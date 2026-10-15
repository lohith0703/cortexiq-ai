
import pytest

from app.claim_extraction_service import extract_claims


def test_single_claim():
    answer = "The application uses PostgreSQL [1]."

    result = extract_claims(answer)

    assert result == [
        {
            "claim": "The application uses PostgreSQL.",
            "citation": "[1]",
        }
    ]


def test_multiple_claims():
    answer = (
        "The application uses PostgreSQL [1]. "
        "The backend uses FastAPI [2]."
    )

    result = extract_claims(answer)

    assert len(result) == 2
    assert result[0]["citation"] == "[1]"
    assert result[1]["citation"] == "[2]"


def test_duplicate_citations():
    answer = "The backend uses FastAPI [1] [1]."

    result = extract_claims(answer)

    assert len(result) == 1
    assert result[0]["citation"] == "[1]"


def test_multiple_citations():
    answer = "The backend uses FastAPI [1] [2]."

    result = extract_claims(answer)

    assert len(result) == 2
    assert result[0]["citation"] == "[1]"
    assert result[1]["citation"] == "[2]"


def test_no_citations():
    answer = "The backend uses FastAPI."

    result = extract_claims(answer)

    assert result == []


def test_empty_answer():
    assert extract_claims("") == []


def test_invalid_answer_type():
    with pytest.raises(ValueError):
        extract_claims(None)
