/**
 * ragClient.ts
 * TypeScript proxy that talks to the Python RAG microservice.
 * Replaces the old vectorStore / chatService / pdfService modules.
 */

import fs from "fs/promises";
import { Response } from "express";
import { SourceChunk } from "../types";

const RAG_URL = process.env.RAG_SERVICE_URL || "http://rag-service:8080";

// ── Ingest ────────────────────────────────────────────────────────────────────

export async function ingestDocument(
  filePath: string,
  documentId: string,
  filename: string
): Promise<number> {
  const fileBuffer = await fs.readFile(filePath);
  const contentB64 = fileBuffer.toString("base64");

  const res = await fetch(`${RAG_URL}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      document_id: documentId,
      filename,
      content_b64: contentB64,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as any).detail || "RAG ingest failed");
  }

  const data = (await res.json()) as { chunk_count: number };
  return data.chunk_count;
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteDocument(documentId: string): Promise<void> {
  const res = await fetch(`${RAG_URL}/documents/${documentId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as any).detail || "RAG delete failed");
  }
}

// ── Query (retrieve only) ─────────────────────────────────────────────────────

export async function queryDocuments(
  query: string,
  topK = 5
): Promise<SourceChunk[]> {
  const res = await fetch(`${RAG_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, top_k: topK }),
  });

  if (!res.ok) {
    throw new Error("RAG query failed");
  }

  const data = (await res.json()) as { sources: SourceChunk[] };
  return data.sources;
}

// ── Streaming chat ────────────────────────────────────────────────────────────

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export async function streamChatResponse(
  sessionId: string,
  message: string,
  history: HistoryMessage[],
  expressRes: import("express").Response
): Promise<{ fullResponse: string; sources: SourceChunk[] }> {
  // Set SSE headers on the Express response
  expressRes.setHeader("Content-Type", "text/event-stream");
  expressRes.setHeader("Cache-Control", "no-cache");
  expressRes.setHeader("Connection", "keep-alive");
  expressRes.setHeader("X-Accel-Buffering", "no");
  expressRes.flushHeaders();

  const ragRes = await fetch(`${RAG_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      message,
      history: history.map((h) => ({ role: h.role, content: h.content })),
    }),
  });

  if (!ragRes.ok || !ragRes.body) {
    throw new Error("RAG chat stream failed");
  }

  let fullResponse = "";
  let sources: SourceChunk[] = [];

  // Pipe SSE from Python → Express response
  const reader = ragRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === "sources") {
          sources = event.sources as SourceChunk[];
        } else if (event.type === "token") {
          fullResponse += event.token;
        }
        // Forward every SSE event to the frontend as-is
        expressRes.write(`${line}\n\n`);
      } catch {
        // skip malformed lines
      }
    }
  }

  expressRes.end();
  return { fullResponse, sources };
}
