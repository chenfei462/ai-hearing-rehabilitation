"""
统一响应格式
"""
from pydantic import BaseModel
from typing import Any, Optional


class ApiResponse(BaseModel):
    """统一 API 响应格式"""
    code: int = 0
    data: Any = None
    message: str = "ok"


class ErrorResponse(BaseModel):
    """错误响应格式"""
    code: int
    data: Optional[Any] = None
    message: str


class PaginatedResponse(BaseModel):
    """分页响应格式"""
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int


def success_response(data: Any = None, message: str = "ok") -> dict:
    """构造成功响应字典"""
    return {
        "code": 0,
        "data": data,
        "message": message,
    }


def error_response(code: int, message: str, data: Any = None) -> dict:
    """构造错误响应字典"""
    return {
        "code": code,
        "data": data,
        "message": message,
    }


def paginated_response(
    items: list,
    total: int,
    page: int,
    page_size: int,
) -> dict:
    """构造分页响应字典"""
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
    return {
        "code": 0,
        "data": {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        },
        "message": "ok",
    }
