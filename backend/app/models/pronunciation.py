from sqlalchemy import Column, Integer, String, Float, JSON, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class PronunciationAttempt(Base):
    """发音评估记录"""
    __tablename__ = "pronunciation_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    target_text = Column(String(500))
    target_phonemes = Column(JSON, default=list)
    asr_phonemes = Column(JSON, default=list)
    accuracy = Column(Float)
    fluency = Column(Float)
    completeness = Column(Float)
    overall = Column(Float)
    suggestions = Column(JSON, default=list)
    audio_url = Column(String(500))
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="pronunciation_attempts")
