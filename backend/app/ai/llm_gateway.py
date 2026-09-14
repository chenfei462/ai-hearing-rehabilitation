"""
Qwen LLM 网关 — 阿里云通义千问对话封装

功能:
  - 非流式对话 (用于单次问答)
  - 流式对话 (用于对话陪练，逐字输出)
  - 场景提示词管理 (点餐/问路/电话等)
  - 安全护栏 (过滤不当内容)
  - 重试 + 超时 + 降级

场景提示词:
  - 系统 prompt 注入场景描述和角色设定
  - 老年用户适配：回复简洁、语速建议、鼓励性语言

安全护栏:
  - 输入过滤：敏感词检测
  - 输出过滤：医疗建议拦截、不当内容检测
  - 降级：LLM 调用失败时返回预设话术
"""
from typing import AsyncGenerator, Optional

from loguru import logger

from app.ai.llm_base import LLMGatewayBase, LLMResponse
from app.core.config import get_settings

settings = get_settings()


# ── 场景提示词 ──────────────────────────────────────────────

SCENARIO_PROMPTS = {
    "ordering": {
        "name": "餐厅点餐",
        "system_prompt": """你是一位友善的餐厅服务员，正在为一位人工耳蜗术后康复训练的用户提供点餐服务。

角色设定：
- 你是一家中式餐厅的服务员
- 用户正在通过与你对话进行听觉康复训练
- 你的回复要简洁明了，语速适中，避免复杂长句
- 使用标准普通话，发音清晰
- 适当鼓励用户的表达

对话要求：
- 每次回复控制在 2-3 句话以内
- 使用日常口语化表达
- 如果用户表达不清楚，温和地询问确认
- 在对话中自然地引导用户多说话

安全提示：
- 不提供任何医疗建议
- 如果用户询问健康/医疗问题，礼貌地引导回点餐话题
- 保持友善、耐心的态度""",
        "greeting": "您好！欢迎光临！请问您今天想吃点什么？",
    },
    "directions": {
        "name": "问路指路",
        "system_prompt": """你是一位热心的路人，正在帮助一位人工耳蜗术后康复训练的用户指路。

角色设定：
- 你在街上遇到了需要问路的用户
- 用户正在通过与你对话进行听觉康复训练
- 你的指路要简洁、清晰，使用方位词和地标
- 使用标准普通话

对话要求：
- 每次回复控制在 2-3 句话以内
- 使用简单直接的指路表达
- 如果用户没听清，换一种方式重复
- 适当询问用户是否明白

安全提示：
- 不提供任何医疗建议
- 保持友善、乐于助人的态度""",
        "greeting": "你好！请问你需要去哪里？我可以帮你指路。",
    },
    "phone": {
        "name": "电话交流",
        "system_prompt": """你正在通过电话与一位人工耳蜗术后康复训练的用户交流。

角色设定：
- 你是一位朋友/家人/客服
- 用户正在通过电话对话进行听觉康复训练
- 电话场景下要特别注意语速和清晰度
- 使用标准普通话

对话要求：
- 每次回复控制在 2-3 句话
- 电话场景下适当放慢语速
- 重要信息重复一次
- 使用电话常用表达

安全提示：
- 不提供任何医疗建议
- 保持自然、亲切的通话氛围""",
        "greeting": "喂，你好！我是小李，最近怎么样？",
    },
    "shopping": {
        "name": "购物交流",
        "system_prompt": """你是一位商店店员，正在为一位人工耳蜗术后康复训练的用户提供购物服务。

角色设定：
- 你是一家日用品商店的店员
- 用户正在通过与你对话进行听觉康复训练
- 回复简洁明了，价格和商品信息要说清楚

对话要求：
- 每次回复控制在 2-3 句话
- 主动询问用户需求
- 价格数字要缓慢清晰地说出来
- 使用日常购物用语

安全提示：
- 不提供任何医疗建议
- 保持热情、专业的服务态度""",
        "greeting": "欢迎光临！请问您需要买点什么？",
    },
    "daily": {
        "name": "日常闲聊",
        "system_prompt": """你是一位友善的朋友，正在与一位人工耳蜗术后康复训练的用户进行日常聊天。

角色设定：
- 你是用户的老朋友
- 用户正在通过与你对话进行听觉康复训练
- 聊天内容轻松愉快，可以聊天气、爱好、日常生活

对话要求：
- 每次回复控制在 2-3 句话
- 使用自然的口语表达
- 适当提问引导用户多表达
- 对用户的回复给予积极反馈

安全提示：
- 不提供任何医疗建议
- 如果用户表达困难，耐心等待并鼓励
- 保持温暖、友善的氛围""",
        "greeting": "嗨！好久不见，最近忙什么呢？",
    },
}

