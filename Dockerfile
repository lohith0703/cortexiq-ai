
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV TOKENIZERS_PARALLELISM=false

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       libgomp1 \
       libglib2.0-0 \
       ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-cloud.txt .

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir \
       -r requirements-cloud.txt \
       "huggingface-hub>=0.25,<2"

# Download only the required ONNX model files.
# No Hugging Face inference credits are needed.
RUN python - <<'PY'
from huggingface_hub import snapshot_download

snapshot_download(
    repo_id="sentence-transformers/all-MiniLM-L6-v2",
    local_dir="/app/models/minilm-onnx",
    allow_patterns=[
        "onnx/model_O1.onnx",
        "tokenizer.json",
    ],
)

snapshot_download(
    repo_id="cross-encoder/ms-marco-MiniLM-L6-v2",
    local_dir="/app/models/reranker-onnx",
    allow_patterns=[
        "onnx/model_O1.onnx",
        "tokenizer.json",
    ],
)

print("ONNX models downloaded successfully")
PY

COPY app ./app

EXPOSE 7860

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
