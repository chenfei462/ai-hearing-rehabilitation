"""
ASR 网关抽象基类
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncGenerator, Optional


@dataclass
class ASRResult:
    """ASR 识别结果"""
    text: str
    confidence: float
    phonemes: list = field(default_factory=list)
    timestamps: list = field(default_factory=list)


@dataclass
class PhonemeInfo:
    """音素信息 (用于发音评分)"""
    phoneme: str
    start_ms: int
    end_ms: int
    confidence: float


class ASRGatewayBase(ABC):
    """ASR 网关抽象基类"""

    @abstractmethod
    async def recognize(self, audio_bytes: bytes, language: str = "zh") -> ASRResult:
        """
        语音识别 (录音文件整段上传)
        :param audio_bytes: 音频二进制 (WAV 16kHz 单声道)
        :param language: 语言代码
        :return: ASRResult
        """
        pass

    @abstractmethod
    async def recognize_with_timestamps(self, audio_bytes: bytes) -> ASRResult:
        """
        带时间戳的语音识别 (用于发音评分)
        :param audio_bytes: 音频二进制
        :return: ASRResult (含 timestamps/phonemes)
        """
        pass

    @abstractmethod
    async def recognize_stream(
        self, audio_stream: AsyncGenerator[bytes, None], language: str = "zh"
    ) -> AsyncGenerator[ASRResult, None]:
        """
        流式语音识别 (用于对话陪练)
        :param audio_stream: 音频流 (chunk by chunk)
        :param language: 语言代码
        :yield: 识别中间结果 / 最终结果
        """
        pass
