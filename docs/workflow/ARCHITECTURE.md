# ARCHITECTURE — 目标架构（基于真实仓库）

> v1.0（2026-10-06）。标注：`[存在]` = 已在仓库核实；`[规划]` = 由 TASK_CATALOG 任务引入。
> 依赖方向铁律：上层 → 下层，禁止反向；同层禁止互相 import 内部实现。

## 1. 系统全景

```
┌────────────────────────── Frontend (React 18 SPA) [存在] ──────────────────────────┐
│ pages: Login/Training/Dialogue/Conversation/Pronunciation/Report/Settings/Home [存在] │
│ pages: KnowledgeQAPage [规划 UI-001]   admin: 知识管理/专家审查/内容管理 [规划 ADMIN-*] │
│ components(common/charts/layout/hardware) hooks(useRecorder/useAudioPlayer/…) [存在]  │
│ stores: authStore/a11yStore/sessionStore [存在]  services→api.ts(axios) [存在]        │
└──────────────────────────────────────┬──────────────────────────────────────────────┘
                                       │ HTTPS /api（httpOnly Cookie JWT）
┌──────────────────────────────────────▼──────────────────────────────────────────────┐
│                        Backend — FastAPI 单体 (Python 3.11)                          │
│  middleware: performance/monitoring/限流 [存在]                                       │
│  api: auth/training/dialogue/pronunciation/report/health/metrics/hardware [存在]      │
│       knowledge(教育问答) [规划 RAG-010]  admin(知识/内容/审查) [规划 ADMIN-*]         │
│       privacy(consent/export/delete) [规划 PRIV-*]                                    │
│  services: auth/training/dialogue(+orchestrator/scenario)/pronunciation/report        │
│            /patient/training_stats [存在]                                             │
│            knowledge: source_registry/document/chunk/ingest_pipeline [规划 KB/ING]    │
│            retrieval: vector/fts/hybrid_rrf/rerank/context_builder/rag_orchestrator    │
│            /citation [规划 RAG-*]                                                     │
│            safety: risk_taxonomy/query_classifier/safety_policy/blocker/events         │
│            [规划 SAFE-*，统一入口扩展 core/safety.py [存在]]                           │
│            privacy: consent/erasure/export/retention/deid [规划 PRIV-*]               │
│            irt_engine [存在] + calibration/experiment_log [规划 IRT-*]                │
│  ai: asr/tts/llm gateway + *_base + retry [存在]  embedding_gateway [规划 ING-008]    │
│      adaptive_engine(BKT) [存在]                                                      │
│  models/schemas: 9 张业务表 [存在] + kb_*/safety_*/privacy_*/irt_* [规划]              │
│  core: config/security/errors/safety/database/redis [存在]                            │
│  tasks: ARQ worker/report_weekly [存在] + reindex/retention/deid [规划]               │
└───────┬───────────────┬───────────────┬────────────────────┬────────────────────────┘
        │               │               │                    │
   PostgreSQL 15    Redis 7         阿里云百炼            OSS(+CDN)
   业务表 [存在]     验证码/上下文/   Fun-ASR/Qwen TTS/    音频素材/录音/
   pgvector 向量库   限流/ARQ        通义千问 [存在]       TTS 缓存 [存在]
   [规划 KB-001]     [存在]          text-embedding
                                     [规划 ING-008]
```

## 2. 组件职责与依赖方向

### 2.1 Frontend [存在]

- 依赖方向：`pages → components/hooks → stores/services → api.ts`。
- 服务层一对一封装后端 API（trainingService/dialogueService/pronunciationService/reportService/hardwareService）。
- 新增 [规划]：knowledgeService（教育问答+引用渲染）、adminService（后台）、privacyService（导出/删除/consent）。

### 2.2 Backend API 层 [存在]

- 只做：认证依赖（get_current_user）、参数校验（Pydantic）、调用 Service、统一响应。
- 新增端点必须：归属校验（防 IDOR）、RBAC 角色检查（admin/expert/audiologist 新角色 [规划 ADMIN-004]）。

### 2.3 Services 层

- 既有 [存在]：auth、training（+irt_engine）、dialogue（+orchestrator/scenario）、pronunciation（+scorer）、report、patient、training_stats。
- 规划新增（各自独立模块，禁止塞入既有 God Module）：
  - `services/knowledge/`：Source Registry、Document/Version 管理、Chunk 管理、Ingestion 编排、Reindex。
  - `services/retrieval/`：Vector/FTS/Hybrid+RRF/Rerank/Context Builder/RAG Orchestrator/Citation。
  - `services/safety/`：Risk Taxonomy、Query Classifier、Safety Policy、Unsafe Answer Blocker、Safety Event、Emergency/Referral Route。
  - `services/privacy/`：Consent、Erasure、Export、Retention、De-identification。
  - `services/irt/`：Calibration、Ability Estimation 持久化、Item Selection、Experiment Log、Parameter Versioning。
