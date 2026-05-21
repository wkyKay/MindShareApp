from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from ..auth import get_current_user
from ..models import User
from ..schemas import AssetResponse, DocumentParseResponse

router = APIRouter()

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
DOCUMENT_EXTENSIONS = {".docx", ".pdf", ".md"}


@router.post("/images", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
def upload_image(
    kind: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> AssetResponse:
    ext = Path(file.filename or "").suffix.lower()
    if kind not in {"image", "cover", "avatar"} or ext not in IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported image upload")
    return AssetResponse(
        id=1,
        kind=kind,
        original_name=file.filename or "upload",
        mime_type=file.content_type or "application/octet-stream",
        file_size=0,
        url=f"/uploads/{file.filename}",
    )


@router.post("/parse-document", response_model=DocumentParseResponse)
def parse_document(
    file: UploadFile = File(...), current_user: User = Depends(get_current_user)
) -> DocumentParseResponse:
    ext = Path(file.filename or "").suffix.lower()
    if ext == ".doc":
        raise HTTPException(status_code=400, detail="Please convert .doc to .docx")
    if ext not in DOCUMENT_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported document type")
    return DocumentParseResponse(
        asset_id=1,
        original_name=file.filename or "document",
        parse_status="success",
        extracted_text="",
    )
