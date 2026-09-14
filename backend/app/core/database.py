"""
数据库引擎与会话配置
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from .config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    """FastAPI 依赖：获取数据库会话"""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    """
    初始化数据库：创建所有表。
    在生产环境中应使用 Alembic 迁移，此方法仅用于开发/测试。
    """
    async with engine.begin() as conn:
        # 导入所有模型以确保它们被注册到 Base.metadata
        # from app.models import user, training  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
