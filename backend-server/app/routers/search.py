from fastapi import APIRouter

from ..schemas import PageResponse

router = APIRouter()


@router.get("", response_model=PageResponse)
def search(
    q: str,
    type: str = "all",
    sort: str = "relevance",
    page: int = 1,
    page_size: int = 20,
) -> PageResponse:
    return PageResponse(items=[], page=page, page_size=page_size, total=0)
