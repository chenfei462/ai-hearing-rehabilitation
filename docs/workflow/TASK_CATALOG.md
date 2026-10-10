# TASK_CATALOG — 原子任务清单与 DAG（唯一权威）

> v1.0（2026-10-06，Max 编制）。编制时全部任务 Status=BACKLOG（2026-10-11 事实同步：M0-001~M0-008 已经 Workflow 真实执行判定为 TASK_PASS，见下表 Status 列；其余里程碑任务仍为 BACKLOG）；执行方式：逐个调用
> `project-feature-delivery` Workflow（task 模式）。每任务 0.5~1.5 开发日，无 Mega Task。
> Implementation Model 统一为：**Flash(qfmodel) 实施 + Max(qmodel_38max) SPEC/Review/Verify**；Flash 无 PASS 权。
> Gate 基线（所有任务默认）：Machine Gate 真实命令 exitCode=0 + Max Review PASS + Max Verify TASK_PASS；
> 下表 Gate Requirements 列出该任务的**附加必跑门禁**。
> 优先级：P0=上线阻断，P1=上线前应完成，P2=增强（上线后迭代）。
> 依赖为硬依赖（DAG 无环）；"并行组"标注可同批 Worktree 并行。

## 汇总

- 任务总数：**92**（M0:8, M1:8, M2:7, M3:10, M4:10, M5:7, M6:6, M7:14, M8:7, M9:8, M10:7）
- 计数口径：上述 92/49/33/10 指**原编号任务**；Workflow 运行产生并追加于「M0 缺陷修复附录」的 `FIX-*` 任务不改变该计数、不改变任何既有任务 ID、不参与上方 DAG 重排。
- P0：**49**，P1：**33**，P2：**10**
- 第一个应执行任务：**M0-001**（前置：人工提交治理文件并切 feature 分支，见 PROJECT_PLAN §10）
- Critical Path：M0-001→M0-004→KB-001→KB-002→KB-003→KB-004→ING-001→ING-005→ING-007→ING-008→ING-009→RAG-001→RAG-003→RAG-006→RAG-007→RAG-008→RAG-010→UI-001→EVAL-005→OPS-004（约 20 个串行节点）

## M0 — Repository Truth & Baseline（只收集证据与文档，不做功能开发）

| ID | Title | Milestone | Pri | Deps | Objective/验收目标 | Size | Risk | Impl Model | Gate Requirements | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| M0-001 | 仓库清单与真相基线文档 | M0 | P0 | — | 产出 `deliverables/baseline/REPO_INVENTORY.md`（注意：基线产物一律落 `deliverables/baseline/`，禁止写入治理保护区 `docs/workflow/**`）：真实模块/文件/命令清单（后端测试、前端构建、lint、迁移、集成、E2E、docker），标注与 README/system_design 的差异；验收=清单中每条命令真实存在且被实际执行记录 exitCode | 0.5d | low | Flash+Max | 命令发现产物复核；禁止假设命令 | **TASK_PASS** `abc6a78` |
| M0-002 | 后端测试基线 | M0 | P0 | M0-001 | 全量 `python -m pytest -q` + `ruff check app/` 在本地跑通并记录结果到 `deliverables/baseline/BACKEND_TEST_BASELINE.md`（通过数/失败数/跳过数/覆盖率）；失败项如实列出并生成缺陷清单（不修复） | 0.5d | med | Flash+Max | pytest+ruff exitCode 记录；失败不掩盖 | **TASK_PASS** `7be3c50` |
| M0-003 | 前端构建基线 | M0 | P0 | M0-001 | `npx tsc --noEmit`、`npm run lint`、`npm test -- --run`、`npm run build`、`npm run test:e2e` 全量执行并记录到 `deliverables/baseline/FRONTEND_BASELINE.md`；失败项如实列出 | 0.5d | med | Flash+Max | 五条命令 exitCode 记录 | **TASK_PASS** `f73cb01` |
| M0-004 | API/DB/迁移基线 | M0 | P0 | M0-001 | clean DB 上 `alembic upgrade head`→`downgrade base`→`upgrade head` 验证；盘点全部 API 端点与 docs/api-reference.md 对照；记录到 `deliverables/baseline/DB_API_BASELINE.md` | 1d | med | Flash+Max | 迁移三连 exitCode=0；端点清单完整 | **TASK_PASS** `a78b10f` |
| M0-005 | 集成测试基线 | M0 | P0 | M0-002,M0-004 | postgres+redis 环境跑 `pytest tests/test_integration.py tests/test_training_api.py tests/test_role_permissions.py -q`（CI 同款）并记录；TODO.md 未勾选项在此给出当前真实结论 | 1d | high | Flash+Max | 集成命令 exitCode；安全测试环境缺失→BLOCKED_MISSING_SAFE_TEST_ENV | **TASK_PASS** `317341b` |
| M0-006 | 安全基线 | M0 | P0 | M0-002 | 只读审查：认证/RBAC 覆盖矩阵（每端点 auth+归属校验）、Secret 管理（.env gitignore、无硬编码）、CORS/Cookie/DEBUG 生产配置、日志脱敏抽查；产出 `deliverables/baseline/SECURITY_BASELINE.md` 缺陷清单（P0/P1 分级，不修复） | 1d | high | Max 主导+Flash 执行命令 | 审查证据含文件:行号；禁止输出 Secret 值 | **TASK_PASS** `8c81df5` |
| M0-007 | 性能基线 | M0 | P0 | M0-005 | 运行 `pytest tests/test_performance.py -v` 记录现状；对 ASR/对话/发音三条链路做本地延迟采样（mock 与真实各一组，若配额允许）；产出 `deliverables/baseline/PERF_BASELINE.md`（对照目标：ASR 首包<500ms、对话<3s、评分<2s） | 1d | med | Flash+Max | 性能命令 exitCode；数据如实记录不达标也不改目标 | **TASK_PASS** `7dcf2f8`（F-01 经 `FIX-PERF-03` `227295d` 闭合） |
| M0-008 | 部署基线 | M0 | P0 | M0-003,M0-004 | `docker compose build` 成功；docker-compose.yml/deploy/serverless.yml/nginx 配置与 .env.example 环境变量引用完整性核对；产出 `deliverables/baseline/DEPLOY_BASELINE.md`；不执行真实云部署 | 1d | med | Flash+Max | docker build exitCode=0；Secret 值零输出 | **TASK_PASS** `ed36481`（**本行门禁口径仍待裁决**：该 `docker build exitCode=0` 在本仓库路径下结构性不可达，见 HD-N-09；任务 TASK_PASS 的依据是该命令真实 exitCode=1 以 record 层原样入账、未降级未绕过） |