# 安全关键词列表从配置中获取，避免重复定义
SAFETY_KEYWORDS = settings.SAFETY_KEYWORDS


class QwenLLMGateway(LLMGatewayBase):
    """
    通义千问 LLM 网关

    使用 dashscope SDK 调用阿里云百炼平台的通义千问模型。
    支持场景提示词、安全护栏、流式/非流式对话。
    """

    def __init__(self):
        self.api_key = settings.DASHSCOPE_API_KEY
        self.model = settings.LLM_MODEL
        self._client = None

    def _ensure_client(self):
        """懒加载 dashscope client"""
        if self._client is None:
            try:
                import dashscope
                dashscope.api_key = self.api_key
                self._client = dashscope
                logger.info("[LLM] dashscope 客户端初始化完成")
            except ImportError:
                logger.error("[LLM] dashscope SDK 未安装")
                raise Exception("dashscope SDK 未安装")
        return self._client

    def _build_messages(self, messages: list, scenario: str = None) -> list:
        """
        构建带场景提示词的消息列表

        如果有场景配置，将系统 prompt 插入消息列表头部。
        """
        result = []

        # 注入场景系统 prompt
        if scenario and scenario in SCENARIO_PROMPTS:
            scene = SCENARIO_PROMPTS[scenario]
            result.append({
                "role": "system",
                "content": scene["system_prompt"],
            })
        else:
            # 默认系统 prompt
            result.append({
                "role": "system",
                "content": """你是一位友善的 AI 助手，正在帮助一位人工耳蜗术后康复训练的用户进行对话练习。

要求：
- 使用标准普通话，语速适中
- 回复简洁明了，每次 2-3 句话
- 对用户的表达给予积极反馈
- 不提供任何医疗建议
- 如果用户询问健康/医疗问题，礼貌地引导回日常话题""",
            })

        # 添加用户消息
        result.extend(messages)
        return result

    def _check_safety_input(self, text: str) -> tuple[bool, str]:
        """
        输入安全检查

        :return: (is_safe, reason)
        """
        text_lower = text.lower()
        for keyword in SAFETY_KEYWORDS:
            if keyword in text_lower:
                return False, f"检测到敏感内容: {keyword}"
        return True, ""

    def _check_safety_output(self, text: str) -> tuple[bool, str]:
        """
        输出安全检查

        过滤 LLM 可能输出的医疗建议或不当内容。
        """
        # 检查是否包含医疗建议
        medical_patterns = ["建议你吃", "应该服用", "药物治疗", "手术建议"]
        for pattern in medical_patterns:
            if pattern in text:
                return False, "输出包含医疗建议"
        return True, ""

    def _get_fallback_response(self, scenario: str = None) -> str:
        """获取降级响应"""
        fallbacks = {
            "ordering": "不好意思，我这边有点忙，请您再说一遍好吗？",
            "directions": "抱歉，我没太听清，您要去哪里呢？",
            "phone": "喂？信号不太好，你能再说一遍吗？",
            "shopping": "不好意思，请您再说一遍您需要什么？",
            "daily": "嗯，你继续说，我在听呢。",
        }
        return fallbacks.get(scenario, "不好意思，请您再说一遍好吗？")

    async def chat(self, messages: list, scenario: str = None) -> LLMResponse:
        """
        非流式对话

        :param messages: 消息列表 [{"role": "user", "content": "..."}]
        :param scenario: 场景代码
        :return: LLMResponse
        """
        # 输入安全检查
        if messages:
            last_msg = messages[-1].get("content", "")
            is_safe, reason = self._check_safety_input(last_msg)
            if not is_safe:
                logger.warning(f"[LLM] 输入安全检查未通过: {reason}")
                return LLMResponse(
                    content="抱歉，我无法回答这个问题。让我们聊点别的吧。",
                    finish_reason="safety",
                )

        client = self._ensure_client()
        full_messages = self._build_messages(messages, scenario)

        async def _call():
            response = client.Generation.call(
                model=self.model,
                messages=full_messages,
                result_format="message",
                max_tokens=settings.LLM_MAX_TOKENS,
                temperature=settings.LLM_TEMPERATURE,
            )

            if response.status_code == 200:
                choices = response.output.get("choices", [])
                if choices:
                    content = choices[0].get("message", {}).get("content", "")
                    finish_reason = choices[0].get("finish_reason", "stop")
                    usage = response.usage or {}
                    return LLMResponse(
                        content=content,
                        finish_reason=finish_reason,
                        usage=usage,
                    )
                return LLMResponse(content="")
            else:
                error_msg = getattr(response, "message", "未知错误")
                raise Exception(f"LLM 返回错误: {error_msg}")

        try:
            result = await self._retry_llm(_call)

            # 输出安全检查
            is_safe, reason = self._check_safety_output(result.content)
            if not is_safe:
                logger.warning(f"[LLM] 输出安全检查未通过: {reason}")
                result.content = self._get_fallback_response(scenario)

            return result

        except Exception as e:
            logger.error(f"[LLM] 对话失败: {e}")
            # 降级：返回预设话术
            return LLMResponse(
                content=self._get_fallback_response(scenario),
                finish_reason="fallback",
            )

    async def chat_stream(
        self, messages: list, scenario: str = None
    ) -> AsyncGenerator[str, None]:
        """
        流式对话 (用于对话陪练)

        逐 token 输出，前端可实时显示字幕。
        """
        # 输入安全检查
        if messages:
            last_msg = messages[-1].get("content", "")
            is_safe, reason = self._check_safety_input(last_msg)
            if not is_safe:
                yield "抱歉，我无法回答这个问题。让我们聊点别的吧。"
                return

        client = self._ensure_client()
        full_messages = self._build_messages(messages, scenario)

        try:
            # dashscope 流式调用
            responses = client.Generation.call(
                model=self.model,
                messages=full_messages,
                result_format="message",
                max_tokens=settings.LLM_MAX_TOKENS,
                temperature=settings.LLM_TEMPERATURE,
                stream=True,
                incremental_output=True,
            )

            full_content = ""
            for response in responses:
                if response.status_code == 200:
                    choices = response.output.get("choices", [])
                    if choices:
                        delta = choices[0].get("message", {}).get("content", "")
                        if delta:
                            full_content += delta
                            yield delta
                else:
                    logger.warning(f"[LLM] 流式响应错误: {response}")
                    break

            # 输出安全检查 (对完整内容)
            is_safe, reason = self._check_safety_output(full_content)
            if not is_safe:
                # 已经流式输出了部分内容，无法撤回
                # 在实际产品中应使用更完善的流式安全过滤
                logger.warning(f"[LLM] 流式输出安全检查未通过: {reason}")

        except Exception as e:
            logger.error(f"[LLM] 流式对话失败: {e}")
            # 降级：返回预设话术
            fallback = self._get_fallback_response(scenario)
            yield fallback

    async def _retry_llm(self, coro_factory, max_retries: int = None, base_delay: float = None):
        """LLM 重试逻辑（委托公共重试模块）"""
        from app.ai.retry import retry_with_backoff
        return await retry_with_backoff(
            coro_factory,
            max_retries=max_retries or settings.LLM_MAX_RETRIES,
            base_delay=base_delay or settings.LLM_RETRY_DELAY,
            timeout=settings.LLM_TIMEOUT,
            service_name="LLM",
        )

    def get_scenario_info(self, scenario: str) -> Optional[dict]:
        """获取场景信息"""
        return SCENARIO_PROMPTS.get(scenario)

    def get_available_scenarios(self) -> list:
        """获取可用场景列表"""
        return [
            {"code": code, "name": info["name"]}
            for code, info in SCENARIO_PROMPTS.items()
        ]
