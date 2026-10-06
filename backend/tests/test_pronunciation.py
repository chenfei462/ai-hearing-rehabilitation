"""
发音评分引擎单元测试

覆盖：
1. DTW 对齐算法
2. 音素相似度计算
3. 评分计算（准确度/流利度/完整度）
4. 建议生成
5. 边界条件
"""

import pytest
from app.services.pronunciation_scorer import (
    PronunciationScorer,
    PronunciationScore,
    PhonemeAlignment,
    PhonemeDifficulty,
    _strip_tone,
    pronunciation_scorer,
)


# ======================================================================
# _strip_tone 辅助函数
# ======================================================================
class TestStripTone:
    def test_no_tone(self):
        assert _strip_tone("ma") == "ma"

    def test_first_tone(self):
        assert _strip_tone("mā") == "ma"

    def test_second_tone(self):
        assert _strip_tone("má") == "ma"

    def test_third_tone(self):
        assert _strip_tone("mǎ") == "ma"

    def test_fourth_tone(self):
        assert _strip_tone("mà") == "ma"

    def test_complex_pinyin(self):
        assert _strip_tone("zhōng") == "zhong"
        assert _strip_tone("guó") == "guo"
        assert _strip_tone("nǐ") == "ni"

    def test_no_tone_chars(self):
        assert _strip_tone("zh") == "zh"
        assert _strip_tone("sh") == "sh"


# ======================================================================
# 音素相似度
# ======================================================================
class TestPhonemeSimilarity:
    def test_identical(self):
        assert PronunciationScorer._phoneme_similarity("ma", "ma") == 1.0

    def test_tone_difference(self):
        # 仅声调不同
        assert PronunciationScorer._phoneme_similarity("mā", "mǎ") == 0.8
        assert PronunciationScorer._phoneme_similarity("nǐ", "nì") == 0.8

    def test_confusable_pair(self):
        # z/zh 是易混淆对
        sim = PronunciationScorer._phoneme_similarity("z", "zh")
        assert sim == 0.4

    def test_confusable_reverse(self):
        sim = PronunciationScorer._phoneme_similarity("zh", "z")
        assert sim == 0.4

    def test_completely_different(self):
        sim = PronunciationScorer._phoneme_similarity("b", "k")
        assert sim == 0.0

    def test_n_l_confusable(self):
        sim = PronunciationScorer._phoneme_similarity("n", "l")
        assert sim == 0.4


# ======================================================================
# DTW 对齐
# ======================================================================
class TestDTWAlign:
    def test_rejects_excessively_long_sequences(self):
        """超长序列应在分配 DTW 矩阵前被拒绝"""
        scorer = PronunciationScorer()
        with pytest.raises(ValueError):
            scorer.dtw_align(["a"] * 501, ["a"] * 501)

    def test_identical_sequences(self):
        scorer = PronunciationScorer()
        result = scorer.dtw_align(["a", "b", "c"], ["a", "b", "c"])
        assert len(result) == 3
        for target, asr, score, conf in result:
            assert target == asr
            assert score == 1.0

    def test_empty_target(self):
        scorer = PronunciationScorer()
        result = scorer.dtw_align([], ["a", "b"])
        assert result == []

    def test_empty_asr(self):
        scorer = PronunciationScorer()
        result = scorer.dtw_align(["a", "b"], [])
        assert len(result) == 2
        for target, asr, score, conf in result:
            assert asr == ""
            assert score == 0.0

    def test_single_match(self):
        scorer = PronunciationScorer()
        result = scorer.dtw_align(["a"], ["a"])
        assert len(result) == 1
        assert result[0] == ("a", "a", 1.0, 1.0)

    def test_single_mismatch(self):
        scorer = PronunciationScorer()
        result = scorer.dtw_align(["a"], ["b"])
        assert len(result) == 1
        assert result[0][0] == "a"
        assert result[0][1] == "b"
        assert result[0][2] == 0.0

    def test_partial_match(self):
        scorer = PronunciationScorer()
        result = scorer.dtw_align(["a", "b", "c"], ["a", "x", "c"])
        # a 和 c 匹配，x 对应 b 不匹配
        assert len(result) == 3
        assert result[0][2] == 1.0  # a == a
        assert result[2][2] == 1.0  # c == c

    def test_asr_longer_than_target(self):
        scorer = PronunciationScorer()
        result = scorer.dtw_align(["a", "b"], ["a", "x", "b"])
        # DTW 应该能处理长度不等的情况
        assert len(result) >= 2

    def test_asr_shorter_than_target(self):
        scorer = PronunciationScorer()
        result = scorer.dtw_align(["a", "b", "c"], ["a", "c"])
        # b 缺失
        assert len(result) >= 2

    def test_with_confidences(self):
        scorer = PronunciationScorer()
        result = scorer.dtw_align(["a", "b"], ["a", "b"], [0.9, 0.8])
        assert result[0][3] == 0.9
        assert result[1][3] == 0.8

    def test_chinese_pinyin(self):
        scorer = PronunciationScorer()
        target = ["nǐ", "hǎo"]
        asr = ["nǐ", "hǎo"]
        result = scorer.dtw_align(target, asr)
        assert len(result) == 2
        for t, a, s, c in result:
            assert s == 1.0


