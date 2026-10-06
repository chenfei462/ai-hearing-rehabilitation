"""
贝叶斯知识追踪（BKT）自适应训练引擎

实现基于BKT的自适应训练算法，用于听觉康复训练。

BKT模型参数：
- p_init: 初始掌握概率
- p_learn: 学习概率（从未掌握到掌握的转移概率）
- p_guess: 猜测概率（未掌握时答对的概率）
- p_slip: 失误概率（掌握时答错的概率）

核心公式：
P(L|correct) = P(correct|L) * P(L) / P(correct)
P(L|wrong) = P(wrong|L) * P(L) / P(wrong)
"""
import random
from typing import Optional
from dataclasses import dataclass


@dataclass
class BKTParameters:
    """BKT模型参数"""
    p_init: float = 0.3  # 初始掌握概率
    p_learn: float = 0.1  # 学习概率
    p_guess: float = 0.2  # 猜测概率
    p_slip: float = 0.1  # 失误概率

    def __post_init__(self):
        """验证参数范围"""
        for name, value in [
            ('p_init', self.p_init),
            ('p_learn', self.p_learn),
            ('p_guess', self.p_guess),
            ('p_slip', self.p_slip)
        ]:
            if not 0.0 <= value <= 1.0:
                raise ValueError(f"{name} must be between 0 and 1, got {value}")


@dataclass
class KnowledgeState:
    """用户知识状态"""
    mastery: float = 0.0  # 掌握概率 (0-1)
    confidence: float = 0.0  # 置信度 (0-1)
    attempts: int = 0  # 尝试次数
    correct_count: int = 0  # 正确次数

    @property
    def accuracy(self) -> float:
        """计算正确率"""
        if self.attempts == 0:
            return 0.0
        return self.correct_count / self.attempts


