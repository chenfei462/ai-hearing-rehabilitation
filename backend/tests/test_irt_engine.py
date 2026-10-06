"""
IRT 自适应引擎单元测试
"""
import pytest
import math
from app.services.irt_engine import IRTEngine, IRTEstimate


@pytest.fixture
def engine():
    """创建 IRT 引擎实例"""
    return IRTEngine()


class TestIRTProbability:
    """测试正确作答概率计算"""

    def test_probability_at_threshold(self, engine):
        """当 theta = b 时，概率应约为 0.625 (c + (1-c)/2)"""
        theta = 0.0
        b = 0.0
        prob = engine.probability(theta, b)
        expected = 0.25 + (1 - 0.25) / 2  # 0.625
        assert abs(prob - expected) < 0.001

    def test_probability_high_ability(self, engine):
        """高能力者答对简单题目的概率应该很高"""
        theta = 3.0
        b = -2.0
        prob = engine.probability(theta, b)
        assert prob > 0.95

    def test_probability_low_ability(self, engine):
        """低能力者答对难题目的概率应该接近猜测概率"""
        theta = -3.0
        b = 2.0
        prob = engine.probability(theta, b)
        assert prob < 0.3

    def test_probability_with_discrimination(self, engine):
        """区分度参数 a 应该影响概率曲线的陡峭程度"""
        theta = 0.5
        b = 0.0
        prob_low_a = engine.probability(theta, b, a=0.5)
        prob_high_a = engine.probability(theta, b, a=2.0)
        # 高区分度下，theta > b 时概率应该更高
        assert prob_high_a > prob_low_a

    def test_probability_rejects_nan_input(self, engine):
        """NaN 输入不能污染自适应计算结果"""
        with pytest.raises(ValueError):
            engine.probability(math.nan, 0.0)

    def test_select_rejects_item_without_difficulty(self, engine):
        """题库题目缺少难度字段时应明确报错"""
        with pytest.raises(ValueError):
            engine.select_next_item(0.0, [{"id": 1}])


class TestIRTInformation:
    """测试题目信息量计算"""

    def test_information_max_at_threshold(self, engine):
        """信息量在 theta ≈ b 时最大"""
        b = 0.0
        info_at_b = engine.information(0.0, b)
        info_below = engine.information(-1.0, b)
        info_above = engine.information(1.0, b)
        assert info_at_b > info_below
        assert info_at_b > info_above

    def test_information_positive(self, engine):
        """信息量应该始终为正"""
        for theta in [-3, -2, -1, 0, 1, 2, 3]:
            for b in [-3, -2, -1, 0, 1, 2, 3]:
                info = engine.information(theta, b)
                assert info > 0


class TestIRTEstimateAbility:
    """测试能力估计"""

    def test_empty_responses(self, engine):
        """无作答记录时返回先验估计"""
        theta, se = engine.estimate_ability([], 0.0)
        assert theta == 0.0
        assert se == 1.0

    def test_all_correct(self, engine):
        """全部答对应该提高能力估计"""
        # 简单题目全部答对
        responses = [(0.0, True), (0.0, True), (0.0, True)]
        theta, se = engine.estimate_ability(responses, 0.0)
        assert theta > 0.0

    def test_all_wrong(self, engine):
        """全部答错应该降低能力估计"""
        # 简单题目全部答错
        responses = [(0.0, False), (0.0, False), (0.0, False)]
        theta, se = engine.estimate_ability(responses, 0.0)
        assert theta < 0.0

    def test_mixed_responses(self, engine):
        """混合正误的作答应该给出合理的能力估计"""
        responses = [
            (0.0, True),   # 简单题答对
            (1.0, False),  # 难题答错
            (0.0, True),   # 简单题答对
        ]
        theta, se = engine.estimate_ability(responses, 0.0)
        # 能力应该在 0 附近
        assert -1.0 < theta < 1.0

    def test_difficult_items_correct(self, engine):
        """答对难题应该大幅提高能力估计"""
        responses = [(2.0, True), (2.0, True), (2.0, True)]
        theta, se = engine.estimate_ability(responses, 0.0)
        assert theta > 1.0

    def test_standard_error_decreases(self, engine):
        """更多作答应该减小标准误"""
        responses_1 = [(0.0, True)]
        responses_3 = [(0.0, True), (0.0, True), (0.0, True)]

        _, se_1 = engine.estimate_ability(responses_1, 0.0)
        _, se_3 = engine.estimate_ability(responses_3, 0.0)

        assert se_3 < se_1


