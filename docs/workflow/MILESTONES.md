# MILESTONES — 里程碑定义

> v1.0（2026-10-06）。任务明细见 `TASK_CATALOG.md`；门禁机制见 `QUALITY_GATES.md`。
> Milestone Gate 由 `project-feature-delivery`（milestone_gate 模式）执行：Flash 收集证据 + Max 判定，
> 只有 MILESTONE_PASS / MILESTONE_BLOCKED 两种结论；历史 `[x]` 不构成证据。

## M0 — Repository Truth & Baseline

- **Objective**：建立当前仓库的真实质量基线，不信任任何历史完成标记；暴露存量缺陷并定级。
- **Entry**：治理文件已提交；工作分支就绪（非 dirty main）；本地可起 postgres/redis（docker compose）。
- **Tasks**：M0-001..008（8 项，全 P0）。
- **Exit / Gate**：8 个基线文档落盘 `deliverables/baseline/`（非治理保护区，Flash 可写）；每条命令有真实 exitCode 记录；集成/安全/性能三项 TODO 未勾选项有当前真实结论；P0 存量缺陷清单产出并插入 FIX-* 任务。
- **Dependencies**：无前置里程碑。
- **Risk**：基线大面积红（高）——处置：如实记录，FIX-* 任务在 M1 内清偿，不放水。
- **Deliverables**：REPO_INVENTORY / BACKEND_TEST_BASELINE / FRONTEND_BASELINE / DB_API_BASELINE / SECURITY_BASELINE / PERF_BASELINE / DEPLOY_BASELINE + 缺陷清单。

## M1 — Architecture Stabilization

- **Objective**：清偿仍然存在的架构债（复核后），统一响应/异常/安全护栏/重试，为知识库与后台开发提供稳定地基。
- **Entry**：M0 MILESTONE_PASS；M0 暴露的 P0 缺陷（FIX-*）全部关闭。
- **Tasks**：ARCH-001..008（P1×3、P2×5）+ 遗留 FIX-*。
- **Exit / Gate**：后端全量测试+ruff、前端 tsc/lint/test/build/E2E 全绿；迁移三连通过；ARCH-04/12 复核结论留痕（已修复则记录证据后剔除）；无新增 God Module。
- **Dependencies**：M0。
- **Risk**：拆分 Report/Dialogue Service 引入回归（中）——处置：行为不变约束写入 SPEC，既有测试为回归基线。
- **Deliverables**：统一响应体系、拆分后的 Service 结构、清理后的前端 Store、DB 化发音题库。

## M2 — Knowledge Core

- **Objective**：知识库数据核心就绪：pgvector、来源登记、文档版本、chunk、审查状态机、A/B/C/D 隔离守卫。
- **Entry**：M1 PASS；KB 相关 ADR（DECISIONS.md）已批准；pgvector 测试镜像可用。
- **Tasks**：KB-001..007（全 P0）。
- **Exit / Gate**：迁移三连通过；隔离回归测试全绿（D 类数据入向量库路径被测试证伪）；review 状态机非法迁移被拒；license/provenance 强制校验测试通过。
- **Dependencies**：M1（架构稳定后动 Schema）。
- **Risk**：pgvector 与 sqlite 单测环境不兼容（中）——处置：分层测试策略（单测 mock、集成 pg 容器）。
- **Deliverables**：kb_* 表族+迁移、隔离守卫模块、审查状态机。

## M3 — Knowledge Ingestion

- **Objective**：内容摄取管道端到端可用：Contract→Parsers→清洗/去重/分块→Embedding→入库(pending)→版本/过期/Reindex。
- **Entry**：M2 PASS；首批内容来源与授权清单人工确认（PROJECT_PLAN §10.2）。
- **Tasks**：ING-001..010（P0×7、P1×2、P2×1）。
- **Exit / Gate**：样本文件（Markdown/HTML/PDF）端到端入库测试通过；chunk 元数据完整率 100%（测试断言）；reindex 幂等；Parser 契约测试全绿。
- **Dependencies**：M2。
- **Risk**：PDF 中文解析质量（中）——处置：ING-003 样本测试含扫描件外多类型中文 PDF；扫描件 OCR 明确 Out of Scope（P2 远期）。
- **Deliverables**：ingest_pipeline、4 类 Parser（DOCX 为 P2 可延后）、embedding_gateway。

