import datetime
from uuid import uuid4
from sqlalchemy import (
    create_engine,
    Column,
    Index,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    UniqueConstraint,
    JSON,
    func,
)
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from app.config import settings


def _engine_connect_args(database_url: str) -> dict:
    """Driver connect_args for SQLite (local) and SSL-required hosts (e.g. Neon)."""
    if database_url.startswith("sqlite"):
        return {"check_same_thread": False}
    if "neon.tech" in database_url:
        return {"sslmode": "require"}
    return {}


engine = create_engine(
    settings.DATABASE_URL,
    connect_args=_engine_connect_args(settings.DATABASE_URL),
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")

class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    files = relationship("UploadedFile", back_populates="conversation", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    has_pdf = Column(Boolean, default=False)
    pdf_content = Column(Text, nullable=True)
    pdf_filename = Column(String(255), nullable=True)
    source = Column(String(50), default="document", nullable=False)
    links = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    conversation = relationship("Conversation", back_populates="messages")

class UploadedFile(Base):
    __tablename__ = "uploaded_files"
    
    id = Column(String(255), primary_key=True, default=lambda: str(uuid4()))
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)   # where you saved it on disk
    status = Column(String(50), default="pending")  # pending → processed
    embedding_model_version = Column(String(100), nullable=True)
    raw_text_blob = Column(Text, nullable=True)
    processing_error = Column(Text, nullable=True)
    status_detail = Column(Text, nullable=True)
    pdf_page_count = Column(Integer, nullable=True)
    indexed_page_count = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    conversation = relationship("Conversation", back_populates="files")
    embeddings = relationship(
        "Embedding",
        back_populates="uploaded_file",
        cascade="all, delete-orphan",
    )


class Embedding(Base):
    __tablename__ = "embeddings"

    id = Column(Integer, primary_key=True)
    file_id = Column(
        String(255),
        ForeignKey("uploaded_files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_text = Column(Text)
    embedding = Column(Text)
    chunk_index = Column(Integer)
    page = Column(Integer, default=1)
    created_at = Column(DateTime, server_default=func.now())

    uploaded_file = relationship("UploadedFile", back_populates="embeddings")


class GeminiDailyUsage(Base):
    __tablename__ = "gemini_daily_usage"
    __table_args__ = (
        UniqueConstraint("user_id", "usage_date", name="uq_gemini_usage_user_date"),
        Index("ix_gemini_daily_usage_user_date", "user_id", "usage_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    usage_date = Column(String(10), nullable=False)  # YYYY-MM-DD UTC
    call_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

# Dependency to get db session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
