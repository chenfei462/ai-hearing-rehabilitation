"""
Qwen3-TTS 网关 — 阿里云百炼语音合成封装

功能:
  - 文本转语音 (返回音频 bytes)
  - 文本转语音 + OSS 上传 (返回可访问 URL，用于对话回复)
  - Redis 缓存 (避免重复合成相同文本)
  - 17 种拟人音色支持

缓存策略:
  - key: tts:{voice}:{text_hash}
  - value: OSS URL 或音频 bytes
  - TTL: 7 天

降级策略:
  - TTS 调用失败 → 重试 (指数退避)
  - 重试耗尽 → 返回空 bytes，前端降级使用 Web Speech API
"""
import hashlib

from loguru import logger

from app.ai.tts_base import TTSGatewayBase
from app.core.config import get_settings

settings = get_settings()


# ── TTS 可用音色表 ──────────────────────────────────────────

AVAILABLE_VOICES = [
    {"name": "zhixiaoxuan", "gender": "female", "description": "知小萱 - 温柔女声"},
    {"name": "zhixiaoyu", "gender": "female", "description": "知小雨 - 活泼女声"},
    {"name": "zhimiao", "gender": "female", "description": "知妙 - 甜美女声"},
    {"name": "zhigang", "gender": "male", "description": "知刚 - 成熟男声"},
    {"name": "zhigui", "gender": "male", "description": "知贵 - 沉稳男声"},
    {"name": "zhiyuan", "gender": "male", "description": "知远 - 磁性男声"},
    {"name": "zhiyan", "gender": "female", "description": "知言 - 新闻播报女声"},
    {"name": "zhilun", "gender": "male", "description": "知伦 - 新闻播报男声"},
    {"name": "zhiqian", "gender": "female", "description": "知谦 - 知性女声"},
    {"name": "zhijia", "gender": "female", "description": "知佳 - 亲切女声"},
    {"name": "zhimi", "gender": "female", "description": "知蜜 - 甜美女声"},
    {"name": "zhina", "gender": "female", "description": "知娜 - 端庄女声"},
    {"name": "zhihao", "gender": "male", "description": "知豪 - 大气男声"},
    {"name": "zhiwei", "gender": "male", "description": "知威 - 权威男声"},
    {"name": "zhiting", "gender": "female", "description": "知婷 - 优雅女声"},
    {"name": "zhicheng", "gender": "male", "description": "知诚 - 诚恳男声"},
    {"name": "zhilin", "gender": "female", "description": "知琳 - 清新女声"},
]

# 老年用户推荐音色 (清晰度优先)
ELDERLY_RECOMMENDED_VOICES = ["zhixiaoxuan", "zhigang", "zhiyan", "zhilun"]


