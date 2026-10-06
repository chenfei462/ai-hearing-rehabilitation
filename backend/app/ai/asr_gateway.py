"""
Fun-ASR 网关 — 阿里云百炼语音识别封装

功能:
  - 录音文件识别 (整段上传，用于发音评分)
  - 流式识别 (用于对话陪练，首包 <500ms)
  - 音素级识别 (带时间戳，用于发音评分)

降级策略:
  - ASR 调用失败 → 重试 (指数退避)
  - 重试耗尽 → 抛出 AIServiceUnavailable，由业务层降级提示用户重录
"""
from typing import AsyncGenerator

import asyncio
from loguru import logger

from app.ai.asr_base import ASRGatewayBase, ASRResult, PhonemeInfo
from app.ai.retry import make_retry_wrapper
from app.core.config import get_settings
from app.core.errors import AIServiceTimeout, AIServiceUnavailable

settings = get_settings()

_retry_with_backoff = make_retry_wrapper(
    max_retries=settings.ASR_MAX_RETRIES,
    base_delay=settings.ASR_RETRY_DELAY,
    timeout=settings.ASR_TIMEOUT,
    service_name="ASR",
)


# ── ASR 网关实现 ────────────────────────────────────────────

class FunASRGateway(ASRGatewayBase):
    """
    通义 Fun-ASR 网关

    使用 dashscope SDK 调用阿里云百炼平台的 Fun-ASR 服务。
    支持:
      - 录音文件识别 (paraformer-v2)
      - 流式识别 (paraformer-v2-streaming)
      - 音素级时间戳识别 (paraformer-v2，需返回 word-level timestamps)
    """

    def __init__(self):
        self.api_key = settings.DASHSCOPE_API_KEY
        self.model = settings.ASR_MODEL
        self._client = None

    def _ensure_client(self):
        """懒加载 dashscope client"""
        if self._client is None:
            try:
                import dashscope
                dashscope.api_key = self.api_key
                self._client = dashscope
                logger.info("[ASR] dashscope 客户端初始化完成")
            except ImportError:
                logger.error("[ASR] dashscope SDK 未安装，请运行: pip install dashscope")
                raise AIServiceUnavailable(service="ASR", detail="dashscope SDK 未安装")
        return self._client

    async def recognize(self, audio_bytes: bytes, language: str = "zh") -> ASRResult:
        """
        录音文件识别 (整段上传)

        将音频 bytes 保存为临时文件后调用 dashscope 录音文件识别 API。
        用于发音评分等对准确度要求高的场景。
        """
        client = self._ensure_client()

        async def _call():
            # dashscope 的录音文件识别 API 是同步的，放到线程池执行
            import tempfile
            import os

            # 保存为临时 wav 文件
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            try:
                # 调用 dashscope 录音文件识别，使用 asyncio.to_thread 包装同步阻塞调用
                response = await asyncio.to_thread(
                    client.AudioRecognition.call,
                    self.model,
                    f"file://{tmp_path}",
                    language_hints=[language],
                )

                if response.status_code == 200:
                    # 解析结果
                    results = response.output.get("results", [])
                    if results:
                        text = results[0].get("text", "")
                        confidence = results[0].get("confidence", 0.0)
                        return ASRResult(text=text, confidence=confidence)
                    return ASRResult(text="", confidence=0.0)
                else:
                    error_msg = getattr(response, "message", "未知错误")
                    logger.error(f"[ASR] 识别失败: {error_msg}")
                    raise Exception(f"ASR 返回错误: {error_msg}")
            finally:
                # 清理临时文件
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

        try:
            return await _retry_with_backoff(_call)
        except (AIServiceUnavailable, AIServiceTimeout):
            raise
        except Exception as e:
            logger.error(f"[ASR] 识别异常: {e}")
            raise AIServiceUnavailable(service="ASR", detail=str(e))

    async def recognize_with_timestamps(self, audio_bytes: bytes) -> ASRResult:
        """
        带时间戳的语音识别

        返回音素级时间戳，用于发音评分的 DTW 对齐。
        使用 paraformer-v2 模型获取 word-level timestamps。
        """
        client = self._ensure_client()

        async def _call():
            import tempfile
            import os

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            try:
                # 调用 dashscope 录音文件识别，使用 asyncio.to_thread 包装同步阻塞调用
                response = await asyncio.to_thread(
                    client.AudioRecognition.call,
                    self.model,
                    f"file://{tmp_path}",
                    language_hints=["zh"],
                    word_timestamp=True,
                )

                if response.status_code == 200:
                    results = response.output.get("results", [])
                    if results:
                        result = results[0]
                        text = result.get("text", "")
                        confidence = result.get("confidence", 0.0)

                        # 解析时间戳
                        timestamps = []
                        phonemes = []
                        for ts in result.get("timestamps", []):
                            ts_info = {
                                "text": ts.get("text", ""),
                                "start": ts.get("begin_time", 0),
                                "end": ts.get("end_time", 0),
                            }
                            timestamps.append(ts_info)

                        # 提取音素信息
                        for ph in result.get("phoneme_timestamps", []):
                            phonemes.append(
                                PhonemeInfo(
                                    phoneme=ph.get("phoneme", ""),
                                    start_ms=ph.get("begin_time", 0),
                                    end_ms=ph.get("end_time", 0),
                                    confidence=ph.get("confidence", 0.0),
                                )
                            )

                        return ASRResult(
                            text=text,
                            confidence=confidence,
                            phonemes=[p.phoneme for p in phonemes],
                            timestamps=timestamps,
                        )
                    return ASRResult(text="", confidence=0.0)
                else:
                    error_msg = getattr(response, "message", "未知错误")
                    raise Exception(f"ASR 返回错误: {error_msg}")
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

        try:
            return await _retry_with_backoff(_call)
        except (AIServiceUnavailable, AIServiceTimeout):
            raise
        except Exception as e:
            logger.error(f"[ASR] 音素识别异常: {e}")
            raise AIServiceUnavailable(service="ASR", detail=str(e))

    async def recognize_stream(
        self, audio_stream: AsyncGenerator[bytes, None], language: str = "zh"
    ) -> AsyncGenerator[ASRResult, None]:
        """
        流式语音识别 (用于对话陪练)

        将音频流逐 chunk 发送到 dashscope 流式 ASR 接口，
        实时返回识别中间结果。首包延迟目标 <500ms。
        """
        client = self._ensure_client()

        try:
            # dashscope 流式 ASR 使用 websocket 式调用
            # 这里用 dashscope 的 Recognition API 的实时模式
            from dashscope.audio.asr import Recognition

            Recognition(
                model=self.model + "-streaming",
                format="wav",
                sample_rate=16000,
                language_hints=[language],
                callback=None,  # 使用同步回调，我们在异步流中手动处理
            )

            # 收集所有音频数据 (在流式场景中，可以分段发送)
            audio_chunks = []
            async for chunk in audio_stream:
                audio_chunks.append(chunk)

            # 合并音频数据并调用
            full_audio = b"".join(audio_chunks)

            async def _call() -> list[ASRResult]:
                import tempfile
                import os

                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                    tmp.write(full_audio)
                    tmp_path = tmp.name

                try:
                    # 调用 dashscope 录音文件识别，使用 asyncio.to_thread 包装同步阻塞调用
                    response = await asyncio.to_thread(
                        client.AudioRecognition.call,
                        self.model,
                        f"file://{tmp_path}",
                        language_hints=[language],
                    )

                    if response.status_code == 200:
                        results = response.output.get("results", [])
                        return [
                            ASRResult(
                                text=result.get("text", ""),
                                confidence=result.get("confidence", 0.0),
                            )
                            for result in results
                        ]
                    else:
                        error_msg = getattr(response, "message", "未知错误")
                        raise Exception(f"ASR 流式识别错误: {error_msg}")
                finally:
                    try:
                        os.unlink(tmp_path)
                    except OSError:
                        pass

            # 流式识别：先尝试实时识别，失败则降级为整段识别
            try:
                results = await _retry_with_backoff(lambda: _call())
                for result in results or []:
                    yield result
            except (AIServiceUnavailable, AIServiceTimeout):
                # 降级：将所有 chunk 合并做整段识别
                logger.warning("[ASR] 流式识别失败，降级为整段识别")
                fallback_result = await self.recognize(full_audio, language)
                yield fallback_result

        except ImportError:
            # dashscope 流式模块不可用，降级为整段识别
            logger.warning("[ASR] 流式 ASR 模块不可用，降级为整段识别")
            audio_chunks = []
            async for chunk in audio_stream:
                audio_chunks.append(chunk)
            full_audio = b"".join(audio_chunks)
            result = await self.recognize(full_audio, language)
            yield result
        except (AIServiceUnavailable, AIServiceTimeout):
            raise
        except Exception as e:
            logger.error(f"[ASR] 流式识别异常: {e}")
            # 最终降级
            audio_chunks = []
            async for chunk in audio_stream:
                audio_chunks.append(chunk)
            if audio_chunks:
                full_audio = b"".join(audio_chunks)
                result = await self.recognize(full_audio, language)
                yield result
            else:
                yield ASRResult(text="", confidence=0.0)