- 跨域调用规则：dialogue/rag 调用 safety（单向）；training 调用 irt（单向）；任何 service 可调用 privacy 的审计接口；禁止循环依赖。

### 2.4 AI 层 [存在 + 规划]

- asr_gateway（Fun-ASR）、tts_gateway（Qwen TTS + OSS 缓存）、llm_gateway（通义千问 + 安全过滤）、retry 公共模块、*_base 抽象。
- 规划：embedding_gateway（dashscope text-embedding，批量、维度/model/version 记录）。
- 所有 LLM 生成路径（对话、教育问答、小结）必须经 safety 层：输入分类 → 生成 → 输出拦截（流式先缓冲）。

### 2.5 数据层

- PostgreSQL：业务表 [存在] + 知识库表族 [规划]：`kb_sources`、`kb_documents`、`kb_document_versions`、`kb_chunks`（vector 列 + HNSW/IVFFlat 索引 + FTS tsvector 列）、`kb_review_events`；安全表族：`safety_events`、`safety_policies`；隐私表族：`consents`、`erasure_requests`、`export_requests`；IRT 表族：`irt_item_params`（含 source 枚举与 version）、`irt_experiments`、`ability_history`。
- item_bank 扩展 [规划 TRN-001]：加列不重建（initial/final/tone/speaker/speech_rate/noise_type/snr_db/distractors/answer/review_status）。
- Redis：验证码（hash 化 [规划 PRIV-005]）、对话上下文、限流、ARQ；非持久主存储。
- OSS：`audio/{user_id}/{date}/…` 用户隔离 [存在]；知识文档原件隔离桶/前缀 [规划 KB-003]。

## 3. 数据流

### 3.1 训练（存在，保持）

FE → POST /api/training/sessions → TrainingService（读 user_abilities.theta）→ IRTEngine 选题 → 作答 → 判定 + EAP 更新 + 升降级规则（连续 3 次 ≥80% 升 / <60% 降，产品规则非医学规律）→ 持久化 → 报告。

### 3.2 对话（存在，安全升级 [规划]）

FE 录音 → ASR → **Query Classifier（新）** → 高风险：拒答/转诊模板；一般：LLM（Redis 上下文）→ **Unsafe Answer Blocker（缓冲后检，新）** → TTS → FE。全部拦截落 safety_events。

### 3.3 教育问答 RAG [规划]

用户问题 → Query Classifier（医疗高风险直接转诊）→ Retrieval（Hybrid：pgvector + FTS → metadata filter[approved/未过期/license] → RRF → Rerank）→ Context Builder（含引用槽位）→ LLM 生成 → Citation Validation（引用必须来自检索结果）→ Blocker 输出检查 → 回答 + citations[]；无可靠依据 → 明确"知识库未找到依据"+ 建议咨询听力师。

### 3.4 Ingestion [规划]

管理后台上传/登记来源 → Source Registry（license/provenance 校验）→ Document Version（hash 去重）→ Parser（按 content-type 路由到 PDF/HTML/Markdown/DOCX 实现，统一 Contract）→ Clean/Normalize → Dedup → Semantic Chunking → Embedding（批量）→ 写入 kb_chunks（review_status=pending）→ 专家审查 approved 后可检索。

### 3.5 隐私数据流 [规划]

注册/首次录音 → Consent 记录（版本化、单独同意）→ D 类数据仅入业务表/隔离存储 → 导出（本人数据打包）/删除（级联 + OSS 对象 + 审计留存删除证明）/Retention 到期清理 → 脱敏管道（离线分析专用，永不回写向量库）。

## 4. 横切关注点

- **安全**：core/security.py（JWT）[存在]、限流中间件 [存在]、RBAC 扩展 [规划]、Secret 全走环境变量 [存在，Task 10 已外部化]。
- **医学安全**：见 `.qoder/rules/70-medical-safety.md`；统一 safety 服务层，关键词表仅作为其中一层实现。
- **可观测性**：/api/health、/api/health/detailed、/api/metrics{,/ai-latency,/errors} [存在]；规划：结构化日志统一（OBS-001）、RAG/安全指标与告警（OBS-002/003）。
- **部署**：docker-compose（本地/单机）、deploy/serverless.yml（FC）、nginx-production.conf、CI 构建推送镜像 [存在]；规划：CI 加迁移门禁与覆盖率阈值（OPS-001）、部署冒烟与回滚演练（OPS-002）。

## 5. 架构验证点（Review/Verify 时核对）

1. api 层无业务逻辑、无直连 ORM 查询新增（存量 ARCH-01 债除外，只减不增）。
2. services 无 dashscope/oss2 直连；AI 全走 gateway。
3. 向量表无 D 类数据写入路径（隔离守卫 + 测试）。
4. LLM 生成路径全部经过 classifier + blocker。
5. 新表全部经 Alembic 迁移且 downgrade 可用。
6. 前端无绕过 services 的裸 axios；无 import deprecated store。
