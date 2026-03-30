import fitz  # PyMuPDF
from docx import Document
import chardet


def extract_pdf(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    text_parts = []
    for page in doc:
        text_parts.append(page.get_text())
    doc.close()
    return "\n".join(text_parts)


def extract_docx(file_bytes: bytes) -> str:
    import io
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


def extract_txt(file_bytes: bytes) -> str:
    detected = chardet.detect(file_bytes)
    encoding = detected.get("encoding", "utf-8") or "utf-8"
    return file_bytes.decode(encoding)


def extract_text(file_bytes: bytes, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    match ext:
        case "pdf":
            return extract_pdf(file_bytes)
        case "docx":
            return extract_docx(file_bytes)
        case "txt":
            return extract_txt(file_bytes)
        case _:
            raise ValueError(f"Unsupported file type: .{ext}")