> M0 暴露的存量缺陷：由 Max 按 P0/P1 定级，插入为 `FIX-*` 临时任务（同规格进 Catalog 附录），在 M1 完成前清偿 P0 缺陷。并行组 PG-A：M0-002/003/004 可并行。

**M0 基线 DAG 状态：8/8 TASK_PASS（M0-001 `abc6a78` / 002 `7be3c50` / 003 `f73cb01` / 004 `a78b10f` / 005 `317341b` / 006 `8c81df5` / 007 `7dcf2f8` / 008 `ed36481`）。**
**M0 Milestone Gate = `NOT_ENTERED`** —— 依人工指令，在 HD-N-05（基线文档 8 vs 7 口径）、HD-N-09（`docker build` 结构性不可达）、HD-N-10（宿主 `:5432` 数据库归属）、HD-N-14（lint 门禁分层追认）四项裁决落地前，即便 8/8 已封存且本表已同步，也**不得**进入 M0 Milestone Gate，更不得进入 M1。
**基线产物交付口径**：`REPO_INVENTORY.md`/`BACKEND_TEST_BASELINE.md`（001/002）、`FRONTEND_BASELINE.md`（003）、`DB_API_BASELINE.md`（004）、`INTEGRATION_BASELINE.md`（005）、`SECURITY_BASELINE.md`（006）、`PERF_BASELINE.md`（007）、`DEPLOY_BASELINE.md`（008）——产物落 `deliverables/baseline/` 的份数口径即 HD-N-05，本表不自行判定。

### M0 缺陷修复附录（Workflow 运行产生；不改变既有任务 ID，不参与上方 DAG）

| ID | Title | Source 缺陷 | 终态 | Commit / 状态 | 如实说明 |
|---|---|---|---|---|---|
| FIX-TEST-FLAKE-001 | 消除 `test_full_adaptive_session` 的未播种随机性，使全量套件成为确定性 required 门禁 | F-13（P2→P1，人工已定级）| **TASK_PASS** | `a41ac70` | 五判据齐备：Machine Gate required 12/12 exit 0 ∧ 独立 Review PASS ∧ Verify TASK_PASS ∧ Task Delta（`taskChanged=["backend/tests/test_adaptive_engine.py"]`）∧ Governance Guard 零改动；负向自证基线 12/100 → 100/100；测试侧 monkeypatch，`backend/app/**` 零改动、生产默认 RNG 未被固定、无 skip/xfail/retry/sleep。**F-13 自此 CLEARED**。 |
| FIX-PERF-03 | 性能用例只在真实成功路径上计量 | F-44 / F-01 | **TASK_PASS** | `227295d` | Machine Gate required 7/7 ∧ HIGH 双独立 Review A+B 均 PASS ∧ Verify TASK_PASS ∧ Task Delta（`RETRY_OWNED_APPLIED`）∧ Governance Guard；**F-01 自此 CLOSED**；阈值与样本数逐字节未改。 |
| FIX-GOV-008 | 加固机器门禁命令证据链（D4-2 argv 自回显 + 脚本侧独立重算逐字符比对）| F-60 | **SEALED / PASS-WITH-HD-N-15-BOOTSTRAP-AUTHORIZATION** | `31c53df` | **非标准五判据 TASK_PASS**：`FORMAL_TASK_DELTA_VERDICT=NOT_ISSUED_DUE_TO_F61`、`FORMAL_GOVERNANCE_GUARD_VERDICT=NOT_PASSABLE_BY_CURRENT_DESIGN_F61`、`ASSURANCE_OVERRIDE=HUMAN_BOOTSTRAP_AUTHORIZATION_HD_N_15`。保证来源 = 人工对这一次、仅这一次的 bootstrap 封存授权（HD-N-15 甲）+ 机器证据现场重跑（required 10/10、回归 122/122、`OLD_SCENARIO_COUNT=106` 与 digest 未变、§8 七类逐字性攻击行为逐条 BLOCK、Reviewer A/B + Verifier 结论经字节哈希一致后复用）。本表**不**为其伪造 `TASK_DELTA_PASS`/`GOVERNANCE_GUARD_PASS`。 |
| FIX-GOV-009 | Human-authorized governance write-set protocol（为 F-61 建合法治理写入通道）| F-61 | **BACKLOG_REQUIRES_HUMAN_AUTHORIZATION** | 未派发、零代码 | 本夜仅登记。禁止简单关闭 Governance Guard；未来设计最小集（taskType 显式分类、humanAuthorizationId 非空可核对、精确路径白名单、禁通配符、禁目录级隐式授权、diff ⊆ 授权集、治理回归必跑、独立 Review、独立 Verify、授权不可由 Worker 自行生成）见 `deliverables/overnight/TASK_LEDGER.json.pendingFixTasks['FIX-GOV-009']`。 |

