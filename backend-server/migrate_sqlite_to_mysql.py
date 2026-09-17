"""SQLite → MySQL 数据迁移脚本。

用法:
    python3 migrate_sqlite_to_mysql.py [--sqlite PATH] [--mysql URL]

流程:
    1. 用 SQLAlchemy metadata 在 MySQL 端建表（保证列类型、索引、约束正确）
    2. 按依赖顺序逐表从 SQLite 读取数据，批量写入 MySQL
    3. 对比两边行数，校验迁移完整性
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

# 确保能 import app
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from app.config import DATABASE_URL
from app.database import Base
from app import models  # noqa: F401  确保所有 model 被注册到 Base.metadata


# 表迁移顺序（考虑外键依赖：被引用的表先迁）
TABLE_ORDER = [
    # 用户与资源
    "users",
    "assets",
    "tags",
    # 帖子相关
    "posts",
    "post_tags",
    "post_dislikes",
    "likes",
    "favorites",
    "comments",
    "comment_likes",
    # 合集
    "collections",
    "collection_items",
    "collection_favorites",
    # 社交
    "follows",
    # 通知
    "notifications",
    # 认证
    "captchas",
    "refresh_tokens",
    # 私信
    "conversations",
    "conversation_participants",
    "messages",
    # 翻译缓存
    "translation_caches",
    # RAG
    "text_chunks",
]


def get_sqlite_engine(sqlite_path: str):
    return create_engine(f"sqlite:///{sqlite_path}")


def get_mysql_engine(mysql_url: str):
    return create_engine(
        mysql_url,
        pool_pre_ping=True,
        pool_recycle=3600,
        pool_size=5,
        max_overflow=10,
    )


def create_mysql_schema(mysql_engine) -> None:
    """在 MySQL 中创建所有表（用 SQLAlchemy metadata，保证索引/约束正确）。"""
    print("→ 在 MySQL 中创建表结构...")
    Base.metadata.create_all(bind=mysql_engine)
    inspector = inspect(mysql_engine)
    tables = inspector.get_table_names()
    print(f"  已创建 {len(tables)} 张表: {', '.join(sorted(tables))}")


def migrate_table(sqlite_engine, mysql_engine, table_name: str) -> tuple[int, int]:
    """迁移单张表，返回 (sqlite行数, mysql行数)。"""
    # 从 SQLite 读取所有数据
    with sqlite_engine.connect() as src_conn:
        result = src_conn.execute(text(f"SELECT * FROM {table_name}"))
        rows = result.mappings().fetchall()
        sqlite_count = len(rows)

    if sqlite_count == 0:
        # 空表，不用插
        inspector = inspect(mysql_engine)
        with mysql_engine.connect() as dst_conn:
            r = dst_conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
            mysql_count = r.scalar() or 0
        return sqlite_count, mysql_count

    # 批量写入 MySQL（用字典列表方式，SQLAlchemy 自动处理列映射）
    table_obj = Base.metadata.tables[table_name]
    BATCH_SIZE = 500
    inserted = 0

    with mysql_engine.connect() as dst_conn:
        # 先清空目标表（幂等，重复执行也安全）
        dst_conn.execute(text(f"SET FOREIGN_KEY_CHECKS = 0"))
        dst_conn.execute(text(f"TRUNCATE TABLE {table_name}"))
        dst_conn.commit()

        for i in range(0, len(rows), BATCH_SIZE):
            batch = [dict(r) for r in rows[i : i + BATCH_SIZE]]
            dst_conn.execute(table_obj.insert(), batch)
            dst_conn.commit()
            inserted += len(batch)

        # 重置自增 ID（SQLite 传过来的 ID 已经用过了）
        try:
            r = dst_conn.execute(text(f"SELECT MAX(id) FROM {table_name}"))
            max_id = r.scalar() or 0
            dst_conn.execute(
                text(f"ALTER TABLE {table_name} AUTO_INCREMENT = :max_id + 1"),
                {"max_id": max_id},
            )
            dst_conn.commit()
        except Exception:
            pass  # 有些表可能没有 id 字段，忽略

        r = dst_conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
        mysql_count = r.scalar() or 0

        dst_conn.execute(text(f"SET FOREIGN_KEY_CHECKS = 1"))
        dst_conn.commit()

    return sqlite_count, mysql_count


def verify_migration(sqlite_engine, mysql_engine) -> bool:
    """逐表对比行数，输出差异。"""
    print("\n=== 迁移校验 ===")
    all_ok = True
    with sqlite_engine.connect() as src_conn, mysql_engine.connect() as dst_conn:
        for table_name in TABLE_ORDER:
            src_count = src_conn.execute(
                text(f"SELECT COUNT(*) FROM {table_name}")
            ).scalar()
            dst_count = dst_conn.execute(
                text(f"SELECT COUNT(*) FROM {table_name}")
            ).scalar()
            status = "✅" if src_count == dst_count else "❌"
            if src_count != dst_count:
                all_ok = False
            print(f"  {status} {table_name}: sqlite={src_count}, mysql={dst_count}")
    return all_ok


def main() -> None:
    parser = argparse.ArgumentParser(description="SQLite → MySQL 数据迁移")
    parser.add_argument(
        "--sqlite",
        default=str(BASE_DIR / "forum.db"),
        help="SQLite 数据库文件路径",
    )
    parser.add_argument(
        "--mysql",
        default=None,
        help="MySQL 连接 URL（默认从 .env 的 DATABASE_URL 读取）",
    )
    args = parser.parse_args()

    sqlite_path = args.sqlite
    mysql_url = args.mysql or DATABASE_URL

    if not mysql_url.startswith("mysql"):
        print(f"❌ 当前 DATABASE_URL 不是 MySQL: {mysql_url}")
        print("   请在 .env 中配置 MySQL 地址后再运行。")
        sys.exit(1)

    if not Path(sqlite_path).exists():
        print(f"❌ SQLite 文件不存在: {sqlite_path}")
        sys.exit(1)

    print(f"源数据库 (SQLite): {sqlite_path}")
    print(f"目标数据库 (MySQL): {mysql_url}")
    print()

    sqlite_engine = get_sqlite_engine(sqlite_path)
    mysql_engine = get_mysql_engine(mysql_url)

    # 测试连接
    try:
        with sqlite_engine.connect() as c:
            c.execute(text("SELECT 1"))
        print("✅ SQLite 连接成功")
    except Exception as e:
        print(f"❌ SQLite 连接失败: {e}")
        sys.exit(1)

    try:
        with mysql_engine.connect() as c:
            c.execute(text("SELECT 1"))
        print("✅ MySQL 连接成功")
    except Exception as e:
        print(f"❌ MySQL 连接失败: {e}")
        sys.exit(1)

    print()

    # 1. 建表
    create_mysql_schema(mysql_engine)
    print()

    # 2. 逐表迁移
    print("=== 开始迁移数据 ===")
    start = time.time()
    for table_name in TABLE_ORDER:
        t0 = time.time()
        src_cnt, dst_cnt = migrate_table(sqlite_engine, mysql_engine, table_name)
        elapsed = time.time() - t0
        status = "✅" if src_cnt == dst_cnt else "❌"
        print(f"  {status} {table_name}: {src_cnt} → {dst_cnt} 行 ({elapsed:.2f}s)")

    total_elapsed = time.time() - start
    print(f"\n迁移完成，总耗时: {total_elapsed:.2f}s")

    # 3. 校验
    ok = verify_migration(sqlite_engine, mysql_engine)
    if ok:
        print("\n🎉 所有表数据一致，迁移成功！")
    else:
        print("\n⚠️  存在数据不一致，请检查上表")
        sys.exit(1)


if __name__ == "__main__":
    main()
