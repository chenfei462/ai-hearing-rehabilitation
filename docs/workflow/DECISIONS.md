# DECISIONS — 架构决策记录（ADR）

> v1.0（2026-10-06）。格式：Context → Decision → Consequences。
> 变更决策必须新增 ADR（不修改历史条目），由 Max 在治理阶段写入。

## ADR-001 向量检索选型：PostgreSQL + pgvector（同库）

- **Status**: Accepted（2026-10-06，规划阶段）
- **Context**: 知识库/RAG 需要向量检索。仓库现状：PostgreSQL 15（asyncpg + SQLAlchemy 2 + Alembic），全仓库无任何向量数据库代码。候选：pgvector / Milvus / Qdrant / Pinecone。
- **Decision**: 采用 **pgvector 扩展，与业务同库**。不引入独立向量数据库。理由：MVP 语料规模（医学教育文档，预计 <100 万 chunk）在 pgvector HNSW 能力范围内；同库保证事务一致性（chunk 与 review_status/version 原子更新）、免新增运维面、Alembic 统一迁移、CI 已有 postgres 容器可复用；无充分规模/性能证据前引入独立向量库违反架构纪律（禁新增微服务/新存储）。
- **Consequences**: 正：部署简单、过滤检索（metadata filter）与向量检索同查询计划、备份一致。负：超大规模（>千万 chunk）或超高 QPS 时需重新评估（触发条件写入：单表 chunk >500 万或检索 P95 >300ms 持续，重开 ADR）；sqlite 单测环境无 vector 类型 → 分层测试策略（单测 mock 检索接口、集成用 pg+pgvector 容器）；CI 需增加带扩展的 pg 镜像 job（OPS-001）。

## ADR-002 知识分级隔离：D 类用户数据永不进入公共向量库

- **Status**: Accepted
- **Context**: 系统处理四类数据：A 医学教育知识、B 结构化训练内容、C 内部规则/Prompt、D 用户个人数据（健康信息、语音、训练记录）。《个人信息保护法》要求敏感个人信息分类管理、境内存储、单独同意。
- **Decision**: A 入 pgvector（仅 review_status=approved）；B 只入业务表（item_bank 族），不入向量库；C 只存在于代码/配置，不入任何语料；**D 绝对禁止写入 kb_* 表或任何公共检索语料**——脱敏（PRIV-006）产物仅用于离线分析，也不回写向量库。隔离由三重保证：服务层守卫（写入路径白名单）、DB 约束/独立表空间、KB-007 隔离回归测试（含恶意路径用例）。
- **Consequences**: 正：隐私合规基线明确，检索结果不可能泄露个人数据。负：无法用用户数据"自动丰富"知识库（预期行为）；离线分析需单独脱敏管道与授权（consent_flags）。

## ADR-003 模型分权：Max 规划/验收，Flash 实施，禁止 fallback

- **Status**: Accepted（永久政策）
- **Context**: 多模型协作需要防止低能力模型做高风险决策、防止自我验收。
- **Decision**: Max（qmodel_38max）独占：分类/探索/SPEC/RCA/Review/Verify/Gate 判定/治理文件。Flash（qfmodel）独占：实施/测试编写/机械命令执行。Flash 无 PASS 权；模型不可用 → BLOCKED_MODEL_UNAVAILABLE，禁止自动换模型。
- **Consequences**: 正：决策质量与实施速度分离，验收独立性有保障。负：Max 调用成本较高；模型标识变更时需同步改 Workflow 常量与本 ADR 系列文件（治理变更流程）。

## ADR-004 Machine Gate 以真实 exitCode 为唯一机器裁判

- **Status**: Accepted
- **Context**: LLM 自报"测试通过"不可信；执行手（Flash）转述 exitCode 也存在虚报风险（Workflow API 无法从脚本直接执行 shell）。
- **Decision**: 门禁 PASS/FAIL 由 Workflow 脚本按 `commands[].exitCode` 计算，忽略执行手自报 allPassed；required command 非零 → MACHINE_FAIL；Verify 阶段 Max 必须抽查重跑 1~2 条关键命令核实退出码；治理文件被实施任务改动 → 直接 TASK_FAIL。
- **Consequences**: 正：验收客观化，虚报有双重威慑。负：Verify 抽查增加一次命令执行成本（可接受）。

## ADR-005 训练（结构化）与 RAG（非结构化）严格分离

- **Status**: Accepted
- **Context**: 训练题库（item_bank，含 IRT 参数、字段化 metadata）与知识库文档（chunk+embedding）都是"内容"，存在混用诱惑（如把题库向量化后用 RAG 选题）。
- **Decision**: 双体系分离：训练选题走 SQL 结构化查询（metadata 过滤 + IRT 信息量），教育问答走 RAG 检索。禁止向量检索参与选题、禁止题库内容写入向量库。服务层分目录（services/training vs services/knowledge + retrieval），存储分表族。
- **Consequences**: 正：选题可解释（IRT 参数+过滤条件）、评测边界清晰、B 类数据不污染 A 类检索。负：两套内容管理后台功能有相似性（ADMIN-002 与 TRN-007 分别实现，接受重复）。

## ADR-006 IRT 参数必须真实数据校准，来源四级追溯

