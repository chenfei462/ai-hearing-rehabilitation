# 30 — 后端规则（Python 3.11 + FastAPI）

## 结构与规范

- 目录：`app/{api,services,models,schemas,ai,core,db,middleware,monitoring,tasks,utils}`；测试在 `backend/tests/`（pytest，`asyncio_mode=auto`，timeout=30s）。
- 依赖版本锁定在 `backend/pyproject.toml`；新增依赖须在 TASK_SPEC 声明理由，禁止顺手升级既有依赖。
- Lint：`ruff check app/`（E,F,W,I,N,UP,B；line-length 120，E501 忽略）。
- 类型注解强制：公共函数签名必须有类型；Pydantic v2 模型放 `schemas/`。

## API 层

- 所有新端点必须：`Depends(get_current_user)` 认证 + Service 层归属校验（`session.user_id == current_user.id`），杜绝 IDOR（历史 B4/S1 教训）。
- POST 业务参数用 Pydantic Request Body，禁止 Query Param 传业务数据（历史 A3 教训）。
- 统一响应 `{code,data,message}`；业务异常抛 `AppException`，禁止裸 `ValueError` 出 Service 层。
- 角色控制：patient / therapist（既有 `tests/test_role_permissions.py` 为回归基线）；新增 admin/expert 角色须走 RBAC 任务并补权限测试。

## Service 层

- 单一职责；一个 Service 只服务一个业务域。跨域统计逻辑放 `training_stats_service.py` 类公共模块。
- 禁止在 Service 直接调用 dashscope/oss2；经 `app/ai/*_gateway.py`。
- 同步阻塞 I/O（dashscope 同步 SDK、oss2）必须 `asyncio.to_thread()` 包装，禁止阻塞事件循环（历史 S2/S3 教训）。

## AI 网关

- 公共重试/退避在 `app/ai/retry.py`；新网关必须复用。
- 公共异常 `AIServiceUnavailable`/`AIServiceTimeout`；降级策略：TTS 失败回退文本、ASR 失败提示重录、LLM 失败返回预设话术（错误码 50301/50302）。
- 流式输出必须先过安全缓冲再发送（禁止先发后检，历史 S4 教训）；输入安全检查覆盖最近多条消息而非仅最后一条（历史 S5 教训）。

## 数据库与迁移

- SQLAlchemy 2 异步；模型改动必须附 Alembic 迁移（`backend/alembic/versions/`，现有链 001_init_tables → 002_seed_items），且 **downgrade 可用**（clean upgrade → downgrade → re-upgrade 验证）。
- 灵活结构用 JSON/JSONB（题库 phonemes、tags、consent_flags 已有先例）；新增字段优先加列而非改语义。
- 种子数据走 `scripts/seed_item_bank.py` / `db/init_db.py` 模式，禁止测试污染生产库。

## Redis

- `decode_responses=True`：返回值是 str，禁止 `.decode()`（历史 B2 教训）。
- 键命名：`sms:{phone}`、对话上下文按 session；验证码存储用 hash 而非明文（A2 建议，隐私任务落实）。
- 缓存 key 必须含用户标识（user_id 或完整 token hash），禁止 token 前缀截断（历史 S6 教训）。

## 日志与监控

- loguru；日志脱敏：手机号只留后 4 位，禁止输出验证码、token、完整语音 URL 中的用户标识、任何 Secret。
- 指标经 `app/monitoring/metrics.py`；计数器用原子操作（历史 S7 教训）。

## 测试

- 新逻辑必须带 pytest 单测；API 改动补 `tests/test_*_api.py`；安全相关补权限/IDOR 测试。
- CI 基线：sqlite+aiosqlite 跑单测、postgres 跑集成（`test_integration.py`、`test_training_api.py`、`test_role_permissions.py`）。
- 禁止删除/注释/skip 既有测试来让门禁通过。
