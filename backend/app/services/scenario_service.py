"""
场景管理服务 - 对话场景的查询与配置管理

从原 DialogueService 中拆分而来，负责场景元数据管理。
"""
from app.ai.llm_gateway import SCENARIO_PROMPTS


# ─── 场景 UI 元数据 ─────────────────────────────────────────
# 场景 key 与 t03 SCENARIO_PROMPTS 完全对齐
SCENARIOS = {
    "ordering": {
        "name": "餐厅点餐",
        "description": "模拟餐厅场景，练习点餐对话",
        "rounds": 5,
        "icon": "restaurant",
    },
    "directions": {
        "name": "问路导航",
        "description": "模拟问路场景，练习方向询问",
        "rounds": 5,
        "icon": "map",
    },
    "phone": {
        "name": "电话交流",
        "description": "模拟电话通话，练习电话沟通",
        "rounds": 5,
        "icon": "phone",
    },
    "shopping": {
        "name": "购物对话",
        "description": "模拟商店购物场景",
        "rounds": 5,
        "icon": "shopping_cart",
    },
    "daily": {
        "name": "日常闲聊",
        "description": "轻松日常对话，练习日常表达",
        "rounds": 5,
        "icon": "chat",
    },
}


class ScenarioService:
    """场景管理服务"""

    @staticmethod
    def list_scenarios() -> list[dict]:
        """获取所有可用场景（从 SCENARIOS + SCENARIO_PROMPTS 合并）"""
        result = []
        for key, meta in SCENARIOS.items():
            prompt_info = SCENARIO_PROMPTS.get(key, {})
            result.append({
                "id": key,
                "name": meta["name"],
                "description": meta["description"],
                "rounds": meta["rounds"],
                "greeting": prompt_info.get("greeting", ""),
            })
        return result

    @staticmethod
    def get_scenario(scenario_key: str) -> dict | None:
        """获取指定场景的元数据"""
        return SCENARIOS.get(scenario_key)

    @staticmethod
    def get_scenario_prompt(scenario_key: str) -> dict:
        """获取指定场景的 prompt 配置"""
        return SCENARIO_PROMPTS.get(scenario_key, {})

    @staticmethod
    def validate_scenario(scenario_key: str) -> bool:
        """验证场景是否存在"""
        return scenario_key in SCENARIOS