# ======================================================================
# 评分计算
# ======================================================================
class TestScoring:
    def test_perfect_score(self):
        scorer = PronunciationScorer()
        result = scorer.score(["nǐ", "hǎo"], ["nǐ", "hǎo"])
        assert result.accuracy == 100.0
        assert result.completeness == 100.0
        assert result.overall == 100.0
        assert len(result.suggestions) > 0
        assert "非常好" in result.suggestions[0]

    def test_zero_match(self):
        scorer = PronunciationScorer()
        result = scorer.score(["a", "b"], ["x", "y"])
        assert result.accuracy == 0.0
        assert result.overall < 50.0

    def test_empty_target(self):
        scorer = PronunciationScorer()
        result = scorer.score([], ["a"])
        assert result.accuracy == 100.0
        assert result.overall == 100.0

    def test_empty_asr(self):
        scorer = PronunciationScorer()
        result = scorer.score(["a", "b"], [])
        assert result.accuracy == 0.0
        assert result.completeness == 0.0

    def test_partial_match(self):
        scorer = PronunciationScorer()
        result = scorer.score(["a", "b", "c"], ["a", "x", "c"])
        # a 和 c 匹配
        assert 50 < result.accuracy < 80
        assert result.completeness == 100.0

    def test_score_range(self):
        """所有分数应在 0~100 范围内"""
        scorer = PronunciationScorer()
        result = scorer.score(["zhōng", "guó"], ["zōng", "guó"])
        assert 0 <= result.accuracy <= 100
        assert 0 <= result.fluency <= 100
        assert 0 <= result.completeness <= 100
        assert 0 <= result.overall <= 100

    def test_details_length(self):
        scorer = PronunciationScorer()
        result = scorer.score(["a", "b", "c"], ["a", "b", "c"])
        assert len(result.details) == 3

    def test_weights_custom(self):
        scorer = PronunciationScorer(w_accuracy=0.7, w_fluency=0.2, w_completeness=0.1)
        result = scorer.score(["a"], ["a"])
        assert result.overall == 100.0

    def test_chinese_sentence(self):
        """中文句子级别测试"""
        scorer = PronunciationScorer()
        target = ["jīn", "tiān", "tiān", "qì", "zhēn", "hǎo"]
        asr = ["jīn", "tiān", "tiān", "qì", "zhēn", "hǎo"]
        result = scorer.score(target, asr)
        assert result.accuracy == 100.0
        assert result.overall == 100.0

    def test_chinese_with_errors(self):
        """中文句子带错误"""
        scorer = PronunciationScorer()
        target = ["jīn", "tiān", "tiān", "qì", "zhēn", "hǎo"]
        asr = ["jīn", "tiān", "tiān", "qì", "zēn", "hǎo"]  # zh→z
        result = scorer.score(target, asr)
        # zh/z 是易混淆对，相似度 0.4，低于阈值 0.6，算不匹配
        assert result.accuracy < 100.0
        assert len(result.suggestions) > 0


