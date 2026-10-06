"""
应用配置

所有配置项均可通过环境变量或 .env 文件覆盖。
配置优先级：环境变量 > .env 文件 > 代码默认值

环境变量前缀：无（直接使用字段名，如 DATABASE_URL、SECRET_KEY 等）
"""
import logging
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from functools import lru_cache

logger = logging.getLogger(__name__)

# 不安全的默认 SECRET_KEY，启动时检测并拒绝
_INSECURE_SECRET_KEYS = frozenset({
    "your-secret-key-change-in-production",
    "your-secret-key-here-change-in-production",
    "your_jwt_secret_key_here",
    "secret",
    "change-me",
    "changeme",
})


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # ── 基础信息 ──────────────────────────────────────────
    APP_NAME: str = "AI听觉康复助手"
    """应用名称，用于 API 文档和健康检查响应"""

    APP_VERSION: str = "0.1.0"
    """应用版本号，遵循语义化版本规范"""

    DEBUG: bool = False
    """调试模式开关。生产环境务必设为 False，会禁用 Swagger/ReDoc 文档"""

    # ── 数据库 ────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/cochlear_rehab"
    """PostgreSQL 异步连接字符串。格式：postgresql+asyncpg://user:pass@host:port/dbname"""

    # ── Redis ─────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    """Redis 连接地址，用于对话上下文缓存和会话管理"""

    # ── JWT 认证 ──────────────────────────────────────────
    SECRET_KEY: str = ""
    """JWT 签名密钥。必须在 .env 中设置强随机值，禁止使用默认值。
    生成方式：python -c 'import secrets; print(secrets.token_urlsafe(64))'"""

    ALGORITHM: str = "HS256"
    """JWT 签名算法，支持 HS256/HS384/HS512"""

    ACCESS_TOKEN_EXPIRE_HOURS: int = 2
    """JWT Token 有效期（小时），过期后用户需重新登录"""

    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    """JWT Refresh Token 有效期（天），用户使用 refresh token 延长会话"""

    # ── AI 服务 (阿里云百炼) ──────────────────────────────
    DASHSCOPE_API_KEY: str = ""
    """阿里云百炼 API Key，用于 ASR/TTS/LLM 服务调用。
    获取地址：https://dashscope.console.aliyun.com/apiKey"""

    # ASR（语音识别）配置
    ASR_MODEL: str = "paraformer-v2"
    """语音识别模型。paraformer-v2 为阿里云百炼的实时语音识别模型"""

    ASR_TIMEOUT: int = 10
    """语音识别请求超时时间（秒）"""

    ASR_MAX_RETRIES: int = 3
    """语音识别失败后最大重试次数"""

    ASR_RETRY_DELAY: float = 1.0
    """语音识别重试间隔（秒），采用固定延迟策略"""

    # TTS（语音合成）配置
    TTS_MODEL: str = "qwen3-tts"
    """语音合成模型。qwen3-tts 为阿里云百炼的高质量 TTS 模型"""

    TTS_DEFAULT_VOICE: str = "zhixiaoxuan"
    """默认 TTS 音色。zhixiaoxuan 为年轻女性音色，适合康复训练场景"""

    TTS_TIMEOUT: int = 15
    """语音合成请求超时时间（秒）"""

    TTS_MAX_RETRIES: int = 3
    """语音合成失败后最大重试次数"""

    TTS_RETRY_DELAY: float = 1.0
    """语音合成重试间隔（秒）"""

    TTS_CACHE_TTL: int = 86400 * 7  # 7 天
    """TTS 音频缓存过期时间（秒）。相同文本的合成结果会缓存到 OSS，避免重复调用"""

    # LLM（大语言模型）配置
    LLM_MODEL: str = "qwen-turbo"
    """对话生成模型。qwen-turbo 为通义千问轻量版，平衡性能与成本"""

    LLM_TIMEOUT: int = 30
    """LLM 请求超时时间（秒）。对话生成可能较慢，设置较长超时"""

    LLM_MAX_RETRIES: int = 3
    """LLM 请求失败后最大重试次数"""

    LLM_RETRY_DELAY: float = 1.0
    """LLM 重试间隔（秒）"""

    LLM_MAX_TOKENS: int = 1024
    """LLM 单次回复最大 token 数。过长会增加延迟和成本"""

    LLM_TEMPERATURE: float = 0.7
    """LLM 生成温度。0.7 平衡创造性与一致性，适合对话场景"""

    # OSS（对象存储）配置 —— 用于 TTS 缓存音频上传
    OSS_ACCESS_KEY_ID: str = ""
    """阿里云 OSS AccessKey ID，用于上传 TTS 缓存音频"""

    OSS_ACCESS_KEY_SECRET: str = ""
    """阿里云 OSS AccessKey Secret"""

    OSS_BUCKET_NAME: str = "cochlear-rehab-audio"
    """OSS Bucket 名称，存储 TTS 合成的音频文件"""

    OSS_ENDPOINT: str = "oss-cn-hangzhou.aliyuncs.com"
    """OSS 访问端点，华东区域为 oss-cn-hangzhou.aliyuncs.com"""

    OSS_REGION: str = "cn-hangzhou"
    """OSS 所在区域，需与 Endpoint 保持一致"""

    # ── CORS 跨域 ─────────────────────────────────────────
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
    ]
    """允许的跨域来源列表。生产环境应替换为实际域名"""

    # ── 安全护栏 ──────────────────────────────────────────
    SAFETY_KEYWORDS: list[str] = [
        "自杀", "自残", "死亡", "遗书", "活不下去",
        "毒品", "赌博", "色情",
        "杀人", "暴力", "炸弹",
        "医疗建议", "用药", "剂量", "手术",
    ]
    """安全护栏关键词列表。用户输入命中时，AI 将拒绝讨论并引导回训练话题"""

    # ── Cookie 安全 ──────────────────────────────────────────
    COOKIE_SECURE: bool = False
    """Cookie 是否仅通过 HTTPS 传输。生产环境应设为 True"""

    COOKIE_SAMESITE: str = "lax"
    """Cookie SameSite 策略。可选值: lax, strict, none"""

    @model_validator(mode="after")
    def _validate_secret_key(self) -> "Settings":
        """启动时强制校验 SECRET_KEY 不能为默认值或空值"""
        secret_key = self.SECRET_KEY.strip()
        if (
            len(secret_key) < 32
            or secret_key in _INSECURE_SECRET_KEYS
        ):
            logger.critical(
                "SECRET_KEY 不安全！必须设置至少 32 个字符的随机密钥，且不能使用示例值。"
                "请在 .env 文件中设置一个强随机密钥，例如：\n"
                "  SECRET_KEY=<运行 python -c 'import secrets; print(secrets.token_urlsafe(64))' 生成>"
            )
            raise ValueError("SECRET_KEY 必须是至少 32 个字符的随机值")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


# 向后兼容：模块级 settings 实例
settings = get_settings()
