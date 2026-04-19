"""
PDF extraction and text chunking with LangChain's RecursiveCharacterTextSplitter.
"""
from __future__ import annotations

import base64
import io
import logging
import re

from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from config import settings

logger = logging.getLogger(__name__)


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """Extract and clean text from raw PDF bytes."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages: list[str] = []

    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append(text)

    raw = "\n\n".join(pages)

    # Clean up common PDF extraction artifacts
    cleaned = re.sub(r"\x00", "", raw)           # null bytes
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned) # collapse blank lines
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned) # collapse spaces
    cleaned = cleaned.strip()

    return cleaned


def extract_text_from_b64(content_b64: str) -> str:
    pdf_bytes = base64.b64decode(content_b64)
    return extract_text_from_pdf_bytes(pdf_bytes)


def chunk_text(text: str) -> list[str]:
    """
    Split text into overlapping chunks using LangChain's
    RecursiveCharacterTextSplitter (respects paragraph / sentence / word
    boundaries in that order).
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )
    chunks = splitter.split_text(text)
    # Drop very short chunks (headers, page numbers, etc.)
    return [c.strip() for c in chunks if len(c.strip()) > 30]
