
"""Add nullable document ownership.

Revision ID: 8b1e3a7c9d20
Revises: 2a5105e9371a
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8b1e3a7c9d20"

down_revision: Union[str, Sequence[str], None] = (
    "2a5105e9371a"
)

branch_labels: Union[str, Sequence[str], None] = None

depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column(
            "owner_id",
            sa.String(length=36),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        "fk_documents_owner_id_users",
        "documents",
        "users",
        ["owner_id"],
        ["id"],
    )

    op.create_index(
        "ix_documents_owner_id",
        "documents",
        ["owner_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_documents_owner_id",
        table_name="documents",
    )

    op.drop_constraint(
        "fk_documents_owner_id_users",
        "documents",
        type_="foreignkey",
    )

    op.drop_column(
        "documents",
        "owner_id",
    )
