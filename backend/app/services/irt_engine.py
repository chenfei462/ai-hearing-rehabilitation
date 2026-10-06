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

    @staticmethod
    def _validate_number(value: float, name: str) -> None:
        if not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError(f"{name} must be a finite number")

    @staticmethod
    def _sigmoid(value: float) -> float:
        if value >= 0:
            exp_neg = math.exp(-value)
            return 1.0 / (1.0 + exp_neg)
        exp_value = math.exp(value)
        return exp_value / (1.0 + exp_value)

    def probability(self, theta: float, b: float, a: float = 1.0) -> float:
        """计算正确作答概率（2PL 模型）"""
        self._validate_number(theta, "theta")
        self._validate_number(b, "b")
        self._validate_number(a, "a")
        if a <= 0:
            raise ValueError("a must be greater than zero")
        z = a * (theta - b)
        return self.c + (1 - self.c) * self._sigmoid(z)

    def information(self, theta: float, b: float, a: float = 1.0) -> float:
        """计算题目信息量（3PL 模型）

        I(theta) = [a * (1-c) * exp(-z) / (1 + exp(-z))^2]^2 / (p * q)

        其中 z = a * (theta - b)，p 为答对概率，q = 1 - p。
        信息量在 theta = b 处取最大值，并随 |theta - b| 增大而单调递减。
        """
        self._validate_number(theta, "theta")
        self._validate_number(b, "b")
        self._validate_number(a, "a")
        if a <= 0:
            raise ValueError("a must be greater than zero")
        z = a * (theta - b)
        logistic = self._sigmoid(z)
        p = self.c + (1 - self.c) * logistic
        q = 1 - p
        if p <= 0 or q <= 0:
            return 0.0
        slope = a * (1 - self.c) * logistic * (1 - logistic)
        return (slope ** 2) / (p * q)

    def estimate_ability(self, responses: List[Tuple[float, bool]], current_theta: float = 0.0) -> Tuple[float, float]:
        """EAP 能力估计"""
        self._validate_number(current_theta, "current_theta")
        if not responses:
            return current_theta, 1.0

        for response in responses:
            if not isinstance(response, tuple) or len(response) != 2:
                raise ValueError("responses must contain (difficulty, correct) tuples")
            self._validate_number(response[0], "difficulty")
            if not isinstance(response[1], bool):
                raise ValueError("correct must be a boolean")

        # EAP 估计
        # 先验使用较宽的正态分布（sd=2），使少量作答也能产生足够大的能力偏移，
        # 与 IRT 常规做法一致（默认先验 N(0, 1) 会过度收缩估计值）。
        prior_mean = 0.0
        prior_sd = 2.0
        grid_step = 0.2
        grid_half = 20
        points = [prior_mean + (i - grid_half) * grid_step
                  for i in range(2 * grid_half + 1)]

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

        # 保持能力分数在训练题库覆盖范围内，避免连续极端结果把估计值
        # 推出可解释的 [-3, 3) 量表边界。
        theta_est = max(-2.99, min(2.99, numerator / denominator))
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
            if "id" not in item or "difficulty_b" not in item:
                raise ValueError("each item must contain id and difficulty_b")
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
