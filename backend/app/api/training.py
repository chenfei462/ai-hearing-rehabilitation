from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.api.deps import get_current_user
from app.services.training_service import TrainingService
from app.schemas.common import ApiResponse
from app.models.user import User

router = APIRouter()


def _check_session_ownership(session, current_user: User):
    """校验 session 是否属于当前用户"""
    if not session or session.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail={"code": 40301, "message": "无权访问该训练session"},
        )


class AdaptiveSubmitRequest(BaseModel):
    """自适应训练提交请求。"""

    item_id: int = Field(..., description="题库项目 ID")
    is_correct: bool = Field(..., description="本次作答是否正确")
    response_ms: int = Field(0, ge=0, description="作答耗时（毫秒）")


@router.post(
    "/sessions",
    response_model=ApiResponse,
    summary="创建训练会话",
    response_description="返回会话 ID、级别和第一道自适应题目",
)
async def start_session(
    level: str = Query(..., description="训练级别：syllable、word、sentence 或 noise"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建训练会话并返回第一道自适应题目。"""
    service = TrainingService(db)
    session = await service.start_session(current_user.id, level)
    item = await service.select_next_item(session.id)

    return {
        "code": 0,
        "data": {
            "session_id": session.id,
            "level": session.level,
            "first_item": item,
        },
        "message": "ok",
    }


@router.get(
    "/sessions/{session_id}/next",
    response_model=ApiResponse,
    summary="获取下一道训练题",
    response_description="返回按当前能力值选择的题目",
)
async def get_next_item(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """返回当前用户训练会话的下一道题。"""
    service = TrainingService(db)
    session = await service.get_session(session_id)
    _check_session_ownership(session, current_user)

    item = await service.select_next_item(session_id)

    if not item:
        raise HTTPException(status_code=404, detail={"code": 40401, "message": "没有更多题目"})

    return {"code": 0, "data": item, "message": "ok"}


@router.post(
    "/sessions/{session_id}/answer",
    response_model=ApiResponse,
    summary="提交训练答案",
    response_description="返回判题结果、能力值和下一步难度动作",
)
async def submit_answer(
    session_id: int,
    item_id: int = Query(..., description="题库项目 ID"),
    answer: str = Query(..., min_length=1, description="用户提交的答案"),
    response_ms: int = Query(0, ge=0, description="作答耗时（毫秒）"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """提交答案并更新 IRT 能力值。"""
    service = TrainingService(db)
    session = await service.get_session(session_id)
    _check_session_ownership(session, current_user)

    result = await service.submit_answer(session_id, item_id, answer, response_ms)
    return {"code": 0, "data": result, "message": "ok"}


@router.post(
    "/sessions/{session_id}/finish",
    response_model=ApiResponse,
    summary="结束训练会话",
    response_description="返回总题数、正确数和正确率",
)
async def finish_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """结束训练会话并返回汇总统计。"""
    service = TrainingService(db)
    session = await service.get_session(session_id)
    _check_session_ownership(session, current_user)

    result = await service.finish_session(session_id)
    return {"code": 0, "data": result, "message": "ok"}


@router.get(
    "/adaptive/recommendation",
    response_model=ApiResponse,
    summary="获取 BKT 自适应推荐",
    response_description="返回掌握度、置信度和推荐难度",
)
async def get_adaptive_recommendation(
    item_id: Optional[int] = Query(None, description="可选题库项目 ID"),
    level: Optional[str] = Query(None, description="可选训练级别，用于聚合推荐"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取自适应训练推荐

    基于BKT算法分析用户知识状态，推荐合适的训练难度。

    Args:
        item_id: 训练项目ID（可选，用于获取特定项目推荐）
        level: 训练级别（可选，用于获取级别推荐）
        db: 数据库会话
        current_user: 当前用户

    Returns:
        推荐信息
    """
    service = TrainingService(db)
    recommendation = await service.get_adaptive_recommendation(
        user_id=current_user.id,
        item_id=item_id,
        level=level,
    )

    return {
        "code": 0,
        "data": recommendation,
        "message": "ok"
    }


@router.post(
    "/adaptive/submit",
    response_model=ApiResponse,
    summary="提交 BKT 自适应结果",
    response_description="返回更新后的知识状态和下一次推荐",
)
async def submit_adaptive_result(
    request: AdaptiveSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    提交自适应训练结果

    更新BKT知识状态，并返回新的推荐。

    Args:
        request: 训练结果请求
        db: 数据库会话
        current_user: 当前用户

    Returns:
        更新后的状态和新推荐
    """
    service = TrainingService(db)
    result = await service.submit_adaptive_result(
        user_id=current_user.id,
        item_id=request.item_id,
        is_correct=request.is_correct,
    )

    return {
        "code": 0,
        "data": result,
        "message": "ok"
    }
