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
        if "notifications" in notification_tables:
            notification_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(notifications)"))}
            if "parent_comment_id" not in notification_columns:
                connection.execute(text("ALTER TABLE notifications ADD COLUMN parent_comment_id INTEGER"))