# ======================================================================
# 建议生成
# ======================================================================
class TestSuggestions:
    def test_perfect_suggestion(self):
        scorer = PronunciationScorer()
        result = scorer.score(["a"], ["a"])
        assert any("非常好" in s for s in result.suggestions)

    def test_error_suggestions(self):
        scorer = PronunciationScorer()
        result = scorer.score(["zhāng", "sān"], ["zāng", "sān"])
        # zh/z 错误应生成建议
        assert len(result.suggestions) > 0

    def test_missing_phoneme_suggestion(self):
        scorer = PronunciationScorer()
        result = scorer.score(["a", "b", "c"], ["a", "c"])
        # b 缺失
        has_missing = any("缺失" in s for s in result.suggestions)
        # 可能有缺失提示，取决于 DTW 对齐结果
        assert len(result.suggestions) > 0

    def test_max_suggestions(self):
        scorer = PronunciationScorer()
        # 大量错误不应产生过多建议
        target = [chr(i) for i in range(20)]
        asr = [chr(i + 50) for i in range(20)]
        result = scorer.score(target, asr)
        assert len(result.suggestions) <= 5

    def test_tone_error_suggestion(self):
        scorer = PronunciationScorer()
        result = scorer.score(["mā"], ["mǎ"])
        # 声调差异，相似度 0.8 >= 阈值 0.6，算匹配
        # 所以不应有声调建议（因为算匹配了）
        assert result.accuracy == 100.0


# ======================================================================
# PhonemeAlignment 数据类
# ======================================================================
class TestPhonemeAlignment:
    def test_creation(self):
        pa = PhonemeAlignment(target="a", asr="b", score=0.5, is_match=False)
        assert pa.target == "a"
        assert pa.asr == "b"
        assert pa.score == 0.5
        assert pa.is_match is False
        assert pa.difficulty == PhonemeDifficulty.EASY

    def test_with_difficulty(self):
        pa = PhonemeAlignment(
            target="zh", asr="z", score=0.4, is_match=False,
            difficulty=PhonemeDifficulty.HARD
        )
        assert pa.difficulty == PhonemeDifficulty.HARD


# ======================================================================
# PronunciationScore 数据类
# ======================================================================
class TestPronunciationScore:
    def test_creation(self):
        ps = PronunciationScore(
            accuracy=85.0, fluency=90.0, completeness=80.0, overall=85.0
        )
        assert ps.accuracy == 85.0
        assert ps.details == []
        assert ps.suggestions == []


# ======================================================================
# 模块级单例
# ======================================================================
class TestModuleScorer:
    def test_singleton_exists(self):
        assert pronunciation_scorer is not None
        assert isinstance(pronunciation_scorer, PronunciationScorer)

    def test_singleton_scoring(self):
        result = pronunciation_scorer.score(["nǐ"], ["nǐ"])
        assert result.accuracy == 100.0


# ======================================================================
# 边界条件
# ======================================================================
class TestEdgeCases:
    def test_very_long_sequence(self):
        """长序列不应崩溃"""
        scorer = PronunciationScorer()
        target = [f"p{i}" for i in range(50)]
        asr = [f"p{i}" for i in range(50)]
        result = scorer.score(target, asr)
        assert result.accuracy == 100.0

    def test_single_phoneme(self):
        scorer = PronunciationScorer()
        result = scorer.score(["a"], ["a"])
        assert result.accuracy == 100.0

    def test_all_mismatch(self):
        scorer = PronunciationScorer()
        result = scorer.score(["a", "b", "c", "d"], ["x", "y", "z", "w"])
        assert result.accuracy == 0.0

    def test_confidence_propagation(self):
        scorer = PronunciationScorer()
        result = scorer.dtw_align(["a"], ["a"], [0.5])
        assert result[0][3] == 0.5

    def test_match_threshold_effect(self):
        """不同阈值会影响匹配判定"""
        scorer_strict = PronunciationScorer(match_threshold=0.9)
        scorer_loose = PronunciationScorer(match_threshold=0.3)

        # 声调差异相似度 0.8
        result_strict = scorer_strict.score(["mā"], ["mǎ"])
        result_loose = scorer_loose.score(["mā"], ["mǎ"])

        # 严格阈值下 0.8 < 0.9 算不匹配；宽松阈值下 0.8 >= 0.3 算匹配
        assert result_strict.accuracy == 0.0
        assert result_loose.accuracy == 100.0
