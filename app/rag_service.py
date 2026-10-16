
from sqlalchemy.orm import Session

from app.hybrid_search import hybrid_search
from app.llm_service import (
    generate_answer,
    rewrite_followup_question,
)
from app.reranking_service import rerank_results
from app.citation_service import validate_citations


MODEL_NAME = "qwen2.5:3b"

NO_ANSWER = (
    "I could not find that information "
    "in the uploaded documents."
)


def answer_question(
    db: Session,
    question: str,
    user_id: str,
    top_k: int = 3,
    verify_evidence: bool = False,
    conversation_history: list[dict[str, str]] | None = None,
) -> dict:
    """
    CortexIQ conversation-aware RAG pipeline.

    Steps:
    1. Resolve follow-up questions using conversation history.
    2. Retrieve documents belonging to the authenticated user.
    3. Rerank retrieved passages using the ONNX cross-encoder.
    4. Build citation-numbered evidence context.
    5. Generate a document-grounded answer.
    6. Validate citation references.
    7. Optionally run experimental evidence verification.

    Conversation history helps clarify questions but is never
    treated as independent factual evidence.
    """

    if not isinstance(user_id, str) or not user_id.strip():
        raise ValueError("A valid user_id is required.")

    if not isinstance(question, str) or not question.strip():
        raise ValueError("Question cannot be empty.")

    if not isinstance(top_k, int) or not 1 <= top_k <= 5:
        raise ValueError("top_k must be between 1 and 5.")

    original_question = question.strip()

    # Resolve follow-up questions into standalone queries.
    retrieval_query = original_question

    if conversation_history:
        retrieval_query = rewrite_followup_question(
            question=original_question,
            history=conversation_history,
        )

    # Retrieve candidate passages belonging only to this user.
    candidates = hybrid_search(
        db=db,
        query=retrieval_query,
        user_id=user_id,
        limit=max(10, top_k),
        semantic_weight=0.7,
    )

    if not candidates:
        return {
            "question": original_question,
            "answer": NO_ANSWER,
            "sources": [],
            "model": MODEL_NAME,
            "citation_validation": validate_citations(
                NO_ANSWER,
                [],
            ),
            "evidence_verification": None,
        }

    # Rerank candidates using the standalone retrieval query.
    results = rerank_results(
        query=retrieval_query,
        results=candidates,
        top_k=top_k,
    )

    if not results:
        return {
            "question": original_question,
            "answer": NO_ANSWER,
            "sources": [],
            "model": MODEL_NAME,
            "citation_validation": validate_citations(
                NO_ANSWER,
                [],
            ),
            "evidence_verification": None,
        }

    # Build citation-numbered evidence context.
    context_parts = []

    for index, result in enumerate(results, start=1):
        context_parts.append(
            f"[{index}]\n"
            f"Document: {result['filename']}\n"
            f"Chunk ID: {result['chunk_id']}\n"
            f"Content:\n{result['text']}"
        )

    context = "\n\n".join(context_parts)

    # Generate an answer using retrieved document evidence.
    answer = generate_answer(
        question=retrieval_query,
        context=context,
    )

    # Preserve the existing frontend source response format.
    sources = []

    for index, result in enumerate(results, start=1):
        sources.append(
            {
                "citation": f"[{index}]",
                "document_id": result["document_id"],
                "filename": result["filename"],
                "chunk_id": result["chunk_id"],
                "text": result["text"],
            }
        )

    # Validate the citations returned by the LLM.
    citation_validation = validate_citations(
        answer=answer,
        sources=sources,
    )

    evidence_verification = None

    # Lazy import prevents loading the NLI dependency
    # during normal RAG requests.
    if verify_evidence:
        try:
            from app.verification_pipeline import (
                run_verification_pipeline,
            )

            evidence_verification = run_verification_pipeline(
                answer=answer,
                sources=sources,
            )

        except Exception:
            evidence_verification = {
                "verification_type": "experimental_nli",
                "status": "error",
                "error": (
                    "Evidence verification could not "
                    "be completed."
                ),
            }

    return {
        "question": original_question,
        "answer": answer,
        "sources": sources,
        "model": MODEL_NAME,
        "citation_validation": citation_validation,
        "evidence_verification": evidence_verification,
    }
