"""
ARQ 异步任务 Worker 配置
"""
from arq import create_pool
from arq.connections import RedisSettings
from app.core.config import get_settings

settings = get_settings()


async def startup(ctx):
    """Worker 启动"""
    ctx["redis"] = await create_pool(
        RedisSettings.from_dsn(settings.REDIS_URL)
    )


async def shutdown(ctx):
    """Worker 关闭"""
    await ctx["redis"].close()


class WorkerSettings:
    """ARQ Worker 配置"""
    functions = [
        "app.tasks.report_weekly.generate_weekly_report",
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    max_jobs = 10
    job_timeout = 300  # 5 分钟超时
    keep_result = 3600  # 保留结果 1 小时
