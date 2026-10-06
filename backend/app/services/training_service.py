from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from typing import Optional
from datetime import datetime, timezone
from app.models.training import TrainingSession, TrainingItem
from app.models.item_bank import ItemBank
from app.models.ability import UserAbility
from app.models.knowledge_state import KnowledgeState
from app.services.irt_engine import irt_engine
from app.ai.adaptive_engine import KnowledgeState as BKTKnowledgeState
from app.ai.adaptive_engine import adaptive_engine

class TrainingService:
    """训练会话、选题、答题和 IRT 能力更新服务。"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def start_session(self, user_id: int, level: str) -> TrainingSession:
        """为用户创建指定级别的活动训练会话。"""
        session = TrainingSession(
            user_id=user_id,
            level=level,
            status="active",
        )
        self.db.add(session)
        await self.db.flush()
        return session

    async def get_session(self, session_id: int) -> Optional[TrainingSession]:
        """根据 ID 获取训练 session"""
        result = await self.db.execute(
            select(TrainingSession).where(TrainingSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def get_user_ability(self, user_id: int, level: str) -> UserAbility:
        """读取用户在指定训练级别的 IRT 能力记录。"""
        result = await self.db.execute(
            select(UserAbility).where(
                UserAbility.user_id == user_id,
                UserAbility.level == level,
            )
        )
        return result.scalar_one_or_none()

    async def select_next_item(self, session_id: int) -> Optional[dict]:
        """按照当前能力值从活动题库选择下一道题。"""
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
                ItemBank.is_active.is_(True),
            )
        )
        items = result.scalars().all()
        items_dict = [{"id": i.id, "difficulty_b": i.difficulty_b, "text": i.text, "audio_url": i.audio_url} for i in items]

        # IRT 选题
        item_id = irt_engine.select_next_item(theta, items_dict)
        item = next((i for i in items_dict if i["id"] == item_id), items_dict[0] if items_dict else None)

        return item

    async def submit_answer(self, session_id: int, item_id: int, user_answer: str, response_ms: int = 0) -> dict:
        """记录答案、更新能力估计并返回下一步难度动作。"""
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
        """结束训练会话并计算总题数、正确数和正确率。"""
        result = await self.db.execute(select(TrainingSession).where(TrainingSession.id == session_id))
        session = result.scalar_one()

        # 统计
        result = await self.db.execute(
            select(
                func.count(TrainingItem.id).label("total"),
                # 使用 CASE 表达式统计正确数：
                # 跨数据库兼容（SQLite/PostgreSQL），且避免 cast(int) 在
                # SQLAlchemy 2.0 下报 "int object has no attribute _isnull"。
                func.sum(
                    case((TrainingItem.is_correct.is_(True), 1), else_=0)
                ).label("correct"),
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

    @staticmethod
    def _to_bkt_state(state: KnowledgeState) -> BKTKnowledgeState:
        """将持久化知识状态转换为 BKT 引擎状态。"""
        return BKTKnowledgeState(
            mastery=state.mastery,
            confidence=state.confidence,
            attempts=state.attempts,
            correct_count=state.correct_count,
        )

    async def get_adaptive_recommendation(
        self,
        user_id: int,
        item_id: Optional[int] = None,
        level: Optional[str] = None,
    ) -> dict:
        """读取用户知识状态并生成单题或级别范围的自适应推荐。"""
        if item_id is not None:
            result = await self.db.execute(
                select(KnowledgeState).where(
                    KnowledgeState.user_id == user_id,
                    KnowledgeState.item_id == item_id,
                )
            )
            state = result.scalar_one_or_none()
            bkt_state = (
                self._to_bkt_state(state)
                if state is not None
                else adaptive_engine.initialize_knowledge()
            )
        else:
            statement = select(KnowledgeState).where(KnowledgeState.user_id == user_id)
            if level is not None:
                statement = statement.join(
                    ItemBank,
                    KnowledgeState.item_id == ItemBank.id,
                ).where(ItemBank.level == level)
            result = await self.db.execute(statement)
            states = result.scalars().all()
            if states:
                bkt_state = BKTKnowledgeState(
                    mastery=sum(state.mastery for state in states) / len(states),
                    confidence=sum(state.confidence for state in states) / len(states),
                    attempts=sum(state.attempts for state in states),
                    correct_count=sum(state.correct_count for state in states),
                )
            else:
                bkt_state = adaptive_engine.initialize_knowledge()

        return adaptive_engine.get_recommendation(bkt_state)

    async def submit_adaptive_result(
        self,
        user_id: int,
        item_id: int,
        is_correct: bool,
    ) -> dict:
        """持久化一次 BKT 观测，并返回更新后的状态和下一次推荐。"""
        result = await self.db.execute(
            select(KnowledgeState).where(
                KnowledgeState.user_id == user_id,
                KnowledgeState.item_id == item_id,
            )
        )
        state = result.scalar_one_or_none()

        if state is None:
            bkt_state = adaptive_engine.initialize_knowledge()
            state = KnowledgeState(
                user_id=user_id,
                item_id=item_id,
                mastery=bkt_state.mastery,
                confidence=bkt_state.confidence,
                attempts=bkt_state.attempts,
                correct_count=bkt_state.correct_count,
            )
            self.db.add(state)
        else:
            bkt_state = self._to_bkt_state(state)

        updated_state = adaptive_engine.update_mastery(bkt_state, is_correct)
        state.mastery = updated_state.mastery
        state.confidence = updated_state.confidence
        state.attempts = updated_state.attempts
        state.correct_count = updated_state.correct_count
        state.last_attempt_at = datetime.now(timezone.utc)
        await self.db.flush()

        return {
            "updated_state": {
                "mastery": updated_state.mastery,
                "confidence": updated_state.confidence,
                "attempts": updated_state.attempts,
                "correct_count": updated_state.correct_count,
                "accuracy": updated_state.accuracy,
            },
            "recommendation": adaptive_engine.get_recommendation(updated_state),
        }
