from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import inspect, text
from app.config import settings
from app.database.db import Base, engine
from app.api.v1 import auth, chat, files
from app.api.v1.files import MAX_FILE_SIZE

# Automatically create tables in database (useful for SQLite/dev setups)
Base.metadata.create_all(bind=engine)

def _migrate_message_pdf_columns() -> None:
    """Add PDF columns to existing SQLite DBs without recreating tables."""
    insp = inspect(engine)
    if "messages" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("messages")}
    alters: list[str] = []
    if "has_pdf" not in existing:
        alters.append("ALTER TABLE messages ADD COLUMN has_pdf BOOLEAN DEFAULT 0")
    if "pdf_content" not in existing:
        alters.append("ALTER TABLE messages ADD COLUMN pdf_content TEXT")
    if "pdf_filename" not in existing:
        alters.append("ALTER TABLE messages ADD COLUMN pdf_filename VARCHAR(255)")
    if alters:
        with engine.begin() as conn:
            for sql in alters:
                conn.execute(text(sql))


_migrate_message_pdf_columns()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)


@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    if request.method == "POST":
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_FILE_SIZE:
            return JSONResponse(
                status_code=413,
                content={"detail": "File too large. Maximum size is 100MB."},
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

# Register routing endpoints
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(chat.router, prefix=settings.API_V1_STR)
app.include_router(files.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "message": f"Welcome to the {settings.PROJECT_NAME}!",
        "docs": "/docs",
        "version": "1.0.0"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}