**F-61 状态 = `OPEN`（`NOT_FIXED_BY_FIX-GOV-008`）**：FIX-GOV-008 封存的是证据强度，未给 `classifyDelta` 开人工授权集通道；结构性缺口仍在，由 FIX-GOV-009 承载。
**封存过程中如实新增的两条低危观察（本轮不改，避免破坏 §10 字节一致性要求）**：`F-62` = 新写的披露文字沿用修复前行号自引用（`:419` 引 `:307/:319`、`:2664` 引 `:308`，实测真实锚点为 `norm` `:400` / `commandVerbatim` `:401`）；`F-63` = `G-GOV-HARNESS-STATIC` 名不副实（`check` 在 `dryrun-harness.mjs:75` 即退出，`:78-88` 禁用 API 扫描不可达，实质由 `G-GOV-NO-FORBIDDEN-API-IN-DIFF` 承担）。
**`PROJECT_BASELINE_HEALTH` 仍为 `DEGRADED`**：全量 `ruff check app/` 有既有告警债（本轮以 record 层真实 exitCode=1 原样入账，未降级、未绕过）。

## M1 — Architecture Stabilization（架构债清偿，执行前 Explore 必须复核债项现状）

| ID | Title | Milestone | Pri | Deps | Objective/验收目标 | Size | Risk | Impl Model | Gate Requirements | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| ARCH-001 | 统一响应格式与异常链 | M1 | P1 | M0-002 | 消除 `schemas/common.py` 与 `schemas/response.py` 双轨（ARCH-05）：统一 success/error_response + AppException；验收=全部 API 单测通过且响应结构一致，双轨只剩单一来源 | 1d | med | Flash+Max | pytest 全量+ruff；API 回归 | BACKLOG |
| ARCH-002 | 拆分 ReportService | M1 | P1 | ARCH-001 | 按 ARCH-02 拆为 UserReportService/TherapistService/StatisticsService；验收=原 report API 行为不变（既有 test_report.py 全绿）+新单测覆盖拆分后服务 | 1.5d | med | Flash+Max | pytest（含 test_report）+ruff | BACKLOG |
| ARCH-003 | 拆分 DialogueService | M1 | P1 | ARCH-001 | 按 ARCH-03 提取 SafetyGuard（并入 core/safety 体系）、DialogueContextManager、场景配置外移；handle_turn 行为不变；验收=test_dialogue_* 全绿+新单测 | 1.5d | high | Flash+Max | pytest+医疗安全回归（test_safety） | BACKLOG |
| ARCH-004 | API 层 ORM 直访治理 | M1 | P2 | ARCH-002 | deps.py/auth/dialogue/report 的 User 直查收敛到 AuthService.get_user_by_id（ARCH-01）；验收=api 层无新增 ORM 查询，auth 回归绿 | 0.5d | low | Flash+Max | pytest+ruff | BACKLOG |
| ARCH-005 | AI 网关依赖注入 | M1 | P2 | M0-002 | 提供 AIServiceProvider 工厂/Depends 覆盖机制（ARCH-09），保留全局单例默认；验收=测试可无 monkeypatch 替换网关，test_ai_gateways 绿 | 1.5d | med | Flash+Max | pytest+ruff | BACKLOG |
| ARCH-006 | 前端 Store 清理 | M1 | P2 | M0-003 | 删除 deprecated `useAppStore.ts`，合并 appStore/authStore 重复 user 状态，明确 sessionStore 边界（ARCH-07/08）；验收=前端 test+build 绿，无 import deprecated | 1d | med | Flash+Max | tsc+lint+vitest+build | BACKLOG |
| ARCH-007 | 发音题库迁移数据库 | M1 | P1 | M0-004 | PRONUNCIATION_TASKS 硬编码迁入 item_bank（module 字段或独立表）+种子迁移+Service 改查库（ARCH-06）；验收=迁移 up/down/up 通过，发音 API 回归绿，硬编码列表删除 | 1d | med | Flash+Max | alembic 三连+pytest（test_pronunciation） | BACKLOG |
| ARCH-008 | 小型清理集 | M1 | P2 | M0-002,M0-003 | CORS 用 settings.CORS_ORIGINS（ARCH-10）、dead import 清理（ARCH-11）、AI 异常移 exceptions.py（ARCH-13）、前端 report 类型收敛 types/（ARCH-14）；验收=lint/tsc 零警告，相关测试绿 | 0.5d | low | Flash+Max | ruff+pytest+tsc+lint | BACKLOG |

> 并行组 PG-B：ARCH-002/ARCH-003 完成后可与 ARCH-006（前端）并行；ARCH-001 先行（触碰 api 面广）。ARCH-04/12 疑似已修复（core/safety.py、ai/retry.py 存在），Explore 复核后若确认修复则该项从 SPEC 剔除。

## M2 — Knowledge Core（知识库数据核心）

