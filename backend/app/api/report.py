"""
报告 API 路由
- GET /report/summary  用户训练概览（含正确率曲线、依从率）
- GET /report/levels    各级别训练分布
- GET /report/patients  听力师查看患者列表
- GET /report/weekly    生成周报
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user, get_current_therapist
from app.services.report_service import ReportService
from app.schemas.common import ApiResponse
from app.models.user import User

router = APIRouter()


@router.get("/summary", response_model=ApiResponse)
async def get_summary(
    days: int = Query(30, ge=1, le=365, description="统计天数范围"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    用户训练概览

    返回内容：
    - 基础统计（总会话数、总题数、总正确数、平均正确率）
    - 正确率曲线（accuracy_curve: 按日聚合的正确率变化）
    - 依从率（adherence_rate: 实际训练天数 / 统计天数）
    - 连续训练天数（streak_days）
    - 各级别进度（level_progress）
    - 每日活动明细（daily_activity）
    - 总训练时长（total_duration_minutes，单位分钟）
    """
    service = ReportService(db)
    summary = await service.get_summary(current_user.id, days)
    return {"code": 0, "data": summary.model_dump(), "message": "ok"}


@router.get("/levels", response_model=ApiResponse)
async def get_level_distribution(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取各训练级别的会话分布"""
    service = ReportService(db)
    distribution = await service.get_level_distribution(current_user.id)
    return {
        "code": 0,
        "data": [d.model_dump() for d in distribution],
        "message": "ok",
    }


@router.get("/patients", response_model=ApiResponse)
async def get_patients(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_therapist),
):
    """
    听力师查看患者列表

    需要 role=therapist 权限。返回每位患者的：
    - 基本信息（昵称、手机号）
    - 训练统计（总会话数、平均正确率）
    - 依从率（最近30天）
    - 当前训练级别
    - 连续训练天数
    - 预警信息（如连续多天未训练）
    """
    service = ReportService(db)
    patients = await service.get_patients_for_therapist(current_user.id)
    return {
        "code": 0,
        "data": [p.model_dump() for p in patients],
        "message": "ok",
    }


@router.get("/weekly", response_model=ApiResponse)
async def get_weekly_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    生成周报

    返回本周的训练数据汇总：
    - 训练次数、时长、平均正确率
    - 依从率
    - 与上周对比的趋势（improving/stable/declining）
    - 各级别进度
    - 每日明细
    - 亮点和建议
    """
    service = ReportService(db)
    weekly = await service.generate_weekly_report(current_user.id)
    return {"code": 0, "data": weekly.model_dump(), "message": "ok"}
