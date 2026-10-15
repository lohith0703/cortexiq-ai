
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.dialects import postgresql

from app.hybrid_search import hybrid_search
from app.rag_service import answer_question
from app.search_service import semantic_search


USER_A = "user-a-123"
USER_B = "user-b-456"


def compile_sql(statement):
    """Compile SQL so we can inspect its ownership filters."""
    return str(
        statement.compile(
            dialect=postgresql.dialect()
        )
    )


def test_semantic_search_requires_user_id():
    db = MagicMock()

    with pytest.raises(TypeError):
        semantic_search(
            db=db,
            query="confidential information",
        )


def test_hybrid_search_requires_user_id():
    db = MagicMock()

    with pytest.raises(TypeError):
        hybrid_search(
            db=db,
            query="confidential information",
        )


def test_rag_requires_user_id():
    db = MagicMock()

    with pytest.raises(TypeError):
        answer_question(
            db=db,
            question="What is confidential?",
        )


@patch(
    "app.search_service.generate_embedding",
    return_value=[0.0] * 384,
)
def test_semantic_search_filters_by_owner(mock_embedding):
    db = MagicMock()
    db.execute.return_value.all.return_value = []

    semantic_search(
        db=db,
        query="enterprise security",
        user_id=USER_A,
    )

    statement = db.execute.call_args.args[0]
    sql = compile_sql(statement)

    assert "owner_id" in sql
    assert USER_A in statement.compile(
        dialect=postgresql.dialect(),
        compile_kwargs={"literal_binds": True},
    ).string



@patch(
    "app.hybrid_search.generate_embedding",
    return_value=[0.0] * 384,
)
def test_hybrid_search_filters_both_queries(mock_embedding):
    db = MagicMock()
    db.execute.return_value.all.return_value = []

    hybrid_search(
        db=db,
        query="enterprise security",
        user_id=USER_A,
    )

    # Hybrid search must execute two queries:
    # 1. Semantic vector search
    # 2. PostgreSQL full-text keyword search
    assert db.execute.call_count == 2

    for call in db.execute.call_args_list:
        statement = call.args[0]

        # Compile using parameterized SQL.
        # Do not use literal_binds=True because
        # PostgreSQL REGCONFIG cannot render
        # the "english" configuration as a literal.
        compiled = statement.compile(
            dialect=postgresql.dialect()
        )

        sql = str(compiled)
        parameters = compiled.params

        # Verify ownership filtering is present.
        assert "documents.owner_id" in sql

        # Verify the current user's ID is passed
        # as a bound SQL parameter.
        assert USER_A in parameters.values()



@patch("app.rag_service.hybrid_search")
def test_rag_passes_user_id_to_retrieval(mock_search):
    db = MagicMock()
    mock_search.return_value = []

    answer_question(
        db=db,
        question="What is CortexIQ?",
        user_id=USER_A,
    )

    assert mock_search.call_args.kwargs["user_id"] == USER_A


@patch("app.rag_service.hybrid_search")
def test_rag_does_not_generate_without_results(mock_search):
    db = MagicMock()
    mock_search.return_value = []

    with patch("app.rag_service.generate_answer") as mock_llm:
        response = answer_question(
            db=db,
            question="What is private?",
            user_id=USER_B,
        )

        mock_llm.assert_not_called()

    assert response["sources"] == []
