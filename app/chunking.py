
from dataclasses import dataclass


@dataclass(frozen=True)
class TextChunk:
    index: int
    text: str
    word_count: int
    start_word: int
    end_word: int


def chunk_text(
    text: str,
    chunk_size: int = 200,
    overlap: int = 40,
) -> list[TextChunk]:
    """
    Split a document into overlapping word-based chunks.

    chunk_size: Maximum words per chunk.
    overlap: Number of words shared by adjacent chunks.
    """

    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")

    if overlap < 0 or overlap >= chunk_size:
        raise ValueError(
            "overlap must be non-negative and smaller than chunk_size"
        )

    words = text.split()

    if not words:
        return []

    chunks = []
    step = chunk_size - overlap

    for start in range(0, len(words), step):
        end = min(start + chunk_size, len(words))
        selected_words = words[start:end]

        chunks.append(
            TextChunk(
                index=len(chunks),
                text=" ".join(selected_words),
                word_count=len(selected_words),
                start_word=start,
                end_word=end,
            )
        )

        if end == len(words):
            break

    return chunks
