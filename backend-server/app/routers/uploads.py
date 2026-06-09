from io import BytesIO
from pathlib import Path

import mammoth
from markdownify import markdownify
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Asset, User
from ..auth import get_current_user
from ..schemas import AssetResponse, DocumentParseResponse

router = APIRouter()

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
DOCUMENT_EXTENSIONS = {".doc", ".docx", ".pdf", ".md"}
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
    asset = Asset(
        uploader_id=current_user.id,
        kind=kind,
        original_name=file.filename or "upload",
        mime_type=file.content_type or "application/octet-stream",
        file_ext=ext,
        file_size=len(file_bytes),
        storage_path="database",
        file_data=file_bytes,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    public_url = f"/api/v1/uploads/assets/{asset.id}/content"
    asset.public_url = public_url
    db.commit()
    return AssetResponse(
        id=asset.id,
        kind=kind,
        original_name=file.filename or "upload",
        mime_type=file.content_type or "application/octet-stream",
        file_size=len(file_bytes),
        url=public_url,
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
    asset = Asset(
        uploader_id=current_user.id,
        kind=kind,
        original_name=file.filename or "document",
        mime_type=file.content_type or "application/octet-stream",
        file_ext=ext,
        file_size=len(file_bytes),
        storage_path="database",
        file_data=file_bytes,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    public_url = f"/api/v1/uploads/assets/{asset.id}/content"
    asset.public_url = public_url
    db.commit()
    return AssetResponse(
        id=asset.id,
        kind=kind,
        original_name=file.filename or "document",
        mime_type=file.content_type or "application/octet-stream",
        file_size=len(file_bytes),
        url=public_url,
    )


@router.get("/assets/{asset_id}/content")
def get_asset_content(asset_id: int, db: Session = Depends(get_db)) -> Response:
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if asset is None or asset.file_data is None:
        raise HTTPException(status_code=404, detail="文件不存在")
    return Response(content=asset.file_data, media_type=asset.mime_type)


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