## M4 — Retrieval & RAG

- **Objective**：检索与问答链路可用且安全：向量/全文/Hybrid+RRF、强制过滤、上下文组装、编排、引用校验、教育问答 API。
- **Entry**：M3 PASS；SAFE-002（Query Classifier）PASS（跨里程碑硬依赖）。
- **Tasks**：RAG-001..010（P0×6、P1×3、P2×1）。
- **Exit / Gate**：unapproved/expired/unlicensed exclusion 回归全绿；引用真实性测试（含编造引用用例）通过；高风险 query 不进自由生成；RAG-010 API 四路径（401/限流/正常/拒答）测试通过；医疗安全回归（SAFE-007 若已就绪）纳入 Gate。
- **Dependencies**：M3、SAFE-002。
- **Risk**：中文 FTS 方案在托管 PG 的扩展可用性（中）——处置：RAG-002 SPEC 内论证 zhparser/bigram/应用层分词三案。
- **Deliverables**：retrieval 服务族、/api/knowledge/qa、检索评测集。

## M5 — Rehabilitation Training Content

- **Objective**：结构化训练内容体系：完整字段 Schema、导入工具、音素/音节/词/句/场景/噪声/电话内容、distractors 判定、内容管理 API。
- **Entry**：M1 PASS（TRN-001 依赖迁移基线）；内容素材与版权人工确认。
- **Tasks**：TRN-001..007（全 P1；TRN-007 依赖 ADMIN-001）。
- **Exit / Gate**：Schema 迁移三连+既有训练回归全绿；种子幂等；按 metadata（noise_type/snr_db/speech_rate）过滤选题测试通过；内容 review_status 流转测试通过。
- **Dependencies**：M1；ADMIN-001（仅 TRN-007）。
- **Risk**：内容量不足影响 IRT 校准（中）——处置：数量目标在 TRN-003/004/005 SPEC 内定义，先覆盖核心音素/常用词句。
- **Deliverables**：扩展 item_bank、导入工具、三批种子内容、内容管理 API。

## M6 — IRT & Adaptive Training

- **Objective**：自适应体系可信可追溯：参数来源四级标注、真实数据校准、theta 持久化消费、选题增强、实验留痕。
- **Entry**：M5 PASS（IRT-001 依赖 TRN-001）。
- **Tasks**：IRT-001..006（P1×4、P2×2）。
- **Exit / Gate**：test_irt_engine 回归全绿；模拟数据校准收敛测试通过；theta 估计-消费链路测试通过；阈值实验框架配置留痕测试通过；所有 IRT 输出文案不得含临床疗效声明（Max Review 核对）。
- **Dependencies**：M5。
- **Risk**：上线前真实作答数据不足（高）——处置：参数保持 EXPERT_ESTIMATE/PILOT_ESTIMATE 标注，CALIBRATED 仅在数据量达 SPEC 阈值后启用。
- **Deliverables**：irt_item_params 体系、校准管道、ability_history、实验日志。

## M7 — Medical Safety & Privacy

