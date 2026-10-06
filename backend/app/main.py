"""
AI 听觉康复助手 - FastAPI 后端入口
集成：性能中间件、监控、种子数据、异常处理
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import get_settings
from app.core.database import engine
from app.core.redis import redis_client
from app.core.errors import register_exception_handlers

# API 路由
from app.api import auth, training, dialogue, pronunciation, report
from app.api.health import router as health_router
from app.api.metrics import router as metrics_router
from app.api.hardware import router as hardware_router

# 硬件集成
from app.hardware.config import get_hardware_config
from app.hardware.manager import device_manager

# 中间件
from app.middleware.performance import setup_middleware

# 监控
from app.monitoring.metrics import metrics_collector

# 数据库初始化
from app.db.init_db import init_database, seed_data

# 日志
from app.utils.logger import logger

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # ─── 启动 ───
    logger.info(f"正在启动 {settings.APP_NAME} v{settings.APP_VERSION}")

    # 初始化数据库表
    await init_database()

    # 填充种子数据
    await seed_data()

    # 测试 Redis 连接
    try:
        await redis_client.ping()
        logger.info("Redis 连接成功")
    except Exception as e:
        logger.warning(f"Redis 连接失败（缓存功能不可用）: {e}")

    # 初始化硬件集成
    hw_config = get_hardware_config()
    if hw_config.HARDWARE_ENABLED:
        try:
            # 注册 Mock 设备（开发/测试模式）
            if hw_config.HARDWARE_MOCK_MODE:
                from app.hardware.devices.mock_device import MockDevice
                mock = MockDevice()
                device_manager.register_device(mock)

            await device_manager.start()
            logger.info("硬件集成已启用")
        except Exception as e:
            logger.warning(f"硬件集成启动失败（硬件功能不可用）: {e}")
    else:
        logger.info("硬件集成已禁用")

    # 记录启动指标
    metrics_collector.increment("app_starts")

    logger.info("应用启动完成")

    yield

    # ─── 关闭 ───
    logger.info("正在关闭应用...")
    # 停止硬件管理器
    try:
        await device_manager.stop()
    except Exception:
        pass
    try:
        await redis_client.close()
    except Exception:
        pass
    await engine.dispose()
    logger.info("应用已关闭")


# 创建 FastAPI 应用
app = FastAPI(
    title="AI 听觉康复助手 API",
    description="帮助人工耳蜗术后患者进行家庭听觉训练的后端服务",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# 注册全局异常处理器
register_exception_handlers(app)

# CORS 配置 - 使用配置文件中的 CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time", "X-Cache"],
)

# 注册性能中间件（GZIP、缓存、限流、计时）
setup_middleware(app)

# ─── 注册路由 ───
app.include_router(health_router, tags=["健康检查"])
app.include_router(metrics_router, prefix="/api", tags=["监控"])
app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(training.router, prefix="/api/training", tags=["训练"])
app.include_router(dialogue.router, prefix="/api/dialogue", tags=["对话"])
app.include_router(pronunciation.router, prefix="/api/pronunciation", tags=["发音"])
app.include_router(report.router, prefix="/api/report", tags=["报告"])
app.include_router(hardware_router, prefix="/api/hardware", tags=["硬件"])


# 根路径
@app.get("/")
async def root():
    return {
        "code": 0,
        "data": {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "docs": "/docs" if settings.DEBUG else "请联系管理员获取 API 文档",
        },
        "message": "ok",
    }
