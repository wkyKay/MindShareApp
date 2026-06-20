import logging
from io import BytesIO
from pathlib import Path

import mammoth
from markdownify import markdownify
from sqlalchemy.orm import Session

from ..celery_app import celery_app
from ..database import SessionLocal
from ..models import Asset

logger = logging.getLogger(__name__)


@celery_app.task(
    autoretry_for=(Exception,),
    max_retries=2,
    default_retry_delay=10,
)
def parse_document_async(asset_id: int) -> None:
    db: Session = SessionLocal()
    try:
        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        if asset is None:
            logger.warning("parse_document_async: asset %s not found", asset_id)
            return
        if asset.file_data is None:
            _fail(db, asset, "文件内容为空")
            return

        asset.parse_status = "processing"
        db.commit()

        ext = asset.file_ext.lower()
        if ext == ".md":
            try:
                text = asset.file_data.decode("utf-8-sig")
            except UnicodeDecodeError as exc:
                _fail(db, asset, f"Markdown 编码错误：{exc}")
                return
        elif ext == ".docx":
            try:
                result = mammoth.convert_to_html(BytesIO(asset.file_data))
                text = markdownify(result.value, heading_style="ATX").strip()
            except Exception as exc:
                _fail(db, asset, f"Word 文档解析失败：{exc}")
                return
        elif ext == ".pdf":
            try:
                from pypdf import PdfReader
                reader = PdfReader(BytesIO(asset.file_data))
                pages = []
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        pages.append(page_text)
                text = "\n\n".join(pages).strip()
            except Exception as exc:
                _fail(db, asset, f"PDF 解析失败：{exc}")
                return
        else:
            _fail(db, asset, f"不支持的文件类型：{ext}")
            return

        if not text.strip():
            _fail(db, asset, "文件未解析出正文内容")
            return

        asset.extracted_text = text.strip()
        asset.parse_status = "success"
        db.commit()
        logger.info("parse_document_async: asset %s parsed successfully", asset_id)

    except Exception as exc:
        logger.exception("parse_document_async: unexpected error for asset %s", asset_id)
        db.rollback()
        try:
            asset = db.query(Asset).filter(Asset.id == asset_id).first()
            if asset:
                _fail(db, asset, str(exc))
        except Exception:
            pass
    finally:
        db.close()


def _fail(db: Session, asset: Asset, error: str) -> None:
    asset.parse_status = "failed"
    asset.parse_error = error
    db.commit()
