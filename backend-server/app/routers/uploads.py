import os
import tempfile
import uuid
from io import BytesIO
from pathlib import Path

import mammoth
from markdownify import markdownify
from PIL import Image, ImageOps
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Asset, User
from ..auth import get_current_user
from ..config import IMAGE_MAX_DIMENSION, IMAGE_UPLOAD_DIR, MAX_DOCUMENT_SIZE, MAX_IMAGE_SIZE, THUMBNAIL_DIMENSION
from ..schemas import AssetResponse, DocumentParseResponse, DocumentParseStatusResponse

router = APIRouter()

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
DOCUMENT_EXTENSIONS = {".doc", ".docx", ".pdf", ".md"}


def _process_image(file_bytes: bytes, original_ext: str) -> tuple[Path, Path, int]:
    """Resize, convert to WebP, generate thumbnail. Returns (image_path, thumb_path, file_size)."""
    IMAGE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Write to temp file so Pillow can read from disk (handles large files better)
    with tempfile.NamedTemporaryFile(suffix=original_ext, delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        img = Image.open(tmp_path)
        img = ImageOps.exif_transpose(img)

        if img.mode in ("RGBA", "P"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            background.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")

        img.thumbnail((IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION), Image.LANCZOS)

        thumb = img.copy()
        thumb.thumbnail((THUMBNAIL_DIMENSION, THUMBNAIL_DIMENSION), Image.LANCZOS)

        unique_id = uuid.uuid4().hex[:12]
        image_path = IMAGE_UPLOAD_DIR / f"{unique_id}.webp"
        thumb_path = IMAGE_UPLOAD_DIR / f"{unique_id}_thumb.webp"
        img.save(image_path, "WebP", quality=80)
        thumb.save(thumb_path, "WebP", quality=70)

        return image_path, thumb_path, image_path.stat().st_size
    finally:
        os.unlink(tmp_path)


def _load_asset_or_404(asset_id: int, db: Session) -> Asset:
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if asset is None:
        raise HTTPException(status_code=404, detail="文件不存在")
    return asset


@router.post("/images", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
def upload_image(
    kind: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AssetResponse:
    ext = Path(file.filename or "").suffix.lower()
    if kind not in {"image", "cover", "avatar"} or ext not in IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported image upload")

    file_bytes = file.file.read()
    if len(file_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail=f"图片大小不能超过 {MAX_IMAGE_SIZE // (1024*1024)}MB")

    image_path, thumb_path, final_size = _process_image(file_bytes, ext)

    asset = Asset(
        uploader_id=current_user.id,
        kind=kind,
        original_name=file.filename or "upload",
        mime_type="image/webp",
        file_ext=".webp",
        file_size=final_size,
        storage_path=str(image_path),
        file_data=None,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    public_url = f"/api/v1/uploads/assets/{asset.id}/content"
    thumb_url = f"/api/v1/uploads/assets/{asset.id}/thumbnail"
    asset.public_url = public_url
    db.commit()

    return AssetResponse(
        id=asset.id,
        kind=kind,
        original_name=file.filename or "upload",
        mime_type="image/webp",
        file_size=final_size,
        url=public_url,
        thumbnail_url=thumb_url,
    )


@router.post("/documents", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
def upload_document(
    kind: str = Form("document"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AssetResponse:
    ext = Path(file.filename or "").suffix.lower()
    if kind != "document" or ext not in DOCUMENT_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported document upload")

    file_bytes = file.file.read()
    if len(file_bytes) > MAX_DOCUMENT_SIZE:
        raise HTTPException(status_code=400, detail=f"文件大小不能超过 {MAX_DOCUMENT_SIZE // (1024*1024)}MB")
    asset = Asset(
        uploader_id=current_user.id,
        kind=kind,
        original_name=file.filename or "document",
        mime_type=file.content_type or "application/octet-stream",
        file_ext=ext,
        file_size=len(file_bytes),
        storage_path="database",
        file_data=file_bytes,
        parse_status="pending",
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    public_url = f"/api/v1/uploads/assets/{asset.id}/content"
    asset.public_url = public_url
    db.commit()

    from ...tasks.document_tasks import parse_document_async

    parse_document_async.delay(asset.id)

    return AssetResponse(
        id=asset.id,
        kind=kind,
        original_name=file.filename or "document",
        mime_type=file.content_type or "application/octet-stream",
        file_size=len(file_bytes),
        url=public_url,
        parse_status=asset.parse_status,
    )


@router.get("/documents/{asset_id}/parse-status", response_model=DocumentParseStatusResponse)
def get_document_parse_status(asset_id: int, db: Session = Depends(get_db)) -> DocumentParseStatusResponse:
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if asset is None:
        raise HTTPException(status_code=404, detail="文件不存在")
    preview = None
    if asset.extracted_text:
        preview = asset.extracted_text[:200]
    return DocumentParseStatusResponse(
        asset_id=asset.id,
        parse_status=asset.parse_status,
        parse_error=asset.parse_error,
        extracted_text_preview=preview,
    )


@router.get("/assets/{asset_id}/content")
def get_asset_content(asset_id: int, db: Session = Depends(get_db)):
    asset = _load_asset_or_404(asset_id, db)

    # File-system stored assets (images after optimization)
    if asset.storage_path and asset.storage_path != "database":
        path = Path(asset.storage_path)
        if not path.is_file():
            raise HTTPException(status_code=404, detail="文件不存在")
        return FileResponse(
            path=str(path),
            media_type=asset.mime_type,
            headers={
                "Cache-Control": "public, max-age=86400, immutable",
                "ETag": f'"{asset.id}-{int(asset.created_at.timestamp())}"',
            },
        )

    # Legacy BLOB stored assets (documents, old images)
    if asset.file_data is not None:
        return Response(
            content=asset.file_data,
            media_type=asset.mime_type,
            headers={
                "Cache-Control": "public, max-age=86400, immutable",
                "ETag": f'"{asset.id}-{int(asset.created_at.timestamp())}"',
            },
        )

    raise HTTPException(status_code=404, detail="文件不存在")


@router.get("/assets/{asset_id}/thumbnail")
def get_asset_thumbnail(asset_id: int, db: Session = Depends(get_db)):
    asset = _load_asset_or_404(asset_id, db)

    if asset.storage_path and asset.storage_path != "database":
        main_path = Path(asset.storage_path)
        thumb_path = main_path.parent / f"{main_path.stem}_thumb{main_path.suffix}"
        if not thumb_path.is_file():
            raise HTTPException(status_code=404, detail="缩略图不存在")
        return FileResponse(
            path=str(thumb_path),
            media_type=asset.mime_type,
            headers={
                "Cache-Control": "public, max-age=86400, immutable",
                "ETag": f'"{asset.id}-thumb-{int(asset.created_at.timestamp())}"',
            },
        )

    raise HTTPException(status_code=404, detail="缩略图不存在")


@router.post("/parse-document", response_model=DocumentParseResponse)
def parse_document(
    file: UploadFile = File(...), current_user: User = Depends(get_current_user)
) -> DocumentParseResponse:
    ext = Path(file.filename or "").suffix.lower()
    file_bytes = file.file.read()

    if ext == ".md":
        try:
            extracted_text = file_bytes.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise HTTPException(status_code=400, detail="Markdown 文件编码必须是 UTF-8") from exc
    elif ext == ".docx":
        try:
            result = mammoth.convert_to_html(BytesIO(file_bytes))
            extracted_text = markdownify(result.value, heading_style="ATX").strip()
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Word 文档解析失败") from exc
    else:
        raise HTTPException(status_code=400, detail="当前仅支持解析 Markdown 和 .docx 文件")

    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="文件没有解析出正文内容")

    return DocumentParseResponse(
        asset_id=abs(hash(file.filename or "document")) % 1_000_000_000,
        original_name=file.filename or "document",
        parse_status="success",
        extracted_text=extracted_text.strip(),
    )
