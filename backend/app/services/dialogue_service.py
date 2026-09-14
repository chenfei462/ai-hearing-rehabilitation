"""
对话陪练服务 - 核心聚合层

聚合场景管理和 AI 编排两个子服务，保持对外 API 不变。
具体职责已拆分至：
  - ScenarioService: 场景管理
  - DialogueOrchestrator: ASR→LLM→TTS AI 编排
"""
import json
import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.dialogue import DialogueSession, DialogueTurn
from app.ai import tts_gateway
from app.ai.llm_gateway import SCENARIO_PROMPTS
from app.services.scenario_service import ScenarioService, SCENARIOS
from app.services.dialogue_orchestrator import DialogueOrchestrator

logger = logging.getLogger(__name__)

# 最大对话轮次限制
MAX_TURNS = 5
# 对话上下文缓存过期时间（秒）
CONTEXT_TTL = 3600  # 1小时

# 安全护栏关键词从配置中获取
from app.core.config import get_settings
settings = get_settings()
SAFETY_BLOCKLIST = settings.SAFETY_KEYWORDS


class DialogueService:
    """对话陪练服务（核心聚合层）"""

    def __init__(self, db: AsyncSession, redis_client=None):
        self.db = db
        self.redis = redis_client
        self._scenario_service = ScenarioService()
        self._orchestrator = DialogueOrchestrator()

    # ─── 场景管理（委托 ScenarioService）─────────────────────

    async def list_scenarios(self) -> list[dict]:
        """获取所有可用场景"""
        return self._scenario_service.list_scenarios()

    # ─── 会话生命周期 ─────────────────────────────────────────

    async def start_session(self, user_id: int, scenario: str) -> dict:
        """
        开始对话会话
        Returns: {session_id, scenario, greeting_text, greeting_audio_url, max_turns}
        """
        if not self._scenario_service.validate_scenario(scenario):
            raise ValueError(f"未知场景: {scenario}")

        # 获取开场白
        prompt_info = self._scenario_service.get_scenario_prompt(scenario)
        greeting_text = prompt_info.get("greeting", "你好，我们开始对话练习吧！")

        # 创建会话
        session = DialogueSession(
            user_id=user_id,
            scenario=scenario,
            turn_count=0,
            status="active",
        )
        self.db.add(session)
        await self.db.flush()

        # 记录 AI 开场白
        turn = DialogueTurn(
            session_id=session.id,
            turn_index=0,
            user_text="",
            ai_text=greeting_text,
            latency_ms=0,
        )
        self.db.add(turn)

        # 尝试生成开场白 TTS 音频
        greeting_audio_url = None
        tts_result = await self._orchestrator.synthesize_speech(greeting_text, voice="zhixiaoxuan")
        if tts_result["audio_url"]:
            greeting_audio_url = tts_result["audio_url"]
            turn.ai_audio_url = greeting_audio_url

        # 初始化 Redis 上下文
        await self._init_context(session.id, scenario)

        return {
            "session_id": session.id,
            "scenario": scenario,
            "greeting_text": greeting_text,
            "greeting_audio_url": greeting_audio_url,
            "max_turns": MAX_TURNS,
        }

    async def get_session(self, session_id: int) -> Optional[DialogueSession]:
        """
        获取会话详情（用于所有权检查）
        """
        result = await self.db.execute(
            select(DialogueSession).where(DialogueSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def handle_turn(self, session_id: int, audio_bytes: bytes) -> dict:
        """
        处理一轮对话：ASR → LLM → TTS
        Returns: {turn_index, user_text, ai_text, ai_audio_url, latency_ms, remaining_turns}
        """
        import time
        start_time = time.monotonic()

        # 获取会话
        result = await self.db.execute(
            select(DialogueSession).where(DialogueSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise ValueError("会话不存在")
        if session.status != "active":
            raise ValueError("会话已结束")

        # 检查轮次限制
        if session.turn_count >= MAX_TURNS:
            raise ValueError(f"已达到最大对话轮次({MAX_TURNS})")

        scenario_info = self._scenario_service.get_scenario(session.scenario) or {}

        # 1. ASR 识别用户语音
        asr_result = await self._orchestrator.recognize_speech(audio_bytes, session_id)
        user_text = asr_result["text"]

        if asr_result["error"] == "timeout":
            return {
                "turn_index": session.turn_count + 1,
                "user_text": "",
                "ai_text": "语音识别超时了，请再说一遍。",
                "ai_audio_url": None,
                "latency_ms": int((time.monotonic() - start_time) * 1000),
                "remaining_turns": MAX_TURNS - session.turn_count,
            }
        elif asr_result["error"] == "unavailable":
            raise ValueError("语音识别服务暂时不可用，请稍后再试")

        if not user_text or not user_text.strip():
            return {
                "turn_index": session.turn_count + 1,
                "user_text": "",
                "ai_text": "抱歉，我没有听清，能再说一遍吗？",
                "ai_audio_url": None,
                "latency_ms": int((time.monotonic() - start_time) * 1000),
                "remaining_turns": MAX_TURNS - session.turn_count,
            }

        # 2. 安全护栏检查
        if self._check_safety(user_text):
            ai_text = "抱歉，这个话题我不太方便讨论。我们继续练习日常对话吧！"
            tts_result = await self._orchestrator.synthesize_speech(ai_text, voice="zhixiaoxuan")
            ai_audio_url = tts_result["audio_url"]

            turn_index = session.turn_count + 1
            turn = DialogueTurn(
                session_id=session_id,
                turn_index=turn_index,
                user_text=user_text,
                ai_text=ai_text,
                ai_audio_url=ai_audio_url,
                latency_ms=int((time.monotonic() - start_time) * 1000),
            )
            self.db.add(turn)
            session.turn_count = turn_index

            return {
                "turn_index": turn_index,
                "user_text": user_text,
                "ai_text": ai_text,
                "ai_audio_url": ai_audio_url,
                "latency_ms": turn.latency_ms,
                "remaining_turns": MAX_TURNS - turn_index,
            }

        # 3. 获取对话上下文（优先 Redis，降级 DB）
        messages = await self._get_context(session_id, session.scenario)
        messages.append({"role": "user", "content": user_text})

        # 4. LLM 生成回复
        llm_result = await self._orchestrator.generate_reply(messages, scenario=session.scenario)
        ai_text = llm_result["text"]

        # 5. TTS 合成
        tts_result = await self._orchestrator.synthesize_speech(ai_text, voice="zhixiaoxuan")
        ai_audio_url = tts_result["audio_url"]

        total_ms = int((time.monotonic() - start_time) * 1000)

        # 6. 记录对话轮次
        turn_index = session.turn_count + 1
        turn = DialogueTurn(
            session_id=session_id,
            turn_index=turn_index,
            user_text=user_text,
            ai_text=ai_text,
            ai_audio_url=ai_audio_url,
            latency_ms=total_ms,
        )
        self.db.add(turn)
        session.turn_count = turn_index

        # 7. 更新 Redis 上下文
        await self._update_context(session_id, user_text, ai_text)

        logger.info(
            f"Dialogue turn completed: session={session_id}, turn={turn_index}, "
            f"asr={asr_result['latency_ms']}ms, llm={llm_result['latency_ms']}ms, "
            f"tts={tts_result['latency_ms']}ms, total={total_ms}ms"
        )

        return {
            "turn_index": turn_index,
            "user_text": user_text,
            "ai_text": ai_text,
            "ai_audio_url": ai_audio_url,
            "latency_ms": total_ms,
            "remaining_turns": MAX_TURNS - turn_index,
        }

    async def finish_session(self, session_id: int) -> dict:
        """
        结束对话会话，生成对话小结
        Returns: {session_id, scenario, turn_count, summary, duration_seconds}
        """
        result = await self.db.execute(
            select(DialogueSession).where(DialogueSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise ValueError("会话不存在")

        # 获取所有对话轮次
        turns_result = await self.db.execute(
            select(DialogueTurn)
            .where(DialogueTurn.session_id == session_id)
            .order_by(DialogueTurn.turn_index)
        )
        turns = turns_result.scalars().all()

        # 获取场景名称
        scenario_info = self._scenario_service.get_scenario(session.scenario) or {}
        scenario_name = scenario_info.get("name", session.scenario)

        # 收集用户发言
        user_messages = [t.user_text for t in turns if t.user_text and t.turn_index > 0]

        # 生成对话小结（委托 orchestrator）
        summary = await self._orchestrator.generate_summary(scenario_name, user_messages)

        # 更新会话状态
        session.status = "completed"

        # 计算时长
        now = datetime.now(timezone.utc)
        duration_seconds = 0
        if session.started_at:
            duration_seconds = int((now - session.started_at).total_seconds())

        # 清理 Redis 上下文
        await self._clear_context(session_id)

        return {
            "session_id": session.id,
            "scenario": session.scenario,
            "turn_count": session.turn_count,
            "summary": summary,
            "duration_seconds": duration_seconds,
        }

    # ─── Redis 上下文管理 ─────────────────────────────────────

    def _context_key(self, session_id: int) -> str:
        return f"dialogue:context:{session_id}"

    async def _init_context(self, session_id: int, scenario: str):
        """初始化 Redis 对话上下文"""
        if not self.redis:
            return
        prompt_info = self._scenario_service.get_scenario_prompt(scenario)
        context = {
            "scenario": scenario,
            "greeting": prompt_info.get("greeting", ""),
            "history": [],
        }
        try:
            await self.redis.setex(
                self._context_key(session_id),
                CONTEXT_TTL,
                json.dumps(context, ensure_ascii=False),
            )
        except Exception as e:
            logger.warning(f"Redis 初始化上下文失败: {e}")

    async def _get_context(self, session_id: int, scenario: str) -> list[dict]:
        """
        获取对话上下文（优先 Redis，降级 DB）

        注意：不添加 system 消息，因为 llm_gateway._build_messages()
        会根据 scenario 参数自动注入 SCENARIO_PROMPTS 中的 system_prompt。
        """
        # 尝试从 Redis 获取
        if self.redis:
            try:
                data = await self.redis.get(self._context_key(session_id))
                if data:
                    context = json.loads(data)
                    messages = []
                    for h in context.get("history", []):
                        messages.append({"role": "user", "content": h["user"]})
                        messages.append({"role": "assistant", "content": h["ai"]})
                    return messages
            except Exception as e:
                logger.warning(f"Redis 读取上下文失败: {e}")

        # 降级：从 DB 读取历史
        messages = []
        result = await self.db.execute(
            select(DialogueTurn)
            .where(DialogueTurn.session_id == session_id)
            .where(DialogueTurn.turn_index > 0)  # 排除开场白
            .order_by(DialogueTurn.turn_index)
        )
        turns = result.scalars().all()
        for turn in turns:
            if turn.user_text:
                messages.append({"role": "user", "content": turn.user_text})
            if turn.ai_text:
                messages.append({"role": "assistant", "content": turn.ai_text})

        return messages

    async def _update_context(self, session_id: int, user_text: str, ai_text: str):
        """更新 Redis 对话上下文"""
        if not self.redis:
            return
        try:
            data = await self.redis.get(self._context_key(session_id))
            if data:
                context = json.loads(data)
                context.setdefault("history", []).append({
                    "user": user_text,
                    "ai": ai_text,
                })
                await self.redis.setex(
                    self._context_key(session_id),
                    CONTEXT_TTL,
                    json.dumps(context, ensure_ascii=False),
                )
        except Exception as e:
            logger.warning(f"Redis 更新上下文失败: {e}")

    async def _clear_context(self, session_id: int):
        """清理 Redis 对话上下文"""
        if not self.redis:
            return
        try:
            await self.redis.delete(self._context_key(session_id))
        except Exception as e:
            logger.warning(f"Redis 清理上下文失败: {e}")

    # ─── 安全护栏 ─────────────────────────────────────────────

    @staticmethod
    def _check_safety(text: str) -> bool:
        """
        检查用户输入是否包含不安全内容
        Returns: True 表示触发安全护栏
        """
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in SAFETY_BLOCKLIST)
