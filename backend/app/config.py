from pathlib import Path
from dotenv import load_dotenv
from pydantic import AliasChoices, Field, computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Self

_INSECURE_SECRET_PLACEHOLDER = "super-secret-key-change-in-production-12345"
_TEST_SECRET_KEY = "ci-test-secret-key-not-for-production-min-32-chars"

_DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# backend/app/config.py -> backend/
_BACKEND_DIR = Path(__file__).resolve().parent.parent
# Monorepo root (parent of backend/)
_ROOT_DIR = _BACKEND_DIR.parent


def _resolved_env_files() -> tuple[str, ...]:
    """Dotenv files loaded in order; later files override earlier ones.

    Only paths that exist are included so pydantic-settings behaves the same
    across platforms. Supports either `backend/.env*` or repo-root `.env*`
    (matches Vite `envDir` pointing at the repo root).
    """
    candidates = [
        _BACKEND_DIR / ".env",
        _BACKEND_DIR / ".env.local",
        _ROOT_DIR / ".env",
        _ROOT_DIR / ".env.local",
    ]
    seen: set[str] = set()
    out: list[str] = []
    for p in candidates:
        resolved = p.resolve()
        if not resolved.is_file():
            continue
        key = str(resolved)
        if key not in seen:
            seen.add(key)
            out.append(key)
    return tuple(out)


_EXISTING_ENV_FILES = _resolved_env_files()


def _bootstrap_dotenv() -> None:
    """Load .env files into os.environ before Settings() (works even if only one path exists)."""
    for path in (
        _BACKEND_DIR / ".env",
        _BACKEND_DIR / ".env.local",
        _ROOT_DIR / ".env",
        _ROOT_DIR / ".env.local",
    ):
        if path.is_file():
            load_dotenv(path, override=True)


_bootstrap_dotenv()


class Settings(BaseSettings):
    PROJECT_NAME: str = "Chatbot Widget API"
    API_V1_STR: str = "/api/v1"

    # Security — no insecure default; must be set via env (except automated tests).
    ENVIRONMENT: str = Field(
        default="development",
        validation_alias=AliasChoices("ENVIRONMENT", "APP_ENV"),
    )
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days

    # Rate limiting / cost protection
    GEMINI_DAILY_QUOTA_PER_USER: int = 100

    # Auth brute-force protection (in-memory per IP)
    AUTH_RATE_LIMIT_ENABLED: bool = True
    AUTH_RATE_LIMIT_MAX_ATTEMPTS: int = 5
    AUTH_RATE_LIMIT_WINDOW_SECONDS: int = 60

    # When True, only trust CF-Connecting-IP from known Cloudflare origin IPs.
    CLOUDFLARE_ONLY: bool = False

    # Response cache (in-process TTLCache — no Redis)
    RESPONSE_CACHE_ENABLED: bool = True
    RESPONSE_CACHE_TTL_SECONDS: int = 3600
    RESPONSE_CACHE_MAX_SIZE: int = 500

    @model_validator(mode="after")
    def require_secret_key(self) -> Self:
        env = (self.ENVIRONMENT or "development").strip().lower()
        key = (self.SECRET_KEY or "").strip()

        if key == _INSECURE_SECRET_PLACEHOLDER:
            key = ""

        if env in ("test", "testing"):
            if not key or len(key) < 32:
                object.__setattr__(self, "SECRET_KEY", _TEST_SECRET_KEY)
            return self

        if not key or len(key) < 32:
            raise ValueError(
                "SECRET_KEY must be set via environment (minimum 32 characters). "
                "No insecure default is provided — add SECRET_KEY to .env.local."
            )
        object.__setattr__(self, "SECRET_KEY", key)
        return self

    # Database
    DATABASE_URL: str = "sqlite:///./chatbot.db"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: object) -> object:
        # Railway/Heroku often provide postgres:// — SQLAlchemy 2 expects postgresql://
        if isinstance(v, str) and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v

    # Comma-separated in .env (CORS_ORIGINS); exposed as list via BACKEND_CORS_ORIGINS
    cors_origins: str = Field(
        default=",".join(_DEFAULT_CORS_ORIGINS),
        validation_alias=AliasChoices("CORS_ORIGINS", "BACKEND_CORS_ORIGINS"),
    )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def BACKEND_CORS_ORIGINS(self) -> List[str]:
        parts = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        return parts if parts else list(_DEFAULT_CORS_ORIGINS)

    # Regex for preview deploys, e.g. https://remi-abc123.vercel.app
    cors_origin_regex: str = Field(
        default=r"https://.*\.vercel\.app",
        validation_alias=AliasChoices("CORS_ORIGIN_REGEX", "BACKEND_CORS_ORIGIN_REGEX"),
    )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def BACKEND_CORS_ORIGIN_REGEX(self) -> str | None:
        value = (self.cors_origin_regex or "").strip()
        return value or None

    # LLM Settings
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    # Vision OCR for scanned PDF pages — separate from chat model to reduce quota contention.
    GEMINI_OCR_MODEL: str = "gemini-2.0-flash-lite"
    # Default embedding model — validator maps retired names (e.g. text-embedding-004) here.
    EMBEDDING_MODEL: str = "gemini-embedding-001"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-3.5-turbo"

    @field_validator("GEMINI_API_KEY", "OPENAI_API_KEY", mode="before")
    @classmethod
    def strip_env_quotes(cls, v: object) -> object:
        if not isinstance(v, str):
            return v
        s = v.strip()
        if len(s) >= 2 and s[0] == s[-1] and s[0] in ("'", '"'):
            return s[1:-1].strip()
        return s

    @field_validator("EMBEDDING_MODEL", mode="before")
    @classmethod
    def normalize_embedding_model(cls, v: object) -> str:
        """Map retired Gemini embedding model names to gemini-embedding-001."""
        if not isinstance(v, str):
            return "gemini-embedding-001"
        model = v.strip().removeprefix("models/")
        retired = {
            "",
            "text-embedding-004",
            "text-embedding-005",
            "embedding-001",
        }
        if model in retired:
            return "gemini-embedding-001"
        allowed = {"gemini-embedding-001"}
        if model not in allowed:
            return "gemini-embedding-001"
        return model

    def gemini_configured(self) -> bool:
        return bool((self.GEMINI_API_KEY or "").strip())

    def gemini_ocr_model_id(self) -> str:
        return (self.GEMINI_OCR_MODEL or "gemini-2.0-flash-lite").removeprefix("models/")

    def openai_configured(self) -> bool:
        return bool((self.OPENAI_API_KEY or "").strip())

    model_config = SettingsConfigDict(
        env_file=_EXISTING_ENV_FILES if _EXISTING_ENV_FILES else None,
        env_file_encoding="utf-8",
        # OS env + .env keys often vary by case on Windows; match either form
        case_sensitive=False,
        extra="allow",
    )


settings = Settings()
