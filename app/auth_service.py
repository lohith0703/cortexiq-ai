
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import User
from app.security import hash_password


class UserAlreadyExistsError(Exception):
    """Raised when an email is already registered."""
    pass


def normalize_email(email: str) -> str:
    """
    Normalize an email address for consistent lookup.
    """

    if not isinstance(email, str):
        raise ValueError("Email must be a string.")

    normalized = email.strip().lower()

    if not normalized:
        raise ValueError("Email cannot be empty.")

    return normalized


def register_user(
    db: Session,
    email: str,
    password: str,
) -> User:
    """
    Register a new CortexIQ user.

    Never store the plaintext password.
    """

    normalized_email = normalize_email(email)

    existing_user = db.scalar(
        select(User).where(
            User.email == normalized_email
        )
    )

    if existing_user is not None:
        raise UserAlreadyExistsError(
            "An account with this email already exists."
        )

    password_hash = hash_password(password)

    user = User(
        email=normalized_email,
        password_hash=password_hash,
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)

    except IntegrityError as error:
        db.rollback()

        raise UserAlreadyExistsError(
            "An account with this email already exists."
        ) from error

    return user