- **Status**: Accepted
- **Context**: 现状 difficulty_b 为种子默认值（0.0/人工设定），无来源标注；IRT 引擎已有 2PL+EAP+信息量函数（真实存在且质量较好），但 theta 消费不完整（A7 债：占位 0.0/1.0）。
- **Decision**: 参数来源枚举 INITIAL_HEURISTIC / EXPERT_ESTIMATE / PILOT_ESTIMATE / CALIBRATED，落 `irt_item_params`（含 version 与生效区间）。上线前允许 HEURISTIC/EXPERT；积累真实作答后经校准管道（MLE/EM）升级 PILOT→CALIBRATED；参数版本可回滚、全部留痕。**≥80% 正确率升降级阈值是产品规则而非医学规律**，其调整必须经实验框架（IRT-005）留痕，禁止拍脑袋改。
- **Consequences**: 正：自适应效果可追溯可回滚；避免"伪校准"（无数据却标 CALIBRATED）。负：上线初期自适应精度有限（如实标注，不夸大）；校准管道需要数据量阈值（SPEC 定义）。

## ADR-007 医学安全：分类器+策略引擎+输出拦截纵深防御，关键词只是其中一层

- **Status**: Accepted
- **Context**: 现状仅两处关键词表（已部分统一到 core/safety.py），历史审查发现流式先发后检（S4）、只查最后一条消息（S5）等绕过路径。
- **Decision**: 纵深防御五层：Risk Taxonomy（版本化）→ Query Classifier（输入分类路由，高风险不进 LLM 自由生成）→ Safety Policy（统一策略模块，单点维护）→ Unsafe Answer Blocker（输出缓冲后检再放行）→ Emergency/Referral 固定话术路径。全部拦截落 safety_events 审计。医疗安全评测集（SAFE-007）为 CI 常驻回归，任何医疗敏感任务 Machine Gate 必跑。
- **Consequences**: 正：单点失效不致命，绕过路径有评测集持续验证。负：分类器可能误杀正常健康教育问题 → 评测集含负样本，误杀率纳入 EVAL 指标；LLM 辅助分类增加延迟 → 规则先行、LLM 兜底的混合策略在 SAFE-002 SPEC 论证。

## ADR-008 保持 FastAPI 单体与既有分层，不拆微服务

- **Status**: Accepted（对 system_design.md 既有结论的治理确认）
- **Context**: 知识库/RAG/后台新增大量功能，存在拆服务诱惑。
- **Decision**: 单体 + 模块化目录（services/knowledge、services/retrieval、services/safety、services/privacy、services/irt）。新增功能一律作为模块加入单体；禁止新增独立微服务、禁止更换框架/存储（除 ADR 批准）。God Module 阈值：单文件 ~500 行且多职责必须拆（M1 先清偿 Report/Dialogue 两例）。
- **Consequences**: 正：部署/调试/事务简单，符合团队规模。负：单体膨胀需靠目录纪律与 Review 把关；未来若拆分，模块化目录已预留边界。

## ADR-009 部署形态：docker-compose（本地/单机）+ 阿里云 FC Serverless（生产），CI 既有链路冻结

- **Status**: Accepted
- **Context**: 仓库已有 docker-compose.yml、deploy/serverless.yml、nginx-production.conf、CI docker build/push/FC deploy job。
- **Decision**: 维持既有双形态；流式接口用 FC 预留实例规避冷启动；Agent/Workflow 禁止执行真实云部署与 push（人工专属）。CI 增强（迁移门禁、覆盖率阈值、pgvector job、安全扫描）走 OPS-001，`.github/**` 改动属治理禁区，实施任务不得触碰——OPS-001 的 CI 变更由人工批准提交。
- **Consequences**: 正：上线路径与既有投资一致。负：CI 变更流程较重（人工介入），换取发布安全。

## ADR-010 历史文档不作为完成证据（Evidence-First 治理）

- **Status**: Accepted
- **Context**: TODO.md 全部 P0/P1 修复已勾选，但集成/安全/性能三项未勾选；架构债报告（2025-07）中 ARCH-04/12 疑似已被后续提交修复；文档与代码存在漂移（如 ACCESS_TOKEN_EXPIRE 从 7 天改为 2 小时）。
- **Decision**: 一切门禁与状态判定只认当前真实证据（命令 exitCode、文件内容、git 留痕）。M0 里程碑的首要产出就是"用证据重写基线"；历史文档降级为参考输入。ARCH-* 任务执行前 Explore 必须复核债项现状，已修复项从 SPEC 剔除并留痕。
- **Consequences**: 正：杜绝"纸面完成"。负：M0 阶段一次性验证成本（8 个基线任务）——必要投入。

## ADR-011 老年/特殊人群工程指标定位为"待验证工程目标"

- **Status**: Accepted
- **Context**: PRD 指标（ASR>85%、任务完成率>80%、评分<2s、≥80% 正确率升级）常被误读为医学/临床标准。目标用户含老年与人工耳蜗使用者，存在构音差异与语音特点。
- **Decision**: 所有此类指标在文档、UI 文案、评测报告中一律标注为**工程/产品目标**；评测（EVAL-001/002/003/004）必须覆盖普通话标准音、老年语音、人工耳蜗使用者语音、构音差异、多噪声/SNR、多语速维度；不达标处置 = 记录 + 立修复/调参任务，禁止修改指标定义或文案表述来"达标"；发音反馈文案禁止病理化表述。
- **Consequences**: 正：合规（非医疗器械定位）与用户信任。负：评测集采集依赖样本授权（人工事项 PROJECT_PLAN §10.4），先用公开测试集过渡并如实标注样本构成。
