from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import (
    BASE_DIR,
    DATABASE_URL,
    DB_ECHO,
    DB_MAX_OVERFLOW,
    DB_POOL_PRE_PING,
    DB_POOL_RECYCLE,
    DB_POOL_SIZE,
)

is_sqlite = DATABASE_URL.startswith("sqlite")

connect_args: dict = {}
if is_sqlite:
    connect_args["check_same_thread"] = False

# 连接池参数（SQLite 下部分参数会被忽略，但传了也不报错）
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=DB_POOL_PRE_PING,
    pool_recycle=DB_POOL_RECYCLE,
    pool_size=DB_POOL_SIZE if not is_sqlite else 5,
    max_overflow=DB_MAX_OVERFLOW if not is_sqlite else 10,
    echo=DB_ECHO,
)
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
            if "custom_light_theme" not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN custom_light_theme TEXT"))
            if "custom_dark_theme" not in user_columns:
                connection.execute(text("ALTER TABLE users ADD COLUMN custom_dark_theme TEXT"))
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
        if "text_chunks" not in notification_tables:
            connection.execute(
                text(
                    "CREATE TABLE text_chunks ("
                    "  id INTEGER PRIMARY KEY,"
                    "  post_id INTEGER NOT NULL,"
                    "  chunk_index INTEGER NOT NULL,"
                    "  content TEXT NOT NULL,"
                    "  content_hash TEXT,"
                    "  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,"
                    "  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP"
                    ")"
                )
            )
            connection.execute(text("CREATE INDEX ix_text_chunks_post_id ON text_chunks(post_id)"))
            connection.execute(text("CREATE INDEX ix_text_chunks_content_hash ON text_chunks(content_hash)"))
        else:
            # 已有 text_chunks 表：schema 升级
            chunk_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(text_chunks)"))}
            if "embedding" in chunk_columns:
                # 删除 embedding 字段（SQLite 不支持 DROP COLUMN 用重建表方式）
                connection.execute(
                    text(
                        "CREATE TABLE text_chunks_new ("
                        "  id INTEGER PRIMARY KEY,"
                        "  post_id INTEGER NOT NULL,"
                        "  chunk_index INTEGER NOT NULL,"
                        "  content TEXT NOT NULL,"
                        "  content_hash TEXT,"
                        "  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,"
                        "  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP"
                        ")"
                    )
                )
                connection.execute(
                    text(
                        "INSERT INTO text_chunks_new (id, post_id, chunk_index, content, created_at) "
                        "SELECT id, post_id, chunk_index, content, created_at FROM text_chunks"
                    )
                )
                connection.execute(text("DROP TABLE text_chunks"))
                connection.execute(text("ALTER TABLE text_chunks_new RENAME TO text_chunks"))
                connection.execute(text("CREATE INDEX ix_text_chunks_post_id ON text_chunks(post_id)"))
                connection.execute(text("CREATE INDEX ix_text_chunks_content_hash ON text_chunks(content_hash)"))
            else:
                if "content_hash" not in chunk_columns:
                    connection.execute(text("ALTER TABLE text_chunks ADD COLUMN content_hash TEXT"))
                    connection.execute(text("CREATE INDEX ix_text_chunks_content_hash ON text_chunks(content_hash)"))
                if "updated_at" not in chunk_columns:
                    connection.execute(
                        text("ALTER TABLE text_chunks ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP")
                    )
