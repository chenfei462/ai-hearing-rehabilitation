"""
贝叶斯知识追踪（BKT）自适应引擎单元测试

测试覆盖：
- BKT算法初始化
- 掌握概率更新
- 难度推荐算法
- 置信度计算
"""
import pytest
import math
import random
from app.ai.adaptive_engine import AdaptiveEngine, BKTParameters, KnowledgeState


@pytest.fixture
def engine():
    """创建自适应引擎实例"""
    return AdaptiveEngine()


@pytest.fixture
def default_params():
    """默认BKT参数"""
    return BKTParameters()


class TestBKTParameters:
    """测试BKT参数初始化"""

    def test_default_parameters(self):
        """测试默认参数值"""
        params = BKTParameters()
        assert params.p_init == 0.3
        assert params.p_learn == 0.1
        assert params.p_guess == 0.2
        assert params.p_slip == 0.1

    def test_custom_parameters(self):
        """测试自定义参数"""
        params = BKTParameters(
            p_init=0.5,
            p_learn=0.2,
            p_guess=0.25,
            p_slip=0.05
        )
        assert params.p_init == 0.5
        assert params.p_learn == 0.2
        assert params.p_guess == 0.25
        assert params.p_slip == 0.05

    def test_parameter_validation(self):
        """测试参数范围验证"""
        with pytest.raises(ValueError):
            BKTParameters(p_init=-0.1)
        with pytest.raises(ValueError):
            BKTParameters(p_learn=1.5)


class TestKnowledgeState:
    """测试知识状态模型"""

    def test_initial_state(self):
        """测试初始状态"""
        state = KnowledgeState()
        assert state.mastery == 0.0
        assert state.confidence == 0.0
        assert state.attempts == 0
        assert state.correct_count == 0

    def test_state_with_values(self):
        """测试带值的状态"""
        state = KnowledgeState(
            mastery=0.7,
            confidence=0.8,
            attempts=10,
            correct_count=7
        )
        assert state.mastery == 0.7
        assert state.confidence == 0.8
        assert state.attempts == 10
        assert state.correct_count == 7

    def test_accuracy_calculation(self):
        """测试正确率计算"""
        state = KnowledgeState(attempts=10, correct_count=7)
        assert state.accuracy == 0.7

    def test_accuracy_no_attempts(self):
        """测试无尝试时的正确率"""
        state = KnowledgeState(attempts=0, correct_count=0)
        assert state.accuracy == 0.0


class TestBKTUpdate:
    """测试BKT概率更新"""

    def test_initial_mastery(self, engine):
        """测试初始掌握概率设置"""
        state = engine.initialize_knowledge()
        assert 0.0 <= state.mastery <= 1.0
        assert state.mastery == engine.params.p_init

    def test_update_correct_answer(self, engine):
        """测试答对后的概率更新"""
        state = KnowledgeState(mastery=0.5)
        updated = engine.update_mastery(state, is_correct=True)
        assert updated.mastery > 0.5

    def test_update_wrong_answer(self, engine):
        """测试答错后的概率更新"""
        state = KnowledgeState(mastery=0.5)
        updated = engine.update_mastery(state, is_correct=False)
        assert updated.mastery < 0.5

    def test_update_attempts_increment(self, engine):
        """测试尝试次数增加"""
        state = KnowledgeState(attempts=5)
        updated = engine.update_mastery(state, is_correct=True)
        assert updated.attempts == 6

    def test_update_correct_count(self, engine):
        """测试正确次数增加"""
        state = KnowledgeState(correct_count=3)
        updated = engine.update_mastery(state, is_correct=True)
        assert updated.correct_count == 4

    def test_mastery_bounds(self, engine):
        """测试掌握概率边界"""
        state = KnowledgeState(mastery=0.99)
        updated = engine.update_mastery(state, is_correct=True)
        assert updated.mastery <= 1.0

        state = KnowledgeState(mastery=0.01)
        updated = engine.update_mastery(state, is_correct=False)
        assert updated.mastery >= 0.0

    def test_multiple_updates(self, engine):
        """测试多次更新的收敛性"""
        state = engine.initialize_knowledge()
        for _ in range(10):
            state = engine.update_mastery(state, is_correct=True)
        assert state.mastery > 0.8
        assert state.attempts == 10
        assert state.correct_count == 10

    def test_mixed_updates(self, engine):
        """测试混合正误的更新"""
        state = engine.initialize_knowledge()
        for i in range(10):
            state = engine.update_mastery(state, is_correct=(i % 2 == 0))
        assert state.correct_count == 5
        assert state.attempts == 10


