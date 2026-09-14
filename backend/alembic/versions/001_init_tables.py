"""初始化数据库表

Revision ID: 001
Revises:
Create Date: 2025-01-01
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("phone", sa.String(20), unique=True, index=True),
        sa.Column("role", sa.String(20), server_default="patient"),
        sa.Column("nickname", sa.String(50)),
        sa.Column("birth_year", sa.Integer()),
        sa.Column("cochlear_info", sa.JSON(), server_default="{}"),
        sa.Column("consent_flags", sa.JSON(), server_default="{}"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "user_abilities",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), index=True),
        sa.Column("level", sa.String(20)),
        sa.Column("theta", sa.Float(), server_default="0.0"),
        sa.Column("se", sa.Float(), server_default="1.0"),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "item_bank",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("level", sa.String(20), index=True),
        sa.Column("content_type", sa.String(20)),
        sa.Column("text", sa.String(500)),
        sa.Column("audio_url", sa.String(500)),
        sa.Column("phonemes", sa.JSON(), server_default="[]"),
        sa.Column("difficulty_b", sa.Float(), server_default="0.0"),
        sa.Column("tags", sa.JSON(), server_default="{}"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
    )

    op.create_table(
        "training_sessions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), index=True),
        sa.Column("level", sa.String(20)),
        sa.Column("start_time", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("end_time", sa.DateTime()),
        sa.Column("total_items", sa.Integer(), server_default="0"),
        sa.Column("correct_items", sa.Integer(), server_default="0"),
        sa.Column("accuracy", sa.Float(), server_default="0.0"),
        sa.Column("status", sa.String(20), server_default="active"),
    )

    op.create_table(
        "training_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("training_sessions.id"), index=True),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("item_bank.id")),
        sa.Column("user_answer", sa.String(500)),
        sa.Column("is_correct", sa.Boolean()),
        sa.Column("response_ms", sa.Integer()),
        sa.Column("ai_score", sa.Float()),
    )

    op.create_table(
        "dialogue_sessions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), index=True),
        sa.Column("scenario", sa.String(50)),
        sa.Column("turn_count", sa.Integer(), server_default="0"),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("started_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "dialogue_turns",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("dialogue_sessions.id"), index=True),
        sa.Column("turn_index", sa.Integer()),
        sa.Column("user_text", sa.String(1000)),
        sa.Column("ai_text", sa.String(1000)),
        sa.Column("user_audio_url", sa.String(500)),
        sa.Column("ai_audio_url", sa.String(500)),
        sa.Column("latency_ms", sa.Integer()),
    )

    op.create_table(
        "pronunciation_attempts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), index=True),
        sa.Column("target_text", sa.String(500)),
        sa.Column("target_phonemes", sa.JSON(), server_default="[]"),
        sa.Column("asr_phonemes", sa.JSON(), server_default="[]"),
        sa.Column("accuracy", sa.Float()),
        sa.Column("fluency", sa.Float()),
        sa.Column("completeness", sa.Float()),
        sa.Column("overall", sa.Float()),
        sa.Column("suggestions", sa.JSON(), server_default="[]"),
        sa.Column("audio_url", sa.String(500)),
    )

    # 创建索引
    op.create_index("ix_user_abilities_user_level", "user_abilities", ["user_id", "level"])
    op.create_index("ix_training_sessions_user_status", "training_sessions", ["user_id", "status"])

def downgrade() -> None:
    op.drop_table("pronunciation_attempts")
    op.drop_table("dialogue_turns")
    op.drop_table("dialogue_sessions")
    op.drop_table("training_items")
    op.drop_table("training_sessions")
    op.drop_table("item_bank")
    op.drop_table("user_abilities")
    op.drop_table("users")
