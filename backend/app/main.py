import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.database.db import Base, engine
from app.database.db import Embedding  # noqa: F401 — register embeddings table
from app.database.migrations.startup import apply_startup_migrations
from app.api.v1 import admin, auth, chat, files
from app.core.network import load_cloudflare_ip_ranges
from app.middleware.security_headers import SecurityHeadersMiddleware

# Import models so SQLAlchemy metadata includes audit_logs and related tables.
from app.schemas import audit_log  # noqa: F401

CHAT_BODY_LIMIT = 1 * 1024 * 1024
FILE_UPLOAD_BODY_LIMIT = 52 * 1024 * 1024
CLOUDFLARE_REFRESH_INTERVAL_SECONDS = 24 * 60 * 60


async def _refresh_cloudflare_ranges_periodically() -> None:
    """Keep Cloudflare origin IP ranges fresh for long-running processes."""
    while True:
        await asyncio.sleep(CLOUDFLARE_REFRESH_INTERVAL_SECONDS)
        await asyncio.to_thread(load_cloudflare_ip_ranges, force=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    apply_startup_migrations()
    await asyncio.to_thread(load_cloudflare_ip_ranges)
    refresh_task = asyncio.create_task(_refresh_cloudflare_ranges_periodically())
    try:
        yield
    finally:
        refresh_task.cancel()
        try:
            await refresh_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)


@app.middleware("http")
async def limit_request_body_size(request: Request, call_next):
    """Per-route-group body size limits (chat vs file uploads)."""
    if request.method in ("POST", "PUT", "PATCH"):
        content_length = request.headers.get("content-length")
        if content_length:
            size = int(content_length)
            path = request.url.path
            api_chat_prefix = f"{settings.API_V1_STR}/chat"

            if path.startswith(f"{api_chat_prefix}/conversations") and path.endswith("/files"):
                if size > FILE_UPLOAD_BODY_LIMIT:
                    return JSONResponse(
                        status_code=413,
                        content={"detail": "Request body too large"},
                    )
            elif path.startswith(api_chat_prefix):
                if size > CHAT_BODY_LIMIT:
                    return JSONResponse(
                        status_code=413,
                        content={"detail": "Request body too large"},
                    )

    return await call_next(request)


# Configure CORS Middleware
_cors_regex = settings.BACKEND_CORS_ORIGIN_REGEX
if settings.BACKEND_CORS_ORIGINS or _cors_regex:
    _cors_kwargs: dict = {
        "allow_origins": [str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }
    if _cors_regex:
        _cors_kwargs["allow_origin_regex"] = _cors_regex
    app.add_middleware(CORSMiddleware, **_cors_kwargs)

app.add_middleware(SecurityHeadersMiddleware)

# Register routing endpoints
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(chat.router, prefix=settings.API_V1_STR)
app.include_router(files.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "message": f"Welcome to the {settings.PROJECT_NAME}!",
        "docs": "/docs",
        "version": "1.0.0",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
