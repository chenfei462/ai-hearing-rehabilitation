"""
Redis 配置
"""
import redis.asyncio as redis

from app.core.config import settings

# 创建 Redis 客户端
redis_client = redis.from_url(
    settings.REDIS_URL,
    encoding="utf-8",
    decode_responses=True,
)


async def get_redis() -> redis.Redis:
    """
    获取 Redis 客户端
    """
    return redis_client
