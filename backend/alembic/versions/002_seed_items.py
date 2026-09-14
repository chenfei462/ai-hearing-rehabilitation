"""种子数据：题库

Revision ID: 002
Revises: 001
Create Date: 2025-01-01
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 音节题目
    syllable_items = [
        {"level": "syllable", "content_type": "tone", "text": "mā", "phonemes": ["m", "ā"], "difficulty_b": -1.0, "tags": {"tone": 1}},
        {"level": "syllable", "content_type": "tone", "text": "má", "phonemes": ["m", "á"], "difficulty_b": -0.5, "tags": {"tone": 2}},
        {"level": "syllable", "content_type": "tone", "text": "mǎ", "phonemes": ["m", "ǎ"], "difficulty_b": 0.0, "tags": {"tone": 3}},
        {"level": "syllable", "content_type": "tone", "text": "mà", "phonemes": ["m", "à"], "difficulty_b": 0.5, "tags": {"tone": 4}},
        {"level": "syllable", "content_type": "initial", "text": "bā", "phonemes": ["b", "ā"], "difficulty_b": -1.5, "tags": {"initial": "b"}},
        {"level": "syllable", "content_type": "initial", "text": "pā", "phonemes": ["p", "ā"], "difficulty_b": -1.0, "tags": {"initial": "p"}},
        {"level": "syllable", "content_type": "initial", "text": "dā", "phonemes": ["d", "ā"], "difficulty_b": -1.0, "tags": {"initial": "d"}},
        {"level": "syllable", "content_type": "initial", "text": "tā", "phonemes": ["t", "ā"], "difficulty_b": -0.5, "tags": {"initial": "t"}},
    ]

    # 词语题目
    word_items = [
        {"level": "word", "content_type": "daily", "text": "你好", "phonemes": ["nǐ", "hǎo"], "difficulty_b": -1.5, "tags": {"category": "greeting"}},
        {"level": "word", "content_type": "daily", "text": "谢谢", "phonemes": ["xiè", "xiè"], "difficulty_b": -1.0, "tags": {"category": "polite"}},
        {"level": "word", "content_type": "daily", "text": "吃饭", "phonemes": ["chī", "fàn"], "difficulty_b": -0.5, "tags": {"category": "daily"}},
        {"level": "word", "content_type": "daily", "text": "医院", "phonemes": ["yī", "yuàn"], "difficulty_b": 0.0, "tags": {"category": "place"}},
        {"level": "word", "content_type": "number", "text": "一二三", "phonemes": ["yī", "èr", "sān"], "difficulty_b": -2.0, "tags": {"category": "number"}},
        {"level": "word", "content_type": "number", "text": "四五六", "phonemes": ["sì", "wǔ", "liù"], "difficulty_b": -1.5, "tags": {"category": "number"}},
    ]

    # 语句题目
    sentence_items = [
        {"level": "sentence", "content_type": "simple", "text": "今天天气很好", "phonemes": ["jīn", "tiān", "tiān", "qì", "hěn", "hǎo"], "difficulty_b": -1.0, "tags": {"length": 6}},
        {"level": "sentence", "content_type": "simple", "text": "我想喝水", "phonemes": ["wǒ", "xiǎng", "hē", "shuǐ"], "difficulty_b": -1.5, "tags": {"length": 4}},
        {"level": "sentence", "content_type": "simple", "text": "请帮我叫一辆出租车", "phonemes": ["qǐng", "bāng", "wǒ", "jiào", "yī", "liàng", "chū", "zū", "chē"], "difficulty_b": 0.0, "tags": {"length": 9}},
    ]

    # 噪声环境题目
    noise_items = [
        {"level": "noise", "content_type": "noise", "text": "你好，请问地铁站怎么走？", "phonemes": [], "difficulty_b": 0.5, "tags": {"noise_type": "street", "snr": 5}},
        {"level": "noise", "content_type": "noise", "text": "我要一杯咖啡，谢谢", "phonemes": [], "difficulty_b": 0.0, "tags": {"noise_type": "cafe", "snr": 10}},
    ]

    all_items = syllable_items + word_items + sentence_items + noise_items

    for item in all_items:
        op.execute(
            sa.text("INSERT INTO item_bank (level, content_type, text, phonemes, difficulty_b, tags, is_active) VALUES (:level, :content_type, :text, :phonemes, :difficulty_b, :tags, true)"),
            item
        )

def downgrade() -> None:
    op.execute("DELETE FROM item_bank")
