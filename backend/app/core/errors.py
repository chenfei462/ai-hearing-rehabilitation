"""
错误码定义 + 自定义异常类 + 全局异常处理器
"""
from typing import Any
from fastapi import Request
from fastapi.responses import JSONResponse


# ──────────────────────────────────────
# 错误码常量
# ──────────────────────────────────────

class ErrorCode:
    """错误码常量"""

    # 成功
    SUCCESS = 0

    # 参数错误 40001-40099
    INVALID_PARAMS = 40001
    MISSING_PARAMS = 40002
    INVALID_FORMAT = 40003

    # 认证错误 40101-40199
    UNAUTHORIZED = 40101
    TOKEN_INVALID = 40102
    TOKEN_EXPIRED = 40103
    LOGIN_FAILED = 40104

    # 权限错误 40301-40399
    FORBIDDEN = 40301
    ACCESS_DENIED = 40302

    # 资源不存在 40401-40499
    NOT_FOUND = 40401
    USER_NOT_FOUND = 40402
    RESOURCE_NOT_FOUND = 40403

    # 请求限制 42901-42999
    RATE_LIMIT = 42901
    TOO_MANY_REQUESTS = 42902

    # 服务器错误 50001-50099
    INTERNAL_ERROR = 50001
    DATABASE_ERROR = 50002
    EXTERNAL_SERVICE_ERROR = 50003

    # 服务不可用 50301-50399
    SERVICE_UNAVAILABLE = 50301
    SERVICE_MAINTENANCE = 50302
    DATABASE_UNAVAILABLE = 50303
    REDIS_UNAVAILABLE = 50304


class AIServiceUnavailable(Exception):
    """AI 网关不可用，供业务层执行降级或返回 503。"""

    def __init__(self, service: str = "AI", detail: str = ""):
        self.service = service
        self.detail = detail
        self.code = ErrorCode.SERVICE_UNAVAILABLE
        super().__init__(f"{service} 服务不可用: {detail}")


class AIServiceTimeout(Exception):
    """AI 网关超时，供业务层执行降级或返回超时错误。"""

    def __init__(self, service: str = "AI", detail: str = ""):
        self.service = service
        self.detail = detail
        self.code = ErrorCode.SERVICE_MAINTENANCE
        super().__init__(f"{service} 服务超时: {detail}")


# 错误码 -> 默认消息映射
ERROR_MESSAGES: dict[int, str] = {
    ErrorCode.SUCCESS: "成功",
    ErrorCode.INVALID_PARAMS: "参数无效",
    ErrorCode.MISSING_PARAMS: "缺少必要参数",
    ErrorCode.INVALID_FORMAT: "格式无效",
    ErrorCode.UNAUTHORIZED: "未授权",
    ErrorCode.TOKEN_INVALID: "令牌无效",
    ErrorCode.TOKEN_EXPIRED: "令牌已过期",
    ErrorCode.LOGIN_FAILED: "登录失败",
    ErrorCode.FORBIDDEN: "禁止访问",
    ErrorCode.ACCESS_DENIED: "拒绝访问",
    ErrorCode.NOT_FOUND: "资源不存在",
    ErrorCode.USER_NOT_FOUND: "用户不存在",
    ErrorCode.RESOURCE_NOT_FOUND: "资源不存在",
    ErrorCode.RATE_LIMIT: "请求频率限制",
    ErrorCode.TOO_MANY_REQUESTS: "请求过于频繁",
    ErrorCode.INTERNAL_ERROR: "服务器内部错误",
    ErrorCode.DATABASE_ERROR: "数据库错误",
    ErrorCode.EXTERNAL_SERVICE_ERROR: "外部服务错误",
    ErrorCode.SERVICE_UNAVAILABLE: "服务不可用",
    ErrorCode.SERVICE_MAINTENANCE: "服务维护中",
    ErrorCode.DATABASE_UNAVAILABLE: "数据库不可用",
    ErrorCode.REDIS_UNAVAILABLE: "Redis不可用",
}


# ──────────────────────────────────────
# 自定义异常类
# ──────────────────────────────────────

class AppException(Exception):
    """
    应用统一异常基类。
    所有业务逻辑层抛出的异常均应继承此类，保证响应格式统一。
    """

    def __init__(
        self,
        code: int = ErrorCode.INTERNAL_ERROR,
        message: str | None = None,
        data: Any = None,
        http_status: int = 400,
    ):
        self.code = code
        self.message = message or ERROR_MESSAGES.get(code, "未知错误")
        self.data = data
        self.http_status = http_status
        super().__init__(self.message)


class NotFoundException(AppException):
    """资源不存在"""

    def __init__(self, message: str | None = None, data: Any = None):
        super().__init__(
            code=ErrorCode.NOT_FOUND,
            message=message,
            data=data,
            http_status=404,
        )


class UnauthorizedException(AppException):
    """未授权"""

    def __init__(self, message: str | None = None):
        super().__init__(
            code=ErrorCode.UNAUTHORIZED,
            message=message,
            http_status=401,
        )


class ForbiddenException(AppException):
    """禁止访问"""

    def __init__(self, message: str | None = None):
        super().__init__(
            code=ErrorCode.FORBIDDEN,
            message=message,
            http_status=403,
        )


class ValidationException(AppException):
    """参数校验失败"""

    def __init__(self, message: str | None = None, data: Any = None):
        super().__init__(
            code=ErrorCode.INVALID_PARAMS,
            message=message,
            data=data,
            http_status=422,
        )


# ──────────────────────────────────────
# 全局异常处理器注册
# ──────────────────────────────────────

async def app_exception_handler(_request: Request, exc: AppException) -> JSONResponse:
    """处理 AppException 及其子类"""
    return JSONResponse(
        status_code=exc.http_status,
        content={
            "code": exc.code,
            "data": exc.data,
            "message": exc.message,
        },
    )


async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    """兜底处理未捕获异常，避免泄露堆栈信息"""
    return JSONResponse(
        status_code=500,
        content={
            "code": ErrorCode.INTERNAL_ERROR,
            "data": None,
            "message": ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR],
        },
    )


def register_exception_handlers(app) -> None:
    """在 FastAPI app 上注册全局异常处理器"""
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
