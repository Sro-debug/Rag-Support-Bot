from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional


# ── Ingest ────────────────────────────────────────────────────────────────────

class IngestRequest(BaseModel):
    document_id: str
    filename: str
    # base64-encoded PDF bytes
    content_b64: str


class IngestResponse(BaseModel):
    document_id: str
    chunk_count: int


# ── Delete ────────────────────────────────────────────────────────────────────

class DeleteResponse(BaseModel):
    document_id: str
    deleted_chunks: int


# ── Query ─────────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=20)


class SourceChunk(BaseModel):
    document_id: str
    filename: str
    chunk: str
    score: float


class QueryResponse(BaseModel):
    sources: list[SourceChunk]


# ── Chat ─────────────────────────────────────────────────────────────────────

class HistoryMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    session_id: str
    message: str
    history: list[HistoryMessage] = []
    top_k: int = Field(default=5, ge=1, le=20)
