from sqlalchemy import Column, Integer, String, DateTime, JSON, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(20), unique=True, index=True)
    role = Column(String(20), default="patient")  # patient / therapist
    nickname = Column(String(50))
    birth_year = Column(Integer)
    cochlear_info = Column(JSON, default=dict)
    consent_flags = Column(JSON, default=dict)
    created_at = Column(DateTime, server_default=func.now())

    abilities = relationship("UserAbility", back_populates="user")
    training_sessions = relationship("TrainingSession", back_populates="user")
    dialogue_sessions = relationship("DialogueSession", back_populates="user")
    pronunciation_attempts = relationship("PronunciationAttempt", back_populates="user")
    knowledge_states = relationship("KnowledgeState", back_populates="user")
