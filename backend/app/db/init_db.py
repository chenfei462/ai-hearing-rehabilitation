"""
数据库初始化 + 种子数据
"""
from sqlalchemy import select
from app.core.database import async_session, engine, Base
from app.models import (
    User, UserAbility, ItemBank, TrainingSession
)
from app.utils.logger import logger


async def init_database():
    """初始化数据库表"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("数据库表创建完成")


async def seed_data():
    """填充种子数据（训练题库 + 测试用户）"""
    async with async_session() as db:
        try:
            # 检查是否已有数据
            result = await db.execute(select(ItemBank).limit(1))
            if result.scalar_one_or_none():
                logger.info("种子数据已存在，跳过")
                return

            # ─── 训练题库种子数据 ───
            items = [
                # 音节级
                ItemBank(level="syllable", content_type="syllable", text="ma",
                         phonemes=["m", "a"], difficulty_b=-1.0, tags={"category": "声母韵母"}),
                ItemBank(level="syllable", content_type="syllable", text="ba",
                         phonemes=["b", "a"], difficulty_b=-1.2, tags={"category": "声母韵母"}),
                ItemBank(level="syllable", content_type="syllable", text="da",
                         phonemes=["d", "a"], difficulty_b=-0.8, tags={"category": "声母韵母"}),
                ItemBank(level="syllable", content_type="syllable", text="ta",
                         phonemes=["t", "a"], difficulty_b=-0.5, tags={"category": "声母韵母"}),
                ItemBank(level="syllable", content_type="syllable", text="na",
                         phonemes=["n", "a"], difficulty_b=-0.3, tags={"category": "声母韵母"}),
                ItemBank(level="syllable", content_type="syllable", text="la",
                         phonemes=["l", "a"], difficulty_b=0.0, tags={"category": "声母韵母"}),
                ItemBank(level="syllable", content_type="syllable", text="ga",
                         phonemes=["g", "a"], difficulty_b=0.3, tags={"category": "声母韵母"}),
                ItemBank(level="syllable", content_type="syllable", text="ka",
                         phonemes=["k", "a"], difficulty_b=0.5, tags={"category": "声母韵母"}),

                # 词语级
                ItemBank(level="word", content_type="word", text="妈妈",
                         phonemes=["m", "ā", "m", "a"], difficulty_b=-1.0, tags={"category": "称谓"}),
                ItemBank(level="word", content_type="word", text="爸爸",
                         phonemes=["b", "à", "b", "a"], difficulty_b=-1.0, tags={"category": "称谓"}),
                ItemBank(level="word", content_type="word", text="你好",
                         phonemes=["n", "ǐ", "h", "ǎo"], difficulty_b=-0.5, tags={"category": "问候"}),
                ItemBank(level="word", content_type="word", text="谢谢",
                         phonemes=["x", "iè", "x", "ie"], difficulty_b=-0.3, tags={"category": "礼貌"}),
                ItemBank(level="word", content_type="word", text="吃饭",
                         phonemes=["ch", "ī", "f", "àn"], difficulty_b=0.0, tags={"category": "日常"}),
                ItemBank(level="word", content_type="word", text="喝水",
                         phonemes=["h", "ē", "sh", "uǐ"], difficulty_b=0.2, tags={"category": "日常"}),
                ItemBank(level="word", content_type="word", text="走路",
                         phonemes=["z", "ǒu", "l", "ù"], difficulty_b=0.5, tags={"category": "动作"}),

                # 语句级
                ItemBank(level="sentence", content_type="sentence",
                         text="今天天气很好",
                         phonemes=["j", "īn", "t", "iān", "t", "iān", "q", "ì", "h", "ěn", "h", "ǎo"],
                         difficulty_b=-0.5, tags={"category": "日常"}),
                ItemBank(level="sentence", content_type="sentence",
                         text="我想吃苹果",
                         phonemes=["w", "ǒ", "x", "iǎng", "ch", "ī", "p", "íng", "g", "uǒ"],
                         difficulty_b=-0.3, tags={"category": "需求"}),
                ItemBank(level="sentence", content_type="sentence",
                         text="请问医院在哪里",
                         phonemes=["q", "ǐng", "w", "èn", "y", "ī", "y", "uàn", "z", "ài", "n", "ǎ", "l", "ǐ"],
                         difficulty_b=0.0, tags={"category": "问路"}),
                ItemBank(level="sentence", content_type="sentence",
                         text="我要一杯咖啡",
                         phonemes=["w", "ǒ", "y", "ào", "y", "ī", "b", "ēi", "k", "ā", "f", "ēi"],
                         difficulty_b=0.3, tags={"category": "点餐"}),

                # 噪声级
                ItemBank(level="noise", content_type="sentence",
                         text="明天下午三点开会",
                         phonemes=["m", "íng", "t", "iān", "x", "ià", "w", "ǔ", "s", "ān", "d", "iǎn", "k", "āi", "h", "uì"],
                         difficulty_b=0.5, tags={"category": "工作", "noise_snr": 10}),
                ItemBank(level="noise", content_type="sentence",
                         text="请帮我叫一辆出租车",
                         phonemes=["q", "ǐng", "b", "āng", "w", "ǒ", "j", "iào", "y", "ī", "l", "iàng", "ch", "ū", "z", "ū", "ch", "ē"],
                         difficulty_b=0.8, tags={"category": "出行", "noise_snr": 5}),

                # ─── 发音练习题库（从原硬编码 PRONUNCIATION_TASKS 迁移）───
                # easy 难度
                ItemBank(level="word", content_type="pronunciation",
                         text="你好",
                         phonemes=["n", "ǐ", "h", "ǎo"],
                         difficulty_b=-1.0,
                         tags={"category": "日常用语", "pronunciation_difficulty": "easy",
                               "target_phonemes": ["nǐ", "hǎo"]}),
                ItemBank(level="word", content_type="pronunciation",
                         text="谢谢",
                         phonemes=["x", "iè", "x", "ie"],
                         difficulty_b=-0.8,
                         tags={"category": "日常用语", "pronunciation_difficulty": "easy",
                               "target_phonemes": ["xiè", "xie"]}),
                ItemBank(level="word", content_type="pronunciation",
                         text="明天见",
                         phonemes=["m", "íng", "t", "iān", "j", "iàn"],
                         difficulty_b=-0.6,
                         tags={"category": "日常用语", "pronunciation_difficulty": "easy",
                               "target_phonemes": ["míng", "tiān", "jiàn"]}),
                ItemBank(level="word", content_type="pronunciation",
                         text="早上好",
                         phonemes=["z", "ǎo", "sh", "ang", "h", "ǎo"],
                         difficulty_b=-0.7,
                         tags={"category": "日常用语", "pronunciation_difficulty": "easy",
                               "target_phonemes": ["zǎo", "shang", "hǎo"]}),
                # medium 难度
                ItemBank(level="sentence", content_type="pronunciation",
                         text="今天天气真好",
                         phonemes=["j", "īn", "t", "iān", "t", "iān", "q", "ì", "zh", "ēn", "h", "ǎo"],
                         difficulty_b=-0.3,
                         tags={"category": "日常对话", "pronunciation_difficulty": "medium",
                               "target_phonemes": ["jīn", "tiān", "tiān", "qì", "zhēn", "hǎo"]}),
                ItemBank(level="sentence", content_type="pronunciation",
                         text="我想吃苹果",
                         phonemes=["w", "ǒ", "x", "iǎng", "ch", "ī", "p", "íng", "g", "uǒ"],
                         difficulty_b=-0.1,
                         tags={"category": "饮食", "pronunciation_difficulty": "medium",
                               "target_phonemes": ["wǒ", "xiǎng", "chī", "píng", "guǒ"]}),
                ItemBank(level="sentence", content_type="pronunciation",
                         text="我喜欢读书",
                         phonemes=["w", "ǒ", "x", "ǐ", "h", "uān", "d", "ú", "sh", "ū"],
                         difficulty_b=0.0,
                         tags={"category": "兴趣爱好", "pronunciation_difficulty": "medium",
                               "target_phonemes": ["wǒ", "xǐ", "huān", "dú", "shū"]}),
                ItemBank(level="sentence", content_type="pronunciation",
                         text="这个多少钱",
                         phonemes=["zh", "è", "g", "e", "d", "uō", "sh", "ǎo", "q", "ián"],
                         difficulty_b=0.2,
                         tags={"category": "购物", "pronunciation_difficulty": "medium",
                               "target_phonemes": ["zhè", "ge", "duō", "shǎo", "qián"]}),
                # hard 难度
                ItemBank(level="sentence", content_type="pronunciation",
                         text="请问医院在哪里",
                         phonemes=["q", "ǐng", "w", "èn", "y", "ī", "y", "uàn", "z", "ài", "n", "ǎ", "l", "ǐ"],
                         difficulty_b=0.5,
                         tags={"category": "问路", "pronunciation_difficulty": "hard",
                               "target_phonemes": ["qǐng", "wèn", "yī", "yuàn", "zài", "nǎ", "lǐ"]}),
                ItemBank(level="sentence", content_type="pronunciation",
                         text="请帮我打电话",
                         phonemes=["q", "ǐng", "b", "āng", "w", "ǒ", "d", "ǎ", "d", "iàn", "h", "uà"],
                         difficulty_b=0.6,
                         tags={"category": "求助", "pronunciation_difficulty": "hard",
                               "target_phonemes": ["qǐng", "bāng", "wǒ", "dǎ", "diàn", "huà"]}),
            ]
            db.add_all(items)

            # ─── 测试用户 ───
            demo_user = User(
                phone="13800000001",
                role="patient",
                nickname="演示用户",
                birth_year=1960,
                cochlear_info={"brand": "Cochlear", "implant_year": 2023},
                consent_flags={"data_usage": True, "model_training": False},
            )
            db.add(demo_user)
            await db.flush()

            # 为演示用户创建各级别能力
            for level in ["syllable", "word", "sentence", "noise"]:
                ability = UserAbility(
                    user_id=demo_user.id,
                    level=level,
                    theta=-0.5 if level == "syllable" else 0.0,
                    se=0.8,
                )
                db.add(ability)

            # 创建演示训练历史
            from datetime import datetime, timedelta, timezone
            for i in range(10):
                session = TrainingSession(
                    user_id=demo_user.id,
                    level=["syllable", "word", "sentence"][i % 3],
                    start_time=datetime.now(timezone.utc) - timedelta(days=10 - i),
                    end_time=datetime.now(timezone.utc) - timedelta(days=10 - i, hours=-1),
                    total_items=10,
                    correct_items=7 + (i % 3),
                    accuracy=(7 + (i % 3)) / 10,
                    status="completed",
                )
                db.add(session)

            # 听力师用户
            therapist = User(
                phone="13800000002",
                role="therapist",
                nickname="王听力师",
            )
            db.add(therapist)

            await db.commit()
            logger.info("种子数据填充完成")

        except Exception as e:
            await db.rollback()
            logger.error(f"种子数据填充失败: {e}")
            raise
