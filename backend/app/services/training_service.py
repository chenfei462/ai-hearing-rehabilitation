from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from datetime import datetime, timezone
from app.models.training import TrainingSession, TrainingItem
from app.models.item_bank import ItemBank
from app.models.ability import UserAbility
from app.services.irt_engine import irt_engine
from app.ai import asr_gateway

class TrainingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def start_session(self, user_id: int, level: str) -> TrainingSession:
        session = TrainingSession(
            user_id=user_id,
            level=level,
            status="active",
        )
        self.db.add(session)
        await self.db.flush()
        return session

    async def get_user_ability(self, user_id: int, level: str) -> UserAbility:
        result = await self.db.execute(
            select(UserAbility).where(
                UserAbility.user_id == user_id,
                UserAbility.level == level,
            )
        )
        return result.scalar_one_or_none()

    async def select_next_item(self, session_id: int) -> Optional[dict]:
        # 获取会话
        result = await self.db.execute(
            select(TrainingSession).where(TrainingSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            return None

        # 获取用户能力
        ability = await self.get_user_ability(session.user_id, session.level)
        theta = ability.theta if ability else 0.0

        # 获取该级别可用题目
        result = await self.db.execute(
            select(ItemBank).where(
                ItemBank.level == session.level,
                ItemBank.is_active == True,
            )
        )
        items = result.scalars().all()
        items_dict = [{"id": i.id, "difficulty_b": i.difficulty_b, "text": i.text, "audio_url": i.audio_url} for i in items]

        # IRT 选题
        item_id = irt_engine.select_next_item(theta, items_dict)
        item = next((i for i in items_dict if i["id"] == item_id), items_dict[0] if items_dict else None)

        return item

    async def submit_answer(self, session_id: int, item_id: int, user_answer: str, response_ms: int = 0) -> dict:
        # 获取题目
        result = await self.db.execute(select(ItemBank).where(ItemBank.id == item_id))
        item = result.scalar_one_or_none()
        if not item:
            return {"error": "题目不存在"}

        # 判定正误（简单字符串匹配）
        is_correct = user_answer.lower().strip() == item.text.lower().strip()

        # 记录作答
        training_item = TrainingItem(
            session_id=session_id,
            item_id=item_id,
            user_answer=user_answer,
            is_correct=is_correct,
            response_ms=response_ms,
            ai_score=1.0 if is_correct else 0.0,
        )
        self.db.add(training_item)

        # 获取会话和用户能力
        result = await self.db.execute(select(TrainingSession).where(TrainingSession.id == session_id))
        session = result.scalar_one()
        ability = await self.get_user_ability(session.user_id, session.level)

        # 获取最近作答记录
        result = await self.db.execute(
            select(TrainingItem.is_correct)
            .where(TrainingItem.session_id == session_id)
            .order_by(TrainingItem.id.desc())
            .limit(10)
        )
        recent = [r[0] for r in result.all()]
        recent_accuracies = [1.0 if r else 0.0 for r in recent]

        # 更新能力估计
        responses = [(item.difficulty_b, is_correct)]
        new_theta, new_se = irt_engine.estimate_ability(responses, ability.theta if ability else 0.0)

        if ability:
            ability.theta = new_theta
            ability.se = new_se

        # 决定升降级
        decision = irt_engine.decide_next_action(recent_accuracies)

        return {
            "is_correct": is_correct,
            "theta": new_theta,
            "se": new_se,
            "next_action": decision.action,
        }

    async def finish_session(self, session_id: int) -> dict:
        result = await self.db.execute(select(TrainingSession).where(TrainingSession.id == session_id))
        session = result.scalar_one()

        # 统计
        result = await self.db.execute(
            select(
                func.count(TrainingItem.id).label("total"),
                func.sum(TrainingItem.is_correct.cast(int)).label("correct"),
            ).where(TrainingItem.session_id == session_id)
        )
        stats = result.one()

        session.status = "completed"
        session.end_time = datetime.now(timezone.utc)
        session.total_items = stats.total or 0
        session.correct_items = stats.correct or 0
        session.accuracy = stats.correct / stats.total if stats.total > 0 else 0

        return {
            "accuracy": session.accuracy,
            "total_items": session.total_items,
            "correct_items": session.correct_items,
        }

