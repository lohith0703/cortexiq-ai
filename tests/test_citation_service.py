
from app.citation_service import validate_citations


# TEST 1: VALID CITATION
def test_valid_citation():
    answer = "Jahnavi knows PostgreSQL [1]."

    sources = [
        {
            "citation": "[1]",
            "text": "PostgreSQL, MySQL, MongoDB"
        },
        {
            "citation": "[2]",
            "text": "Docker, Jenkins, Git"
        }
    ]

    result = validate_citations(
        answer=answer,
        sources=sources
    )

    assert result["has_citations"] is True
    assert result["references_valid"] is True
    assert result["valid_citations"] == ["[1]"]
    assert result["invalid_citations"] == []
    assert result["unused_citations"] == ["[2]"]


# TEST 2: INVALID CITATION
def test_invalid_citation():
    answer = "Jahnavi knows PostgreSQL [5]."

    sources = [
        {
            "citation": "[1]",
            "text": "PostgreSQL, MySQL, MongoDB"
        },
        {
            "citation": "[2]",
            "text": "Docker, Jenkins, Git"
        }
    ]

    result = validate_citations(
        answer=answer,
        sources=sources
    )

    assert result["has_citations"] is True
    assert result["references_valid"] is False
    assert result["valid_citations"] == []
    assert result["invalid_citations"] == ["[5]"]
    assert result["unused_citations"] == ["[1]", "[2]"]


# TEST 3: DUPLICATE CITATIONS
def test_duplicate_citations():
    answer = (
        "Jahnavi knows PostgreSQL [1]. "
        "She also knows MySQL [1]. "
        "She uses MongoDB [1]."
    )

    sources = [
        {
            "citation": "[1]",
            "text": "PostgreSQL, MySQL, MongoDB"
        }
    ]

    result = validate_citations(
        answer=answer,
        sources=sources
    )

    assert result["has_citations"] is True
    assert result["references_valid"] is True
    assert result["valid_citations"] == ["[1]"]
    assert result["citation_count"] == 1
    assert result["invalid_citations"] == []
    assert result["unused_citations"] == []


# TEST 4: MISSING CITATIONS
def test_missing_citations():
    answer = "Jahnavi knows PostgreSQL and MySQL."

    sources = [
        {
            "citation": "[1]",
            "text": "PostgreSQL, MySQL"
        },
        {
            "citation": "[2]",
            "text": "Docker and Jenkins"
        }
    ]

    result = validate_citations(
        answer=answer,
        sources=sources
    )

    assert result["has_citations"] is False
    assert result["references_valid"] is False
    assert result["valid_citations"] == []
    assert result["invalid_citations"] == []
    assert result["unused_citations"] == ["[1]", "[2]"]
    assert result["citation_count"] == 0


import pytest


def test_empty_sources():
    answer = "No information found."

    result = validate_citations(
        answer=answer,
        sources=[]
    )

    assert result["has_citations"] is False
    assert result["references_valid"] is False
    assert result["invalid_citations"] == []
    assert result["citation_count"] == 0


def test_zero_citation():
    answer = "Jahnavi knows PostgreSQL [0]."

    sources = [
        {
            "citation": "[1]",
            "text": "PostgreSQL and MySQL"
        }
    ]

    result = validate_citations(
        answer=answer,
        sources=sources
    )

    assert result["references_valid"] is False
    assert result["invalid_citations"] == ["[0]"]


def test_invalid_answer_type():
    with pytest.raises(ValueError):
        validate_citations(
            answer=None,
            sources=[]
        )
