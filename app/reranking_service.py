
from functools import lru_cache
from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer


RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L6-v2"

MODEL_DIR = (
    Path(__file__).resolve().parent.parent
    / "models"
    / "reranker-onnx"
)

MODEL_PATH = MODEL_DIR / "onnx" / "model_O1.onnx"
TOKENIZER_PATH = MODEL_DIR / "tokenizer.json"


@lru_cache(maxsize=1)
def get_reranker():
    """
    Load the ONNX reranking model once.
    """
    if not MODEL_PATH.is_file():
        raise FileNotFoundError(
            f"ONNX reranker not found: {MODEL_PATH}"
        )

    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1

    return ort.InferenceSession(
        str(MODEL_PATH),
        sess_options=options,
        providers=["CPUExecutionProvider"],
    )


@lru_cache(maxsize=1)
def get_reranker_tokenizer():
    """
    Load the reranker tokenizer once.
    """
    if not TOKENIZER_PATH.is_file():
        raise FileNotFoundError(
            f"Reranker tokenizer not found: {TOKENIZER_PATH}"
        )

    tokenizer = Tokenizer.from_file(
        str(TOKENIZER_PATH)
    )

    tokenizer.enable_truncation(max_length=512)

    return tokenizer


def rerank_results(
    query: str,
    results: list[dict],
    top_k: int = 3,
) -> list[dict]:
    """
    Rerank candidate passages using the
    ONNX MiniLM cross-encoder.
    """

    if not isinstance(query, str) or not query.strip():
        raise ValueError("Query cannot be empty.")

    if not 1 <= top_k <= 20:
        raise ValueError(
            "top_k must be between 1 and 20."
        )

    if not results:
        return []

    model = get_reranker()
    tokenizer = get_reranker_tokenizer()

    available_inputs = {
        item.name for item in model.get_inputs()
    }

    scored_results = []
    batch_size = 8

    for start in range(0, len(results), batch_size):
        batch = results[start:start + batch_size]

        pairs = [
            (query, result["text"])
            for result in batch
        ]

        encoded = tokenizer.encode_batch(pairs)

        max_length = max(
            len(item.ids) for item in encoded
        )

        input_ids = np.asarray(
            [
                item.ids
                + [0] * (max_length - len(item.ids))
                for item in encoded
            ],
            dtype=np.int64,
        )

        attention_mask = np.asarray(
            [
                item.attention_mask
                + [0] * (
                    max_length
                    - len(item.attention_mask)
                )
                for item in encoded
            ],
            dtype=np.int64,
        )

        token_type_ids = np.asarray(
            [
                item.type_ids
                + [0] * (
                    max_length
                    - len(item.type_ids)
                )
                for item in encoded
            ],
            dtype=np.int64,
        )

        inputs = {
            "input_ids": input_ids,
            "attention_mask": attention_mask,
            "token_type_ids": token_type_ids,
        }

        inputs = {
            key: value
            for key, value in inputs.items()
            if key in available_inputs
        }

        scores = np.asarray(
            model.run(None, inputs)[0]
        ).reshape(-1)

        for result, score in zip(batch, scores):
            scored_results.append(
                {
                    **result,
                    "rerank_score": float(score),
                }
            )

    scored_results.sort(
        key=lambda item: item["rerank_score"],
        reverse=True,
    )

    return scored_results[:top_k]
