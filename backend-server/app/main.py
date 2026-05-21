from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from . import models
from .database import engine
from .routers import auth, collections, comments, posts, search, uploads, users

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Tongren Forum API", version="0.1.0")

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(uploads.router, prefix="/api/v1/uploads", tags=["uploads"])
app.include_router(posts.router, prefix="/api/v1/posts", tags=["posts"])
app.include_router(comments.router, prefix="/api/v1", tags=["comments"])
app.include_router(collections.router, prefix="/api/v1/collections", tags=["collections"])
app.include_router(search.router, prefix="/api/v1/search", tags=["search"])


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
