"""
发音服务 — 任务管理、录音评分、历史记录

核心流程：
1. get_next_task → 从练习题库中抽取任务，返回文本 + 标准音素 + 示范音频
2. evaluate → ASR 音素识别 → DTW 评分 → 生成建议 → 持久化
3. get_history → 查询用户历史发音记录
4. get_stats → 聚合用户发音统计数据
"""

import time
from typing import Optional, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.models.pronunciation import PronunciationAttempt
from app.models.item_bank import ItemBank
from app.ai import asr_gateway, tts_gateway, AIServiceUnavailable, AIServiceTimeout
from app.services.pronunciation_scorer import pronunciation_scorer


# 发音练习难度映射（difficulty → ItemBank tags.pronunciation_difficulty）
DIFFICULTY_LEVELS = ["easy", "medium", "hard"]


class PronunciationService:
    """发音服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_next_task(self, user_id: int) -> dict:
        """
        获取下一个发音练习任务

        策略：
        1. 从 ItemBank 中按发音难度标签递进选取
        2. 根据用户历史表现调整难度
        """
        # 查询用户历史，确定推荐难度
        result = await self.db.execute(
            select(PronunciationAttempt)
            .where(PronunciationAttempt.user_id == user_id)
            .order_by(desc(PronunciationAttempt.id))
            .limit(5)
        )
        recent_attempts = result.scalars().all()

        # 根据最近成绩推荐难度
        if recent_attempts:
            avg_score = sum(a.overall for a in recent_attempts) / len(recent_attempts)
            if avg_score >= 85:
                target_difficulty = "hard"
            elif avg_score >= 65:
                target_difficulty = "medium"
            else:
                target_difficulty = "easy"
        else:
            target_difficulty = "easy"

        # 从 ItemBank 中选择匹配发音难度的任务
        result = await self.db.execute(
            select(ItemBank).where(
                ItemBank.is_active == True,
                ItemBank.tags["pronunciation_difficulty"].as_string() == target_difficulty,
            )
        )
        items = result.scalars().all()

        # 兜底：无匹配难度时，查询所有发音题
        if not items:
            result = await self.db.execute(
                select(ItemBank).where(
                    ItemBank.is_active == True,
                    ItemBank.tags["pronunciation_difficulty"].as_string() != None,
                )
            )
            items = result.scalars().all()

        if not items:
            return {"error": "暂无发音练习题目，请联系听力师添加"}

        tasks = [
            {
                "id": i.id,
                "text": i.text,
                "phonemes": i.tags.get("target_phonemes", []),
                "difficulty": i.tags.get("pronunciation_difficulty", "medium"),
            }
            for i in items
        ]

        # 简单轮转：根据用户已做任务数取模
        task_index = len(recent_attempts) % len(tasks)
        task = tasks[task_index]

        # 尝试生成标准发音示范音频
        demo_audio_url = None
        try:
            demo_audio_url = await tts_gateway.synthesize_to_url(task["text"], "zhixiaoxuan")
        except Exception:
            pass  # TTS 不可用时不影响任务下发

        return {
            "task_id": task["id"],
            "text": task["text"],
            "phonemes": task["phonemes"],
            "demo_audio_url": demo_audio_url,
            "difficulty": task["difficulty"],
        }

    async def evaluate(
        self,
        user_id: int,
        audio_bytes: bytes,
        target_text: str,
        target_phonemes: Optional[List[str]] = None,
    ) -> dict:
        """
        评估用户发音

        流程：
        1. ASR 音素识别（并行加载标准音素）
        2. DTW 对齐 + 评分
        3. 生成纠正建议
        4. 持久化结果
        """
        start_time = time.time()

        if target_phonemes is None:
            # 从 ItemBank 查找
            target_phonemes = await self._find_phonemes(target_text)

        # ASR 音素级识别（带时间戳）
        try:
            asr_result = await asr_gateway.recognize_with_timestamps(audio_bytes)
        except (AIServiceUnavailable, AIServiceTimeout) as e:
            # ASR 不可用时返回零分
            return {
                "id": 0,
                "overall": 0.0,
                "accuracy": 0.0,
                "fluency": 0.0,
                "completeness": 0.0,
                "phoneme_details": [],
                "suggestions": [f"语音识别服务暂时不可用，请稍后重试。({e.detail})"],
                "tts_demo_url": None,
                "latency_ms": int((time.time() - start_time) * 1000),
            }

        # 从 ASRResult 提取音素和置信度
        asr_phonemes = asr_result.phonemes if asr_result.phonemes else []
        asr_confidences = None
        if asr_result.timestamps:
            # timestamps 中可能包含置信度信息
            asr_confidences = [ts.get("confidence", 1.0) if isinstance(ts, dict) else 1.0 for ts in asr_result.timestamps]

        # DTW 评分
        score = pronunciation_scorer.score(
            target_phonemes, asr_phonemes, asr_confidences
        )

        # 尝试生成 TTS 示范音频
        tts_demo_url = None
        try:
            tts_demo_url = await tts_gateway.synthesize_to_url(target_text, "zhixiaoxuan")
        except Exception:
            pass

        # 计算延迟
        elapsed_ms = int((time.time() - start_time) * 1000)

        # 持久化
        attempt = PronunciationAttempt(
            user_id=user_id,
            target_text=target_text,
            target_phonemes=target_phonemes,
            asr_phonemes=asr_phonemes,
            accuracy=score.accuracy,
            fluency=score.fluency,
            completeness=score.completeness,
            overall=score.overall,
            suggestions=score.suggestions,
            audio_url="",
        )
        self.db.add(attempt)
        await self.db.flush()

        return {
            "id": attempt.id,
            "overall": score.overall,
            "accuracy": score.accuracy,
            "fluency": score.fluency,
            "completeness": score.completeness,
            "phoneme_details": [
                {
                    "target": d.target,
                    "asr": d.asr,
                    "score": round(d.score, 2),
                    "is_match": d.is_match,
                }
                for d in score.details
            ],
            "suggestions": score.suggestions,
            "tts_demo_url": tts_demo_url,
            "latency_ms": elapsed_ms,
        }

    async def get_history(
        self, user_id: int, limit: int = 20, offset: int = 0
    ) -> List[dict]:
        """获取用户发音历史记录"""
        result = await self.db.execute(
            select(PronunciationAttempt)
            .where(PronunciationAttempt.user_id == user_id)
            .order_by(desc(PronunciationAttempt.id))
            .offset(offset)
            .limit(limit)
        )
        attempts = result.scalars().all()

        return [
            {
                "id": a.id,
                "target_text": a.target_text,
                "overall": a.overall,
                "accuracy": a.accuracy,
                "fluency": a.fluency,
                "completeness": a.completeness,
                "suggestions": a.suggestions or [],
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in attempts
        ]

    async def get_stats(self, user_id: int) -> dict:
        """获取用户发音统计数据"""
        result = await self.db.execute(
            select(
                func.count(PronunciationAttempt.id).label("total"),
                func.avg(PronunciationAttempt.overall).label("avg_score"),
                func.max(PronunciationAttempt.overall).label("best_score"),
            ).where(PronunciationAttempt.user_id == user_id)
        )
        row = result.one()

        # 计算进步趋势（最近5次 vs 之前5次的平均分）
        improvement = 0.0
        recent_result = await self.db.execute(
            select(PronunciationAttempt.overall)
            .where(PronunciationAttempt.user_id == user_id)
            .order_by(desc(PronunciationAttempt.id))
            .limit(10)
        )
        scores = [r[0] for r in recent_result.all()]
        if len(scores) >= 6:
            recent_avg = sum(scores[:5]) / 5
            older_avg = sum(scores[5:]) / len(scores[5:])
            improvement = recent_avg - older_avg

        return {
            "total_attempts": row.total or 0,
            "average_score": round(row.avg_score or 0, 1),
            "best_score": round(row.best_score or 0, 1),
            "improvement_trend": round(improvement, 1),
        }

    async def _find_phonemes(self, text: str) -> List[str]:
        """从 ItemBank 查找目标音素"""
        result = await self.db.execute(
            select(ItemBank).where(
                ItemBank.text == text,
                ItemBank.is_active == True,
            )
        )
        item = result.scalar_one_or_none()
        if item and item.tags and item.tags.get("target_phonemes"):
            return item.tags["target_phonemes"]
        # 兜底：逐字拆分
        return list(text)
