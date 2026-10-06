# 20 — 架构规则

## 分层与依赖方向（强制）

```
frontend(pages → components/hooks/stores → services → api.ts/axios)
   │ HTTP /api
backend: api → services → models / ai(gateways)
         core(config/security/errors/safety/database/redis)  ← 横切
         middleware(performance/monitoring)                    ← 横切
         tasks(ARQ worker)                                     ← 后台
数据: PostgreSQL 15 (asyncpg+SQLAlchemy 2) / Redis 7 / OSS(音频)
```

- 依赖只能向下：api → services → models/ai；禁止 models 依赖 services、services 依赖 api。
- AI 调用统一走 `app/ai/*_gateway.py`（asr/tts/llm + `retry.py` 公共重试 + `*_base.py` 抽象）；业务层禁止直连 dashscope。
- 新增知识库/RAG 层时：`services/knowledge/**`（ingestion、retrieval、citation）→ `ai/embedding_gateway.py` → pgvector；同样禁止 api 层直连向量库。
- 训练（结构化题库，B 类数据）与 RAG（非结构化知识，A 类数据）**存储与服务分离**，禁止把题库塞进向量库、禁止用 RAG 检索代替选题。

## 冻结决策（改动须新 ADR + Max 批准）

1. FastAPI 单体，不拆微服务。
2. PostgreSQL + pgvector 承载向量检索；不引入独立向量数据库。
3. React 18 + Vite + MUI + Tailwind + Zustand + TanStack Query；不换栈。
4. 统一响应 `{code,data,message}` + `AppException`/`ErrorCode` 全局异常体系（`app/core/errors.py`）；新增端点必须走该体系（现存双轨 `schemas/common.py` vs `schemas/response.py` 待 ARCH-001 统一）。
5. JWT httpOnly Cookie + Bearer 兼容；短信验证码登录；不换认证方式。
6. 安全关键词统一在 `app/core/safety.py`（已存在）；新增安全策略引擎须复用该模块入口。

## 已知架构债（2025-07 评估，执行前须复核现状）

`architecture-debt-assessment.md` 列出 ARCH-01~14。注意：**ARCH-04（安全护栏统一→core/safety.py）与 ARCH-12（公共重试→ai/retry.py）经仓库核实已有对应文件，疑似已修复**；M1 任务执行前 Explore 阶段必须重新核实现状，只修仍然存在的债，禁止按过期报告盲目改动。

## 复用优先

新代码必须先搜索既有实现：IRT（`services/irt_engine.py`）、BKT（`ai/adaptive_engine.py`）、发音评分（`services/pronunciation_scorer.py`）、场景（`services/scenario_service.py`）、统计（`services/training_stats_service.py`）、错误码（`core/errors.py`）、中间件、`utils/date_utils.py`。三行相似代码优于过早抽象，但第 4 次复制必须提取公共模块。

## 禁止事项

- 推倒重构、更换框架、新增独立微服务、新增向量数据库、大规模升级依赖。
- 修改现有公开 API 路径/响应契约（新增可以，破坏性变更须 ADR）。
- God Module 增量：单文件超 ~500 行且多职责时必须拆分而非继续膨胀（参照 ReportService/DialogueService 拆分任务）。
- 在 Service 中硬编码新增题库/场景/关键词数据（走数据库或配置，参照 ARCH-06）。
