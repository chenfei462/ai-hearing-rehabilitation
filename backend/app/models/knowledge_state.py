"""
用户知识状态模型

用于存储用户在训练项目上的知识状态，
基于贝叶斯知识追踪（BKT）算法。
"""
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class KnowledgeState(Base):
    """用户知识状态"""
    __tablename__ = "knowledge_states"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("item_bank.id"), nullable=False, index=True)
    mastery = Column(Float, default=0.0, nullable=False)  # 掌握概率 (0-1)
    confidence = Column(Float, default=0.0, nullable=False)  # 置信度 (0-1)
    attempts = Column(Integer, default=0, nullable=False)  # 尝试次数
    correct_count = Column(Integer, default=0, nullable=False)  # 正确次数
    last_attempt_at = Column(DateTime, nullable=True)  # 最后尝试时间
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # 关系
    user = relationship("User", back_populates="knowledge_states")
    item = relationship("ItemBank", back_populates="knowledge_states")

    @property
    def accuracy(self) -> float:
        """计算正确率"""
        if self.attempts == 0:
            return 0.0
        return self.correct_count / self.attempts

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "item_id": self.item_id,
            "mastery": self.mastery,
            "confidence": self.confidence,
            "attempts": self.attempts,
            "correct_count": self.correct_count,
            "accuracy": self.accuracy,
            "last_attempt_at": self.last_attempt_at.isoformat() if self.last_attempt_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<KnowledgeState user_id={self.user_id} item_id={self.item_id} mastery={self.mastery:.2f}>"
