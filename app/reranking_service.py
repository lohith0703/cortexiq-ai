
from functools import lru_cache

from sentence_transformers import CrossEncoder


RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"


@lru_cache(maxsize=1)
def get_reranker() -> CrossEncoder:
    """
    Load the reranking model only once.
    """
    return CrossEncoder(RERANKER_MODEL)


def rerank_results(
    query: str,
    results: list[dict],
    top_k: int = 3,
) -> list[dict]:
    """
    Rerank hybrid search results based on how
    relevant each passage is to the query.
    """

    if not query.strip():
        raise ValueError("Query cannot be empty.")

    if not 1 <= top_k <= 20:
        raise ValueError("top_k must be between 1 and 20.")

    if not results:
        return []

    # Pair the question with each candidate passage.
    pairs = [
        (query, result["text"])
        for result in results
    ]

    # Generate relevance scores.
    reranker = get_reranker()
    scores = reranker.predict(pairs)

    # Attach scores without changing original results.
    scored_results = []

    for result, score in zip(results, scores):
        scored_results.append(
            {
                **result,
                "rerank_score": float(score),
            }
        )

    # Higher scores indicate greater relevance.
    scored_results.sort(
        key=lambda item: item["rerank_score"],
        reverse=True,
    )

    return scored_results[:top_k]
