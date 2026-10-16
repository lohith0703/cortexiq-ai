
from functools import lru_cache
from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer


MODEL_DIR = (
    Path(__file__).resolve().parent.parent
    / "models"
    / "minilm-onnx"
)

MODEL_PATH = MODEL_DIR / "onnx" / "model_O1.onnx"
TOKENIZER_PATH = MODEL_DIR / "tokenizer.json"

EMBEDDING_DIMENSION = 384


@lru_cache(maxsize=1)
def get_embedding_model():
    """
    Load the ONNX embedding model once.
    """
    if not MODEL_PATH.is_file():
        raise FileNotFoundError(
            f"ONNX embedding model not found: {MODEL_PATH}"
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
def get_tokenizer():
    """
    Load the MiniLM tokenizer once.
    """
    if not TOKENIZER_PATH.is_file():
        raise FileNotFoundError(
            f"Tokenizer not found: {TOKENIZER_PATH}"
        )

    tokenizer = Tokenizer.from_file(
        str(TOKENIZER_PATH)
    )

    tokenizer.enable_truncation(max_length=256)

    return tokenizer


def generate_embeddings(
    texts: list[str],
) -> list[list[float]]:
    """
    Generate normalized 384-dimensional
    sentence embeddings using ONNX.
    """

    if not texts:
        return []

    if any(
        not isinstance(text, str)
        or not text.strip()
        for text in texts
    ):
        raise ValueError(
            "All texts must be non-empty."
        )

    model = get_embedding_model()
    tokenizer = get_tokenizer()

    all_embeddings = []
    batch_size = 16

    available_inputs = {
        item.name for item in model.get_inputs()
    }

    for start in range(0, len(texts), batch_size):
        batch = texts[start:start + batch_size]

        encoded = tokenizer.encode_batch(batch)

        # Pad each batch to its longest sequence.
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

        token_embeddings = model.run(
            None, inputs
        )[0]

        # Attention-mask-aware mean pooling.
        mask = attention_mask[
            :, :, None
        ].astype(np.float32)

        pooled = (
            (token_embeddings * mask).sum(axis=1)
            / np.maximum(
                mask.sum(axis=1),
                1e-9,
            )
        )

        # L2 normalization.
        norms = np.linalg.norm(
            pooled,
            axis=1,
            keepdims=True,
        )

        normalized = pooled / np.maximum(
            norms,
            1e-12,
        )

        if normalized.shape[1] != EMBEDDING_DIMENSION:
            raise RuntimeError(
                "Unexpected embedding dimension."
            )

        all_embeddings.extend(
            normalized.astype(
                np.float32
            ).tolist()
        )

    return all_embeddings


def generate_embedding(
    text: str,
) -> list[float]:
    """
    Generate one normalized embedding.
    """

    if not isinstance(text, str) or not text.strip():
        raise ValueError(
            "Text cannot be empty."
        )

    return generate_embeddings([text])[0]
