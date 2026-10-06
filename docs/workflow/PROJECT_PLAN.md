# PROJECT_PLAN — ai-hearing-rehabilitation 总体项目计划

> 版本 v1.0（2026-10-06，Max/Chief Architect 基于真实仓库核实编制）
> 权威任务清单见 `TASK_CATALOG.md`；里程碑见 `MILESTONES.md`；决策记录见 `DECISIONS.md`。

## 1. Current State（真实仓库基线，非历史文档）

### 已实现（代码存在于仓库）

- **后端**（FastAPI，~85 个 Python 文件）：短信验证码登录 + JWT httpOnly Cookie（auth）、四级听觉训练 + IRT 2PL EAP 引擎（`services/irt_engine.py`）+ BKT 引擎（`ai/adaptive_engine.py`）、场景对话陪练（ASR→LLM→TTS 编排 + Redis 上下文 + 关键词安全护栏）、发音评估（DTW 音素对齐 `pronunciation_scorer.py`）、报告/听力师患者列表/ARQ 周报任务、健康检查与 Prometheus 风格指标、性能/监控/限流中间件、硬件模块（ESP32，实验性）。
- **前端**（React 18 + Vite + MUI + Tailwind，~60 个文件）：登录/训练/对话/发音/报告/设置页面、无障碍体系（a11yStore、大字模式、语音引导）、录音/播放 hooks、ECharts 图表、6 个 vitest 测试文件 + playwright E2E。
- **数据**：Alembic 迁移链 001_init_tables → 002_seed_items；9 张业务表；item_bank 种子脚本。
- **工程**：GitHub Actions CI（后端 ruff+pytest+coverage、postgres 集成 job、前端 typecheck/lint/test/build/E2E、Docker 构建推送、FC 部署）；docker-compose（frontend/backend/postgres15/redis7）；deploy/serverless.yml + nginx 配置；docs/runbook.md。
- **质量历史**：TODO.md 记录 P0×5、P1×6 修复完成（Redis decode、useRecorder、训练 API 认证、Alembic downgrade、健康检查状态码、IDOR、流式安全、httpOnly Cookie、DEBUG 默认值、Docker 密码外部化、验证码 secrets）；架构债评估 14 项（其中 ARCH-04/ARCH-12 经核实疑似已修复：`core/safety.py`、`ai/retry.py` 已存在）。

### 关键缺口（经仓库核实为"不存在"）

1. **知识库/RAG 完全缺失**：无 pgvector、无向量表、无 Parser/Chunking/Embedding/检索/引用代码（grep 全仓库无 pgvector/vector 引用；`models/knowledge_state.py` 是 BKT 用户知识状态，与知识库无关）。
2. **医学安全体系初级**：仅关键词表（core/safety.py + llm_gateway），无 Risk Taxonomy、Query Classifier、安全事件审计、医疗安全评测集。
3. **隐私合规缺口**：users.consent_flags 字段存在，但无 Consent 管理、删除路径、导出路径、Retention、脱敏管道。
4. **训练内容单薄**：item_bank 仅 level/content_type/text/phonemes/difficulty_b/tags；缺 initial/final/tone/speaker/speech_rate/noise_type/snr_db/distractors/review_status 等字段；发音题库硬编码 10 条于 Service（ARCH-06）。
5. **IRT 参数无校准来源追溯**：difficulty_b 为种子值（默认 0.0），无 INITIAL_HEURISTIC/EXPERT_ESTIMATE/PILOT_ESTIMATE/CALIBRATED 区分，无校准管道与实验日志。
6. **后台缺失**：无知识管理后台、无专家审查工作流、听力师后台仅患者列表级别；RBAC 仅 patient/therapist。
7. **验证缺口**：TODO.md 中集成测试、安全审查、性能测试三项**未勾选**；ASR>85%、评分<2s、对话<3s 等指标无当前有效证据。
8. **工程卫生**：根目录遗留杂物（temp_fix.py、test_output*.txt、nul、fix_syntax.py 等）；git 当前 master + 未跟踪 .qoder/（会触发 Workflow BLOCKED_DIRTY_MAIN）。

## 2. Target State（项目完成定义）

一个可上线的听觉康复训练与健康教育辅助工具，具备：

