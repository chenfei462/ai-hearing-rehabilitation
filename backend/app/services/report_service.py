"""
报告服务 - 聚合层

聚合训练统计和患者管理两个子服务，保持对外 API 不变。
具体职责已拆分至：
  - TrainingStatsService: 训练数据聚合、趋势分析、依从率计算、周报生成
  - PatientService: 听力师患者列表管理
"""
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.services.training_stats_service import TrainingStatsService
from app.services.patient_service import PatientService
from app.schemas.report import (
    TrainingSummary, WeeklyReportData, PatientSummary, LevelDistribution,
)


class ReportService:
    """报告服务（聚合层）- 委托给子服务执行"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._training_stats = TrainingStatsService(db)
        self._patient_service = PatientService(db)

    async def get_summary(self, user_id: int, days: int = 30) -> TrainingSummary:
        """获取用户训练概览（含正确率曲线、依从率、连续训练天数）"""
        return await self._training_stats.get_summary(user_id, days)

    async def get_level_distribution(self, user_id: int) -> List[LevelDistribution]:
        """获取训练级别分布"""
        return await self._training_stats.get_level_distribution(user_id)

    async def get_patients_for_therapist(self, therapist_id: int) -> List[PatientSummary]:
        """听力师查看患者列表（含预警信息）"""
        return await self._patient_service.get_patients_for_therapist(therapist_id)

    async def generate_weekly_report(self, user_id: int) -> WeeklyReportData:
        """生成用户周报数据"""
        return await self._training_stats.generate_weekly_report(user_id)

    # ---- 向后兼容：静态方法代理 ----

    @staticmethod
    def _generate_highlight(total_sessions: int, avg_accuracy: float, trend: str) -> str:
        """生成周报亮点（代理）"""
        return TrainingStatsService._generate_highlight(total_sessions, avg_accuracy, trend)

    @staticmethod
    def _generate_suggestion(avg_accuracy: float, adherence: float, trend: str) -> str:
        """生成周报建议（代理）"""
        return TrainingStatsService._generate_suggestion(avg_accuracy, adherence, trend)
