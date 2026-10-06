from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import verify_token
from app.models.user import User
from app.services.auth_service import AuthService


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    # 优先从 Authorization: Bearer <token> 获取，其次回退到 httpOnly cookie。
    # 浏览器端使用 cookie（防 XSS 窃取），移动端/第三方客户端使用 Bearer 头。
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
    if not token:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 40101, "message": "未登录或 token 失效"},
        )

    payload = verify_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 40101, "message": "未登录或 token 失效"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 40101, "message": "无效的 token"},
        )

    auth_service = AuthService(db)
    user = await auth_service.get_user_by_id(int(user_id))

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 40101, "message": "用户不存在"},
        )

    return user


async def get_current_therapist(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != "therapist":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": 40301, "message": "需要听力师权限"},
        )
    return current_user
