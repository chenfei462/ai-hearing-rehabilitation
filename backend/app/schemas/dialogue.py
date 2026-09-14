"""
对话陪练模块 Pydantic DTO
"""
from pydantic import BaseModel, Field
from typing import Optional


class ScenarioInfo(BaseModel):
    """场景信息"""
    id: str = Field(..., description="场景标识")
    name: str = Field(..., description="场景名称")
    description: str = Field(..., description="场景描述")
    rounds: int = Field(default=5, description="建议对话轮次")


class StartSessionRequest(BaseModel):
    """开始对话会话请求"""
    scenario: str = Field(..., description="场景标识", examples=["ordering"])


class StartSessionResponse(BaseModel):
    """开始对话会话响应"""
    session_id: int = Field(..., description="会话ID")
    scenario: str = Field(..., description="场景标识")
    greeting_text: str = Field(..., description="AI开场白文本")
    greeting_audio_url: Optional[str] = Field(None, description="AI开场白音频URL")
    max_turns: int = Field(default=5, description="最大对话轮次")


class TurnResponse(BaseModel):
    """对话轮次响应"""
    turn_index: int = Field(..., description="轮次索引（从1开始）")
    user_text: str = Field(..., description="用户语音识别文本")
    ai_text: str = Field(..., description="AI回复文本")
    ai_audio_url: Optional[str] = Field(None, description="AI回复音频URL")
    latency_ms: int = Field(..., description="本轮响应延迟(ms)")
    remaining_turns: int = Field(..., description="剩余可用轮次")


class FinishSessionResponse(BaseModel):
    """结束对话会话响应"""
    session_id: int = Field(..., description="会话ID")
    scenario: str = Field(..., description="场景标识")
    turn_count: int = Field(..., description="总对话轮次")
    summary: str = Field(..., description="对话小结")
    duration_seconds: int = Field(..., description="对话总时长(秒)")
