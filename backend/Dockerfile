# Production image for Railway / Docker.
# Railway: set Root Directory = backend (this folder).

FROM python:3.12-slim-bookworm

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONUNBUFFERED=1 \
    CUDA_VISIBLE_DEVICES=-1 \
    HF_HOME=/app/data/huggingface

WORKDIR /app

# faiss-cpu runtime + psycopg2 build helpers
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-ci-core.txt requirements-docker.txt ./

# Layer 1 — FastAPI, SQLAlchemy, file parsers (no torch)
RUN pip install --upgrade pip setuptools wheel \
    && pip install -r requirements-docker.txt

# Layer 2 — CPU-only PyTorch (MUST come before sentence-transformers)
# Default pip torch pulls CUDA wheels (~2GB+) and often OOMs Railway builds.
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu

# Layer 3 — embeddings (uses CPU torch already installed)
RUN pip install "sentence-transformers>=2.7.0"

COPY app ./app

RUN mkdir -p data/uploads data/vector_store data/huggingface

EXPOSE 8000

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
