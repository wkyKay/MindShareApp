import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'forum.db'}")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-me")

UPLOAD_DIR = BASE_DIR / "uploads"
IMAGE_UPLOAD_DIR = UPLOAD_DIR / "images"
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_DOCUMENT_SIZE = 50 * 1024 * 1024  # 50MB
MAX_POST_BODY_LENGTH = 200_000  # ~10 万汉字
IMAGE_MAX_DIMENSION = 1920
THUMBNAIL_DIMENSION = 300

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "openai").lower()
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "")
EMBEDDING_API_KEY = os.getenv("EMBEDDING_API_KEY")
EMBEDDING_BASE_URL = os.getenv("EMBEDDING_BASE_URL")
BAIDU_API_KEY = os.getenv("BAIDU_API_KEY")
BAIDU_SECRET_KEY = os.getenv("BAIDU_SECRET_KEY")
BAIDU_ACCESS_TOKEN_URL = os.getenv(
    "BAIDU_ACCESS_TOKEN_URL",
    "https://aip.baidubce.com/oauth/2.0/token",
)
BAIDU_WENXIN_BASE_URL = os.getenv(
    "BAIDU_WENXIN_BASE_URL",
    "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop",
)
BAIDU_EMBEDDING_BATCH_SIZE = int(os.getenv("BAIDU_EMBEDDING_BATCH_SIZE", "16"))
RERANKER_PROVIDER = os.getenv("RERANKER_PROVIDER", "").lower()
RERANKER_MODEL = os.getenv("RERANKER_MODEL", "")
RERANKER_CANDIDATE_K = int(os.getenv("RERANKER_CANDIDATE_K", "50"))
RERANKER_BATCH_SIZE = int(os.getenv("RERANKER_BATCH_SIZE", "16"))

# ── Qdrant 向量库配置 ──────────────────────────────────────────────
# 优先使用服务端 QDRANT_URL；不设置时使用本地持久化模式
QDRANT_URL = os.getenv("QDRANT_URL", "")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")
# 本地模式数据目录；为空且 QDRANT_URL 也为空时使用纯内存模式
QDRANT_LOCAL_PATH = os.getenv("QDRANT_LOCAL_PATH", str(BASE_DIR / "qdrant_data"))
QDRANT_COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME", "rag_chunks")
QDRANT_EMBEDDING_DIM = int(os.getenv("QDRANT_EMBEDDING_DIM", "1536"))

# ── 稀疏向量 / 关键词检索 ──────────────────────────────────────────
SPARSE_ENABLED = os.getenv("SPARSE_ENABLED", "true").lower() == "true"
SPARSE_VOCAB_SIZE = int(os.getenv("SPARSE_VOCAB_SIZE", "50000"))

# ── 查询改写 ───────────────────────────────────────────────────────
QUERY_REWRITE_ENABLED = os.getenv("QUERY_REWRITE_ENABLED", "false").lower() == "true"
QUERY_REWRITE_COUNT = int(os.getenv("QUERY_REWRITE_COUNT", "3"))
HYDE_ENABLED = os.getenv("HYDE_ENABLED", "false").lower() == "true"

# ── 语义缓存 ───────────────────────────────────────────────────────
SEMANTIC_CACHE_ENABLED = os.getenv("SEMANTIC_CACHE_ENABLED", "false").lower() == "true"
SEMANTIC_CACHE_THRESHOLD = float(os.getenv("SEMANTIC_CACHE_THRESHOLD", "0.95"))
SEMANTIC_CACHE_TTL = int(os.getenv("SEMANTIC_CACHE_TTL", "86400"))  # 24 小时

# ── Chunker 配置 ───────────────────────────────────────────────────
CHUNK_OVERLAP_CHARS = int(os.getenv("CHUNK_OVERLAP_CHARS", "80"))
CHUNK_MAX_CHARS = int(os.getenv("CHUNK_MAX_CHARS", "800"))
CHUNK_TARGET_CHARS = int(os.getenv("CHUNK_TARGET_CHARS", "400"))
