"""
TTS 网关抽象基类
"""
from abc import ABC, abstractmethod


class TTSGatewayBase(ABC):
    """TTS 网关抽象基类"""

    @abstractmethod
    async def synthesize(self, text: str, voice: str = "zhixiaoxuan") -> bytes:
        """
        文本转语音 (返回音频 bytes)
        :param text: 待合成文本
        :param voice: 音色名称
        :return: 音频二进制 (WAV/MP3)
        """
        pass

    @abstractmethod
    async def synthesize_to_url(self, text: str, voice: str = "zhixiaoxuan") -> str:
        """
        文本转语音并上传到 OSS (返回可访问 URL)
        :param text: 待合成文本
        :param voice: 音色名称
        :return: OSS 可访问 URL
        """
        pass

    @abstractmethod
    async def get_available_voices(self) -> list:
        """
        获取可用音色列表
        :return: 音色列表 [{name, gender, description}]
        """
        pass
