"""
对话陪练 API 路由
"""
import logging
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.redis import get_redis
from app.api.deps import get_current_user
from app.models.user import User
from app.services.dialogue_service import DialogueService
from app.schemas.dialogue import (
    ScenarioInfo,
    StartSessionRequest,
    StartSessionResponse,
    TurnResponse,
    FinishSessionResponse,
)
from app.schemas.response import ApiResponse, success_response, error_response

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/scenarios", response_model=ApiResponse)
async def list_scenarios(db: AsyncSession = Depends(get_db)):
    """获取可用对话场景列表"""
    redis = await get_redis()
    service = DialogueService(db, redis_client=redis)
    scenarios = await service.list_scenarios()
    return success_response(data=scenarios)


@router.post("/sessions", response_model=ApiResponse)
async def start_session(
    request: StartSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """开始对话会话"""
    redis = await get_redis()
    service = DialogueService(db, redis_client=redis)
    try:
        result = await service.start_session(current_user.id, request.scenario)
        return success_response(data=result)
    except ValueError as e:
        return error_response(code=40001, message=str(e))
    except Exception as e:
        logger.error(f"开始对话会话失败: {e}")
        return error_response(code=50001, message="服务内部错误")


@router.post("/sessions/{session_id}/turn", response_model=ApiResponse)
async def handle_turn(
    session_id: int,
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """提交一轮语音，获取 AI 回复"""
    # 验证音频文件
    if not audio.content_type or not audio.content_type.startswith("audio/"):
        # 宽松校验：部分浏览器可能不设置正确的 content_type
        pass

    audio_bytes = await audio.read()
    if len(audio_bytes) == 0:
        return error_response(code=40001, message="音频文件为空")

    # 音频大小限制（10MB）
    if len(audio_bytes) > 10 * 1024 * 1024:
        return error_response(code=40001, message="音频文件过大，请控制在10MB以内")

    redis = await get_redis()
    service = DialogueService(db, redis_client=redis)
    # Add ownership check
    session = await service.get_session(session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail={"code": 40301, "message": "无权访问该对话session"})
    try:
        result = await service.handle_turn(session_id, audio_bytes)
        return success_response(data=result)
    except ValueError as e:
        return error_response(code=40001, message=str(e))
    except Exception as e:
        logger.error(f"处理对话轮次失败: {e}")
        return error_response(code=50001, message="服务内部错误")


@router.post("/sessions/{session_id}/finish", response_model=ApiResponse)
async def finish_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """结束对话会话，获取对话小结"""
    redis = await get_redis()
    service = DialogueService(db, redis_client=redis)
    # Add ownership check
    session = await service.get_session(session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail={"code": 40301, "message": "无权访问该对话session"})
    try:
        result = await service.finish_session(session_id)
        return success_response(data=result)
    except ValueError as e:
        return error_response(code=40001, message=str(e))
    except Exception as e:
        logger.error(f"结束对话会话失败: {e}")
        return error_response(code=50001, message="服务内部错误")
