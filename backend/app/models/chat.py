from typing import Optional

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class Source(BaseModel):
    doc_id: str
    filename: str
    chunk_index: int
    score: float
    text_preview: str


class ChatResponse(BaseModel):
    response: str
    sources: list[Source]
    session_id: str
