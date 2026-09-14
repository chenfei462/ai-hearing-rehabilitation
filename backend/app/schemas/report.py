"""
报告相关 Pydantic Schema
"""
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime


class AccuracyPoint(BaseModel):
    """正确率曲线数据点"""
    date: str
    accuracy: float
    session_count: int = 0


class LevelProgress(BaseModel):
    """各训练级别进度"""
    level: str
    theta: float = 0.0
    se: float = 1.0
    session_count: int = 0
    avg_accuracy: float = 0.0


class DailyActivity(BaseModel):
    """每日活动记录"""
    date: str
    session_count: int = 0
    total_items: int = 0
    duration_minutes: float = 0.0


class TrainingSummary(BaseModel):
    """用户训练概览"""
    total_sessions: int = 0
    total_items: int = 0
    correct_items: int = 0
    avg_accuracy: float = 0.0
    total_duration_minutes: float = 0.0
    accuracy_curve: List[AccuracyPoint] = []
    adherence_rate: float = 0.0
    daily_activity: List[DailyActivity] = []
    level_progress: List[LevelProgress] = []
    streak_days: int = 0
    last_training_date: Optional[str] = None


class WeeklyReportData(BaseModel):
    """周报数据"""
    user_id: int
    week_start: str
    week_end: str
    total_sessions: int = 0
    total_duration_minutes: float = 0.0
    avg_accuracy: float = 0.0
    adherence_rate: float = 0.0
    accuracy_trend: str = ""  # "improving" / "stable" / "declining"
    level_progress: List[LevelProgress] = []
    daily_breakdown: List[DailyActivity] = []
    highlight: str = ""  # 本周亮点
    suggestion: str = ""  # 改进建议


class PatientSummary(BaseModel):
    """患者概要（听力师视角）"""
    user_id: int
    nickname: str
    phone: str = ""
    last_training_date: Optional[str] = None
    total_sessions: int = 0
    avg_accuracy: float = 0.0
    adherence_rate: float = 0.0
    current_level: str = ""
    streak_days: int = 0
    alert: Optional[str] = None  # 预警信息（如连续多天未训练）


class LevelDistribution(BaseModel):
    """训练级别分布"""
    level: str
    count: int