- **Objective**：医疗安全引擎与隐私合规套件上线级就绪。
- **Entry**：M0-006 PASS；SAFE/PRIV 可与 M2–M6 并行启动（模块目录不相交）。
- **Tasks**：SAFE-001..007（全 P0）、PRIV-001..007（P0×5、P1×1、P2×1）。
- **Exit / Gate**：医疗安全评测集回归 100% 通过并接入 Machine Gate 常跑项；Emergency/转诊两路径端到端测试通过；流式缓冲拦截测试通过；删除/导出/隔离/脱敏（P2 可后置）测试全绿；日志脱敏抽查证据；consent 缺失拒绝访问测试通过。
- **Dependencies**：M0；被 M4（RAG-007）、M8（后台）反向依赖。
- **Risk**：分类器误杀正常健康教育问题（中）——处置：评测集含正常问题负样本，误杀率指标入 EVAL。
- **Deliverables**：safety 服务族+safety_events、privacy 服务族+consents、医疗安全评测集（CI 常驻）。

## M8 — Patient UI & Admin/Audiologist

- **Objective**：三类角色界面完备：患者（教育问答+新训练类型+无障碍达标）、听力师后台、知识管理/专家审查后台。
- **Entry**：ADMIN-001 依赖 M0-006；ADMIN-002/003 依赖 M3/M2；UI-001 依赖 M4。
- **Tasks**：ADMIN-001..004、UI-001..003（P0×2、P1×5）。
- **Exit / Gate**：RBAC 全端点角色矩阵测试通过；后台 E2E（上传→审查→发布→可检索）通过；UI-001 医疗免责展示断言通过；a11y 审计清单逐项通过；前端 tsc/lint/test/build/E2E 全绿。
- **Dependencies**：M4（UI-001）、M3（ADMIN-002）、M1（ADMIN-004）。
- **Risk**：听力师"训练计划建议"文案越界医疗边界（中）——处置：ADMIN-004 Gate 必跑医疗安全回归，文案白名单化。
- **Deliverables**：KnowledgeQAPage、管理后台三件套、a11y 整改报告。

## M9 — Evaluation & Observability

- **Objective**：工程指标有真实证据：ASR/发音评分/阈值/鲁棒性/RAG 五类评测报告；日志、指标、告警生产可用。
- **Entry**：M4/M7 PASS（EVAL-005 依赖）；评测样本授权人工确认。
- **Tasks**：EVAL-001..005、OBS-001..003（P0×2、P1×5、P2×1）。
- **Exit / Gate**：五份评测报告落盘 deliverables/（不达标如实记录并立后续任务，禁止改指标定义）；request_id 贯穿断言通过；新指标端点测试通过；告警规则与 runbook 对齐。
- **Dependencies**：M0-007、M4、M6（EVAL-003）、M5（EVAL-004）。
- **Risk**：评测样本采集授权延迟（高，人工依赖）——处置：先用公开普通话测试集跑基线，特殊人群样本到位后补充；报告中明确标注样本构成。
- **Deliverables**：五类评测报告、结构化日志体系、指标/告警清单。

## M10 — Production Readiness

- **Objective**：达到 Release Gate 全部证据要求，可上线。
- **Entry**：全部 P0 任务 PASS；P1 任务 PASS 或有人工批准的豁免记录。
- **Tasks**：SEC-001..003、OPS-001..004（P0×5、P1×2）。
- **Exit / Gate**：`RELEASE_CRITERIA.md` 全清单有当前有效证据；release_gate 模式返回 PROJECT_READY；回滚演练记录在案；安全 blocking finding 清零。
- **Dependencies**：全部里程碑。
- **Risk**：证据链缺口导致 NOT_READY 反复（中）——处置：OPS-004 前先自查 RELEASE_CRITERIA 清单。
- **Deliverables**：Release 证据包、硬化配置、CI 增强、压测报告、回滚演练记录。

## 里程碑顺序与并行总览

```
M0 → M1 → ┬ M2 → M3 → M4 ─────────┬→ M8 → M9 → M10
          ├ M5 → M6 ───────────────┤
          └ M7（SAFE/PRIV，与 M2-M6 并行，SAFE-002 前置于 RAG-007）┘
```

- 里程碑 Gate 逐个执行；M5/M6 与 M2–M4 可并行推进（不同模块）；M7 的 SAFE-002 是 M4 的硬前置，须优先排程。
