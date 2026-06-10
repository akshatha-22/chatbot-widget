from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.database.db import get_db, User
from app.schemas.audit_log import AuditAction
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token
from app.services import audit_service, auth_rate_limit_service, auth_service
from app.core import security
from app.core.network import get_real_ip

router = APIRouter(prefix="/auth", tags=["Authentication"])

_LOGIN_SCOPE = "login"
_SIGNUP_SCOPE = "signup"


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(user_in: UserCreate, request: Request, db: Session = Depends(get_db)):
    """Sign up a new user."""
    client_ip = get_real_ip(request)
    auth_rate_limit_service.raise_http_rate_limited(_SIGNUP_SCOPE, client_ip)

    try:
        user = auth_service.create_user(db, user_in)
    except HTTPException as exc:
        if exc.status_code >= 400:
            auth_rate_limit_service.record_failed_attempt(_SIGNUP_SCOPE, client_ip)
        raise

    auth_rate_limit_service.reset_attempts(_SIGNUP_SCOPE, client_ip)
    return user


@router.post("/login", response_model=Token)
def login(
    credentials: UserLogin,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Log in and generate access token (JSON body: email + password).

    Uses JSON rather than OAuth2 form encoding so SPA clients sending
    JSON with the shared axios instance work reliably."""
    client_ip = get_real_ip(request)
    auth_rate_limit_service.raise_http_rate_limited(_LOGIN_SCOPE, client_ip)

    user = auth_service.authenticate_user(db, credentials.email, credentials.password)
    if not user:
        auth_rate_limit_service.record_failed_attempt(_LOGIN_SCOPE, client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    auth_rate_limit_service.reset_attempts(_LOGIN_SCOPE, client_ip)

    # Generate JWT token with sub (subject) and user id
    access_token = security.create_access_token(
        data={"sub": user.email, "id": user.id}
    )

    background_tasks.add_task(
        audit_service.log_action,
        db,
        user.id,
        AuditAction.login,
        "user",
        str(user.id),
        client_ip,
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(auth_service.get_current_user)):
    """Fetch profile of current authenticated user."""
    return current_user
