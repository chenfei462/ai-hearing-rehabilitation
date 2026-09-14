import math
from typing import Tuple, List
from dataclasses import dataclass

@dataclass
class IRTEstimate:
    theta: float  # 能力估计
    se: float     # 标准误
    action: str   # next / upgrade / downgrade

class IRTEngine:
    """IRT 2PL 自适应引擎"""

    def __init__(self):
        self.c = 0.25  # 猜测参数
        self.upgrade_threshold = 0.8    # 升级阈值
        self.downgrade_threshold = 0.6  # 降级阈值
        self.consecutive_required = 3   # 连续次数要求

    def probability(self, theta: float, b: float, a: float = 1.0) -> float:
        """计算正确作答概率（2PL 模型）"""
        z = a * (theta - b)
        return self.c + (1 - self.c) / (1 + math.exp(-z))

    def information(self, theta: float, b: float, a: float = 1.0) -> float:
        """计算题目信息量"""
        p = self.probability(theta, b, a)
        q = 1 - p
        return (a ** 2 * q) / (p * (1 - self.c) ** 2)

    def estimate_ability(self, responses: List[Tuple[float, bool]], current_theta: float = 0.0) -> Tuple[float, float]:
        """EAP 能力估计"""
        if not responses:
            return current_theta, 1.0

        # EAP 估计
        prior_mean = 0.0
        prior_sd = 1.0
        n_points = 41
        points = [prior_mean + (i - 20) * 0.2 for i in range(n_points)]

        numerator = 0.0
        denominator = 0.0

        for theta in points:
            # 先验
            prior = math.exp(-0.5 * ((theta - prior_mean) / prior_sd) ** 2)

            # 似然
            likelihood = 1.0
            for b, correct in responses:
                p = self.probability(theta, b)
                if correct:
                    likelihood *= p
                else:
                    likelihood *= (1 - p)

            numerator += theta * prior * likelihood
            denominator += prior * likelihood

        if denominator == 0:
            return current_theta, 1.0

        theta_est = numerator / denominator
        se = 1.0 / math.sqrt(sum(
            self.information(theta_est, b) for b, _ in responses
        ) + 1.0)

        return theta_est, se

    def select_next_item(self, theta: float, available_items: list) -> int:
        """最大信息量选题"""
        if not available_items:
            return None

        best_item = None
        best_info = -1

        for item in available_items:
            info = self.information(theta, item["difficulty_b"])
            if info > best_info:
                best_info = info
                best_item = item

        return best_item["id"] if best_item else available_items[0]["id"]

    def decide_next_action(self, recent_accuracies: List[float]) -> IRTEstimate:
        """决定升降级"""
        if len(recent_accuracies) < self.consecutive_required:
            return IRTEstimate(0.0, 1.0, "continue")

        recent = recent_accuracies[-self.consecutive_required:]
        avg = sum(recent) / len(recent)

        if avg >= self.upgrade_threshold:
            return IRTEstimate(0.0, 1.0, "upgrade")
        elif avg < self.downgrade_threshold:
            return IRTEstimate(0.0, 1.0, "downgrade")
        else:
            return IRTEstimate(0.0, 1.0, "continue")

irt_engine = IRTEngine()
