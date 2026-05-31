from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from app.config import settings
from app.database.db import Base, engine
from app.api.v1 import auth, chat, files

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

# Configure CORS Middleware
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

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
