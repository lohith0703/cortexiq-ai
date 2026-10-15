
import pytest

from app.evidence_matching_service import match_claims_to_sources


def test_successful_matching():
    answer = (
        "The backend uses FastAPI [1]. "
        "The database uses PostgreSQL [2]."
    )

    sources = [
        {
            "citation": "[1]",
            "text": "The API is built with FastAPI.",
        },
        {
            "citation": "[2]",
            "text": "PostgreSQL stores application data.",
        },
    ]

    result = match_claims_to_sources(answer, sources)

    assert result["total_extracted_claims"] == 2
    assert result["matched_count"] == 2
    assert result["unmatched_count"] == 0

    assert result["matched_claims"][0]["citation"] == "[1]"
    assert result["matched_claims"][1]["citation"] == "[2]"


def test_missing_source():
    answer = "The system uses Kubernetes [3]."

    sources = [
        {
            "citation": "[1]",
            "text": "The backend uses FastAPI.",
        }
    ]

    result = match_claims_to_sources(answer, sources)

    assert result["matched_count"] == 0
    assert result["unmatched_count"] == 1
    assert result["unmatched_claims"][0]["citation"] == "[3]"


def test_empty_sources():
    answer = "The backend uses FastAPI [1]."

    result = match_claims_to_sources(answer, [])

    assert result["matched_count"] == 0
    assert result["unmatched_count"] == 1


def test_empty_answer():
    result = match_claims_to_sources(
        "",
        [{"citation": "[1]", "text": "FastAPI backend."}],
    )

    assert result["total_extracted_claims"] == 0
    assert result["matched_count"] == 0


def test_invalid_sources_type():
    with pytest.raises(ValueError):
        match_claims_to_sources(
            "The backend uses FastAPI [1].",
            "invalid",
        )


def test_invalid_source_item():
    with pytest.raises(ValueError):
        match_claims_to_sources(
            "The backend uses FastAPI [1].",
            ["not a dictionary"],
        )


def test_missing_source_text():
    with pytest.raises(ValueError):
        match_claims_to_sources(
            "The backend uses FastAPI [1].",
            [{"citation": "[1]"}],
        )


def test_empty_evidence_is_unmatched():
    answer = "The backend uses FastAPI [1]."

    sources = [
        {
            "citation": "[1]",
            "text": "",
        }
    ]

    result = match_claims_to_sources(answer, sources)

    assert result["matched_count"] == 0
    assert result["unmatched_count"] == 1