class TestIRTSelectNextItem:
    """测试题目选择"""

    def test_select_from_available(self, engine):
        """应该从可用题目中选择"""
        items = [
            {"id": 1, "difficulty_b": -1.0},
            {"id": 2, "difficulty_b": 0.0},
            {"id": 3, "difficulty_b": 1.0},
        ]
        item_id = engine.select_next_item(0.0, items)
        assert item_id in [1, 2, 3]

    def test_select_matching_difficulty(self, engine):
        """应该选择难度匹配能力的题目"""
        items = [
            {"id": 1, "difficulty_b": -2.0},
            {"id": 2, "difficulty_b": 0.0},
            {"id": 3, "difficulty_b": 2.0},
        ]
        # 能力为 0 时，应该选择难度为 0 的题目
        item_id = engine.select_next_item(0.0, items)
        assert item_id == 2

    def test_select_for_high_ability(self, engine):
        """高能力者应该选择更难的题目"""
        items = [
            {"id": 1, "difficulty_b": -1.0},
            {"id": 2, "difficulty_b": 0.0},
            {"id": 3, "difficulty_b": 1.0},
        ]
        item_id = engine.select_next_item(2.0, items)
        assert item_id == 3

    def test_select_for_low_ability(self, engine):
        """低能力者应该选择更简单的题目"""
        items = [
            {"id": 1, "difficulty_b": -1.0},
            {"id": 2, "difficulty_b": 0.0},
            {"id": 3, "difficulty_b": 1.0},
        ]
        item_id = engine.select_next_item(-2.0, items)
        assert item_id == 1

    def test_empty_items(self, engine):
        """无可用题目时返回 None"""
        item_id = engine.select_next_item(0.0, [])
        assert item_id is None


class TestIRTDecideNextAction:
    """测试升降级决策"""

    def test_continue_when_few_responses(self, engine):
        """作答次数不足时继续当前级别"""
        result = engine.decide_next_action([1.0, 0.8])
        assert result.action == "continue"

    def test_upgrade_on_high_accuracy(self, engine):
        """连续高正确率应该升级"""
        result = engine.decide_next_action([0.9, 0.85, 0.9])
        assert result.action == "upgrade"

    def test_downgrade_on_low_accuracy(self, engine):
        """连续低正确率应该降级"""
        result = engine.decide_next_action([0.5, 0.4, 0.3])
        assert result.action == "downgrade"

    def test_continue_on_medium_accuracy(self, engine):
        """中等正确率应该继续"""
        result = engine.decide_next_action([0.7, 0.75, 0.7])
        assert result.action == "continue"

    def test_upgrade_threshold(self, engine):
        """测试升级阈值边界"""
        # 刚好达到阈值
        result = engine.decide_next_action([0.8, 0.8, 0.8])
        assert result.action == "upgrade"

    def test_downgrade_threshold(self, engine):
        """测试降级阈值边界"""
        # 刚好低于阈值
        result = engine.decide_next_action([0.59, 0.59, 0.59])
        assert result.action == "downgrade"

    def test_mixed_recent_accuracies(self, engine):
        """只看最近 N 次作答"""
        # 前面表现差，后面表现好
        accuracies = [0.3, 0.4, 0.5, 0.9, 0.85, 0.9]
        result = engine.decide_next_action(accuracies)
        assert result.action == "upgrade"

    def test_result_is_irtestimate(self, engine):
        """返回值应该是 IRTEstimate 类型"""
        result = engine.decide_next_action([0.8, 0.9, 0.85])
        assert isinstance(result, IRTEstimate)
        assert hasattr(result, 'theta')
        assert hasattr(result, 'se')
        assert hasattr(result, 'action')


class TestIRTIntegration:
    """集成测试：模拟完整训练流程"""

    def test_full_training_session(self, engine):
        """模拟完整的训练会话"""
        # 初始能力
        theta = 0.0
        responses = []

        # 模拟 10 次作答
        items = [
            {"id": i, "difficulty_b": i * 0.5 - 2.5}
            for i in range(10)
        ]

        correct_count = 0
        for _ in range(10):
            # 选择题目
            item_id = engine.select_next_item(theta, items)
            item = next(i for i in items if i["id"] == item_id)

            # 模拟作答（能力越高，答对概率越大）
            prob = engine.probability(theta, item["difficulty_b"])
            is_correct = prob > 0.5  # 简化：概率 > 0.5 则答对
            if is_correct:
                correct_count += 1

            # 记录作答
            responses.append((item["difficulty_b"], is_correct))

            # 更新能力估计
            theta, se = engine.estimate_ability(responses, theta)

        # 验证能力估计在合理范围内
        assert -3.0 < theta < 3.0
        assert se > 0

        # 验证升降级决策
        recent = [1.0 if r[1] else 0.0 for r in responses[-3:]]
        decision = engine.decide_next_action(recent)
        assert decision.action in ["upgrade", "downgrade", "continue"]

    def test_adaptive_difficulty(self, engine):
        """测试自适应难度调整"""
        # 模拟高能力用户
        theta = 2.0
        items = [
            {"id": i, "difficulty_b": i * 0.5 - 2.5}
            for i in range(10)
        ]

        # 高能力用户应该选择更难的题目
        selected_items = []
        for _ in range(5):
            item_id = engine.select_next_item(theta, items)
            item = next(i for i in items if i["id"] == item_id)
            selected_items.append(item)

        # 验证选择的题目难度逐渐增加
        difficulties = [item["difficulty_b"] for item in selected_items]
        # 高能力者应该倾向于选择较难的题目
        assert all(d > 0 for d in difficulties)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
