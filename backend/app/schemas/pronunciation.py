from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
from datetime import datetime


class PhonemeDetail(BaseModel):
    """单个音素对齐详情"""
    target: str = Field(..., description="目标音素")
    asr: str = Field(..., description="ASR识别音素")
    score: float = Field(..., ge=0, le=1, description="匹配分数")
    is_match: bool = Field(..., description="是否匹配")


class PronunciationAttemptResponse(BaseModel):
    """发音评估结果响应"""
    id: int
    target_text: str
    overall: float = Field(..., ge=0, le=100, description="综合评分(0-100)")
    accuracy: float = Field(..., ge=0, le=100, description="准确度(0-100)")
    fluency: float = Field(..., ge=0, le=100, description="流利度(0-100)")
    completeness: float = Field(..., ge=0, le=100, description="完整度(0-100)")
    phoneme_details: List[PhonemeDetail] = Field(default_factory=list, description="音素级详情")
    suggestions: List[str] = Field(default_factory=list, description="纠正建议")
    tts_demo_url: Optional[str] = Field(None, description="标准发音示范音频URL")
    audio_url: Optional[str] = Field(None, description="用户录音URL")
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PronunciationTaskResponse(BaseModel):
    """发音练习任务响应"""
    task_id: int = Field(..., description="任务ID")
    text: str = Field(..., description="练习文本")
    phonemes: List[str] = Field(default_factory=list, description="标准音素序列")
    demo_audio_url: Optional[str] = Field(None, description="标准发音示范音频URL")
    difficulty: str = Field("normal", description="难度级别")


class PronunciationHistoryItem(BaseModel):
    """发音历史记录项"""
    id: int
    target_text: str
    overall: float
    accuracy: float
    fluency: float
    completeness: float
    suggestions: List[str]
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PronunciationStats(BaseModel):
    """发音练习统计"""
    total_attempts: int = 0
    average_score: float = 0.0
    best_score: float = 0.0
    improvement_trend: float = 0.0  # 正数表示进步
