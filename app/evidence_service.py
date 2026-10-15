
from functools import lru_cache

import numpy as np
from sentence_transformers import CrossEncoder


MODEL_NAME = "cross-encoder/nli-deberta-v3-small"

VALID_LABELS = {
    "entailment",
    "contradiction",
    "neutral",
}


@lru_cache(maxsize=1)
def get_evidence_model() -> CrossEncoder:
    """Load the NLI model once and reuse it."""
    return CrossEncoder(MODEL_NAME)


def verify_evidence(evidence: str, claim: str) -> dict:
    """Classify whether evidence supports a claim."""

    if not isinstance(evidence, str) or not evidence.strip():
        raise ValueError("Evidence cannot be empty.")

    if not isinstance(claim, str) or not claim.strip():
        raise ValueError("Claim cannot be empty.")

    model = get_evidence_model()

    label_mapping = model.model.config.id2label

    probabilities = model.predict(
        [(evidence, claim)],
        apply_softmax=True,
    )

    scores = np.asarray(probabilities)[0]

    predicted_index = int(np.argmax(scores))
    predicted_label = label_mapping[predicted_index].lower()

    if predicted_label not in VALID_LABELS:
        raise ValueError(
            f"Unexpected model label: {predicted_label}"
        )

    return {
        "claim": claim,
        "prediction": predicted_label,
        "scores": {
            label_mapping[index].lower(): round(
                float(score), 4
            )
            for index, score in enumerate(scores)
        },
        "model": MODEL_NAME,
    }