class QwenTTSGateway(TTSGatewayBase):
    """
    通义 Qwen3-TTS 网关

    使用 dashscope SDK 调用阿里云百炼平台的 Qwen3-TTS 服务。
    支持 Redis 缓存，避免重复合成。
    """

    def __init__(self):
        self.api_key = settings.DASHSCOPE_API_KEY
        self.model = settings.TTS_MODEL
        self.default_voice = settings.TTS_DEFAULT_VOICE
        self._client = None
        self._redis = None

    def _ensure_client(self):
        """懒加载 dashscope client"""
        if self._client is None:
            try:
                import dashscope
                dashscope.api_key = self.api_key
                self._client = dashscope
                logger.info("[TTS] dashscope 客户端初始化完成")
            except ImportError:
                logger.error("[TTS] dashscope SDK 未安装")
                raise Exception("dashscope SDK 未安装")
        return self._client

    async def _get_redis(self):
        """懒加载 Redis 客户端"""
        if self._redis is None:
            try:
                from app.core.redis import redis_client
                self._redis = redis_client
            except Exception as e:
                logger.warning(f"[TTS] Redis 不可用，跳过缓存: {e}")
        return self._redis

    def _cache_key(self, text: str, voice: str) -> str:
        """生成缓存 key"""
        text_hash = hashlib.md5(f"{voice}:{text}".encode()).hexdigest()
        return f"tts:{voice}:{text_hash}"

    async def synthesize(self, text: str, voice: str = "zhixiaoxuan") -> bytes:
        """
        文本转语音 (返回音频 bytes)

        先查 Redis 缓存，未命中则调用 dashscope TTS API。
        """
        if not text or not text.strip():
            return b""

        if not self.api_key:
            logger.warning("[TTS] 未配置 DASHSCOPE_API_KEY，使用空音频降级")
            return b""

        # 确保音色有效
        voice = voice if voice else self.default_voice

        # 查缓存
        redis = await self._get_redis()
        cache_key = self._cache_key(text, voice)
        if redis:
            try:
                cached = await redis.get(cache_key)
                if cached:
                    # 缓存的是 OSS URL，需要下载
                    if cached.startswith("http"):
                        import httpx
                        async with httpx.AsyncClient() as client:
                            resp = await client.get(cached, timeout=10)
                            if resp.status_code == 200:
                                logger.debug(f"[TTS] 缓存命中: {cache_key}")
                                return resp.content
                    # 缓存的是 base64 编码的音频
                    import base64
                    logger.debug(f"[TTS] 缓存命中 (base64): {cache_key}")
                    return base64.b64decode(cached)
            except Exception as e:
                logger.warning(f"[TTS] 读取缓存失败: {e}")

        # 调用 TTS API
        client = self._ensure_client()

        async def _call():
            response = client.SpeechSynthesizer.call(
                model=self.model,
                text=text,
                voice=voice,
                # 老年用户适配：语速稍慢
                rate=0.9,
                # 音量适中
                volume=80,
            )

            if response.status_code == 200:
                # 获取音频数据
                audio_data = response.get_audio_data()
                if audio_data:
                    return audio_data
                raise Exception("TTS 返回空音频数据")
            else:
                error_msg = getattr(response, "message", "未知错误")
                raise Exception(f"TTS 返回错误: {error_msg}")

        try:
            audio_bytes = await self._retry_tts(_call)

            # 写入缓存 (base64 编码)
            if redis and audio_bytes:
                try:
                    import base64
                    await redis.setex(
                        cache_key,
                        settings.TTS_CACHE_TTL,
                        base64.b64encode(audio_bytes).decode(),
                    )
                except Exception as e:
                    logger.warning(f"[TTS] 写入缓存失败: {e}")

            return audio_bytes

        except Exception as e:
            logger.error(f"[TTS] 合成失败: {e}")
            # 降级：返回空 bytes，前端可降级使用 Web Speech API
            return b""

    async def synthesize_to_url(self, text: str, voice: str = "zhixiaoxuan") -> str:
        """
        文本转语音并上传到 OSS (返回可访问 URL)

        用于对话陪练等场景，返回可直接播放的 URL。
        """
        if not text or not text.strip():
            return ""

        # 查缓存
        redis = await self._get_redis()
        cache_key = self._cache_key(text, voice)
        if redis:
            try:
                cached_url = await redis.get(cache_key)
                if cached_url and cached_url.startswith("http"):
                    logger.debug(f"[TTS] URL 缓存命中: {cache_key}")
                    return cached_url
            except Exception:
                pass

        # 合成音频
        audio_bytes = await self.synthesize(text, voice)
        if not audio_bytes:
            return ""

        # 上传到 OSS
        oss_url = await self._upload_to_oss(audio_bytes, text, voice)
        if oss_url:
            # 写入 URL 缓存
            if redis:
                try:
                    await redis.setex(
                        cache_key, settings.TTS_CACHE_TTL, oss_url
                    )
                except Exception:
                    pass
            return oss_url

        # OSS 上传失败，返回空 (前端降级)
        logger.warning("[TTS] OSS 上传失败，返回空 URL")
        return ""

    async def get_available_voices(self) -> list:
        """获取可用音色列表"""
        return AVAILABLE_VOICES

    async def _retry_tts(self, coro_factory, max_retries: int = None, base_delay: float = None):
        """TTS 重试逻辑（委托公共重试模块）"""
        from app.ai.retry import retry_with_backoff
        return await retry_with_backoff(
            coro_factory,
            max_retries=max_retries or settings.TTS_MAX_RETRIES,
            base_delay=base_delay or settings.TTS_RETRY_DELAY,
            timeout=settings.TTS_TIMEOUT,
            service_name="TTS",
        )

    async def _upload_to_oss(self, audio_bytes: bytes, text: str, voice: str) -> str:
        """
        上传音频到阿里云 OSS

        返回可访问的签名 URL。
        如果 OSS 配置不完整，返回空字符串。
        """
        if not settings.OSS_ACCESS_KEY_ID or not settings.OSS_BUCKET_NAME:
            logger.debug("[TTS] OSS 未配置，跳过上传")
            return ""

        try:
            import oss2

            auth = oss2.Auth(settings.OSS_ACCESS_KEY_ID, settings.OSS_ACCESS_KEY_SECRET)
            bucket = oss2.Bucket(
                auth, f"https://{settings.OSS_ENDPOINT}", settings.OSS_BUCKET_NAME
            )

            # 生成文件路径: tts/{voice}/{hash}.wav
            text_hash = hashlib.md5(f"{voice}:{text}".encode()).hexdigest()[:16]
            object_key = f"tts/{voice}/{text_hash}.wav"

            # 上传
            bucket.put_object(object_key, audio_bytes)

            # 生成签名 URL (7 天有效)
            url = bucket.sign_url("GET", object_key, settings.TTS_CACHE_TTL)
            logger.debug(f"[TTS] 已上传到 OSS: {object_key}")
            return url

        except ImportError:
            logger.warning("[TTS] oss2 SDK 未安装，跳过 OSS 上传")
            return ""
        except Exception as e:
            logger.error(f"[TTS] OSS 上传失败: {e}")
            return ""
