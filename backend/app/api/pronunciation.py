"""
发音反馈 API 路由

接口：
- GET  /pronunciation/tasks/next  获取发音练习任务
- POST /pronunciation/attempts    提交录音评分
- GET  /pronunciation/attempts    获取历史记录
- GET  /pronunciation/stats       获取统计数据
"""

from fastapi import APIRouter, Depends, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.api.deps import get_current_user
from app.services.pronunciation_service import PronunciationService
from app.schemas.common import ApiResponse
from app.schemas.pronunciation import (
    PronunciationAttemptResponse,
    PronunciationTaskResponse,
    PronunciationHistoryItem,
    PronunciationStats,
)

router = APIRouter()


@router.get("/tasks/next", response_model=ApiResponse)
async def get_next_task(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """获取下一个发音练习任务"""
    service = PronunciationService(db)
    task = await service.get_next_task(current_user.id)
    return {"code": 0, "data": task, "message": "ok"}


@router.post("/attempts", response_model=ApiResponse)
async def submit_attempt(
    audio: UploadFile = File(..., description="用户录音文件(WAV/PCM)"),
    target_text: str = Form(..., description="目标文本"),
    target_phonemes: Optional[str] = Form(None, description="目标音素(JSON数组字符串)"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    提交录音，返回音素级评分

    请求：multipart/form-data
    - audio: 录音文件
    - target_text: 目标文本
    - target_phonemes: 可选，标准音素序列（JSON数组）
    """
    audio_bytes = await audio.read()

    # 解析音素参数
    phonemes_list = None
    if target_phonemes:
        import json
        try:
            phonemes_list = json.loads(target_phonemes)
        except (json.JSONDecodeError, TypeError):
            phonemes_list = None

    service = PronunciationService(db)
    result = await service.evaluate(
        user_id=current_user.id,
        audio_bytes=audio_bytes,
        target_text=target_text,
        target_phonemes=phonemes_list,
    )
    return {"code": 0, "data": result, "message": "ok"}


@router.get("/attempts", response_model=ApiResponse)
async def get_history(
    limit: int = Query(20, ge=1, le=100, description="每页数量"),
    offset: int = Query(0, ge=0, description="偏移量"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """获取用户发音历史记录"""
    service = PronunciationService(db)
    history = await service.get_history(current_user.id, limit=limit, offset=offset)
    return {"code": 0, "data": history, "message": "ok"}


@router.get("/stats", response_model=ApiResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """获取用户发音统计数据"""
    service = PronunciationService(db)
    stats = await service.get_stats(current_user.id)
    return {"code": 0, "data": stats, "message": "ok"}
