"""用户主题定制相关 API。"""

import json
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import User
from ..schemas import (
    ThemeApplyRequest,
    ThemeColors,
    ThemeResponse,
    ThemeResetRequest,
    VALID_THEME_COLOR_KEYS,
)

router = APIRouter()


_HEX_COLOR_RE = re.compile(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
_RGBA_COLOR_RE = re.compile(
    r"^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*(0|1|0?\.\d+)\s*)?\)$"
)


def _validate_color_value(color: str) -> bool:
    """校验颜色值是否合法：hex 或 rgba 格式。"""
    if not isinstance(color, str):
        return False
    color = color.strip()
    if _HEX_COLOR_RE.match(color):
        return True
    if color.startswith("rgba") or color.startswith("rgb"):
        return bool(_RGBA_COLOR_RE.match(color))
    return False


def _validate_theme_colors(colors: dict[str, str]) -> dict[str, str]:
    """校验主题颜色字典，只保留合法的键值对。"""
    validated: dict[str, str] = {}
    for key, value in colors.items():
        if key not in VALID_THEME_COLOR_KEYS:
            continue
        if not _validate_color_value(value):
            raise HTTPException(
                status_code=400,
                detail=f"非法颜色值：{key} = {value}，请使用 hex 或 rgba 格式。",
            )
        validated[key] = value
    return validated


def _load_theme_json(raw: Optional[str]) -> Optional[dict[str, str]]:
    """从数据库 JSON 字符串加载主题字典。"""
    if not raw:
        return None
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return {k: v for k, v in data.items() if k in VALID_THEME_COLOR_KEYS}
    except (json.JSONDecodeError, TypeError):
        return None
    return None


def _save_theme_json(db: Session, user: User, mode: str, colors: dict[str, str]) -> None:
    """保存主题到对应用户字段。"""
    json_str = json.dumps(colors, ensure_ascii=False)
    if mode == "light":
        user.custom_light_theme = json_str
    elif mode == "dark":
        user.custom_dark_theme = json_str
    db.add(user)
    db.commit()


@router.get("", response_model=ThemeResponse)
def get_user_theme(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ThemeResponse:
    """获取当前用户的自定义主题（两套）。未设置返回 null。"""
    light = _load_theme_json(current_user.custom_light_theme)
    dark = _load_theme_json(current_user.custom_dark_theme)
    return ThemeResponse(light=light, dark=dark)


@router.post("/apply", response_model=ThemeResponse)
def apply_theme(
    payload: ThemeApplyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ThemeResponse:
    """应用（增量保存）用户自定义主题。

    - 只更新传入的颜色键，其他已保存的键保持不变
    - mode 指定保存到 light 还是 dark 主题
    - 保存后返回最新的两套主题
    """
    # 校验颜色
    new_colors = _validate_theme_colors(payload.theme.to_non_null_dict())
    if not new_colors:
        raise HTTPException(status_code=400, detail="没有提供有效的颜色设置。")

    mode = payload.mode

    # 读取已有主题，合并新颜色
    if mode == "light":
        existing = _load_theme_json(current_user.custom_light_theme) or {}
    else:
        existing = _load_theme_json(current_user.custom_dark_theme) or {}

    merged = {**existing, **new_colors}

    # 保存
    _save_theme_json(db, current_user, mode, merged)

    # 返回最新
    light = _load_theme_json(current_user.custom_light_theme)
    dark = _load_theme_json(current_user.custom_dark_theme)
    return ThemeResponse(light=light, dark=dark)


@router.delete("", response_model=ThemeResponse)
def reset_theme(
    payload: ThemeResetRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ThemeResponse:
    """重置用户自定义主题。

    - mode=light：重置浅色
    - mode=dark：重置深色
    - mode=all：全部重置
    """
    mode = payload.mode

    if mode in ("light", "all"):
        current_user.custom_light_theme = None
    if mode in ("dark", "all"):
        current_user.custom_dark_theme = None

    db.add(current_user)
    db.commit()

    light = _load_theme_json(current_user.custom_light_theme)
    dark = _load_theme_json(current_user.custom_dark_theme)
    return ThemeResponse(light=light, dark=dark)