class AdaptiveEngine:
    """
    自适应训练引擎

    实现BKT算法，用于听觉康复训练的自适应难度调整。
    """

    def __init__(self, params: Optional[BKTParameters] = None):
        """
        初始化自适应引擎

        Args:
            params: BKT模型参数，使用默认参数如果未提供
        """
        self.params = params or BKTParameters()

    def initialize_knowledge(self) -> KnowledgeState:
        """
        初始化知识状态

        Returns:
            初始知识状态
        """
        return KnowledgeState(
            mastery=self.params.p_init,
            confidence=0.0,
            attempts=0,
            correct_count=0
        )

    def update_mastery(self, state: KnowledgeState, is_correct: bool) -> KnowledgeState:
        """
        使用BKT算法更新掌握概率

        Args:
            state: 当前知识状态
            is_correct: 是否答对

        Returns:
            更新后的知识状态
        """
        p_mastery = state.mastery
        p_correct_given_mastery = 1.0 - self.params.p_slip if is_correct else self.params.p_slip
        p_correct_given_not_mastery = self.params.p_guess if is_correct else (1.0 - self.params.p_guess)

        # P(correct) = P(correct|L)*P(L) + P(correct|~L)*P(~L)
        p_correct = (p_correct_given_mastery * p_mastery +
                     p_correct_given_not_mastery * (1.0 - p_mastery))

        # 避免除零
        if p_correct == 0:
            p_correct = 1e-10

        # 贝叶斯更新: P(L|correct) = P(correct|L) * P(L) / P(correct)
        p_mastery_given_correct = (p_correct_given_mastery * p_mastery) / p_correct

        # 应用学习转移: P(L_new) = P(L|obs) + P(T) * (1 - P(L|obs))
        new_mastery = p_mastery_given_correct + self.params.p_learn * (1.0 - p_mastery_given_correct)

        # 确保在[0, 1]范围内
        new_mastery = max(0.0, min(1.0, new_mastery))

        # 更新计数
        new_attempts = state.attempts + 1
        new_correct_count = state.correct_count + (1 if is_correct else 0)

        # 计算置信度
        new_confidence = self.calculate_confidence(
            KnowledgeState(
                attempts=new_attempts,
                correct_count=new_correct_count,
                mastery=new_mastery,
            )
        )

        return KnowledgeState(
            mastery=new_mastery,
            confidence=new_confidence,
            attempts=new_attempts,
            correct_count=new_correct_count
        )

    def calculate_confidence(self, state: KnowledgeState) -> float:
        """
        计算置信度

        置信度基于尝试次数和掌握概率的稳定性。
        使用对数函数使置信度随尝试次数增加而增加，但增速递减。

        Args:
            state: 知识状态

        Returns:
            置信度 (0-1)
        """
        if state.attempts == 0:
            return 0.0

        # 基于尝试次数的置信度（有界增长）
        n = state.attempts
        confidence_from_attempts = n / (n + 5)

        # 观测结果越一致，结论越可靠；不直接使用 mastery，避免连续答对时
        # 掌握概率上升反而令置信度下降。
        accuracy = state.accuracy
        consistency = max(accuracy, 1.0 - accuracy)

        # 综合置信度
        confidence = 0.7 * confidence_from_attempts + 0.3 * consistency

        return max(0.0, min(1.0, confidence))

    def recommend_difficulty(self, state: KnowledgeState) -> float:
        """
        推荐训练难度

        基于掌握概率和置信度推荐合适的训练难度。
        使用自适应策略：
        - 高掌握度+高置信度：推荐较高难度
        - 低掌握度：推荐较低难度
        - 低置信度：推荐中等难度（探索）

        Args:
            state: 知识状态

        Returns:
            推荐难度 (0-1)
        """
        mastery = state.mastery
        confidence = state.confidence

        # 基础难度：略高于当前掌握度
        base_difficulty = mastery + 0.1

        # 根据置信度调整
        # 低置信度时，倾向于推荐中等难度进行探索
        if confidence < 0.5:
            # 向0.5靠拢
            exploration_factor = 1.0 - confidence
            base_difficulty = base_difficulty * (1.0 - exploration_factor) + 0.5 * exploration_factor

        # 确保在[0, 1]范围内
        return max(0.0, min(1.0, base_difficulty))

    def simulate_response(self, state: KnowledgeState, difficulty: float) -> bool:
        """
        模拟用户回答

        基于掌握概率和难度模拟用户是否答对。

        Args:
            state: 知识状态
            difficulty: 题目难度

        Returns:
            是否答对
        """
        # 使用BKT的猜测和失误参数
        # P(correct) = P(L) * (1 - P_slip) + (1 - P(L)) * P_guess
        # 难度调整：难度越高，答对概率越低
        mastery = state.mastery
        difficulty_factor = 1.0 - difficulty * 0.3

        # 难度主要影响掌握状态下的答题表现，不能同时压低猜测概率。
        p_correct = (
            mastery * (1.0 - self.params.p_slip) * difficulty_factor
            + (1.0 - mastery) * self.params.p_guess
        )

        p_correct = max(0.0, min(1.0, p_correct))

        return random.random() < p_correct

    def calculate_reward(self, difficulty: float, is_correct: bool) -> float:
        """
        计算训练奖励

        答对难题获得更高奖励，答错简单题惩罚更低。

        Args:
            difficulty: 题目难度
            is_correct: 是否答对

        Returns:
            奖励值
        """
        if is_correct:
            # 答对：难度越高，奖励越高
            return 1.0 + difficulty * 0.5
        else:
            # 答错：难度越高，惩罚越小
            return -0.5 * (1.0 - difficulty)

    def get_recommendation(self, state: KnowledgeState) -> dict:
        """
        获取完整的训练推荐

        Args:
            state: 知识状态

        Returns:
            推荐信息字典
        """
        difficulty = self.recommend_difficulty(state)

        return {
            "recommended_difficulty": difficulty,
            "mastery": state.mastery,
            "confidence": state.confidence,
            "attempts": state.attempts,
            "accuracy": state.accuracy,
            "suggestion": self._get_suggestion(state)
        }

    def _get_suggestion(self, state: KnowledgeState) -> str:
        """
        生成训练建议

        Args:
            state: 知识状态

        Returns:
            建议文本
        """
        if state.attempts < 5:
            return "继续练习，积累更多数据以提高评估准确性"

        if state.mastery >= 0.8 and state.confidence >= 0.7:
            return "掌握良好，可以尝试更高难度的训练"

        if state.mastery < 0.4:
            return "建议降低难度，巩固基础知识"

        if state.confidence < 0.5:
            return "置信度较低，建议保持当前难度继续练习"

        return "继续当前难度训练，稳步提升"


# 创建全局实例
adaptive_engine = AdaptiveEngine()