1. 稳定通过全部基线验证（测试/构建/迁移/集成/安全/性能/部署）的既有四大模块（训练、对话、发音、报告）。
2. 医学教育知识库（A 类）完整管道：Source Registry → 版本化文档 → 多格式 Parser → 清洗/去重/语义分块 → Embedding → pgvector；专家审查通过（approved）才可检索；回答带可验证引用；D 类用户数据与公共向量库物理+逻辑双隔离并有回归测试。
3. 结构化训练内容体系：完整字段 Schema（音素/声母/韵母/声调/音节/词/句/场景/说话人/语速/噪声/SNR/干扰项/难度/审查状态），覆盖电话与噪声场景训练；内容管理后台 + review_status 工作流。
4. IRT 自适应体系可信：参数来源四级追溯，真实作答数据校准管道，能力估计持久化使用，选题与升降级规则有实验日志支撑。
5. 医学安全引擎：Risk Taxonomy + Query Classifier + Safety Policy + Emergency Route + Unsafe Answer Blocker + 安全事件审计 + 医疗安全评测集回归全绿。
6. 隐私合规：Consent 版本化管理、数据删除/导出路径、Retention 清理、日志脱敏、健康语音隔离审计。
7. 三类角色后台：患者端（含教育问答 UI）、听力师端、知识管理员/专家端；RBAC 完整权限测试。
8. 评测与可观测性：ASR/发音评分/自适应阈值/噪声语速鲁棒性四类评测报告；结构化日志、指标、告警；RAG 与安全线上监控。
9. 生产就绪：安全审查无 blocking、性能达标有证据、CI/CD 含迁移门禁、部署冒烟与回滚演练通过、Release Gate PROJECT_READY。

## 3. Scope / Non-Scope

### In Scope（本计划覆盖）

- 既有模块稳定化与架构债清偿（M1）。
- 知识库/RAG 全链路（M2–M4）、训练内容体系（M5）、IRT 校准（M6）、医学安全与隐私（M7）、患者 UI 与三类后台（M8）、评测与可观测性（M9）、生产就绪（M10）。

### Out of Scope（远期，禁止塞入 MVP/P0）

- 语音克隆（Fun-CosyVoice3）、人工耳蜗设备数据对接、助听器集成、HIS/电子病历集成、医嘱解析、模型微调（ASR/TTS）、脱敏数据集平台化、微信小程序原生版、多语言（仅普通话优先）、ESP32 硬件新功能。
- 一切医疗器械注册/认证活动（产品定位为非医疗器械）。

## 4. MVP 定义

**MVP = M0 + M1（P0/P1 债）+ M2 + M3（Markdown/HTML/PDF 解析）+ M4（核心检索+引用）+ M5（Schema 扩展+核心内容）+ M7（安全与隐私 P0 项）+ M8（患者教育问答 UI + RBAC）+ M9（评测基线）+ M10（Release Gate）。**

MVP 验收（全部须有当前有效证据）：

1. 四大既有模块回归全绿（后端全测 + 前端测试/构建 + 集成 + E2E 冒烟）。
2. 用户可完成：登录 → 训练（自适应升降级）→ 对话 → 发音评分 → 查看报告。
3. 用户可进行健康教育问答，回答带真实引用；未审查/过期内容不可检索；无依据时明确拒答。
4. 医疗安全评测集回归通过；高风险问题 100% 走拒答/转诊路径。
5. 用户数据可删除、可导出；D 类数据隔离测试通过；日志无敏感信息。
6. clean migration up/down/up、docker compose build、部署冒烟四路径、回滚路径全部通过。

## 5. 优先级定义

- **P0（上线阻断）**：不做就不能上线——基线验证、安全/隐私/医疗安全核心、数据隔离、迁移完整性、发布证据链。
- **P1（上线前应完成）**：显著影响质量与运营——架构债清偿、IRT 校准、内容管理后台、可观测性、评测完善、混合检索增强。
- **P2（增强）**：上线后迭代——Reranker 调优、DOCX 解析、成就系统、报告推送、语音克隆等远期项。

## 6. 架构与开发策略

- 架构策略见 `ARCHITECTURE.md`：单体分层冻结、pgvector 同库、训练与 RAG 分离、A/B/C/D 数据分级隔离。
- 开发策略：**全部任务经 `project-feature-delivery` Workflow 单任务交付**（Max 规划/验收 + Flash 实施 + Machine Gate 裁判）；串行主链 + 并行组（见 `TASK_CATALOG.md` DAG）；Schema → Service → API → UI 顺序；Parser Contract 冻结后多 Parser 并行（可 Worktree 隔离）。
- 每任务 0.5~1.5 开发日，无 Mega Task；执行前先跑 M0 基线，禁止按历史 `[x]` 假定通过。

