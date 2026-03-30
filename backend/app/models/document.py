from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    doc_id: str
    client_id: str
    filename: str
    file_type: str
    file_size_bytes: int
    status: str
    error_message: Optional[str] = None
    chunks_count: int = 0
    uploaded_at: datetime
    processed_at: Optional[datetime] = None


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int
