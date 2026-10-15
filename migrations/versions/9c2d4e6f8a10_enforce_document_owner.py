
"""Enforce document ownership.

Revision ID: 9c2d4e6f8a10
Revises: 8b1e3a7c9d20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9c2d4e6f8a10"

down_revision: Union[str, Sequence[str], None] = (
    "8b1e3a7c9d20"
)

branch_labels: Union[str, Sequence[str], None] = None

depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()

    unowned_count = connection.execute(
        sa.text(
            "SELECT COUNT(*) FROM documents "
            "WHERE owner_id IS NULL"
        )
    ).scalar_one()

    if unowned_count > 0:
        raise RuntimeError(
            f"Cannot enforce ownership: "
            f"{unowned_count} documents have no owner."
        )

    op.alter_column(
        "documents",
        "owner_id",
        existing_type=sa.String(length=36),
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "documents",
        "owner_id",
        existing_type=sa.String(length=36),
        nullable=True,
    )
