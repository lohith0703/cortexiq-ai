
from sqlalchemy import text

from app.database import Base, engine
from app.models import Document, DocumentChunk


def create_tables():
    with engine.begin() as connection:
        connection.execute(
            text("CREATE EXTENSION IF NOT EXISTS vector")
        )

    Base.metadata.create_all(bind=engine)

    print("CortexIQ database tables created successfully.")


if __name__ == "__main__":
    create_tables()
