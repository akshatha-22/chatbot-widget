from pydantic import Field, field_validator
from datetime import datetime
from typing import Optional
import re
from app.schemas.base import BaseSchema

# Simple regex to validate email address format
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

class UserBase(BaseSchema):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        """Validate email format and convert to lowercase."""
        if not EMAIL_REGEX.match(v):
            raise ValueError("Invalid email address format")
        return v.lower()

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="User password (min 6 characters)")

class UserLogin(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

class Token(BaseSchema):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseSchema):
    user_id: Optional[int] = None
    email: Optional[str] = None
