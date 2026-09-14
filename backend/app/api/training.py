from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
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


@router.post("/sessions", response_model=ApiResponse)
async def start_session(
    level: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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


@router.get("/sessions/{session_id}/next", response_model=ApiResponse)
async def get_next_item(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = TrainingService(db)
    session = await service.get_session(session_id)
    _check_session_ownership(session, current_user)

    item = await service.select_next_item(session_id)

    if not item:
        raise HTTPException(status_code=404, detail={"code": 40401, "message": "没有更多题目"})

    return {"code": 0, "data": item, "message": "ok"}


@router.post("/sessions/{session_id}/answer", response_model=ApiResponse)
async def submit_answer(
    session_id: int,
    item_id: int,
    answer: str,
    response_ms: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = TrainingService(db)
    session = await service.get_session(session_id)
    _check_session_ownership(session, current_user)

    result = await service.submit_answer(session_id, item_id, answer, response_ms)
    return {"code": 0, "data": result, "message": "ok"}


@router.post("/sessions/{session_id}/finish", response_model=ApiResponse)
async def finish_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = TrainingService(db)
    session = await service.get_session(session_id)
    _check_session_ownership(session, current_user)

    result = await service.finish_session(session_id)
    return {"code": 0, "data": result, "message": "ok"}