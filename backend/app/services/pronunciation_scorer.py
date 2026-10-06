"""
发音评分引擎 — DTW 音素对齐 + 准确度/流利度/完整度

设计要点：
1. DTW 对齐：将 ASR 输出的音素序列与标准音素序列做动态时间规整
2. 准确度（accuracy）：匹配音素占标准音素的比例
3. 流利度（fluency）：基于对齐路径的连续性和间隔均匀度
4. 完整度（completeness）：ASR 识别出的音素占标准音素的比例
5. 综合分（overall）：加权汇总
6. 发音建议：针对不匹配音素生成具体纠正建议
"""

import numpy as np
from typing import List, Tuple, Optional
from dataclasses import dataclass, field
from enum import Enum


class PhonemeDifficulty(str, Enum):
    """音素难度分类"""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


# 常见中文易混淆音素对（用于生成更精准的建议）
CONFUSABLE_PAIRS = {
    "z": ["zh", "j"],
    "c": ["ch", "q"],
    "s": ["sh", "x"],
    "zh": ["z", "j"],
    "ch": ["c", "q"],
    "sh": ["s", "x"],
    "n": ["l", "ng"],
    "l": ["n"],
    "r": ["l", "y"],
    "f": ["h"],
    "h": ["f"],
    "ang": ["an", "eng"],
    "eng": ["en", "ang"],
    "an": ["ang", "en"],
    "en": ["eng", "an"],
    "ing": ["in", "iong"],
    "in": ["ing"],
}

# 音素难度等级
PHONEME_DIFFICULTY = {
    "zh": PhonemeDifficulty.HARD,
    "ch": PhonemeDifficulty.HARD,
    "sh": PhonemeDifficulty.HARD,
    "r": PhonemeDifficulty.HARD,
    "z": PhonemeDifficulty.MEDIUM,
    "c": PhonemeDifficulty.MEDIUM,
    "s": PhonemeDifficulty.MEDIUM,
    "n": PhonemeDifficulty.MEDIUM,
    "l": PhonemeDifficulty.MEDIUM,
    "ang": PhonemeDifficulty.HARD,
    "eng": PhonemeDifficulty.MEDIUM,
    "ing": PhonemeDifficulty.MEDIUM,
}


@dataclass
class PhonemeAlignment:
    """单个音素对齐结果"""
    target: str
    asr: str
    score: float  # 0.0 ~ 1.0
    is_match: bool
    confidence: float = 1.0  # ASR 置信度
    difficulty: PhonemeDifficulty = PhonemeDifficulty.EASY
    suggestion: Optional[str] = None


@dataclass
class PronunciationScore:
    """发音评分结果"""
    accuracy: float       # 准确度 (0~100)
    fluency: float        # 流利度 (0~100)
    completeness: float   # 完整度 (0~100)
    overall: float        # 综合分 (0~100)
    details: List[PhonemeAlignment] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)


