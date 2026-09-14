"""
通用 Schema 定义

注意：ApiResponse 已统一定义在 response.py 中，
此处为向后兼容提供 re-export。
"""
from pydantic import BaseModel
from typing import Any, Generic, TypeVar

# 从 response.py 统一导入，避免重复定义
from app.schemas.response import ApiResponse, success_response, error_response

T = TypeVar("T")


class PaginatedData(BaseModel, Generic[T]):
    """分页数据"""
    list: list[T]
    total: int
    page: int
    page_size: int


class HealthStatus(BaseModel):
    """健康检查响应"""
    status: str
    timestamp: str
    version: str
    service: str


__all__ = [
    "ApiResponse",
    "success_response",
    "error_response",
    "PaginatedData",
    "HealthStatus",
]