| ID | Title | Milestone | Pri | Deps | Objective/验收目标 | Size | Risk | Impl Model | Gate Requirements | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| KB-001 | pgvector 扩展与向量 Schema 迁移 | M2 | P0 | M0-004 | 引入 pgvector（docker/CI 镜像带扩展）、`kb_chunks.embedding vector(N)` + HNSW 索引迁移；验收=clean up/down/up 通过，向量插入/相似度查询集成测试绿 | 1d | med | Flash+Max | alembic 三连+pg 集成测试；sqlite 不可用项记 skippedGates | BACKLOG |
| KB-002 | Source Registry | M2 | P0 | KB-001 | `kb_sources` 表+服务：来源登记（name/type/license/copyright_holder/provenance/url/授权状态）；验收=无 license 记录不得创建文档（服务层强制+测试） | 1d | med | Flash+Max | pytest+alembic | BACKLOG |
| KB-003 | 文档与版本模型 | M2 | P0 | KB-002 | `kb_documents`/`kb_document_versions`（content hash、版本链、原件 OSS 隔离前缀）；验收=同 hash 重复上传产生新 version 而非重复 document，测试覆盖 | 1d | med | Flash+Max | pytest+alembic | BACKLOG |
| KB-004 | Chunk Schema 与存储 | M2 | P0 | KB-003 | `kb_chunks`：doc_version_id/position/heading/text/embedding/embedding_model/embedding_version/review_status/valid_from/valid_until/metadata；验收=Schema 迁移+CRUD 测试 | 1d | med | Flash+Max | pytest+alembic | BACKLOG |
| KB-005 | License/Copyright 与 Provenance 校验 | M2 | P0 | KB-002 | 入库管道强制校验 license 白名单与 provenance 完整性；验收=缺 provenance/无授权内容入库被拒（测试） | 0.5d | high | Flash+Max | pytest | BACKLOG |
| KB-006 | Review Status 工作流 | M2 | P0 | KB-003 | draft→in_review→approved/rejected→expired/superseded 状态机+`kb_review_events` 审计；验收=状态迁移合法性测试，非法迁移被拒 | 1d | med | Flash+Max | pytest+alembic | BACKLOG |
| KB-007 | A/B/C/D 数据隔离守卫 | M2 | P0 | KB-004 | 服务层守卫+DB 约束：D 类（用户数据）写入 kb_* 表的路径不存在且被测试证伪；B 类题库不入向量库；C 类 prompt/关键词不入语料；验收=隔离回归测试全绿（含恶意路径用例） | 1d | high | Flash+Max | pytest 隔离专项+全量回归 | BACKLOG |

## M3 — Knowledge Ingestion（摄取管道）

| ID | Title | Milestone | Pri | Deps | Objective/验收目标 | Size | Risk | Impl Model | Gate Requirements | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| ING-001 | Parser Contract 定义 | M3 | P0 | KB-004 | 统一 Parser 接口（输入 bytes+mime→输出 normalized text+结构元数据+定位信息）+契约测试基类；验收=contract 文档+基类测试，冻结后多 Parser 可并行 | 0.5d | low | Flash+Max | pytest（contract 测试） | BACKLOG |
| ING-002 | Markdown/HTML Parser | M3 | P0 | ING-001 | 两种格式实现 Contract：标题层级/列表/表格提取、HTML 去标签防注入；验收=契约测试+样本文件测试 | 1d | low | Flash+Max | pytest | BACKLOG |
| ING-003 | PDF Parser | M3 | P0 | ING-001 | PDF 文本+页码定位提取（选型在 SPEC 内论证，倾向 pypdf/pdfplumber 轻量栈）；验收=契约测试+多类型 PDF 样本（含中文）测试 | 1.5d | med | Flash+Max | pytest；新依赖须 SPEC 声明 | BACKLOG |
| ING-004 | DOCX Parser | M3 | P2 | ING-001 | DOCX 实现 Contract；验收=契约测试 | 1d | low | Flash+Max | pytest | BACKLOG |
| ING-005 | Cleaner/Normalizer | M3 | P0 | ING-001 | 去噪、繁简归一、全半角、Unicode NFC、空白规整；验收=纯函数单测覆盖边界（空输入/超长/混合编码） | 1d | low | Flash+Max | pytest+ruff | BACKLOG |
| ING-006 | Deduplication | M3 | P1 | KB-003 | 内容 hash 精确去重+近重检测（simhash/minhash 择一，SPEC 论证）；验收=重复与近重样本测试 | 0.5d | low | Flash+Max | pytest | BACKLOG |
| ING-007 | Semantic Chunking | M3 | P0 | ING-005 | 结构感知分段（标题/段落/长度上限/重叠），chunk 携带 position/heading；验收=中文医学文档样本分块质量测试（边界不断句、元数据完整） | 1.5d | med | Flash+Max | pytest | BACKLOG |
| ING-008 | Embedding Provider 与批处理 | M3 | P0 | KB-004 | `ai/embedding_gateway.py`：dashscope text-embedding 封装、批量、限流重试（复用 ai/retry）、记录 model+version+维度；验收=mock 测试+批量语义正确性 | 1d | med | Flash+Max | pytest；真实调用仅评测环境 | BACKLOG |
| ING-009 | Ingestion 编排管道 | M3 | P0 | ING-002,ING-003,ING-007,ING-008 | parse→clean→dedup→chunk→embed→写库(pending) 端到端管道+失败断点续跑；验收=端到端测试（样本文件入库，review_status=pending，全链路元数据完整） | 1.5d | high | Flash+Max | pytest 端到端+alembic | BACKLOG |
| ING-010 | 版本/过期/Reindex | M3 | P1 | ING-009 | 文档更新→新 version→旧 chunk superseded 排除；valid_until 过期排除；reindex 幂等任务（ARQ）；验收=更新/过期/重建三场景测试 | 1d | med | Flash+Max | pytest | BACKLOG |

> 并行组 PG-C：ING-002/ING-003/ING-004 在 Contract 冻结后并行（Worktree）；ING-005/006 与之并行。

## M4 — Retrieval & RAG

