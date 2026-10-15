
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.embedding_service import generate_embedding
from app.models import Document, DocumentChunk


# Starting threshold for cosine similarity.
# This must be calibrated against your embedding model
# and representative relevant/irrelevant test queries.
MIN_SEMANTIC_SIMILARITY = 0.35


def hybrid_search(
    db: Session,
    query: str,
    user_id: str,
    limit: int = 5,
    semantic_weight: float = 0.7,
) -> list[dict]:
    """
    Owner-scoped hybrid retrieval using Reciprocal Rank Fusion.

    Features:
    - Semantic similarity filtering
    - PostgreSQL full-text keyword retrieval
    - Reciprocal Rank Fusion
    - Database-level document ownership filtering
    - Empty results when neither retrieval path finds
      sufficiently relevant candidates
    """

    if not isinstance(user_id, str) or not user_id.strip():
        raise ValueError("A valid user_id is required.")

    if not isinstance(query, str) or not query.strip():
        raise ValueError("Search query cannot be empty.")

    if not 1 <= limit <= 20:
        raise ValueError("Limit must be between 1 and 20.")

    if not 0 <= semantic_weight <= 1:
        raise ValueError(
            "semantic_weight must be between 0 and 1."
        )

    candidate_limit = max(20, limit * 4)

    query_embedding = generate_embedding(query)

    # --------------------------------------------------------
    # SEMANTIC RETRIEVAL
    # --------------------------------------------------------

    distance = DocumentChunk.embedding.cosine_distance(
        query_embedding
    )

    # Cosine similarity = 1 - cosine distance.
    similarity = 1.0 - distance

    semantic_stmt = (
        select(
            DocumentChunk,
            Document.filename,
            similarity.label("similarity"),
        )
        .join(
            Document,
            Document.id == DocumentChunk.document_id,
        )
        .where(
            Document.owner_id == user_id,
            DocumentChunk.embedding.is_not(None),
            similarity >= MIN_SEMANTIC_SIMILARITY,
        )
        .order_by(distance.asc())
        .limit(candidate_limit)
    )

    semantic_results = db.execute(
        semantic_stmt
    ).all()

    # --------------------------------------------------------
    # KEYWORD RETRIEVAL
    # --------------------------------------------------------

    search_vector = func.to_tsvector(
        "english",
        DocumentChunk.text,
    )

    search_query = func.plainto_tsquery(
        "english",
        query,
    )

    keyword_stmt = (
        select(
            DocumentChunk,
            Document.filename,
        )
        .join(
            Document,
            Document.id == DocumentChunk.document_id,
        )
        .where(
            Document.owner_id == user_id,
            search_vector.op("@@")(search_query),
        )
        .order_by(
            func.ts_rank(
                search_vector,
                search_query,
            ).desc()
        )
        .limit(candidate_limit)
    )

    keyword_results = db.execute(
        keyword_stmt
    ).all()

    # --------------------------------------------------------
    # RECIPROCAL RANK FUSION
    # --------------------------------------------------------

    rrf_k = 60

    scores: dict = {}
    metadata: dict = {}
    similarities: dict = {}

    for rank, (
        chunk,
        filename,
        semantic_similarity,
    ) in enumerate(semantic_results, start=1):

        scores[chunk.id] = (
            scores.get(chunk.id, 0.0)
            + semantic_weight / (rrf_k + rank)
        )

        metadata[chunk.id] = (chunk, filename)

        similarities[chunk.id] = float(
            semantic_similarity
        )

    keyword_weight = 1.0 - semantic_weight

    for rank, (chunk, filename) in enumerate(
        keyword_results,
        start=1,
    ):
        scores[chunk.id] = (
            scores.get(chunk.id, 0.0)
            + keyword_weight / (rrf_k + rank)
        )

        metadata[chunk.id] = (chunk, filename)

    # --------------------------------------------------------
    # FINAL RANKING
    # --------------------------------------------------------

    ranked_ids = sorted(
        scores,
        key=lambda chunk_id: scores[chunk_id],
        reverse=True,
    )[:limit]

    results = []

    for chunk_id in ranked_ids:
        chunk, filename = metadata[chunk_id]

        results.append(
            {
                "chunk_id": chunk_id,
                "document_id": chunk.document_id,
                "filename": filename,
                "chunk_index": chunk.chunk_index,
                "text": chunk.text,
                "rrf_score": round(
                    scores[chunk_id],
                    6,
                ),
                "semantic_similarity": (
                    round(similarities[chunk_id], 4)
                    if chunk_id in similarities
                    else None
                ),
            }
        )

    return results
