"""
Vector store layer — ChromaDB + Ollama nomic-embed-text embeddings.
"""
from __future__ import annotations

import asyncio
import logging
from functools import lru_cache
from typing import Any

import chromadb
from chromadb import Collection
import ollama as ollama_sdk

from config import settings
from schemas import SourceChunk

logger = logging.getLogger(__name__)


# ── Chroma client (lazy singleton) ───────────────────────────────────────────

@lru_cache(maxsize=1)
def _chroma_client() -> chromadb.HttpClient:
    # chromadb.HttpClient expects host and port separately
    from urllib.parse import urlparse
    parsed = urlparse(settings.chroma_url)
    return chromadb.HttpClient(
        host=parsed.hostname or "chromadb",
        port=parsed.port or 8000,
    )


def get_collection() -> Collection:
    client = _chroma_client()
    return client.get_or_create_collection(
        name=settings.collection_name,
        metadata={"hnsw:space": "cosine"},
    )


# ── Embeddings ────────────────────────────────────────────────────────────────

def _ollama_client() -> ollama_sdk.Client:
    return ollama_sdk.Client(host=settings.ollama_url)


def embed_text(text: str) -> list[float]:
    """Synchronous Ollama embedding call."""
    client = _ollama_client()
    response = client.embeddings(
        model=settings.embed_model,
        prompt=text,
    )
    return response["embedding"]


async def embed_text_async(text: str) -> list[float]:
    return await asyncio.get_event_loop().run_in_executor(None, embed_text, text)


# ── Ingest ────────────────────────────────────────────────────────────────────

async def ingest_chunks(
    chunks: list[str],
    document_id: str,
    filename: str,
) -> int:
    """Embed each chunk and upsert into ChromaDB."""
    import uuid

    col = get_collection()
    ids: list[str] = []
    embeddings: list[list[float]] = []
    documents: list[str] = []
    metadatas: list[dict[str, Any]] = []

    for chunk in chunks:
        embedding = await embed_text_async(chunk)
        ids.append(str(uuid.uuid4()))
        embeddings.append(embedding)
        documents.append(chunk)
        metadatas.append({"documentId": document_id, "filename": filename})

    col.add(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)
    logger.info("Ingested %d chunks for document %s", len(chunks), document_id)
    return len(chunks)


async def delete_document_chunks(document_id: str) -> int:
    col = get_collection()
    results = col.get(where={"documentId": document_id})
    chunk_ids: list[str] = results.get("ids", [])
    if chunk_ids:
        col.delete(ids=chunk_ids)
    logger.info("Deleted %d chunks for document %s", len(chunk_ids), document_id)
    return len(chunk_ids)


# ── Query ─────────────────────────────────────────────────────────────────────

async def query_similar(query: str, top_k: int = 5) -> list[SourceChunk]:
    embedding = await embed_text_async(query)
    col = get_collection()

    results = col.query(
        query_embeddings=[embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )

    chunks: list[SourceChunk] = []
    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for doc, meta, dist in zip(docs, metas, distances):
        score = 1.0 - float(dist)
        if score < settings.min_score:
            continue
        chunks.append(
            SourceChunk(
                document_id=str(meta.get("documentId", "")),
                filename=str(meta.get("filename", "")),
                chunk=str(doc),
                score=round(score, 4),
            )
        )

    return chunks