class PronunciationScorer:
    """DTW 音素对齐发音评分引擎"""

    MAX_SEQUENCE_LENGTH = 500

    def __init__(
        self,
        match_threshold: float = 0.6,
        # 评分权重
        w_accuracy: float = 0.5,
        w_fluency: float = 0.3,
        w_completeness: float = 0.2,
    ):
        self.match_threshold = match_threshold
        self.w_accuracy = w_accuracy
        self.w_fluency = w_fluency
        self.w_completeness = w_completeness

    # ------------------------------------------------------------------
    # 核心：DTW 对齐
    # ------------------------------------------------------------------
    def dtw_align(
        self,
        target: List[str],
        asr: List[str],
        asr_confidences: Optional[List[float]] = None,
    ) -> List[Tuple[str, str, float, float]]:
        """
        DTW 对齐算法

        返回：[(target_phoneme, asr_phoneme, similarity_score, confidence), ...]
        """
        n, m = len(target), len(asr)
        if max(n, m) > self.MAX_SEQUENCE_LENGTH:
            raise ValueError(
                f"phoneme sequences must not exceed {self.MAX_SEQUENCE_LENGTH} items"
            )
        if n == 0:
            return []
        if m == 0:
            return [(t, "", 0.0, 0.0) for t in target]

        # 默认置信度
        if asr_confidences is None:
            asr_confidences = [1.0] * m

        # 初始化代价矩阵
        cost = np.full((n + 1, m + 1), np.inf)
        cost[0, 0] = 0

        for i in range(1, n + 1):
            for j in range(1, m + 1):
                sim = self._phoneme_similarity(target[i - 1], asr[j - 1])
                # 代价 = 1 - 相似度（越相似代价越低）
                d = 1.0 - sim
                cost[i, j] = d + min(
                    cost[i - 1, j],      # 插入（跳过目标）
                    cost[i, j - 1],      # 删除（跳过ASR）
                    cost[i - 1, j - 1],  # 匹配
                )

        # 回溯对齐路径
        alignment: List[Tuple[str, str, float, float]] = []
        i, j = n, m
        path = []
        while i > 0 or j > 0:
            path.append((i, j))
            if i == 0:
                j -= 1
            elif j == 0:
                i -= 1
            else:
                diag = cost[i - 1, j - 1]
                up = cost[i - 1, j]
                left = cost[i, j - 1]
                if diag <= up and diag <= left:
                    i, j = i - 1, j - 1
                elif up < left:
                    i -= 1
                else:
                    j -= 1

        path.reverse()

        for i, j in path:
            if i > 0 and j > 0:
                sim = self._phoneme_similarity(target[i - 1], asr[j - 1])
                conf = asr_confidences[j - 1] if j - 1 < len(asr_confidences) else 1.0
                alignment.append((target[i - 1], asr[j - 1], sim, conf))
            elif i > 0:
                alignment.append((target[i - 1], "", 0.0, 0.0))
            # j > 0 的情况（ASR 多出的音素）不计入对齐结果

        return alignment

    # ------------------------------------------------------------------
    # 音素相似度
    # ------------------------------------------------------------------
    @staticmethod
    def _phoneme_similarity(a: str, b: str) -> float:
        """
        计算两个音素的相似度 (0~1)

        - 完全相同 → 1.0
        - 易混淆对 → 0.4
        - 声调差异（拼音去掉声调后相同）→ 0.8
        - 完全不同 → 0.0
        """
        if a == b:
            return 1.0

        # 去声调比较（中文拼音 1-4 声 + 轻声）
        stripped_a = _strip_tone(a)
        stripped_b = _strip_tone(b)
        if stripped_a == stripped_b:
            return 0.8  # 仅声调差异

        # 易混淆音素对
        confusable = CONFUSABLE_PAIRS.get(stripped_a, [])
        if stripped_b in confusable:
            return 0.4

        confusable = CONFUSABLE_PAIRS.get(stripped_b, [])
        if stripped_a in confusable:
            return 0.4

        return 0.0

    # ------------------------------------------------------------------
    # 主评分函数
    # ------------------------------------------------------------------
    def score(
        self,
        target_phonemes: List[str],
        asr_phonemes: List[str],
        asr_confidences: Optional[List[float]] = None,
    ) -> PronunciationScore:
        """计算发音评分"""
        if not target_phonemes:
            return PronunciationScore(100.0, 100.0, 100.0, 100.0, [], [])

        # DTW 对齐
        alignment = self.dtw_align(target_phonemes, asr_phonemes, asr_confidences)

        # 构建详情列表
        details: List[PhonemeAlignment] = []
        for target_p, asr_p, sim, conf in alignment:
            is_match = sim >= self.match_threshold
            diff = PHONEME_DIFFICULTY.get(_strip_tone(target_p), PhonemeDifficulty.EASY)
            suggestion = None
            if not is_match:
                suggestion = self._generate_single_suggestion(target_p, asr_p)

            details.append(PhonemeAlignment(
                target=target_p,
                asr=asr_p,
                score=sim,
                is_match=is_match,
                confidence=conf,
                difficulty=diff,
                suggestion=suggestion,
            ))

        # ---- 计算各项分数 (0~100) ----

        # 准确度：匹配音素 / 标准音素
        match_count = sum(1 for d in details if d.is_match)
        accuracy = (match_count / len(target_phonemes)) * 100

        # 完整度：ASR 识别出的有效音素 / 标准音素数
        asr_effective = min(len(asr_phonemes), len(target_phonemes))
        completeness = (asr_effective / len(target_phonemes)) * 100
        completeness = min(completeness, 100.0)

        # 流利度：基于对齐路径连续性 + 音素间隔均匀度
        fluency = self._compute_fluency(details, target_phonemes, asr_phonemes)

        # 综合分
        overall = (
            accuracy * self.w_accuracy
            + fluency * self.w_fluency
            + completeness * self.w_completeness
        )

        # 生成建议
        suggestions = self._generate_suggestions(details, accuracy)

        return PronunciationScore(
            accuracy=round(accuracy, 1),
            fluency=round(fluency, 1),
            completeness=round(completeness, 1),
            overall=round(overall, 1),
            details=details,
            suggestions=suggestions,
        )

    # ------------------------------------------------------------------
    # 流利度计算
    # ------------------------------------------------------------------
    @staticmethod
    def _compute_fluency(
        details: List[PhonemeAlignment],
        target_phonemes: List[str],
        asr_phonemes: List[str],
    ) -> float:
        """
        流利度评分 (0~100)

        考虑因素：
        1. 连续匹配的音素越多，流利度越高
        2. ASR 音素数量与目标越接近，流利度越高
        3. 缺失/多余音素会降低流利度
        """
        if not details:
            return 0.0

        # 1. 连续匹配比例
        max_streak = 0
        current_streak = 0
        for d in details:
            if d.is_match:
                current_streak += 1
                max_streak = max(max_streak, current_streak)
            else:
                current_streak = 0
        streak_score = (max_streak / len(target_phonemes)) * 100 if target_phonemes else 0

        # 2. 长度匹配度
        len_ratio = min(len(asr_phonemes) / max(len(target_phonemes), 1), 1.0)
        length_score = len_ratio * 100

        # 3. 整体匹配率
        match_rate = sum(1 for d in details if d.is_match) / max(len(details), 1)
        match_score = match_rate * 100

        # 加权汇总
        fluency = streak_score * 0.3 + length_score * 0.3 + match_score * 0.4
        return min(fluency, 100.0)

    # ------------------------------------------------------------------
    # 建议生成
    # ------------------------------------------------------------------
    def _generate_suggestions(self, details: List[PhonemeAlignment], accuracy: float) -> List[str]:
        """生成整体发音建议"""
        suggestions = []

        # 收集不匹配音素
        mismatched = [d for d in details if not d.is_match]
        hard_errors = [d for d in mismatched if d.difficulty == PhonemeDifficulty.HARD]
        medium_errors = [d for d in mismatched if d.difficulty == PhonemeDifficulty.MEDIUM]

        if not mismatched:
            suggestions.append("发音非常好！请继续保持。")
            return suggestions

        # 整体评价
        if accuracy >= 90:
            suggestions.append("发音整体很好，只有少量细节需要注意。")
        elif accuracy >= 70:
            suggestions.append("发音基本正确，以下几个音素需要重点练习。")
        elif accuracy >= 50:
            suggestions.append("发音有较多不准确之处，建议多听标准发音后反复练习。")
        else:
            suggestions.append("发音需要较大改善，建议先听标准发音，放慢速度逐音素练习。")

        # 针对困难音素的建议
        for d in hard_errors[:2]:
            s = d.suggestion or f"音素 '{d.target}' 发音不准确，您发成了 '{d.asr}'"
            suggestions.append(s)

        for d in medium_errors[:1]:
            s = d.suggestion or f"音素 '{d.target}' 发音不准确，您发成了 '{d.asr}'"
            suggestions.append(s)

        # 如果还有额外的不匹配，给一个总结
        if len(mismatched) > 3:
            remaining = len(mismatched) - 3
            suggestions.append(f"还有 {remaining} 个音素需要改善，请查看详细评分。")

        return suggestions[:5]  # 最多5条建议

    @staticmethod
    def _generate_single_suggestion(target: str, asr: str) -> str:
        """为单个不匹配音素生成建议"""
        stripped_target = _strip_tone(target)
        stripped_asr = _strip_tone(asr)

        if asr == "":
            return f"音素 '{target}' 缺失，请注意发完整。"

        if stripped_target == stripped_asr:
            return f"音素 '{target}' 声调不准确，您发成了 '{asr}'，请注意声调。"

        confusable = CONFUSABLE_PAIRS.get(stripped_target, [])
        if stripped_asr in confusable:
            return (
                f"音素 '{target}' 与 '{asr}' 容易混淆。"
                f"请注意 '{target}' 的发音位置和方法，建议对比练习。"
            )

        return f"音素 '{target}' 发音不准确，您发成了 '{asr}'，请模仿标准发音。"


# ------------------------------------------------------------------
# 辅助函数
# ------------------------------------------------------------------
_TONE_MARKS = "āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ"


def _strip_tone(phoneme: str) -> str:
    """去除拼音声调标记，返回基础字母"""
    tone_map = {
        "ā": "a", "á": "a", "ǎ": "a", "à": "a",
        "ē": "e", "é": "e", "ě": "e", "è": "e",
        "ī": "i", "í": "i", "ǐ": "i", "ì": "i",
        "ō": "o", "ó": "o", "ǒ": "o", "ò": "o",
        "ū": "u", "ú": "u", "ǔ": "u", "ù": "u",
        "ǖ": "v", "ǘ": "v", "ǚ": "v", "ǜ": "v",
    }
    result = []
    for ch in phoneme:
        result.append(tone_map.get(ch, ch))
    return "".join(result)


# 模块级单例
pronunciation_scorer = PronunciationScorer()
