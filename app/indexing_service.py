
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.chunking import chunk_text
from app.embedding_service import generate_embeddings
from app.models import Document, DocumentChunk


def index_document(
    db: Session,
    document_id: str,
) -> dict:
    document = db.get(Document, document_id)

    if document is None:
        raise ValueError("Document not found.")

    chunks = chunk_text(
        text=document.extracted_text,
        chunk_size=200,
        overlap=40,
    )

    if not chunks:
        raise ValueError(
            "Document contains no extractable text."
        )

    embeddings = generate_embeddings(
        [chunk.text for chunk in chunks]
    )

    # Replace old chunks if the document is reindexed.
    db.execute(
        delete(DocumentChunk).where(
            DocumentChunk.document_id == document_id
        )
    )

    for chunk, embedding in zip(
        chunks, embeddings, strict=True
    ):
        db.add(
            DocumentChunk(
                document_id=document.id,
                chunk_index=chunk.index,
                text=chunk.text,
                word_count=chunk.word_count,
                embedding=embedding,
            )
        )

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "document_id": document.id,
        "filename": document.filename,
        "indexed_chunks": len(chunks),
        "status": "indexed",
    }
