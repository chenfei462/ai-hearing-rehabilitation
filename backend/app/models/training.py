from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class TrainingSession(Base):
    """一次训练会话"""
    __tablename__ = "training_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    level = Column(String(20))
    start_time = Column(DateTime, server_default=func.now())
    end_time = Column(DateTime)
    total_items = Column(Integer, default=0)
    correct_items = Column(Integer, default=0)
    accuracy = Column(Float, default=0.0)
    status = Column(String(20), default="active")

    user = relationship("User", back_populates="training_sessions")
    items = relationship("TrainingItem", back_populates="session")


class TrainingItem(Base):
    """会话内单题记录"""
    __tablename__ = "training_items"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("training_sessions.id"))
    item_id = Column(Integer, ForeignKey("item_bank.id"))
    user_answer = Column(String(500))
    is_correct = Column(Boolean)
    response_ms = Column(Integer)
    ai_score = Column(Float)

    session = relationship("TrainingSession", back_populates="items")
    item = relationship("ItemBank")
