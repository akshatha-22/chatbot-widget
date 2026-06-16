# Production image for Railway / Docker.
# Railway: set Root Directory = backend (this folder).

FROM python:3.12-slim-bookworm

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-ci-core.txt requirements-docker.txt ./

RUN pip install --upgrade pip setuptools wheel \
    && pip install -r requirements-docker.txt

COPY alembic.ini ./
COPY docker-entrypoint.sh ./
COPY app ./app

RUN mkdir -p data/uploads \
    && chmod +x docker-entrypoint.sh

EXPOSE 8000

CMD ["./docker-entrypoint.sh"]
