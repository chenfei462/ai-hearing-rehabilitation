from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.errors import AppException, ErrorCode
from app.schemas.auth import SmsRequest, LoginRequest, PreferencesUpdate
from app.schemas.response import ApiResponse, success_response
from app.services.auth_service import AuthService
from app.api.deps import get_current_user
from app.models.user import User
from app.core.config import get_settings
from app.core.redis import get_redis
import time

router = APIRouter()
settings = get_settings()

# 登录限流配置：5次失败 / 15分钟锁定
LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5
LOGIN_RATE_LIMIT_WINDOW_SECONDS = 900  # 15分钟
LOGIN_RATE_LIMIT_LOCK_SECONDS = 900    # 锁定15分钟


async def _check_login_rate_limit(phone: str) -> None:
    """检查登录失败次数，超限则抛出限流异常"""
    try:
        redis = await get_redis()
        key = f"login:fail:{phone}"
        lock_key = f"login:lock:{phone}"
        # 检查是否已被锁定
        locked = await redis.get(lock_key)
        if locked:
            remaining = int(locked) - int(time.time())
            if remaining > 0:
                raise AppException(
                    code=ErrorCode.TOO_MANY_REQUESTS,
                    message=f"登录尝试次数过多，请在 {remaining // 60} 分钟后重试",
                    http_status=429,
                )
            # 锁定已过期，清理计数器
            await redis.delete(key)
            await redis.delete(lock_key)
        # 获取当前失败次数
        fail_count = await redis.get(key)
        if fail_count and int(fail_count) >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS:
            # 达到上限，设置锁定
            await redis.setex(lock_key, LOGIN_RATE_LIMIT_LOCK_SECONDS, int(time.time()) + LOGIN_RATE_LIMIT_LOCK_SECONDS)
            raise AppException(
                code=ErrorCode.TOO_MANY_REQUESTS,
                message=f"登录失败次数过多，已锁定 {LOGIN_RATE_LIMIT_LOCK_SECONDS // 60} 分钟",
                http_status=429,
            )
    except AppException:
        raise
    except Exception as e:
        # Redis 不可用时降级处理：允许请求继续（避免阻塞合法用户）
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Redis 不可用，跳过登录限流检查: {e}")


async def _record_login_failure(phone: str) -> None:
    """记录一次登录失败"""
    try:
        redis = await get_redis()
        key = f"login:fail:{phone}"
        # 原子递增失败计数，窗口期内过期
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, LOGIN_RATE_LIMIT_WINDOW_SECONDS)
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Redis 不可用，无法记录登录失败: {e}")


@router.post("/sms/send", response_model=ApiResponse)
async def send_sms(request: SmsRequest, db: AsyncSession = Depends(get_db)):
    """发送短信验证码"""
    service = AuthService(db)
    await service.send_sms(request.phone)
    return success_response(data={"message": "验证码已发送"})


@router.post("/login", response_model=ApiResponse)
async def login(request: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """手机号 + 验证码登录"""
    # 登录限流检查
    await _check_login_rate_limit(request.phone)

    service = AuthService(db)
    result = await service.login(request.phone, request.code)
    if result is None:
        # 记录失败次数
        await _record_login_failure(request.phone)
        raise AppException(
            code=ErrorCode.LOGIN_FAILED,
            message="验证码错误或已过期",
            http_status=401,
        )

    # 设置 httpOnly cookie
    response.set_cookie(
        key="access_token",
        value=result["token"],
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_HOURS * 3600,
        path="/",
    )

    # 返回用户信息（不再返回 token）
    return {"code": 0, "data": {"user": result["user"]}, "message": "ok"}


@router.post("/logout", response_model=ApiResponse)
async def logout(response: Response):
    """登出并清除 cookie"""
    response.delete_cookie(
        key="access_token",
        path="/",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
    )
    return {"code": 0, "data": {"message": "已登出"}, "message": "ok"}


@router.get("/me", response_model=ApiResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """获取当前用户信息"""
    return {
        "code": 0,
        "data": {
            "id": current_user.id,
            "phone": current_user.phone,
            "role": current_user.role,
            "nickname": current_user.nickname,
            "birth_year": current_user.birth_year,
            "cochlear_info": current_user.cochlear_info,
            "consent_flags": current_user.consent_flags,
        },
        "message": "ok",
    }


@router.put("/users/me/preferences", response_model=ApiResponse)
async def update_preferences(
    preferences: PreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新用户无障碍偏好"""
    service = AuthService(db)
    prefs_dict = preferences.model_dump(exclude_none=True)
    await service.update_preferences(current_user, prefs_dict)
    return {"code": 0, "data": {"message": "偏好已更新"}, "message": "ok"}
