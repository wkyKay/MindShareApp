from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import BASE_DIR, init_db
from .routers import auth, collections, comments, messages, notifications, posts, search, uploads, users

init_db()

app = FastAPI(title="Tongren Forum API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8081", "http://localhost:19006"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|10\.32\.233\.242|192\.168\.\d+\.\d+):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

uploads_dir = BASE_DIR / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(uploads.router, prefix="/api/v1/uploads", tags=["uploads"])
app.include_router(posts.router, prefix="/api/v1/posts", tags=["posts"])
app.include_router(comments.router, prefix="/api/v1", tags=["comments"])
app.include_router(messages.router, prefix="/api/v1/messages", tags=["messages"])
app.include_router(collections.router, prefix="/api/v1/collections", tags=["collections"])
app.include_router(search.router, prefix="/api/v1/search", tags=["search"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
