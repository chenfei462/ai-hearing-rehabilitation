from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserAbility(Base):
    """用户能力参数（IRT θ 参数，按训练级别）"""
    __tablename__ = "user_abilities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    level = Column(String(20))  # syllable / word / sentence / noise
    theta = Column(Float, default=0.0)
    se = Column(Float, default=1.0)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="abilities")
