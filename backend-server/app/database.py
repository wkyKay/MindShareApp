from collections.abc import Generator
import os
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'forum.db'}")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from . import models

    Base.metadata.create_all(bind=engine)
    _ensure_sqlite_schema_updates()


def _ensure_sqlite_schema_updates() -> None:
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.begin() as connection:
        columns = {row[1] for row in connection.execute(text("PRAGMA table_info(comments)"))}
        if columns and "like_count" not in columns:
            connection.execute(text("ALTER TABLE comments ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0"))
        notification_tables = {row[0] for row in connection.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))}
        if "users" in notification_tables:
            user_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(users)"))}
            if "background_asset_id" not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN background_asset_id INTEGER"))
        if "assets" in notification_tables:
            asset_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(assets)"))}
            if "file_data" not in asset_columns:
                connection.execute(text("ALTER TABLE assets ADD COLUMN file_data BLOB"))
        if "notifications" in notification_tables:
            notification_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(notifications)"))}
            if "parent_comment_id" not in notification_columns:
                connection.execute(text("ALTER TABLE notifications ADD COLUMN parent_comment_id INTEGER"))
            if "target_user_id" not in notification_columns:
                connection.execute(text("ALTER TABLE notifications ADD COLUMN target_user_id INTEGER"))
        if "conversation_participants" in notification_tables:
            participant_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(conversation_participants)"))}
            if "is_hidden" not in participant_columns:
                connection.execute(text("ALTER TABLE conversation_participants ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT 0"))
        if "translation_caches" in notification_tables:
            indexes = {row[1] for row in connection.execute(text("PRAGMA index_list(translation_caches)"))}
            if "ix_translation_caches_lookup" not in indexes:
                connection.execute(
                    text(
                        "CREATE INDEX ix_translation_caches_lookup "
                        "ON translation_caches(content_type, content_id, field, source_text_hash, target_language)"
                    )
                )
