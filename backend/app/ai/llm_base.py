"""
LLM 网关抽象基类
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncGenerator


@dataclass
class LLMResponse:
    """LLM 响应结果"""
    content: str
    finish_reason: str = "stop"
    usage: dict = field(default_factory=dict)


class LLMGatewayBase(ABC):
    """LLM 网关抽象基类"""

    @abstractmethod
    async def chat(self, messages: list, scenario: str = None) -> LLMResponse:
        """
        非流式对话
        :param messages: 消息列表 [{"role": "user"/"assistant"/"system", "content": "..."}]
        :param scenario: 场景代码 (如 "ordering"/"directions"/"phone")
        :return: LLMResponse
        """
        pass

    @abstractmethod
    async def chat_stream(
        self, messages: list, scenario: str = None
    ) -> AsyncGenerator[str, None]:
        """
        流式对话 (用于对话陪练)
        :param messages: 消息列表
        :param scenario: 场景代码
        :yield: 增量文本片段
        """
        pass
