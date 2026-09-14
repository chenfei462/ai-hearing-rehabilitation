"""
对话编排服务 - ASR→LLM→TTS AI 管线编排

从原 DialogueService 中拆分而来，负责 AI 服务调用编排逻辑。
"""
import time
import logging
from app.ai import asr_gateway, tts_gateway, llm_gateway
from app.ai import AIServiceUnavailable, AIServiceTimeout

logger = logging.getLogger(__name__)


class DialogueOrchestrator:
    """AI 对话编排服务 — ASR→LLM→TTS 管线"""

    async def recognize_speech(self, audio_bytes: bytes, session_id: int) -> dict:
        """
        ASR 语音识别

        Returns:
            {"text": str, "latency_ms": int, "error": str | None}
        """
        start = time.monotonic()
        try:
            asr_result = await asr_gateway.recognize(audio_bytes, language="zh")
            text = asr_result.text if asr_result else ""
            return {
                "text": text,
                "latency_ms": int((time.monotonic() - start) * 1000),
                "error": None,
            }
        except AIServiceTimeout:
            logger.warning(f"ASR 超时: session={session_id}")
            return {
                "text": "",
                "latency_ms": int((time.monotonic() - start) * 1000),
                "error": "timeout",
            }
        except AIServiceUnavailable:
            logger.error(f"ASR 服务不可用: session={session_id}")
            return {
                "text": "",
                "latency_ms": int((time.monotonic() - start) * 1000),
                "error": "unavailable",
            }

    async def generate_reply(self, messages: list[dict], scenario: str) -> dict:
        """
        LLM 生成回复

        Returns:
            {"text": str, "latency_ms": int, "error": str | None}
        """
        start = time.monotonic()
        try:
            llm_response = await llm_gateway.chat(messages, scenario=scenario)
            text = llm_response.content if llm_response else ""
            return {
                "text": text,
                "latency_ms": int((time.monotonic() - start) * 1000),
                "error": None,
            }
        except Exception as e:
            logger.error(f"LLM 调用失败: {e}")
            return {
                "text": "",
                "latency_ms": int((time.monotonic() - start) * 1000),
                "error": str(e),
            }

    async def synthesize_speech(self, text: str, voice: str = "zhixiaoxuan") -> dict:
        """
        TTS 语音合成

        Returns:
            {"audio_url": str | None, "latency_ms": int, "error": str | None}
        """
        start = time.monotonic()
        try:
            audio_url = await tts_gateway.synthesize_to_url(text, voice=voice)
            return {
                "audio_url": audio_url,
                "latency_ms": int((time.monotonic() - start) * 1000),
                "error": None,
            }
        except Exception as e:
            logger.warning(f"TTS 合成失败: {e}")
            return {
                "audio_url": None,
                "latency_ms": int((time.monotonic() - start) * 1000),
                "error": str(e),
            }

    async def generate_summary(self, scenario_name: str, user_messages: list[str]) -> str:
        """
        使用 LLM 生成对话小结

        Args:
            scenario_name: 场景中文名称
            user_messages: 用户发言列表

        Returns:
            对话小结文本
        """
        if not user_messages:
            return f"您完成了「{scenario_name}」场景的对话练习。继续加油！"

        try:
            summary_messages = [
                {
                    "role": "system",
                    "content": (
                        "你是一个听觉康复助手。请根据以下对话内容，用简短的中文生成一段鼓励性的对话小结（不超过100字）。"
                        "指出用户的亮点，并给出一两个简单的改进建议。语气要温暖友善。"
                    ),
                },
                {
                    "role": "user",
                    "content": f"场景：{scenario_name}\n用户发言：{'；'.join(user_messages)}",
                },
            ]
            llm_response = await llm_gateway.chat(summary_messages)
            return llm_response.content if llm_response else (
                f"您完成了「{scenario_name}」场景的对话练习，"
                f"共进行了 {len(user_messages)} 轮对话。继续加油！"
            )
        except Exception as e:
            logger.warning(f"LLM 小结生成失败: {e}")
            return (
                f"您完成了「{scenario_name}」场景的对话练习，"
                f"共进行了 {len(user_messages)} 轮对话。继续加油！"
            )
