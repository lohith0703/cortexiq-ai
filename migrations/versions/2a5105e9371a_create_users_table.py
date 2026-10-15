
"""Create users table.

Revision ID: 2a5105e9371a
Revises: 635c919a3dd7
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2a5105e9371a"

down_revision: Union[str, Sequence[str], None] = (
    "635c919a3dd7"
)

branch_labels: Union[str, Sequence[str], None] = None

depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the users table."""

    op.create_table(
        "users",
        sa.Column(
            "id",
            sa.String(length=36),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "email",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "password_hash",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_users_email",
        "users",
        ["email"],
        unique=True,
    )


def downgrade() -> None:
    """Reverse the migration."""

    op.drop_index(
        "ix_users_email",
        table_name="users",
    )

    op.drop_table("users")