class TestConfidenceCalculation:
    """测试置信度计算"""

    def test_initial_confidence(self, engine):
        """测试初始置信度"""
        state = engine.initialize_knowledge()
        assert state.confidence == 0.0

    def test_confidence_increases_with_attempts(self, engine):
        """测试置信度随尝试次数增加"""
        state = engine.initialize_knowledge()
        confidences = []
        for _ in range(10):
            state = engine.update_mastery(state, is_correct=True)
            confidences.append(state.confidence)
        for i in range(1, len(confidences)):
            assert confidences[i] >= confidences[i-1]

    def test_confidence_bounds(self, engine):
        """测试置信度边界"""
        state = engine.initialize_knowledge()
        for _ in range(100):
            state = engine.update_mastery(state, is_correct=True)
        assert 0.0 <= state.confidence <= 1.0

    def test_confidence_formula(self, engine):
        """测试置信度计算公式"""
        state = KnowledgeState(attempts=10)
        confidence = engine.calculate_confidence(state)
        assert 0.0 <= confidence <= 1.0


class TestDifficultyRecommendation:
    """测试难度推荐算法"""

    def test_recommend_for_beginner(self, engine):
        """测试初学者的难度推荐"""
        state = KnowledgeState(mastery=0.3, confidence=0.5)
        difficulty = engine.recommend_difficulty(state)
        assert difficulty <= 0.5

    def test_recommend_for_expert(self, engine):
        """测试专家的难度推荐"""
        state = KnowledgeState(mastery=0.9, confidence=0.9)
        difficulty = engine.recommend_difficulty(state)
        assert difficulty >= 0.5

    def test_recommend_for_low_confidence(self, engine):
        """测试低置信度时的推荐"""
        state = KnowledgeState(mastery=0.7, confidence=0.3)
        difficulty = engine.recommend_difficulty(state)
        assert 0.3 <= difficulty <= 0.7

    def test_recommend_difficulty_bounds(self, engine):
        """测试推荐难度边界"""
        state = KnowledgeState(mastery=0.0, confidence=1.0)
        difficulty = engine.recommend_difficulty(state)
        assert 0.0 <= difficulty <= 1.0

        state = KnowledgeState(mastery=1.0, confidence=1.0)
        difficulty = engine.recommend_difficulty(state)
        assert 0.0 <= difficulty <= 1.0

    def test_recommend_adapts_to_performance(self, engine):
        """测试推荐随表现适应"""
        state = engine.initialize_knowledge()
        difficulties = []
        for _ in range(10):
            state = engine.update_mastery(state, is_correct=True)
            difficulty = engine.recommend_difficulty(state)
            difficulties.append(difficulty)
        for i in range(1, len(difficulties)):
            assert difficulties[i] >= difficulties[i-1]


class TestAdaptiveEngineIntegration:
    """集成测试：完整自适应流程"""

    def test_full_adaptive_session(self, engine):
        """测试完整的自适应训练会话"""
        state = engine.initialize_knowledge()
        total_reward = 0

        for _ in range(20):
            difficulty = engine.recommend_difficulty(state)
            is_correct = engine.simulate_response(state, difficulty)
            state = engine.update_mastery(state, is_correct)
            reward = engine.calculate_reward(difficulty, is_correct)
            total_reward += reward

        assert state.attempts == 20
        assert 0.0 <= state.mastery <= 1.0
        assert 0.0 <= state.confidence <= 1.0
        assert total_reward > 0

    def test_learning_curve(self, engine):
        """测试学习曲线"""
        state = engine.initialize_knowledge()
        mastery_history = [state.mastery]

        for i in range(50):
            is_correct = engine.simulate_response(state, 0.5)
            state = engine.update_mastery(state, is_correct)
            mastery_history.append(state.mastery)

        n = len(mastery_history)
        x_mean = (n - 1) / 2
        y_mean = sum(mastery_history) / n

        numerator = sum((i - x_mean) * (y - y_mean) for i, y in enumerate(mastery_history))
        denominator = sum((i - x_mean) ** 2 for i in range(n))

        if denominator != 0:
            slope = numerator / denominator
            assert slope > 0

    def test_difficulty_calibration(self, engine, monkeypatch):
        """测试难度校准"""
        state = KnowledgeState(mastery=0.9, confidence=0.9)
        difficulty = engine.recommend_difficulty(state)
        seeded_random = random.Random(1)
        monkeypatch.setattr(
            "app.ai.adaptive_engine.random.random",
            seeded_random.random,
        )

        correct_count = sum(
            engine.simulate_response(state, difficulty)
            for _ in range(100)
        )

        assert 0.5 < correct_count / 100 < 1.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
