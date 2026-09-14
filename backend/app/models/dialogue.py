from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class DialogueSession(Base):
    """对话陪练会话"""
    __tablename__ = "dialogue_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    scenario = Column(String(50))
    turn_count = Column(Integer, default=0)
    status = Column(String(20), default="active")
    started_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="dialogue_sessions")
    turns = relationship("DialogueTurn", back_populates="session")


class DialogueTurn(Base):
    """对话轮次"""
    __tablename__ = "dialogue_turns"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("dialogue_sessions.id"))
    turn_index = Column(Integer)
    user_text = Column(String(1000))
    ai_text = Column(String(1000))
    user_audio_url = Column(String(500))
    ai_audio_url = Column(String(500))
    latency_ms = Column(Integer)

    session = relationship("DialogueSession", back_populates="turns")
