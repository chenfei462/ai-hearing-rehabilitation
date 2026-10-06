# 50 — 数据库规则（PostgreSQL 15 + pgvector + Redis 7）

## 现状（真实迁移链）

- `backend/alembic/versions/001_init_tables.py` → `002_seed_items.py`。
- 既有表：users、user_abilities、item_bank、training_sessions、training_items、dialogue_sessions、dialogue_turns、pronunciation_attempts、knowledge_states（BKT）。
- 向量能力：**当前未安装 pgvector、无任何向量表**；知识库 Schema 由 KB-001 起的任务引入。

## 迁移纪律

1. 任何 Schema 变更必须走 Alembic 迁移，禁止手改生产库、禁止 `Base.metadata.create_all` 代替迁移。
2. 每个迁移必须实现可用的 `downgrade()`（历史 Task 4 修复过 downgrade bug）；门禁验证 clean upgrade → downgrade → re-upgrade。
3. 迁移文件按序号递增命名（003_xxx.py），单一职责；数据迁移与结构迁移分开。
4. 种子数据幂等（可重复执行不产生重复行）。

## 建模规范

- 表/字段 snake_case；每表含 `created_at`/`updated_at`（UTC）；主键 Integer/BigInteger 自增（既有风格）或 UUID（新子系统可用，须在 SPEC 声明并全局一致）。
- 灵活结构用 JSON/JSONB（phonemes、tags、consent_flags、suggestions 已有先例）；高频过滤字段必须建索引。
- 外键必须显式声明 + index（参照 knowledge_states.user_id/item_id）。
- 训练题库内容字段规划（TRN-001）：phoneme/initial/final/tone/syllable/word/sentence/scenario/speaker/speech_rate/noise_type/snr_db/audio/answer/distractors/difficulty/review_status——加列迁移，禁止重建 item_bank。

## 数据分级与隔离（强制）

| 级别 | 数据 | 规则 |
|---|---|---|
| A 公共知识 | 医学教育文档 chunk + embedding | pgvector 表仅存 A 类；每条 chunk 必须带 source_id/document_id/provenance/review_status/license 字段；review_status≠approved 或已过期文档禁止进入检索结果 |
| B 训练内容 | item_bank 及扩展 | 结构化表存储，不入向量库 |
| C 内部规则 | Prompt/安全策略/关键词 | 只存在于代码与配置，不入库为可检索语料 |
| D 用户数据 | 健康信息、语音、训练/对话/发音记录、consent | **绝对禁止写入 A 类向量表或任何公共检索语料**；对象存储按 `audio/{user_id}/...` 隔离；访问必须归属校验 + 审计 |

- 隔离必须由数据库约束/服务层守卫 + 回归测试双重保证（KB-007），不得只靠约定。
- 删除路径：用户注销必须级联删除 D 类数据（PRIV-002）；导出路径：用户可导出本人数据（PRIV-003）；保留策略：超期数据由后台任务清理（PRIV-004）。

## Redis 使用

- 用途限定：短信验证码（hash 存储）、对话上下文、限流、缓存、ARQ 队列。**禁止把 Redis 当持久化主存储**（用户数据一律 PostgreSQL）。
- `decode_responses=True`；键带命名空间前缀；TTL 必须显式设置。

## 测试数据库

- 单测：`sqlite+aiosqlite://`（CI 既有配置）；集成：postgres 16-alpine 服务容器（CI 既有 job）。
- pgvector 相关测试需要带 vector 扩展的 PostgreSQL 镜像；无法安全搭建时 Machine Gate 记 `BLOCKED_MISSING_SAFE_TEST_ENV`，禁止打生产库。
