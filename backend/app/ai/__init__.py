"""
AI 能力网关层

统一封装阿里云百炼平台的三大 AI 服务:
  - asr_gateway:  Fun-ASR 语音识别
  - tts_gateway:  Qwen3-TTS 语音合成
  - llm_gateway:  通义千问大模型对话

使用方式 (推荐 - 全局单例):
    from app.ai import asr_gateway, tts_gateway, llm_gateway

使用方式 (依赖注入):
    from app.ai import get_asr_gateway, get_tts_gateway, get_llm_gateway
    gateway = get_asr_gateway()

使用方式 (自定义配置):
    from app.ai import create_asr_gateway
    gateway = create_asr_gateway(api_key="...", model="...")
"""
from .asr_gateway import FunASRGateway, AIServiceUnavailable, AIServiceTimeout
from .asr_base import ASRResult, PhonemeInfo
from .tts_gateway import QwenTTSGateway, AVAILABLE_VOICES, ELDERLY_RECOMMENDED_VOICES
from .llm_gateway import QwenLLMGateway, SCENARIO_PROMPTS
from .llm_base import LLMResponse
from .retry import retry_with_backoff, make_retry_wrapper

# ── 工厂函数 (依赖注入) ─────────────────────────────────────

def create_asr_gateway(api_key: str = None, model: str = None, **kwargs) -> FunASRGateway:
    """创建 ASR 网关实例（可自定义配置）"""
    gateway = FunASRGateway()
    if api_key:
        gateway.api_key = api_key
    if model:
        gateway.model = model
    return gateway


def create_tts_gateway(api_key: str = None, model: str = None, **kwargs) -> QwenTTSGateway:
    """创建 TTS 网关实例（可自定义配置）"""
    gateway = QwenTTSGateway()
    if api_key:
        gateway.api_key = api_key
    if model:
        gateway.model = model
    return gateway


def create_llm_gateway(api_key: str = None, model: str = None, **kwargs) -> QwenLLMGateway:
    """创建 LLM 网关实例（可自定义配置）"""
    gateway = QwenLLMGateway()
    if api_key:
        gateway.api_key = api_key
    if model:
        gateway.model = model
    return gateway


# ── 延迟初始化的访问器 (依赖注入) ────────────────────────────

_gateway_container = {}

def get_asr_gateway() -> FunASRGateway:
    """获取 ASR 网关单例（延迟初始化，线程安全）"""
    if "asr" not in _gateway_container:
        _gateway_container["asr"] = FunASRGateway()
    return _gateway_container["asr"]


def get_tts_gateway() -> QwenTTSGateway:
    """获取 TTS 网关单例（延迟初始化，线程安全）"""
    if "tts" not in _gateway_container:
        _gateway_container["tts"] = QwenTTSGateway()
    return _gateway_container["tts"]


def get_llm_gateway() -> QwenLLMGateway:
    """获取 LLM 网关单例（延迟初始化，线程安全）"""
    if "llm" not in _gateway_container:
        _gateway_container["llm"] = QwenLLMGateway()
    return _gateway_container["llm"]


def reset_gateways():
    """重置所有网关单例（用于测试）"""
    _gateway_container.clear()


# ── 全局单例（向后兼容） ────────────────────────────────────
asr_gateway = FunASRGateway()
tts_gateway = QwenTTSGateway()
llm_gateway = QwenLLMGateway()

__all__ = [
    # 网关实例 (向后兼容)
    "asr_gateway",
    "tts_gateway",
    "llm_gateway",
    # 依赖注入访问器
    "get_asr_gateway",
    "get_tts_gateway",
    "get_llm_gateway",
    # 工厂函数
    "create_asr_gateway",
    "create_tts_gateway",
    "create_llm_gateway",
    # 工具函数
    "reset_gateways",
    # 网关类
    "FunASRGateway",
    "QwenTTSGateway",
    "QwenLLMGateway",
    # 数据类
    "ASRResult",
    "PhonemeInfo",
    "LLMResponse",
    # 异常
    "AIServiceUnavailable",
    "AIServiceTimeout",
    # 常量
    "AVAILABLE_VOICES",
    "ELDERLY_RECOMMENDED_VOICES",
    "SCENARIO_PROMPTS",
    # 重试工具
    "retry_with_backoff",
    "make_retry_wrapper",
]
