"""
健康检查 API
"""
from fastapi import APIRouter
from datetime import datetime, timezone

from app.schemas.response import success_response
from app.core.config import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    基础健康检查接口（供 Docker healthcheck / LB 使用）
    """
    return success_response(
        data={
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": settings.APP_VERSION,
            "service": settings.APP_NAME,
        },
        message="服务运行正常",
    )


@router.get("/health/detailed")
async def detailed_health_check():
    """
    详细健康检查接口（检查数据库和 Redis 连通性）
    """
    from app.core.database import engine
    from app.core.redis import redis_client

    health_status = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": settings.APP_VERSION,
        "service": settings.APP_NAME,
        "checks": {
            "database": "unknown",
            "redis": "unknown",
        },
    }

    overall_healthy = True

    # 检查数据库连接
    try:
        async with engine.connect() as conn:
            await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        health_status["checks"]["database"] = "healthy"
    except Exception as e:
        health_status["checks"]["database"] = f"unhealthy: {str(e)}"
        overall_healthy = False

    # 检查 Redis 连接
    try:
        await redis_client.ping()
        health_status["checks"]["redis"] = "healthy"
    except Exception as e:
        health_status["checks"]["redis"] = f"unhealthy: {str(e)}"
        overall_healthy = False

    health_status["status"] = "healthy" if overall_healthy else "degraded"

    status_code = 200 if overall_healthy else 503
    return success_response(
        data=health_status,
        message="健康检查完成",
    )