| ID | Title | Milestone | Pri | Deps | Objective/验收目标 | Size | Risk | Impl Model | Gate Requirements | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| RAG-001 | pgvector 向量检索 | M4 | P0 | ING-008 | 相似度检索服务（top-k、距离度量、索引命中）；验收=检索集成测试（pg 环境） | 1d | med | Flash+Max | pg 集成测试 | BACKLOG |
| RAG-002 | PostgreSQL 全文检索 | M4 | P1 | KB-004 | 中文 FTS 方案（zhparser 或 bigram/tsvector 配置，SPEC 论证）；验收=中文检索测试 | 0.5d | med | Flash+Max | pg 集成测试；扩展不可用→skippedGates+替代方案 | BACKLOG |
| RAG-003 | Metadata Filter | M4 | P0 | RAG-001,KB-006 | 检索强制过滤 review_status=approved、未过期、license 允许；验收=unapproved/expired/unlicensed exclusion 回归测试（Gate 必跑） | 0.5d | high | Flash+Max | exclusion 专项测试 | BACKLOG |
| RAG-004 | Hybrid Search + RRF | M4 | P1 | RAG-001,RAG-002,RAG-003 | 向量+FTS 融合（RRF）；验收=融合排序优于单路的样本测试 | 1d | med | Flash+Max | pytest | BACKLOG |
| RAG-005 | Reranker | M4 | P2 | RAG-004 | 重排（dashscope rerank 或轻量交叉编码，SPEC 论证成本）；验收=评测集 MRR 提升证据 | 1d | med | Flash+Max | pytest+RAG-009 评测 | BACKLOG |
| RAG-006 | Context Builder | M4 | P0 | RAG-001,RAG-003 | 检索结果→上下文组装（截断/去重/排序/引用槽位/token 预算）；验收=单测（超长截断、引用编号稳定） | 1d | med | Flash+Max | pytest | BACKLOG |
| RAG-007 | RAG Orchestrator | M4 | P0 | RAG-006,SAFE-002 | query→classify→retrieve→build→LLM→blocker 编排；无结果/低置信走拒答兜底；验收=mock LLM 端到端测试+高风险 query 不进入自由生成 | 1.5d | high | Flash+Max | pytest+医疗安全回归 | BACKLOG |
| RAG-008 | Citation 生成与校验 | M4 | P0 | RAG-007 | 回答携带 citations[]（source/doc/定位）；Citation Validation：引用必须存在于检索结果，编造引用→丢弃并降级；验收=引用真实性测试（含 LLM 编造引用用例） | 1d | high | Flash+Max | pytest citation 专项 | BACKLOG |
| RAG-009 | 检索评测集与指标 | M4 | P1 | RAG-004 | 固定中文医学教育评测集（问题→应命中 chunk），recall@k/MRR 指标脚本；验收=评测报告落盘 `deliverables/`，指标可复跑 | 1d | med | Flash+Max | 评测脚本 exitCode | BACKLOG |
| RAG-010 | 教育问答 API 端点 | M4 | P0 | RAG-008 | `POST /api/knowledge/qa`：认证+限流+安全链+引用返回+免责字段；验收=API 测试（401/限流/正常/拒答四路径） | 1d | high | Flash+Max | pytest API+安全回归 | BACKLOG |

## M5 — Rehabilitation Training Content（结构化训练内容，B 类）

| ID | Title | Milestone | Pri | Deps | Objective/验收目标 | Size | Risk | Impl Model | Gate Requirements | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| TRN-001 | 训练内容 Schema 扩展 | M5 | P1 | M0-004 | item_bank 加列迁移：initial/final/tone/speaker/speech_rate/noise_type/snr_db/distractors/answer/review_status（audio/text/phonemes/difficulty 已有）；验收=up/down/up+既有训练回归绿 | 1d | med | Flash+Max | alembic 三连+pytest 训练全量 | BACKLOG |
| TRN-002 | 内容导入与校验工具 | M5 | P1 | TRN-001 | 结构化内容（CSV/JSON）批量导入+字段校验（音素合法性/SNR 范围/审查状态）；验收=合法与非法样本导入测试 | 1d | med | Flash+Max | pytest | BACKLOG |
| TRN-003 | 音素/音节内容种子 | M5 | P1 | TRN-002 | 普通话音素（声母/韵母/声调）与音节训练内容种子（含 difficulty 初值与 INITIAL_HEURISTIC 标注）；验收=种子幂等迁移+选题 API 返回新内容 | 1d | med | Flash+Max | alembic+pytest | BACKLOG |
| TRN-004 | 词/句内容种子 | M5 | P1 | TRN-002 | 日常词/句内容+answer/distractors；验收=种子迁移+训练流程回归 | 1d | med | Flash+Max | alembic+pytest | BACKLOG |
| TRN-005 | 场景/噪声/电话内容 | M5 | P1 | TRN-002 | 噪声场景（noise_type/snr_db 梯度）、语速梯度（speech_rate）、电话训练内容；验收=种子迁移+按 metadata 过滤选题测试 | 1.5d | med | Flash+Max | alembic+pytest | BACKLOG |
| TRN-006 | 答案判定与 distractors 增强 | M5 | P1 | TRN-001 | 判定逻辑从纯字符串匹配升级为 answer/distractors 感知（选择题选项判定、文本归一化比对）；验收=判定单测覆盖新旧路径，训练 API 回归绿 | 1d | med | Flash+Max | pytest | BACKLOG |
| TRN-007 | 内容管理后台 API | M5 | P1 | TRN-001,ADMIN-001 | 题库 CRUD+review_status 流转 API（admin/audiologist 角色）；验收=RBAC 权限测试+CRUD 测试 | 1.5d | med | Flash+Max | pytest 权限专项 | BACKLOG |

> 并行组 PG-D：TRN-003/004/005 在 TRN-002 后并行（不同数据文件）。

## M6 — IRT & Adaptive Training