## 7. 里程碑概览（详见 MILESTONES.md）

M0 Repository Truth & Baseline → M1 Architecture Stabilization → M2 Knowledge Core → M3 Knowledge Ingestion → M4 Retrieval & RAG → M5 Rehabilitation Training Content → M6 IRT & Adaptive Training → M7 Medical Safety & Privacy → M8 Patient UI & Admin/Audiologist → M9 Evaluation & Observability → M10 Production Readiness。

## 8. Critical Path

```
M0-001..008（基线）
→ KB-001 pgvector Schema → KB-002/003/004 Source/Doc/Chunk
→ ING-001 Parser Contract → ING-002/003 Parser 实现（并行）→ ING-005/006/007 清洗/去重/分块
→ ING-008 Embedding → ING-009 Ingestion 编排
→ RAG-001 向量检索 → RAG-004 Hybrid+RRF → RAG-006 Context Builder → RAG-007 Orchestrator
→ RAG-008 Citation → RAG-010 教育问答 API → UI-001 患者问答页
→ EVAL-005 RAG 评测 → OPS-004 Release Gate
（并行主线：SAFE-001..006 医疗安全、PRIV-001..007 隐私、TRN/IRT 训练线、ADMIN 后台线）
```

最长链约 25 个串行任务；SAFE/PRIV/TRN/IRT/ADMIN 与知识线并行推进以压缩总工期。

## 9. Major Risks

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R1 | 基线本身是红的（集成/安全/性能从未验证通过），M0 可能暴露大量存量缺陷 | 高 | M0 如实记录，缺陷立 P0 bugfix 任务插入 M1 前；不放水门禁 |
| R2 | ASR 对老年/人工耳蜗用户语音准确率不达 85% 目标 | 高 | EVAL-001 尽早跑；不达标走热词表/音频前处理/模型参数任务；禁止改指标定义 |
| R3 | 知识库内容版权/来源不合规 | 高 | Source Registry 强制 license/provenance 字段；无授权内容不得入库（KB-005） |
| R4 | 医学安全关键词方案被多轮对话/注入绕过 | 高 | SAFE-001/002 分类器+策略引擎替代纯关键词；SAFE-006 评测集含绕过用例 |
| R5 | IRT 校准需要真实作答数据，上线前数据不足 | 中 | 参数来源四级标注；先 EXPERT_ESTIMATE，上线后 PILOT→CALIBRATED 迭代（IRT-002/005） |
| R6 | pgvector 在 sqlite 测试环境不可用，测试策略复杂 | 中 | 集成测试用 postgres+pgvector 容器；单测 mock 检索层；缺环境时 BLOCKED_MISSING_SAFE_TEST_ENV |
| R7 | master + dirty 导致 Workflow 全部 BLOCKED_DIRTY_MAIN | 中 | 人工先提交治理文件并切 feature 分支（见"需人工决定事项"） |
| R8 | 单人/小团队多线并行合并冲突 | 中 | 严格按 DAG 排程；并行组用 git worktree；合并顺序 Schema→Service→API→UI |
| R9 | 发音评分对构音差异用户效度不足 | 中 | EVAL-002 覆盖构音差异样本；文案禁止病理化（70-medical-safety） |
| R10 | dashscope 配额/流式能力限制影响对话与评测 | 低 | 网关降级策略已有；评测排期避开配额瓶颈；预留实例方案在 deploy/serverless.yml |

## 10. 需人工决定事项（Agent 无权代决）

1. **Git 工作流**：master 上存在未跟踪 `.qoder/`；运行 Workflow 前须人工提交治理文件（AGENTS.md、.qoder/rules、.qoder/workflows、docs/workflow）并决定分支策略（建议 feature 分支交付）。Agent 不执行 commit/push。
2. 知识库首批内容来源与版权授权清单（购买/合作/自编）。
3. 专家审查人选与审查标准（医学顾问资质）。
4. 评测集语音样本采集授权（老年/人工耳蜗用户录音的伦理与 consent）。
5. 根目录遗留杂物文件（temp_fix.py、nul、test_output*.txt 等）是否清理。
6. 生产环境密钥注入方式与部署账号（FC/OSS/CR 凭据）。
7. 覆盖率阈值具体数值（OPS-001 提案后批准）。
