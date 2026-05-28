from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.db import get_db, User
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token
from app.services import auth_service
from app.core import security

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(user_in: UserCreate, db: Session = Depends(get_db)):
    """Sign up a new user."""
    return auth_service.create_user(db, user_in)

@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Log in and generate access token (JSON body: email + password).

    Uses JSON rather than OAuth2 form encoding so SPA clients sending
    JSON with the shared axios instance work reliably."""
    user = auth_service.authenticate_user(db, credentials.email, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generate JWT token with sub (subject) and user id
    access_token = security.create_access_token(
        data={"sub": user.email, "id": user.id}
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(auth_service.get_current_user)):
    """Fetch profile of current authenticated user."""
    return current_user
