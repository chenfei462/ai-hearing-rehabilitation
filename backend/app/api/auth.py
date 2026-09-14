from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.errors import AppException, ErrorCode
from app.schemas.auth import SmsRequest, LoginRequest, TokenResponse, PreferencesUpdate
from app.schemas.response import ApiResponse, success_response
from app.services.auth_service import AuthService
from app.api.deps import get_current_user
from app.models.user import User
from app.core.config import get_settings

router = APIRouter()
settings = get_settings()


@router.post("/sms/send", response_model=ApiResponse)
async def send_sms(request: SmsRequest, db: AsyncSession = Depends(get_db)):
    """发送短信验证码"""
    service = AuthService(db)
    await service.send_sms(request.phone)
    return success_response(data={"message": "验证码已发送"})


@router.post("/login", response_model=ApiResponse)
async def login(request: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """手机号 + 验证码登录"""
    service = AuthService(db)
    result = await service.login(request.phone, request.code)
    if result is None:
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
        max_age=settings.ACCESS_TOKEN_EXPIRE_DAYS * 24 * 3600,
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
