from pydantic import BaseModel, Field
from typing import Optional, Dict, Any


class SmsRequest(BaseModel):
    """发送短信验证码请求"""
    phone: str = Field(..., min_length=11, max_length=11, pattern=r"^1[3-9]\d{9}$", description="手机号")


class LoginRequest(BaseModel):
    """手机号+验证码登录请求"""
    phone: str = Field(..., min_length=11, max_length=11, pattern=r"^1[3-9]\d{9}$")
    code: str = Field(..., min_length=4, max_length=6, description="验证码")


class WechatLoginRequest(BaseModel):
    """微信登录请求"""
    wx_code: str


class TokenResponse(BaseModel):
    """登录成功响应"""
    token: str
    user: dict


class PreferencesUpdate(BaseModel):
    """无障碍偏好更新"""
    font_scale: Optional[float] = Field(None, ge=0.8, le=3.0, description="字体缩放比例")
    volume: Optional[float] = Field(None, ge=0.0, le=1.0, description="音量")
    voice_guide: Optional[bool] = Field(None, description="语音引导开关")
    high_contrast: Optional[bool] = Field(None, description="高对比度开关")
    large_text: Optional[bool] = Field(None, description="大字模式开关")
