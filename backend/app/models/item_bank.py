from sqlalchemy import Column, Integer, String, Float, Boolean, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class ItemBank(Base):
    """训练题库（音素/词/句/噪声）"""
    __tablename__ = "item_bank"

    id = Column(Integer, primary_key=True, index=True)
    level = Column(String(20), index=True)  # syllable / word / sentence / noise
    content_type = Column(String(20))  # tone / initial / daily / number / simple / noise
    text = Column(String(500))
    audio_url = Column(String(500))
    phonemes = Column(JSON, default=list)
    difficulty_b = Column(Float, default=0.0)
    tags = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)

    knowledge_states = relationship("KnowledgeState", back_populates="item")
