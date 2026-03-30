def recursive_chunk(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50,
    separators: list[str] | None = None,
) -> list[str]:
    if separators is None:
        separators = ["\n\n", "\n", ". ", " "]

    if len(text) <= chunk_size:
        stripped = text.strip()
        return [stripped] if stripped else []

    # Find the best separator that produces splits
    for sep in separators:
        if sep in text:
            parts = text.split(sep)
            break
    else:
        # No separator found — hard split by chunk_size
        chunks = []
        for i in range(0, len(text), chunk_size - overlap):
            chunk = text[i : i + chunk_size].strip()
            if chunk:
                chunks.append(chunk)
        return chunks

    # Merge parts into chunks respecting chunk_size
    chunks = []
    current = ""
    for part in parts:
        candidate = (current + sep + part) if current else part
        if len(candidate) <= chunk_size:
            current = candidate
        else:
            if current.strip():
                chunks.append(current.strip())
            # If the part itself is too large, recursively chunk it
            if len(part) > chunk_size:
                remaining_seps = separators[separators.index(sep) + 1 :]
                sub_chunks = recursive_chunk(part, chunk_size, overlap, remaining_seps)
                chunks.extend(sub_chunks)
                current = ""
            else:
                current = part

    if current.strip():
        chunks.append(current.strip())

    # Apply overlap
    if overlap > 0 and len(chunks) > 1:
        overlapped = [chunks[0]]
        for i in range(1, len(chunks)):
            prev_tail = chunks[i - 1][-overlap:]
            overlapped.append(prev_tail + chunks[i])
        chunks = overlapped

    return chunks
