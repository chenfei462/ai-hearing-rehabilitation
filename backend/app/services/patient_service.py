"""
患者管理服务 - 听力师患者列表、患者训练状态查询

从原 ReportService 中拆分而来，负责听力师视角的患者管理逻辑。
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta, date
from typing import List
from app.models import TrainingSession, UserAbility, User
from app.schemas.report import PatientSummary
from app.utils.date_utils import to_date


class PatientService:
    """听力师患者管理服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_patients_for_therapist(self, therapist_id: int) -> List[PatientSummary]:
        """听力师查看患者列表（含预警信息）"""
        # 获取所有患者
        result = await self.db.execute(
            select(User).where(User.role == "patient").order_by(User.created_at.desc())
        )
        patients = result.scalars().all()
        patient_ids = [p.id for p in patients]

        if not patient_ids:
            return []

        today = date.today()

        # 批量查询：最近训练日期（每个患者一条记录）
        result = await self.db.execute(
            select(
                TrainingSession.user_id,
                func.max(func.date(TrainingSession.start_time)).label("last_date"),
            ).where(
                TrainingSession.user_id.in_(patient_ids)
            ).group_by(TrainingSession.user_id)
        )
        # last_date 需规范化为 date，后续用于计算 "距今天数"
        last_dates = {r.user_id: to_date(r.last_date) for r in result.all()}

        # 批量查询：基础统计
        result = await self.db.execute(
            select(
                TrainingSession.user_id,
                func.count(TrainingSession.id).label("total"),
                func.coalesce(func.avg(TrainingSession.accuracy), 0.0).label("avg_accuracy"),
            ).where(
                and_(
                    TrainingSession.user_id.in_(patient_ids),
                    TrainingSession.status == "completed",
                )
            ).group_by(TrainingSession.user_id)
        )
        stats_map = {r.user_id: r for r in result.all()}

        # 批量查询：依从率（最近 30 天的训练天数）
        thirty_days_ago = today - timedelta(days=30)
        result = await self.db.execute(
            select(
                TrainingSession.user_id,
                func.count(func.distinct(func.date(TrainingSession.start_time))).label("training_days"),
            ).where(
                and_(
                    TrainingSession.user_id.in_(patient_ids),
                    TrainingSession.start_time >= thirty_days_ago,
                    TrainingSession.status == "completed",
                )
            ).group_by(TrainingSession.user_id)
        )
        adherence_map = {r.user_id: r.training_days / 30.0 for r in result.all()}

        # 批量查询：连续训练天数（简化版：最近连续训练天数）
        result = await self.db.execute(
            select(
                TrainingSession.user_id,
                func.date(TrainingSession.start_time).label("date"),
            ).where(
                and_(
                    TrainingSession.user_id.in_(patient_ids),
                    TrainingSession.status == "completed",
                )
            ).group_by(TrainingSession.user_id, func.date(TrainingSession.start_time))
            .order_by(func.date(TrainingSession.start_time).desc())
        )
        # 按患者分组，计算连续天数
        streak_map = {}
        user_dates = {}
        for r in result.all():
            if r.user_id not in user_dates:
                user_dates[r.user_id] = []
            user_dates[r.user_id].append(to_date(r.date))

        for uid, dates in user_dates.items():
            streak = 0
            expected_date = today
            for d in dates:
                if d == expected_date:
                    streak += 1
                    expected_date = expected_date - timedelta(days=1)
                elif d < expected_date:
                    break
            streak_map[uid] = streak

        # 批量查询：当前最高级别
        result = await self.db.execute(
            select(UserAbility)
            .where(
                and_(
                    UserAbility.user_id.in_(patient_ids),
                    UserAbility.theta > 0,
                )
            )
            .order_by(UserAbility.theta.desc())
        )
        # 取每个患者的最高theta值
        level_map = {}
        for ability in result.scalars().all():
            if ability.user_id not in level_map:
                level_map[ability.user_id] = ability.level

        # 组装结果
        patient_summaries = []
        for patient in patients:
            last_date = last_dates.get(patient.id)
            stats = stats_map.get(patient.id)
            adherence = adherence_map.get(patient.id, 0.0)
            streak = streak_map.get(patient.id, 0)
            current_level = level_map.get(patient.id, "syllable")

            # 预警信息
            alert = None
            if last_date:
                days_since = (today - last_date).days
                if days_since >= 7:
                    alert = f"已 {days_since} 天未训练"
                elif days_since >= 3:
                    alert = f"已 {days_since} 天未训练，请关注"
            else:
                alert = "尚未开始训练"

            patient_summaries.append(PatientSummary(
                user_id=patient.id,
                nickname=patient.nickname or f"患者{patient.id}",
                phone=patient.phone or "",
                last_training_date=str(last_date) if last_date else None,
                total_sessions=stats.total if stats else 0,
                avg_accuracy=round(float(stats.avg_accuracy if stats and stats.avg_accuracy else 0), 4),
                adherence_rate=round(adherence, 4),
                current_level=current_level,
                streak_days=streak,
                alert=alert,
            ))

        return patient_summaries
