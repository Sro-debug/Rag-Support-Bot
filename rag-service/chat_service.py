"""
Chat service — RAG retrieval + Ollama streaming via SSE.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncGenerator

import ollama as ollama_sdk

from config import settings
from schemas import HistoryMessage, SourceChunk
from vector_store import query_similar

logger = logging.getLogger(__name__)


def _build_system_prompt(sources: list[SourceChunk]) -> str:
    if not sources:
        return (
            "You are a helpful customer support assistant. "
            "You have no relevant documents for this query. "
            "Politely tell the user you could not find the answer in the knowledge base "
            "and suggest they contact support directly."
        )

    context_blocks = "\n\n---\n\n".join(
        f"[Source {i + 1} — {s.filename}]\n{s.chunk}"
        for i, s in enumerate(sources)
    )

    return f"""You are a helpful customer support assistant. \
Answer questions based ONLY on the context provided below. \
If the answer is not clearly in the context, say so and suggest contacting support. \
Be concise, friendly, and accurate. Cite source filenames when useful.

CONTEXT:
{context_blocks}"""


async def stream_rag_response(
    message: str,
    history: list[HistoryMessage],
    top_k: int = 5,
) -> AsyncGenerator[str, None]:
    """
    Async generator that yields SSE-formatted strings:
      data: {"type": "sources", "sources": [...]}
      data: {"type": "token",   "token":   "..."}
      data: {"type": "done"}
    """
    # 1. Retrieve relevant chunks
    sources = await query_similar(message, top_k=top_k)

    # 2. Emit sources event first so the frontend can display them immediately
    yield f"data: {json.dumps({'type': 'sources', 'sources': [s.model_dump() for s in sources]})}\n\n"

    # 3. Build message list for Ollama
    system_prompt = _build_system_prompt(sources)
    messages: list[dict] = [{"role": "system", "content": system_prompt}]

    # Include last 6 turns of history for context
    for h in history[-6:]:
        messages.append({"role": h.role, "content": h.content})

    messages.append({"role": "user", "content": message})

    # 4. Stream from Ollama
    try:
        client = ollama_sdk.Client(host=settings.ollama_url)
        loop = asyncio.get_event_loop()

        # ollama-python's stream is synchronous; run in thread pool
        def _sync_stream():
            return client.chat(
                model=settings.chat_model,
                messages=messages,
                stream=True,
            )

        stream = await loop.run_in_executor(None, _sync_stream)

        for part in stream:
            token: str = part["message"]["content"]
            if token:
                yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

    except Exception as exc:
        logger.exception("Ollama streaming error: %s", exc)
        yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"