| ID | Title | Milestone | Pri | Deps | Objective/验收目标 | Size | Risk | Impl Model | Gate Requirements | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| IRT-001 | 参数来源与版本 Schema | M6 | P1 | TRN-001 | `irt_item_params`：source ∈ INITIAL_HEURISTIC/EXPERT_ESTIMATE/PILOT_ESTIMATE/CALIBRATED + version + 生效区间；difficulty_b 读路径切换到该表（回退兼容）；验收=迁移+参数读取测试 | 0.5d | med | Flash+Max | alembic+pytest（test_irt_engine 回归） | BACKLOG |
| IRT-002 | 校准管道 | M6 | P1 | IRT-001 | 从真实作答数据（training_items）估计 b/a（MLE/EM，scipy 已有），产出 PILOT_ESTIMATE/CALIBRATED 参数版本；验收=模拟数据校准收敛测试+真实流程 dry-run 报告 | 1.5d | high | Flash+Max | pytest 数值测试 | BACKLOG |
| IRT-003 | 能力估计持久化与消费 | M6 | P1 | IRT-001 | theta/se 每 session 更新写 user_abilities+`ability_history`；选题真实消费 theta（修复 A7 的 theta=0 占位债）；验收=估计-消费链路测试 | 1d | med | Flash+Max | pytest | BACKLOG |
| IRT-004 | 选题策略增强 | M6 | P1 | IRT-003 | 最大信息量选题+曝光控制（防止同题重复）；验收=选题分布测试 | 1d | med | Flash+Max | pytest | BACKLOG |
| IRT-005 | 实验日志与阈值实验框架 | M6 | P2 | IRT-002 | `irt_experiments` 记录升降级阈值/参数版本实验配置与结果；≥80%/60% 阈值可配置并留痕（产品规则，非医学规律）；验收=实验配置生效测试 | 1d | med | Flash+Max | pytest | BACKLOG |
| IRT-006 | 参数版本回滚与审计 | M6 | P2 | IRT-002 | 参数版本激活/回滚 API+审计；验收=回滚后选题使用旧参数测试 | 0.5d | low | Flash+Max | pytest | BACKLOG |

## M7 — Medical Safety & Privacy

| ID | Title | Milestone | Pri | Deps | Objective/验收目标 | Size | Risk | Impl Model | Gate Requirements | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| SAFE-001 | Risk Taxonomy 与数据模型 | M7 | P0 | M0-006 | 风险分类清单（诊断/用药/调机/急症/心理危机/一般教育）版本化落库+文档；验收=分类定义评审记录（Max）+模型测试 | 0.5d | med | Flash+Max | pytest | BACKLOG |
| SAFE-002 | Query Classifier | M7 | P0 | SAFE-001 | 用户输入风险分类（规则+关键词+可选 LLM 辅助分类，SPEC 论证）；验收=分类测试集准确率记录，高风险样例 100% 命中 | 1.5d | high | Flash+Max | pytest 分类专项 | BACKLOG |
| SAFE-003 | Safety Policy 引擎 | M7 | P0 | SAFE-001 | 统一策略模块（扩展 core/safety.py）：策略规则化、可配置、单点维护；dialogue 与 llm_gateway 关键词双轨收敛；验收=策略命中测试+双轨消除证据 | 1d | high | Flash+Max | pytest+test_safety 回归 | BACKLOG |
| SAFE-004 | Unsafe Answer Blocker | M7 | P0 | SAFE-003 | 输出拦截：流式先缓冲后检查再放行（修 S4 债）；输入检查覆盖最近 N 条消息（修 S5 债）；验收=流式拦截测试+历史消息注入测试 | 1d | high | Flash+Max | pytest 安全专项 | BACKLOG |
| SAFE-005 | Emergency/高危转诊路径 | M7 | P0 | SAFE-002 | 急症/心理危机→固定应急话术（不经 LLM）；高危非急症→拒答模板+转诊建议；验收=两路径端到端测试 | 0.5d | high | Flash+Max | pytest+医疗安全回归 | BACKLOG |
| SAFE-006 | Safety Event 审计 | M7 | P0 | SAFE-003 | `safety_events` 表：拦截/转诊/命中规则全量落库+统计 API；验收=事件产生与查询测试 | 1d | med | Flash+Max | pytest+alembic | BACKLOG |
| SAFE-007 | 医疗安全评测集与回归 | M7 | P0 | SAFE-002,SAFE-004 | 固定评测集（诱导提问/多轮绕过/历史注入/疗效诱导/调机参数索取）作为 CI 回归；验收=评测集全过，接入 Machine Gate 医疗安全回归项 | 1.5d | high | Flash+Max | 评测回归 exitCode=0（此后所有医疗敏感任务必跑） | BACKLOG |
| PRIV-001 | Consent 管理 | M7 | P0 | M0-006 | `consents` 表：版本化协议+单独同意（数据使用/模型优化/录音存储）+查询 API；验收=consent 缺失时受限功能被拒测试 | 1d | high | Flash+Max | pytest 权限专项 | BACKLOG |
| PRIV-002 | 数据删除路径 | M7 | P0 | PRIV-001 | 账号注销：级联删除业务数据+OSS 音频+向量库零残留证明+审计留存删除记录；验收=删除完整性测试（全表核查） | 1d | high | Flash+Max | pytest 删除专项 | BACKLOG |
| PRIV-003 | 数据导出路径 | M7 | P0 | PRIV-001 | 本人数据导出（训练/对话/发音/consent，JSON 打包）；验收=导出内容与归属校验测试（他人数据不可导出） | 1d | med | Flash+Max | pytest+IDOR 测试 | BACKLOG |
| PRIV-004 | Retention 策略与清理 | M7 | P1 | PRIV-002 | 保留期配置+ARQ 到期清理任务（含 Redis/OSS）；验收=过期数据清理测试 | 0.5d | med | Flash+Max | pytest | BACKLOG |
| PRIV-005 | 日志脱敏增强 | M7 | P0 | M0-006 | 全链路日志审计：手机号/验证码/token/语音 URL 脱敏；验证码 Redis 改 hash 存储（A2 债）；验收=脱敏单测+验证码 hash 测试 | 1d | high | Flash+Max | pytest+日志抽查证据 | BACKLOG |
| PRIV-006 | 脱敏管道（De-identification） | M7 | P2 | PRIV-002 | 离线分析用脱敏数据集生成（去标识+聚合），产物永不回写向量库；验收=脱敏输出无直接标识符测试 | 1.5d | high | Flash+Max | pytest+KB-007 隔离回归 | BACKLOG |
| PRIV-007 | 健康语音隔离审计 | M7 | P0 | PRIV-001 | 语音数据访问路径盘点：OSS 前缀隔离、访问必经归属校验、访问审计日志；验收=越权访问测试全被拒+审计记录存在 | 1d | high | Flash+Max | pytest 越权专项 | BACKLOG |

