"""
周报生成异步任务

功能：
1. 为所有活跃用户生成周报数据
2. 将周报数据存储/缓存到 Redis
3. 可通过 ARQ 调度定期执行

调度建议：
- 每周日凌晨 2:00 执行
- 可通过 cron 或 APScheduler 触发
"""
import logging
from datetime import datetime, timedelta, date, timezone
from typing import Optional

from sqlalchemy import select, and_, func, distinct
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import get_settings
from app.models import User, TrainingSession
from app.services.report_service import ReportService
from app.schemas.report import WeeklyReportData

logger = logging.getLogger(__name__)
settings = get_settings()


async def get_async_session() -> AsyncSession:
    """创建异步数据库会话（用于独立任务执行）"""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return session_factory()


async def generate_all_weekly_reports(ctx) -> dict:
    """
    为所有活跃用户生成周报

    判断"活跃用户"：最近 30 天内有训练记录的用户。
    生成的周报数据暂存到日志中（后续可扩展为存入数据库或 Redis）。
    """
    logger.info("开始生成周报...")
    start_time = datetime.now(timezone.utc)

    db = await get_async_session()
    try:
        # 获取活跃用户（最近 30 天有训练记录）
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        result = await db.execute(
            select(User.id)
            .join(TrainingSession, TrainingSession.user_id == User.id)
            .where(
                and_(
                    User.role == "patient",
                    TrainingSession.start_time >= thirty_days_ago,
                    TrainingSession.status == "completed",
                )
            )
            .distinct()
        )
        user_ids = [r[0] for r in result.all()]

        logger.info(f"找到 {len(user_ids)} 个活跃用户")

        success_count = 0
        error_count = 0

        for user_id in user_ids:
            try:
                service = ReportService(db)
                weekly_report = await service.generate_weekly_report(user_id)

                # 记录周报生成结果
                logger.info(
                    f"用户 {user_id} 周报生成成功: "
                    f"sessions={weekly_report.total_sessions}, "
                    f"accuracy={weekly_report.avg_accuracy:.2%}, "
                    f"adherence={weekly_report.adherence_rate:.2%}, "
                    f"trend={weekly_report.accuracy_trend}"
                )

                # TODO: 后续可将周报存入数据库或 Redis 缓存
                # await save_weekly_report_to_db(db, weekly_report)
                # await cache_weekly_report_to_redis(ctx["redis"], weekly_report)

                success_count += 1
            except Exception as e:
                logger.error(f"用户 {user_id} 周报生成失败: {e}")
                error_count += 1

        elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
        result = {
            "total_users": len(user_ids),
            "success": success_count,
            "errors": error_count,
            "elapsed_seconds": round(elapsed, 2),
        }
        logger.info(f"周报生成完成: {result}")
        return result

    except Exception as e:
        logger.error(f"周报生成任务异常: {e}")
        raise
    finally:
        await db.close()


async def generate_single_weekly_report(ctx, user_id: int) -> Optional[WeeklyReportData]:
    """
    为单个用户生成周报

    可通过 ARQ 手动触发，例如：
        await redis.enqueue_job('generate_single_weekly_report', user_id=123)
    """
    logger.info(f"为用户 {user_id} 生成周报...")
    db = await get_async_session()
    try:
        service = ReportService(db)
        weekly_report = await service.generate_weekly_report(user_id)
        logger.info(f"用户 {user_id} 周报生成完成")
        return weekly_report
    except Exception as e:
        logger.error(f"用户 {user_id} 周报生成失败: {e}")
        raise
    finally:
        await db.close()
