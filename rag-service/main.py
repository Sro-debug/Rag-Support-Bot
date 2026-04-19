"""
RAG Microservice — FastAPI
Exposes internal endpoints consumed by the TypeScript Express backend.
Not exposed to the internet directly (internal Docker network only).
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from fastapi.responses import StreamingResponse

from config import settings
from pdf_parser import extract_text_from_b64, chunk_text
from schemas import (
    ChatRequest,
    DeleteResponse,
    IngestRequest,
    IngestResponse,
    QueryRequest,
    QueryResponse,
)
from vector_store import (
    delete_document_chunks,
    get_collection,
    ingest_chunks,
    query_similar,
)
from chat_service import stream_rag_response

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s  %(message)s")
logger = logging.getLogger(__name__)


# ── Lifespan — warm up ChromaDB collection on startup ─────────────────────────

@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        col = get_collection()
        count = col.count()
        logger.info("ChromaDB ready — collection '%s' has %d chunks", settings.collection_name, count)
    except Exception as exc:
        logger.warning("ChromaDB not ready yet: %s", exc)
    yield


app = FastAPI(
    title="RAG Microservice",
    version="1.0.0",
    description="Internal Python RAG service: PDF ingestion, embeddings, retrieval, streaming chat.",
    lifespan=lifespan,
)


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "models": {"chat": settings.chat_model, "embed": settings.embed_model}}


# ── Ingest ─────────────────────────────────────────────────────────────────────

@app.post("/ingest", response_model=IngestResponse, status_code=status.HTTP_201_CREATED)
async def ingest(req: IngestRequest):
    """
    Accepts a base64-encoded PDF, extracts text, chunks it,
    embeds each chunk, and upserts into ChromaDB.
    """
    try:
        text = extract_text_from_b64(req.content_b64)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"PDF extraction failed: {exc}")

    if not text.strip():
        raise HTTPException(status_code=422, detail="No extractable text found in PDF")

    chunks = chunk_text(text)
    if not chunks:
        raise HTTPException(status_code=422, detail="Text chunking produced no usable chunks")

    try:
        count = await ingest_chunks(chunks, req.document_id, req.filename)
    except Exception as exc:
        logger.exception("Ingest error")
        raise HTTPException(status_code=500, detail=f"Ingest error: {exc}")

    return IngestResponse(document_id=req.document_id, chunk_count=count)


# ── Delete ─────────────────────────────────────────────────────────────────────

@app.delete("/documents/{document_id}", response_model=DeleteResponse)
async def delete_document(document_id: str):
    try:
        deleted = await delete_document_chunks(document_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return DeleteResponse(document_id=document_id, deleted_chunks=deleted)


# ── Query (retrieve only, no generation) ──────────────────────────────────────

@app.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest):
    try:
        sources = await query_similar(req.query, top_k=req.top_k)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return QueryResponse(sources=sources)


# ── Chat (RAG + streaming generation) ─────────────────────────────────────────

@app.post("/chat")
async def chat(req: ChatRequest):
    """
    Returns a text/event-stream SSE response:
      data: {"type": "sources", "sources": [...]}
      data: {"type": "token",   "token":   "Hello"}
      ...
      data: {"type": "done"}
    """
    return StreamingResponse(
        stream_rag_response(req.message, req.history, top_k=req.top_k),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering
        },
    )
