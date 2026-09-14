"""
种子题库数据脚本
用于初始化 ItemBank 表，提供各级别训练题目
"""
import asyncio
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine, async_session, Base
from app.models.item_bank import ItemBank


# 种子数据
SEED_ITEMS = [
    # ============ 音节级别 (syllable) ============
    # 元音
    {"level": "syllable", "content_type": "vowel", "text": "a", "difficulty_b": -2.0,
     "phonemes": ["a"], "tags": {"category": "元音", "pinyin": "a"}},
    {"level": "syllable", "content_type": "vowel", "text": "o", "difficulty_b": -2.0,
     "phonemes": ["o"], "tags": {"category": "元音", "pinyin": "o"}},
    {"level": "syllable", "content_type": "vowel", "text": "e", "difficulty_b": -1.8,
     "phonemes": ["e"], "tags": {"category": "元音", "pinyin": "e"}},
    {"level": "syllable", "content_type": "vowel", "text": "i", "difficulty_b": -1.8,
     "phonemes": ["i"], "tags": {"category": "元音", "pinyin": "i"}},
    {"level": "syllable", "content_type": "vowel", "text": "u", "difficulty_b": -1.8,
     "phonemes": ["u"], "tags": {"category": "元音", "pinyin": "u"}},
    {"level": "syllable", "content_type": "vowel", "text": "ü", "difficulty_b": -1.5,
     "phonemes": ["ü"], "tags": {"category": "元音", "pinyin": "ü"}},

    # 声母
    {"level": "syllable", "content_type": "initial", "text": "b", "difficulty_b": -1.5,
     "phonemes": ["b"], "tags": {"category": "声母", "pinyin": "b"}},
    {"level": "syllable", "content_type": "initial", "text": "p", "difficulty_b": -1.5,
     "phonemes": ["p"], "tags": {"category": "声母", "pinyin": "p"}},
    {"level": "syllable", "content_type": "initial", "text": "m", "difficulty_b": -1.5,
     "phonemes": ["m"], "tags": {"category": "声母", "pinyin": "m"}},
    {"level": "syllable", "content_type": "initial", "text": "f", "difficulty_b": -1.3,
     "phonemes": ["f"], "tags": {"category": "声母", "pinyin": "f"}},
    {"level": "syllable", "content_type": "initial", "text": "d", "difficulty_b": -1.3,
     "phonemes": ["d"], "tags": {"category": "声母", "pinyin": "d"}},
    {"level": "syllable", "content_type": "initial", "text": "t", "difficulty_b": -1.3,
     "phonemes": ["t"], "tags": {"category": "声母", "pinyin": "t"}},
    {"level": "syllable", "content_type": "initial", "text": "n", "difficulty_b": -1.3,
     "phonemes": ["n"], "tags": {"category": "声母", "pinyin": "n"}},
    {"level": "syllable", "content_type": "initial", "text": "l", "difficulty_b": -1.3,
     "phonemes": ["l"], "tags": {"category": "声母", "pinyin": "l"}},

    # 音节组合
    {"level": "syllable", "content_type": "syllable", "text": "ma", "difficulty_b": -1.0,
     "phonemes": ["m", "a"], "tags": {"category": "音节", "pinyin": "ma"}},
    {"level": "syllable", "content_type": "syllable", "text": "ba", "difficulty_b": -1.0,
     "phonemes": ["b", "a"], "tags": {"category": "音节", "pinyin": "ba"}},
    {"level": "syllable", "content_type": "syllable", "text": "pa", "difficulty_b": -1.0,
     "phonemes": ["p", "a"], "tags": {"category": "音节", "pinyin": "pa"}},
    {"level": "syllable", "content_type": "syllable", "text": "da", "difficulty_b": -0.8,
     "phonemes": ["d", "a"], "tags": {"category": "音节", "pinyin": "da"}},
    {"level": "syllable", "content_type": "syllable", "text": "ta", "difficulty_b": -0.8,
     "phonemes": ["t", "a"], "tags": {"category": "音节", "pinyin": "ta"}},
    {"level": "syllable", "content_type": "syllable", "text": "na", "difficulty_b": -0.8,
     "phonemes": ["n", "a"], "tags": {"category": "音节", "pinyin": "na"}},

    # 声调
    {"level": "syllable", "content_type": "tone", "text": "mā", "difficulty_b": -0.5,
     "phonemes": ["m", "a"], "tags": {"category": "声调", "pinyin": "ma1", "tone": 1}},
    {"level": "syllable", "content_type": "tone", "text": "má", "difficulty_b": -0.3,
     "phonemes": ["m", "a"], "tags": {"category": "声调", "pinyin": "ma2", "tone": 2}},
    {"level": "syllable", "content_type": "tone", "text": "mǎ", "difficulty_b": -0.3,
     "phonemes": ["m", "a"], "tags": {"category": "声调", "pinyin": "ma3", "tone": 3}},
    {"level": "syllable", "content_type": "tone", "text": "mà", "difficulty_b": -0.3,
     "phonemes": ["m", "a"], "tags": {"category": "声调", "pinyin": "ma4", "tone": 4}},

    # ============ 词语级别 (word) ============
    # 日常用语
    {"level": "word", "content_type": "daily", "text": "你好", "difficulty_b": -1.5,
     "phonemes": ["n", "i", "h", "ao"], "tags": {"category": "问候", "pinyin": "nihao"}},
    {"level": "word", "content_type": "daily", "text": "谢谢", "difficulty_b": -1.3,
     "phonemes": ["x", "i", "e", "x", "i", "e"], "tags": {"category": "礼貌", "pinyin": "xiexie"}},
    {"level": "word", "content_type": "daily", "text": "再见", "difficulty_b": -1.3,
     "phonemes": ["z", "ai", "j", "ian"], "tags": {"category": "告别", "pinyin": "zaijian"}},
    {"level": "word", "content_type": "daily", "text": "吃饭", "difficulty_b": -1.0,
     "phonemes": ["ch", "i", "f", "an"], "tags": {"category": "生活", "pinyin": "chifan"}},
    {"level": "word", "content_type": "daily", "text": "喝水", "difficulty_b": -1.0,
     "phonemes": ["h", "e", "sh", "ui"], "tags": {"category": "生活", "pinyin": "heshui"}},
    {"level": "word", "content_type": "daily", "text": "睡觉", "difficulty_b": -1.0,
     "phonemes": ["sh", "ui", "j", "iao"], "tags": {"category": "生活", "pinyin": "shuijiao"}},

    # 数字
    {"level": "word", "content_type": "number", "text": "一", "difficulty_b": -1.5,
     "phonemes": ["y", "i"], "tags": {"category": "数字", "pinyin": "yi"}},
    {"level": "word", "content_type": "number", "text": "二", "difficulty_b": -1.5,
     "phonemes": ["er"], "tags": {"category": "数字", "pinyin": "er"}},
    {"level": "word", "content_type": "number", "text": "三", "difficulty_b": -1.5,
     "phonemes": ["s", "an"], "tags": {"category": "数字", "pinyin": "san"}},
    {"level": "word", "content_type": "number", "text": "十", "difficulty_b": -1.3,
     "phonemes": ["sh", "i"], "tags": {"category": "数字", "pinyin": "shi"}},
    {"level": "word", "content_type": "number", "text": "百", "difficulty_b": -1.0,
     "phonemes": ["b", "ai"], "tags": {"category": "数字", "pinyin": "bai"}},

    # 称呼
    {"level": "word", "content_type": "daily", "text": "爸爸", "difficulty_b": -1.2,
     "phonemes": ["b", "a", "b", "a"], "tags": {"category": "称呼", "pinyin": "baba"}},
    {"level": "word", "content_type": "daily", "text": "妈妈", "difficulty_b": -1.2,
     "phonemes": ["m", "a", "m", "a"], "tags": {"category": "称呼", "pinyin": "mama"}},
    {"level": "word", "content_type": "daily", "text": "医生", "difficulty_b": -0.8,
     "phonemes": ["y", "i", "sh", "eng"], "tags": {"category": "职业", "pinyin": "yisheng"}},

    # ============ 语句级别 (sentence) ============
    # 简单句
    {"level": "sentence", "content_type": "simple", "text": "你好吗？", "difficulty_b": -1.5,
     "phonemes": ["n", "i", "h", "ao", "m", "a"], "tags": {"category": "问候", "pinyin": "nihao ma"}},
    {"level": "sentence", "content_type": "simple", "text": "我很好。", "difficulty_b": -1.3,
     "phonemes": ["w", "o", "h", "en", "h", "ao"], "tags": {"category": "回答", "pinyin": "wo hen hao"}},
    {"level": "sentence", "content_type": "simple", "text": "谢谢你。", "difficulty_b": -1.3,
     "phonemes": ["x", "i", "e", "x", "i", "e", "n", "i"], "tags": {"category": "礼貌", "pinyin": "xiexie ni"}},
    {"level": "sentence", "content_type": "simple", "text": "请帮我。", "difficulty_b": -1.0,
     "phonemes": ["q", "ing", "b", "ang", "w", "o"], "tags": {"category": "请求", "pinyin": "qing bang wo"}},

    # 日常对话
    {"level": "sentence", "content_type": "daily", "text": "今天天气很好。", "difficulty_b": -0.5,
     "phonemes": ["j", "in", "t", "ian", "t", "ian", "q", "i", "h", "en", "h", "ao"],
     "tags": {"category": "天气", "pinyin": "jintian tianqi hen hao"}},
    {"level": "sentence", "content_type": "daily", "text": "我要去医院。", "difficulty_b": -0.5,
     "phonemes": ["w", "o", "y", "ao", "q", "u", "y", "i", "y", "uan"],
     "tags": {"category": "就医", "pinyin": "wo yao qu yiyuan"}},
    {"level": "sentence", "content_type": "daily", "text": "请问多少钱？", "difficulty_b": -0.3,
     "phonemes": ["q", "ing", "w", "en", "d", "uo", "sh", "ao", "q", "ian"],
     "tags": {"category": "购物", "pinyin": "qingwen duoshao qian"}},
    {"level": "sentence", "content_type": "daily", "text": "我不太舒服。", "difficulty_b": -0.3,
     "phonemes": ["w", "o", "b", "u", "t", "ai", "sh", "u", "f", "u"],
     "tags": {"category": "健康", "pinyin": "wo bu tai shufu"}},

    # 较长句子
    {"level": "sentence", "content_type": "complex", "text": "我想预约明天上午的号。", "difficulty_b": 0.5,
     "phonemes": ["w", "o", "x", "iang", "y", "u", "y", "ue", "m", "ing", "t", "ian", "sh", "ang", "w", "u", "d", "e", "h", "ao"],
     "tags": {"category": "预约", "pinyin": "wo xiang yuyue mingtian shangwu de hao"}},
    {"level": "sentence", "content_type": "complex", "text": "这个药一天吃三次。", "difficulty_b": 0.5,
     "phonemes": ["zh", "e", "g", "e", "y", "ao", "y", "i", "t", "ian", "ch", "i", "s", "an", "c", "i"],
     "tags": {"category": "用药", "pinyin": "zhege yao yitian chi sanci"}},

    # ============ 噪声环境 (noise) ============
    # 噪声下简单词
    {"level": "noise", "content_type": "daily", "text": "你好", "difficulty_b": 0.0,
     "phonemes": ["n", "i", "h", "ao"], "tags": {"category": "噪声-问候", "pinyin": "nihao", "noise_level": "low"}},
    {"level": "noise", "content_type": "daily", "text": "谢谢", "difficulty_b": 0.2,
     "phonemes": ["x", "i", "e", "x", "i", "e"], "tags": {"category": "噪声-礼貌", "pinyin": "xiexie", "noise_level": "low"}},
    {"level": "noise", "content_type": "daily", "text": "再见", "difficulty_b": 0.2,
     "phonemes": ["z", "ai", "j", "ian"], "tags": {"category": "噪声-告别", "pinyin": "zaijian", "noise_level": "low"}},

    # 噪声下日常句
    {"level": "noise", "content_type": "daily", "text": "请问洗手间在哪里？", "difficulty_b": 0.8,
     "phonemes": ["q", "ing", "w", "en", "x", "i", "sh", "ou", "j", "ian", "z", "ai", "n", "a", "l", "i"],
     "tags": {"category": "噪声-问路", "pinyin": "qingwen xishoujian zai nali", "noise_level": "medium"}},
    {"level": "noise", "content_type": "daily", "text": "我要一杯咖啡。", "difficulty_b": 0.8,
     "phonemes": ["w", "o", "y", "ao", "y", "i", "b", "ei", "k", "a", "f", "ei"],
     "tags": {"category": "噪声-点餐", "pinyin": "wo yao yibei kafei", "noise_level": "medium"}},
    {"level": "noise", "content_type": "daily", "text": "帮我叫一辆出租车。", "difficulty_b": 1.0,
     "phonemes": ["b", "ang", "w", "o", "j", "iao", "y", "i", "l", "iang", "ch", "u", "z", "u", "ch", "e"],
     "tags": {"category": "噪声-出行", "pinyin": "bang wo jiao yiliang chuzuche", "noise_level": "medium"}},

    # 高噪声环境
    {"level": "noise", "content_type": "daily", "text": "现在几点了？", "difficulty_b": 1.2,
     "phonemes": ["x", "ian", "z", "ai", "j", "i", "d", "ian", "l", "e"],
     "tags": {"category": "噪声-时间", "pinyin": "xianzai jidian le", "noise_level": "high"}},
    {"level": "noise", "content_type": "daily", "text": "我听不清楚。", "difficulty_b": 1.2,
     "phonemes": ["w", "o", "t", "ing", "b", "u", "q", "ing", "ch", "u"],
     "tags": {"category": "噪声-反馈", "pinyin": "wo ting bu qingchu", "noise_level": "high"}},
]


async def seed_item_bank():
    """将种子数据写入数据库"""
    async with engine.begin() as conn:
        # 创建表（如果不存在）
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        # 检查是否已有数据
        from sqlalchemy import select, func
        result = await session.execute(select(func.count()).select_from(ItemBank))
        count = result.scalar()

        if count > 0:
            print(f"ItemBank 已有 {count} 条数据，跳过种子数据插入")
            return

        # 插入种子数据
        for item_data in SEED_ITEMS:
            item = ItemBank(**item_data)
            session.add(item)

        await session.commit()
        print(f"成功插入 {len(SEED_ITEMS)} 条种子数据")


if __name__ == "__main__":
    asyncio.run(seed_item_bank())