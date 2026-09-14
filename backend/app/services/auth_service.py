import json
import random
import logging
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.models.ability import UserAbility
from app.core.security import create_access_token
from app.core.redis import get_redis
from app.core.errors import AppException, ErrorCode
from typing import Optional

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def send_sms(self, phone: str) -> bool:
        """发送短信验证码

        临时方案：生成 4 位随机验证码，存入 Redis（5 分钟过期）。
        生产环境需集成阿里云 SMS。
        """
        code = f"{random.randint(1000, 9999)}"
        try:
            redis = await get_redis()
            await redis.setex(f"sms:{phone}", 300, code)
        except Exception as e:
            logger.error(f"Redis 不可用，无法发送验证码: {e}")
            raise AppException(
                code=ErrorCode.REDIS_UNAVAILABLE,
                message="短信服务暂时不可用，请稍后再试",
                http_status=503,
            )
        # TODO: 集成阿里云 SMS 发送
        logger.info(f"[SMS] 向 {phone[-4:]}**** 发送验证码成功")
        return True

    async def verify_sms(self, phone: str, code: str) -> bool:
        """验证短信验证码"""
        try:
            redis = await get_redis()
            stored = await redis.get(f"sms:{phone}")
            if stored and stored == code:
                await redis.delete(f"sms:{phone}")
                return True
        except Exception as e:
            logger.error(f"Redis 不可用，无法验证验证码: {e}")
            raise AppException(
                code=ErrorCode.REDIS_UNAVAILABLE,
                message="验证服务暂时不可用，请稍后再试",
                http_status=503,
            )
        return False

    async def get_or_create_user(self, phone: str) -> User:
        """获取或创建用户，新用户自动创建各级别能力记录"""
        result = await self.db.execute(select(User).where(User.phone == phone))
        user = result.scalar_one_or_none()

        if not user:
            user = User(phone=phone, nickname=f"用户{phone[-4:]}")
            self.db.add(user)
            await self.db.flush()

            # 为新用户创建各级别能力记录
            for level in ["syllable", "word", "sentence", "noise"]:
                ability = UserAbility(user_id=user.id, level=level)
                self.db.add(ability)

        return user

    async def login(self, phone: str, code: str) -> Optional[dict]:
        """手机号+验证码登录，返回 token 和用户信息"""
        if not await self.verify_sms(phone, code):
            return None

        user = await self.get_or_create_user(phone)
        token = create_access_token({"sub": str(user.id), "role": user.role})

        return {
            "token": token,
            "user": {
                "id": user.id,
                "phone": user.phone,
                "role": user.role,
                "nickname": user.nickname,
            },
        }

    async def get_user_by_id(self, user_id: int) -> Optional[User]:
        """根据用户 ID 查询用户"""
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def update_preferences(self, user: User, preferences: dict) -> None:
        """更新用户无障碍偏好设置（存入 cochlear_info 或 consent_flags）"""
        current_info = user.cochlear_info or {}
        # 合并无障碍偏好到 cochlear_info.accessibility 字段
        accessibility = current_info.get("accessibility", {})
        accessibility.update(preferences)
        current_info["accessibility"] = accessibility
        user.cochlear_info = current_info
        await self.db.flush()