> 并行组 PG-E：SAFE 线与 PRIV 线相互独立可并行；两线与 M2–M4 知识线并行（不同模块目录）。RAG-007 依赖 SAFE-002，故 SAFE-002 须早启动。

## M8 — Patient UI & Admin/Audiologist

| ID | Title | Milestone | Pri | Deps | Objective/验收目标 | Size | Risk | Impl Model | Gate Requirements | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| ADMIN-001 | RBAC 角色与权限扩展 | M8 | P0 | M0-006 | roles：patient/therapist/admin/expert/knowledge_admin；统一权限依赖（require_role）；验收=全端点角色矩阵测试（test_role_permissions 扩展） | 1d | high | Flash+Max | pytest 权限矩阵 | BACKLOG |
| ADMIN-002 | 知识管理后台 | M8 | P1 | ADMIN-001,ING-009,KB-005 | 文档上传/元数据/来源登记/发布/下架 API+前端管理页；验收=RBAC 测试+上传→pending 端到端测试 | 1.5d | med | Flash+Max | pytest+tsc+vitest+build | BACKLOG |
| ADMIN-003 | 专家审查工作流 UI | M8 | P1 | ADMIN-002,KB-006 | 专家审查队列/批准/驳回/意见+审计展示；验收=审查流转 E2E（vitest）+approved 后可检索联动测试 | 1d | med | Flash+Max | vitest+pytest | BACKLOG |
| ADMIN-004 | 听力师后台增强 | M8 | P1 | ADMIN-001,ARCH-002 | 听力师查看患者训练详情/趋势/预警+训练计划建议（仅建议，禁止调机参数）；验收=RBAC+数据归属测试，文案过医疗安全审查 | 1.5d | med | Flash+Max | pytest+医疗安全回归 | BACKLOG |
| UI-001 | 患者端教育问答页 | M8 | P0 | RAG-010 | KnowledgeQAPage：提问/回答/引用展示/免责声明/语音朗读/老年适配（≥18px/≥48px）；验收=vitest 渲染+交互测试，E2E 冒烟，医疗免责展示断言 | 1.5d | med | Flash+Max | tsc+lint+vitest+build+E2E | BACKLOG |
| UI-002 | 训练新内容类型前端适配 | M8 | P1 | TRN-005 | 噪声/电话/语速训练的播放与作答 UI（SNR 播放控制、场景说明）；验收=vitest+训练 E2E 回归 | 1d | med | Flash+Max | vitest+build | BACKLOG |
| UI-003 | 老年可访问性审计与整改 | M8 | P1 | M0-003 | 全页面 a11y 审计（字号/触控/对比度/语音引导/字幕）+整改；验收=审计清单逐项通过+E2E 大字模式断言 | 1d | med | Flash+Max | vitest+E2E+lint | BACKLOG |

## M9 — Evaluation & Observability

| ID | Title | Milestone | Pri | Deps | Objective/验收目标 | Size | Risk | Impl Model | Gate Requirements | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| EVAL-001 | ASR 准确率评测 | M9 | P0 | M0-007 | 固定评测集：普通话标准音/老年语音/人工耳蜗使用者/构音差异（样本授权见 PROJECT_PLAN §10.4）；WER/CER 报告对照 >85% 工程目标；验收=评测脚本可复跑+报告落盘 deliverables/ | 1.5d | high | Flash+Max | 评测脚本 exitCode；配额不足→missing_evidence 如实记录 | BACKLOG |
| EVAL-002 | 发音评分效度评测 | M9 | P1 | EVAL-001 | 音素评分与人工标注一致性（构音差异样本必含）；验收=一致性报告；评分低不病理化文案核查 | 1.5d | high | Flash+Max | 评测脚本+报告 | BACKLOG |
| EVAL-003 | 自适应阈值实验 | M9 | P2 | IRT-005 | ≥80%/60% 升降级规则的模拟与真实数据实验报告（明确标注为产品规则验证，非医学规律）；验收=实验报告+阈值配置留痕 | 1d | med | Flash+Max | 实验脚本 | BACKLOG |
| EVAL-004 | 噪声/语速鲁棒性实验 | M9 | P1 | TRN-005,EVAL-001 | 不同 noise_type/snr_db/speech_rate 下 ASR 与训练完成率实验；验收=实验报告落盘 | 1d | med | Flash+Max | 实验脚本 | BACKLOG |
| EVAL-005 | RAG/教育问答评测 | M9 | P0 | RAG-009,RAG-010 | 端到端评测：回答正确性/引用真实率/无依据拒答率/医疗安全评测集联动；验收=报告落盘，引用真实率与拒答正确率有量化数据 | 1d | high | Flash+Max | 评测脚本+SAFE-007 回归 | BACKLOG |
| OBS-001 | 结构化日志与 Trace 统一 | M9 | P1 | M0-002 | loguru 结构化格式（request_id 贯穿 api→service→gateway）+脱敏过滤器统一；验收=日志格式测试+request_id 贯穿断言 | 1d | med | Flash+Max | pytest | BACKLOG |
| OBS-002 | 指标看板与告警规则 | M9 | P1 | M0-007 | 指标补齐（训练/对话/发音/认证成功率、AI P95）+告警规则文档化（对接 runbook）；验收=metrics 端点新指标测试 | 1d | med | Flash+Max | pytest+metrics 抽查 | BACKLOG |
| OBS-003 | RAG 与安全线上指标 | M9 | P1 | RAG-007,SAFE-006 | 检索命中率/拒答率/引用率/安全拦截率指标+异常告警条件；验收=指标测试 | 0.5d | low | Flash+Max | pytest | BACKLOG |

