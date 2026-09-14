"""
训练统计服务 - 训练数据聚合、趋势分析、依从率计算、周报数据生成

从原 ReportService 中拆分而来，负责所有训练统计相关逻辑。
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, distinct
from datetime import datetime, timedelta, date, timezone
from typing import List
from app.models import TrainingSession, UserAbility
from app.schemas.report import (
    TrainingSummary, AccuracyPoint, LevelProgress, DailyActivity,
    WeeklyReportData, LevelDistribution,
)
from app.utils.date_utils import to_date


class TrainingStatsService:
    """训练统计服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_summary(self, user_id: int, days: int = 30) -> TrainingSummary:
        """获取用户训练概览（含正确率曲线、依从率、连续训练天数）"""
        start_date = datetime.now(timezone.utc) - timedelta(days=days)

        # --- 1. 基础统计 ---
        result = await self.db.execute(
            select(
                func.count(TrainingSession.id).label("total_sessions"),
                func.coalesce(func.sum(TrainingSession.total_items), 0).label("total_items"),
                func.coalesce(func.sum(TrainingSession.correct_items), 0).label("correct_items"),
                func.coalesce(func.avg(TrainingSession.accuracy), 0.0).label("avg_accuracy"),
            ).where(
                and_(
                    TrainingSession.user_id == user_id,
                    TrainingSession.start_time >= start_date,
                    TrainingSession.status == "completed",
                )
            )
        )
        stats = result.one()

        # --- 2. 正确率曲线（按日聚合）---
        result = await self.db.execute(
            select(
                func.date(TrainingSession.start_time).label("date"),
                func.avg(TrainingSession.accuracy).label("avg_accuracy"),
                func.count(TrainingSession.id).label("session_count"),
            ).where(
                and_(
                    TrainingSession.user_id == user_id,
                    TrainingSession.start_time >= start_date,
                    TrainingSession.status == "completed",
                )
            ).group_by(func.date(TrainingSession.start_time))
            .order_by(func.date(TrainingSession.start_time))
        )
        accuracy_curve = [
            AccuracyPoint(
                date=str(r.date),
                accuracy=round(float(r.avg_accuracy or 0), 4),
                session_count=r.session_count,
            )
            for r in result.all()
        ]

        # --- 3. 每日活动（含训练时长估算）---
        result = await self.db.execute(
            select(
                func.date(TrainingSession.start_time).label("date"),
                func.count(TrainingSession.id).label("session_count"),
                func.coalesce(func.sum(TrainingSession.total_items), 0).label("total_items"),
                func.coalesce(
                    func.sum(
                        func.extract('epoch', TrainingSession.end_time - TrainingSession.start_time) / 60.0
                    ), 0.0
                ).label("duration_minutes"),
            ).where(
                and_(
                    TrainingSession.user_id == user_id,
                    TrainingSession.start_time >= start_date,
                    TrainingSession.status == "completed",
                    TrainingSession.end_time.isnot(None),
                )
            ).group_by(func.date(TrainingSession.start_time))
            .order_by(func.date(TrainingSession.start_time))
        )
        daily_activity = [
            DailyActivity(
                date=str(r.date),
                session_count=r.session_count,
                total_items=r.total_items,
                duration_minutes=round(float(r.duration_minutes or 0), 1),
            )
            for r in result.all()
        ]

        # --- 4. 依从率计算 ---
        adherence_rate = await self._calculate_adherence(user_id, days)

        # --- 5. 连续训练天数 ---
        streak_days = await self._calculate_streak(user_id)

        # --- 6. 各级别能力 ---
        result = await self.db.execute(
            select(UserAbility).where(UserAbility.user_id == user_id)
        )
        abilities = {a.level: a for a in result.scalars().all()}

        # 各级别会话统计
        result = await self.db.execute(
            select(
                TrainingSession.level,
                func.count(TrainingSession.id).label("count"),
                func.coalesce(func.avg(TrainingSession.accuracy), 0.0).label("avg_accuracy"),
            ).where(
                and_(
                    TrainingSession.user_id == user_id,
                    TrainingSession.status == "completed",
                )
            ).group_by(TrainingSession.level)
        )
        session_stats = {r.level: r for r in result.all()}

        level_progress = []
        for level in ["syllable", "word", "sentence", "noise"]:
            ability = abilities.get(level)
            stats_for_level = session_stats.get(level)
            level_progress.append(LevelProgress(
                level=level,
                theta=round(ability.theta, 4) if ability else 0.0,
                se=round(ability.se, 4) if ability else 1.0,
                session_count=stats_for_level.count if stats_for_level else 0,
                avg_accuracy=round(float(stats_for_level.avg_accuracy or 0), 4) if stats_for_level else 0.0,
            ))

        # --- 7. 最后训练日期 ---
        result = await self.db.execute(
            select(func.max(func.date(TrainingSession.start_time)))
            .where(TrainingSession.user_id == user_id)
        )
        last_training_date = to_date(result.scalar())

        # --- 8. 总训练时长 ---
        total_duration = sum(d.duration_minutes for d in daily_activity)

        return TrainingSummary(
            total_sessions=stats.total_sessions or 0,
            total_items=stats.total_items or 0,
            correct_items=stats.correct_items or 0,
            avg_accuracy=round(float(stats.avg_accuracy or 0), 4),
            total_duration_minutes=round(total_duration, 1),
            accuracy_curve=accuracy_curve,
            adherence_rate=round(adherence_rate, 4),
            daily_activity=daily_activity,
            level_progress=level_progress,
            streak_days=streak_days,
            last_training_date=str(last_training_date) if last_training_date else None,
        )

    async def get_level_distribution(self, user_id: int) -> List[LevelDistribution]:
        """获取训练级别分布"""
        result = await self.db.execute(
            select(
                TrainingSession.level,
                func.count(TrainingSession.id).label("count"),
            ).where(TrainingSession.user_id == user_id)
            .group_by(TrainingSession.level)
        )
        return [LevelDistribution(level=r.level, count=r.count) for r in result.all()]

    async def generate_weekly_report(self, user_id: int) -> WeeklyReportData:
        """生成用户周报数据"""
        today = date.today()
        # 本周一
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        start_dt = datetime.combine(week_start, datetime.min.time())

        # 本周统计
        result = await self.db.execute(
            select(
                func.count(TrainingSession.id).label("total_sessions"),
                func.coalesce(func.avg(TrainingSession.accuracy), 0.0).label("avg_accuracy"),
                func.coalesce(
                    func.sum(
                        func.extract('epoch', TrainingSession.end_time - TrainingSession.start_time) / 60.0
                    ), 0.0
                ).label("duration_minutes"),
            ).where(
                and_(
                    TrainingSession.user_id == user_id,
                    TrainingSession.start_time >= start_dt,
                    TrainingSession.status == "completed",
                    TrainingSession.end_time.isnot(None),
                )
            )
        )
        stats = result.one()

        # 本周依从率
        adherence = await self._calculate_adherence_for_period(user_id, week_start, week_end)

        # 与上周对比判断趋势
        prev_week_start = week_start - timedelta(days=7)
        prev_week_end = week_start - timedelta(days=1)
        prev_start_dt = datetime.combine(prev_week_start, datetime.min.time())
        prev_end_dt = datetime.combine(prev_week_end, datetime.max.time())

        result = await self.db.execute(
            select(func.coalesce(func.avg(TrainingSession.accuracy), 0.0))
            .where(
                and_(
                    TrainingSession.user_id == user_id,
                    TrainingSession.start_time >= prev_start_dt,
                    TrainingSession.start_time <= prev_end_dt,
                    TrainingSession.status == "completed",
                )
            )
        )
        prev_avg_accuracy = float(result.scalar() or 0)
        current_avg = float(stats.avg_accuracy or 0)

        if current_avg > prev_avg_accuracy + 0.05:
            trend = "improving"
        elif current_avg < prev_avg_accuracy - 0.05:
            trend = "declining"
        else:
            trend = "stable"

        # 各级别进度
        result = await self.db.execute(
            select(
                TrainingSession.level,
                func.count(TrainingSession.id).label("count"),
                func.coalesce(func.avg(TrainingSession.accuracy), 0.0).label("avg_accuracy"),
            ).where(
                and_(
                    TrainingSession.user_id == user_id,
                    TrainingSession.start_time >= start_dt,
                    TrainingSession.status == "completed",
                )
            ).group_by(TrainingSession.level)
        )
        level_stats = {r.level: r for r in result.all()}

        result = await self.db.execute(
            select(UserAbility).where(UserAbility.user_id == user_id)
        )
        abilities = {a.level: a for a in result.scalars().all()}

        level_progress = []
        for level in ["syllable", "word", "sentence", "noise"]:
            ability = abilities.get(level)
            ls = level_stats.get(level)
            level_progress.append(LevelProgress(
                level=level,
                theta=round(ability.theta, 4) if ability else 0.0,
                se=round(ability.se, 4) if ability else 1.0,
                session_count=ls.count if ls else 0,
                avg_accuracy=round(float(ls.avg_accuracy or 0), 4) if ls else 0.0,
            ))

        # 每日明细
        result = await self.db.execute(
            select(
                func.date(TrainingSession.start_time).label("date"),
                func.count(TrainingSession.id).label("session_count"),
                func.coalesce(func.sum(TrainingSession.total_items), 0).label("total_items"),
                func.coalesce(
                    func.sum(
                        func.extract('epoch', TrainingSession.end_time - TrainingSession.start_time) / 60.0
                    ), 0.0
                ).label("duration_minutes"),
            ).where(
                and_(
                    TrainingSession.user_id == user_id,
                    TrainingSession.start_time >= start_dt,
                    TrainingSession.status == "completed",
                    TrainingSession.end_time.isnot(None),
                )
            ).group_by(func.date(TrainingSession.start_time))
            .order_by(func.date(TrainingSession.start_time))
        )
        daily_breakdown = [
            DailyActivity(
                date=str(r.date),
                session_count=r.session_count,
                total_items=r.total_items,
                duration_minutes=round(float(r.duration_minutes or 0), 1),
            )
            for r in result.all()
        ]

        # 生成亮点和建议
        highlight = self._generate_highlight(stats.total_sessions or 0, current_avg, trend)
        suggestion = self._generate_suggestion(current_avg, adherence, trend)

        return WeeklyReportData(
            user_id=user_id,
            week_start=str(week_start),
            week_end=str(week_end),
            total_sessions=stats.total_sessions or 0,
            total_duration_minutes=round(float(stats.duration_minutes or 0), 1),
            avg_accuracy=round(current_avg, 4),
            adherence_rate=round(adherence, 4),
            accuracy_trend=trend,
            level_progress=level_progress,
            daily_breakdown=daily_breakdown,
            highlight=highlight,
            suggestion=suggestion,
        )

    # ---- 私有方法 ----

    async def _calculate_adherence(self, user_id: int, days: int) -> float:
        """计算依从率：实际训练天数 / 天数范围"""
        start_date = datetime.now(timezone.utc) - timedelta(days=days)

        result = await self.db.execute(
            select(func.count(distinct(func.date(TrainingSession.start_time))))
            .where(
                and_(
                    TrainingSession.user_id == user_id,
                    TrainingSession.start_time >= start_date,
                    TrainingSession.status == "completed",
                )
            )
        )
        active_days = result.scalar() or 0
        return active_days / days if days > 0 else 0.0

    async def _calculate_adherence_for_period(
        self, user_id: int, start: date, end: date
    ) -> float:
        """计算指定时间段的依从率"""
        days = (end - start).days + 1
        start_dt = datetime.combine(start, datetime.min.time())
        end_dt = datetime.combine(end, datetime.max.time())

        result = await self.db.execute(
            select(func.count(distinct(func.date(TrainingSession.start_time))))
            .where(
                and_(
                    TrainingSession.user_id == user_id,
                    TrainingSession.start_time >= start_dt,
                    TrainingSession.start_time <= end_dt,
                    TrainingSession.status == "completed",
                )
            )
        )
        active_days = result.scalar() or 0
        return active_days / days if days > 0 else 0.0

    async def _calculate_streak(self, user_id: int) -> int:
        """计算连续训练天数（从今天往回数）"""
        result = await self.db.execute(
            select(distinct(func.date(TrainingSession.start_time)).label("date"))
            .where(
                and_(
                    TrainingSession.user_id == user_id,
                    TrainingSession.status == "completed",
                )
            )
            .order_by(func.date(TrainingSession.start_time).desc())
        )
        # SQLite 的 func.date() 返回字符串，需统一规范化为 date 后再比较
        training_dates = [d for d in (to_date(r.date) for r in result.all()) if d]

        if not training_dates:
            return 0

        streak = 0
        check_date = date.today()

        for td in training_dates:
            if td == check_date:
                streak += 1
                check_date -= timedelta(days=1)
            elif td == check_date - timedelta(days=1):
                # 允许今天还没训练，从昨天开始算
                streak += 1
                check_date = td - timedelta(days=1)
            elif td < check_date:
                break

        return streak

    @staticmethod
    def _generate_highlight(total_sessions: int, avg_accuracy: float, trend: str) -> str:
        """生成周报亮点"""
        highlights = []
        if total_sessions >= 5:
            highlights.append(f"本周完成 {total_sessions} 次训练，非常积极")
        elif total_sessions >= 3:
            highlights.append(f"本周完成 {total_sessions} 次训练")
        if avg_accuracy >= 0.8:
            highlights.append("平均正确率超过 80%，表现优秀")
        if trend == "improving":
            highlights.append("正确率持续提升")
        return "；".join(highlights) if highlights else "请继续保持训练习惯"

    @staticmethod
    def _generate_suggestion(avg_accuracy: float, adherence: float, trend: str) -> str:
        """生成周报建议"""
        suggestions = []
        if adherence < 0.5:
            suggestions.append("建议每天坚持训练，提高依从率")
        if avg_accuracy < 0.6:
            suggestions.append("当前正确率较低，建议从基础级别开始巩固")
        elif avg_accuracy < 0.8:
            suggestions.append("建议重点练习薄弱环节，逐步提升难度")
        if trend == "declining":
            suggestions.append("正确率有所下降，建议回顾之前的内容")
        return "；".join(suggestions) if suggestions else "训练情况良好，请继续保持"
