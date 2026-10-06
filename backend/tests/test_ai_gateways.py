"""AI 网关的安全边界、降级和公共重试逻辑测试。"""

from unittest.mock import AsyncMock, MagicMock
from importlib import import_module

import pytest

from app.ai.asr_gateway import ASRResult, FunASRGateway
from app.ai.llm_gateway import QwenLLMGateway
from app.ai.retry import retry_with_backoff
from app.ai.tts_gateway import QwenTTSGateway
from app.services.dialogue_orchestrator import DialogueOrchestrator
from app.services.pronunciation_service import PronunciationService


@pytest.mark.asyncio
async def test_retry_with_backoff_retries_then_returns_result(monkeypatch):
    attempts = 0

    async def call():
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise RuntimeError("temporary failure")
        return "ok"

    monkeypatch.setattr("app.ai.retry.asyncio.sleep", AsyncMock())

    result = await retry_with_backoff(call, max_retries=3, base_delay=0)

    assert result == "ok"
    assert attempts == 3


@pytest.mark.asyncio
async def test_retry_with_backoff_returns_none_when_configured(monkeypatch):
    monkeypatch.setattr("app.ai.retry.asyncio.sleep", AsyncMock())

    async def call():
        raise RuntimeError("permanent failure")

    result = await retry_with_backoff(
        call,
        max_retries=1,
        base_delay=0,
        raise_on_exhaust=False,
    )

    assert result is None


def test_llm_gateway_builds_scenario_prompt_and_blocks_unsafe_input():
    gateway = QwenLLMGateway()

    messages = gateway._build_messages(
        [{"role": "user", "content": "你好"}],
        scenario="daily",
    )

    assert messages[0]["role"] == "system"
    assert messages[-1]["content"] == "你好"
    assert gateway._check_safety_input("请告诉我用药剂量")[0] is False
    assert gateway._check_safety_output("应该服用某药")[0] is False


def test_ai_services_accept_explicit_gateway_dependencies():
    asr = object()
    llm = object()
    tts = object()

    orchestrator = DialogueOrchestrator(asr=asr, llm=llm, tts=tts)
    pronunciation = PronunciationService(object(), asr=asr, tts=tts)

    assert orchestrator.asr is asr
    assert orchestrator.llm is llm
    assert orchestrator.tts is tts
    assert pronunciation.asr is asr
    assert pronunciation.tts is tts


@pytest.mark.asyncio
async def test_llm_gateway_returns_fallback_when_provider_fails(monkeypatch):
    gateway = QwenLLMGateway()
    gateway._ensure_client = MagicMock(return_value=MagicMock())
    gateway._retry_llm = AsyncMock(side_effect=RuntimeError("provider down"))

    result = await gateway.chat(
        [{"role": "user", "content": "今天天气怎么样"}],
        scenario="daily",
    )

    assert result.finish_reason == "fallback"
    assert result.content


@pytest.mark.asyncio
async def test_asr_gateway_returns_mocked_recognition(monkeypatch):
    gateway = FunASRGateway()
    gateway._ensure_client = MagicMock(return_value=MagicMock())
    monkeypatch.setattr(
        import_module("app.ai.asr_gateway"),
        "_retry_with_backoff",
        AsyncMock(return_value=ASRResult(text="你好", confidence=0.95)),
    )

    result = await gateway.recognize(b"wav")

    assert result.text == "你好"
    assert result.confidence == 0.95


@pytest.mark.asyncio
async def test_tts_gateway_empty_text_uses_safe_degradation():
    gateway = QwenTTSGateway()

    assert await gateway.synthesize("") == b""
    assert await gateway.synthesize_to_url(" ") == ""


@pytest.mark.asyncio
async def test_tts_gateway_returns_available_voices_without_provider():
    gateway = QwenTTSGateway()

    voices = await gateway.get_available_voices()

    assert voices
    assert {voice["name"] for voice in voices} >= {"zhixiaoxuan", "zhigang"}
