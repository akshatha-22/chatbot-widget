#!/usr/bin/env python3
"""
Diagnose Gemini embedding API access using the same SDK path as production (google.genai).

Usage (from repo root or backend/):
  cd backend
  python scripts/diagnose_embeddings.py

Reads GEMINI_API_KEY from ../.env.local or environment.
Never prints the full API key.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))

try:
    from dotenv import load_dotenv

    for env_file in (ROOT / ".env.local", ROOT / ".env", BACKEND / ".env.local"):
        if env_file.is_file():
            load_dotenv(env_file)
            print(f"Loaded env from {env_file}")
            break
except ImportError:
    pass

API_KEY = (os.environ.get("GEMINI_API_KEY") or "").strip()
EMBEDDING_MODEL = (os.environ.get("EMBEDDING_MODEL") or "gemini-embedding-001").strip()
EMBEDDING_MODEL = EMBEDDING_MODEL.removeprefix("models/")


def _key_preview(key: str) -> str:
    if len(key) < 12:
        return "(too short or missing)"
    return f"{key[:6]}…{key[-4:]}"


def list_embedding_models_genai() -> None:
    print("\n=== google.genai — embedding models ===")
    try:
        from google import genai

        client = genai.Client(api_key=API_KEY)
        for model in client.models.list():
            name = getattr(model, "name", "") or str(model)
            if "embed" in name.lower():
                print(f"  {name}")
    except Exception as exc:
        print(f"  FAILED: {type(exc).__name__}: {exc}")


def test_production_embed_path() -> None:
    """Same call path as vector_store_service._get_embeddings_batch."""
    print("\n=== google.genai embed (production path) ===")
    print(f"  model={EMBEDDING_MODEL!r}  key={_key_preview(API_KEY)}")

    if not API_KEY:
        print("  SKIPPED: GEMINI_API_KEY not set")
        return

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=API_KEY)
        config = types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=768,
        )
        response = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=["test sentence for embedding"],
            config=config,
        )
        embeddings = getattr(response, "embeddings", None) or []
        if not embeddings:
            print("  FAILED: response.embeddings is empty")
            print(f"  response={response!r}")
            return
        values = getattr(embeddings[0], "values", None) or []
        print(f"  SUCCESS — vector length={len(values)}")
    except Exception as exc:
        print(f"  FAILED: {type(exc).__name__}: {exc}")


def test_legacy_embed_path() -> None:
    print("\n=== google.generativeai embed (legacy SDK) ===")
    if not API_KEY:
        print("  SKIPPED: GEMINI_API_KEY not set")
        return

    try:
        import google.generativeai as genai

        genai.configure(api_key=API_KEY)
        result = genai.embed_content(
            model=f"models/{EMBEDDING_MODEL}",
            content="test sentence for embedding",
            task_type="retrieval_document",
        )
        embedding = result.get("embedding") if isinstance(result, dict) else None
        if embedding:
            print(f"  SUCCESS — vector length={len(embedding)}")
        else:
            print(f"  FAILED: unexpected result shape: {type(result)}")
    except Exception as exc:
        print(f"  FAILED: {type(exc).__name__}: {exc}")


def main() -> int:
    print("Gemini embedding diagnostics")
    print(f"  EMBEDDING_MODEL={EMBEDDING_MODEL!r}")
    print(f"  GEMINI_API_KEY={_key_preview(API_KEY)}")

    list_embedding_models_genai()
    test_production_embed_path()
    test_legacy_embed_path()

    print(
        "\nNote: gemini-embedding-001 is the documented stable model for Google AI "
        "(https://ai.google.dev/gemini-api/docs/embeddings). "
        "Production uses google.genai, not google.generativeai."
    )
    return 0 if API_KEY else 1


if __name__ == "__main__":
    raise SystemExit(main())
