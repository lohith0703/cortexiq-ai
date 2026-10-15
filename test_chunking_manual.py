
from app.chunking import chunk_text


sample_text = " ".join(
    f"word{i}" for i in range(1, 501)
)

chunks = chunk_text(
    text=sample_text,
    chunk_size=200,
    overlap=40,
)

print(f"Total chunks: {len(chunks)}")

for chunk in chunks:
    print(
        f"Chunk {chunk.index + 1}: "
        f"{chunk.word_count} words, "
        f"positions {chunk.start_word}-{chunk.end_word}"
    )