## M10 — Production Readiness

| ID | Title | Milestone | Pri | Deps | Objective/验收目标 | Size | Risk | Impl Model | Gate Requirements | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| SEC-001 | 依赖漏洞扫描与修复 | M10 | P0 | M0-006 | pip-audit/npm audit 基线+高危修复（升级须 SPEC 批准，禁大规模升级）；验收=扫描报告+高危清零或豁免记录（Max 审批） | 1d | med | Flash+Max | 扫描命令 exitCode | BACKLOG |
| SEC-002 | 渗透复测与修复 | M10 | P0 | ADMIN-001 | 对照 M0-006 缺陷清单复测：IDOR/认证/限流/Cookie/CORS；修复遗留项；验收=安全回归测试全绿+缺陷清单闭环 | 1.5d | high | Flash+Max | pytest 安全专项全套 | BACKLOG |
| SEC-003 | 生产配置硬化 | M10 | P0 | M0-008 | 生产 checklist 落地：CORS 白名单、COOKIE_SECURE、docs 关闭、安全响应头（nginx）、DEBUG=False 强制；验收=配置测试+checklist 文档 | 0.5d | med | Flash+Max | pytest（test_config）+配置核查 | BACKLOG |
| OPS-001 | CI/CD 完善 | M10 | P1 | M0-005,M0-008 | 产出 CI 增强**提案**与本地验证脚本（落 `deliverables/ci-proposal/`）：迁移三连门禁、覆盖率阈值（数值人工批准）、安全扫描 job、pgvector 集成 job；验收=提案中每条 job 的 YAML 片段经本地语法校验通过且验证脚本可复现门禁结果。**`.github/**` 属 Flash 禁区：实际 CI 配置变更由治理阶段（Max）或人工应用，本任务不修改 `.github/workflows/ci.yml`** | 1d | med | Flash+Max | 提案 YAML 语法校验 exitCode=0；确认 git diff 不含 .github/** | BACKLOG |
| OPS-002 | 部署冒烟与回滚演练 | M10 | P0 | M0-008,SEC-003 | docker compose 本地全栈起服务→四路径冒烟（health/detailed、登录、训练开始、报告查询）→模拟回滚（旧镜像+downgrade）演练并记录；验收=冒烟与回滚证据落盘 | 1d | high | Flash+Max | compose up+冒烟命令 exitCode | BACKLOG |
| OPS-003 | 容量与性能压测 | M10 | P1 | M0-007 | 100 并发目标压测（locust/k6 择一，SPEC 论证）+瓶颈报告；验收=压测报告落盘，指标对照 PRD §4.3 | 1.5d | med | Flash+Max | 压测脚本；生产环境禁止压测 | BACKLOG |
| OPS-004 | Release Gate 证据包 | M10 | P0 | 全部 P0/P1 任务 | 组装 RELEASE_CRITERIA.md 全部证据（测试/构建/迁移/集成/安全/性能/RAG/医疗回归/docker/冒烟/回滚），执行 release_gate 模式；验收=PROJECT_READY 或如实 PROJECT_NOT_READY+缺口清单 | 0.5d | high | Max 判定+Flash 收集 | release_gate 全清单证据 | BACKLOG |

## DAG 与排程说明

### 依赖正确性

- 全部依赖边指向更早定义或跨里程碑前置任务，**无环**（KB→ING→RAG→UI→EVAL→OPS 单向；SAFE/PRIV/ADMIN/TRN/IRT 支线仅被引用不回指）。
- 跨里程碑依赖合法（如 TRN-007→ADMIN-001、RAG-007→SAFE-002、OPS-001 依赖 M0）；里程碑 Gate 只要求"本里程碑任务全 PASS"，被依赖的外里程碑任务须先 PASS。

### 并行组（可 Worktree 隔离）

| 组 | 任务 | 条件 |
|---|---|---|
| PG-A | M0-002/003/004 | M0-001 后 |
| PG-B | ARCH-002/003（后端不同 Service）+ ARCH-006（前端） | ARCH-001 后 |
| PG-C | ING-002/003/004 + ING-005/006 | ING-001 Contract 冻结后 |
| PG-D | TRN-003/004/005 | TRN-002 后 |
| PG-E | SAFE 线 × PRIV 线 × 知识线（M2–M4） | 模块目录不相交 |
| PG-F | RAG-001/002（检索通道） | KB-004 后 |

### 串行主链（禁止乱序）

Schema 先行：KB-001→…→KB-004；Contract 先行：ING-001→Parsers；Service 先于 API：RAG-007→RAG-010；API 先于 UI：RAG-010→UI-001；ADMIN-001（RBAC）先于一切后台 API。

### 第一批任务（治理文件提交后）

M0-001（串行起点）→ 随后 PG-A（M0-002/003/004）→ M0-005/006 → M0-007/008。

### 变更管理

- 本 Catalog 由 Max 维护；新增/调整任务须同步更新依赖与汇总计数，并在 DECISIONS.md 留痕（重大调整时）。
- Workflow 运行产生的 FIX-*（M0 缺陷修复）追加到对应里程碑附录，不改变既有任务 ID。
