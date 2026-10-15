
import pytest

from app.chunking import chunk_text


def test_empty_document():
    assert chunk_text("") == []


def test_short_document():
    chunks = chunk_text(
        "CortexIQ processes enterprise knowledge.",
        chunk_size=10,
        overlap=2,
    )

    assert len(chunks) == 1
    assert chunks[0].word_count == 4


def test_overlapping_chunks():
    text = " ".join(f"word{i}" for i in range(20))

    chunks = chunk_text(
        text,
        chunk_size=10,
        overlap=2,
    )

    assert len(chunks) == 3
    assert chunks[0].text.split()[-2:] == (
        chunks[1].text.split()[:2]
    )


def test_invalid_chunk_configuration():
    with pytest.raises(ValueError):
        chunk_text("sample", chunk_size=0)

    with pytest.raises(ValueError):
        chunk_text("sample", chunk_size=10, overlap=10)
