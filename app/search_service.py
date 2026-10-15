
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.embedding_service import generate_embedding
from app.models import Document, DocumentChunk


def semantic_search(
    db: Session,
    query: str,
    user_id: str,
    limit: int = 5,
) -> list[dict]:
    """
    Search only document chunks owned by the user.

    Security:
    - user_id is required.
    - Ownership is enforced inside the SQL query.
    - Other users' chunks are excluded before ranking.
    """

    if not isinstance(user_id, str) or not user_id.strip():
        raise ValueError("A valid user_id is required.")

    if not isinstance(query, str) or not query.strip():
        raise ValueError("Search query cannot be empty.")

    if not 1 <= limit <= 20:
        raise ValueError("Limit must be between 1 and 20.")

    query_embedding = generate_embedding(query)

    distance = DocumentChunk.embedding.cosine_distance(
        query_embedding
    )

    statement = (
        select(
            DocumentChunk,
            Document.filename,
            distance.label("distance"),
        )
        .join(
            Document,
            Document.id == DocumentChunk.document_id,
        )
        .where(
            Document.owner_id == user_id
        )
        .order_by(distance)
        .limit(limit)
    )

    results = db.execute(statement).all()

    return [
        {
            "chunk_id": chunk.id,
            "document_id": chunk.document_id,
            "filename": filename,
            "chunk_index": chunk.chunk_index,
            "text": chunk.text,
            "similarity_score": round(
                1.0 - float(distance_value),
                4,
            ),
        }
        for chunk, filename, distance_value in results
    ]
