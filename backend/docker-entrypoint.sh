#!/bin/sh
set -e

PORT="${PORT:-8000}"

echo "[startup] Validating configuration..."
python -c "from app.config import settings; print(f'  ENVIRONMENT={settings.ENVIRONMENT}')"

echo "[startup] Ensuring base ORM tables exist..."
python -c "from app.database.db import Base, engine; Base.metadata.create_all(bind=engine)"

echo "[startup] Running alembic upgrade head..."
alembic upgrade head

echo "[startup] Starting uvicorn on 0.0.0.0:${PORT}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}"
