# GOAL_PROGRESS — Autonomous Delivery Orchestrator

> **⛔ 续跑前置条件（勿跳过）**：M0-005/006/007/008 **禁止在未修复 F-20 前重启** —— Workflow 守卫与 Gate 契约互斥（HD-N-01 / `FIX-GOV-001`），重启必以 `GOVERNANCE_POLICY_VIOLATION / REQUIRED_DOWNGRADE` 再次撞墙（每次约 40 分钟）。唯一正确顺序：人工修 `.qoder/workflows/project-feature-delivery.js` → 重跑 M0-005 → M0-006 → M0-007/M0-008 → M0 Milestone Gate（Exit 还需 HD-N-04 治理写 Catalog）。
>
> **⚠️ 修法约束（标签 `21:14Z` 系陈旧时间戳，权威为 `2026-10-08T06:31Z`；见「时间戳订正」/F-25）新增，来自 F-24**：HD-N-01 的候选 **A 或 B 单独实施会削弱门禁** —— 它们移除误报的同时也移除了 SPEC↔提交之间唯一的字符串对账，使"沉默省略红基线"成为零成本作弊。必须采纳 `TASK_LEDGER.json → pendingFixTasks.FIX-GOV-001.design` 的**融合设计（C1–C5 + 回归 d6-01..d6-08）**，其净效果为"收紧"而非"放宽"。

> 人类可读进度日志。每完成一个 Task 更新一次。禁止记录任何 Secret 真实值。
> 机器可读状态见同目录 `TASK_LEDGER.json`。

- Goal 启动时间：2026-10-06T19:03Z
- 当前分支：`feature/m0-baseline`
- 当前 HEAD：**账本/进度字段按约定记录"本 seal commit 的父提交"**（详见 `TASK_LEDGER.json.headPointerNote`），因此本行数字恒比 `git log -1` 落后一个账本提交 —— 这是记录口径而非漂移，最新提交请以 `git log --oneline -1` 为准。最近两个账本提交：`39c7432`（M0-006 BLOCKED 封印，F-21..F-23 + 四条安全 P0）→ 其父 `1a62703`（候选 C 撤回）。任务侧最后一个安全交付提交 = **`a78b10f`（M0-004 TASK_PASS）**；M0-005 与 M0-006 均 **未提交**，见下。
- 当前 Milestone：**M0 — Repository Truth & Baseline**
- Goal 状态：**PAUSED_FOR_HUMAN**（2026-10-07T19:41Z 起）
- 暂停根因：**F-20（P1-BLOCKING 治理缺陷，已真实执行两次确证）** — Workflow 反降级守卫 `detectRequiredDowngrade`（`.qoder/workflows/project-feature-delivery.js:727-743`）与 Gate 契约（同文件 `:1798-1799`「基线采集类命令必须 `kind=record`」）**结构性互斥**。M0-005（`wf_bd5d9d4f-2c7`）与 M0-006（`wf_6b00bd56-a7c`）两次 FULL 模式全程执行均 BLOCK 于 Machine Gate，两次都是 Max 亲写的 `record` 层被归因给执行手。修复需改治理保护路径 → Night Chain 禁止夜间自动修复治理缺陷。配套登记 **F-24（P1-BLOCKING-COUPLING）**：守卫同样缺少"SPEC↔提交覆盖率"对账，此缺陷**决定 F-20 的正确修法** → 融合设计见「FIX-GOV-001 融合设计」附录。
- 模型政策：仅 `qmodel_38max`(Max) / `qfmodel`(Flash)；执行器 `.qoder/workflows/project-feature-delivery.js`；**全程无违规、无 fallback、无换模型**。
- 串行策略（§18）：夜间默认串行；进度文件在 Workflow 启动前提交，仅在 TASK_PASS 后更新（§116/§117）。

## Pre-existing untracked（§8，PRE_EXISTING_UNCHANGED）

- `docs/qgraphflow/dialogue-turn-sequence/` — 2 文件
  - `graph.json` sha256 = `5f12d3d4503d2305f352b21b8d275bb5e2ea544a32f3d539ea6909951373f138`（34972 B；md5 `2fe742d810f7cd0ce2f5eb401f0050a0`）
  - `index.html` sha256 = `2bd127b7c22c25b20e04804cc5c745f686f7f462cae96649aa9b47612d4bf600`（794348 B；md5 `c1bb9c9b90d92db933577e4056e3ba91`）
  - 每个 Task 结束须复核指纹不变；变化则 BLOCKED_EXTERNAL_WORKTREE_CHANGE。
  - **摘要口径订正（D4）**：本文件历史版本曾把这两个值记为 40 位 hex（`e88c0295…`/`cde38f82…`）。40 位 hex 是 **git blob SHA-1**，按 `.qoder/rules/90-quality-gates.md` D4 节**不得充当内容身份**。现只认上方 64 位小写 hex SHA-256；md5/size 仅佐证。此订正属记录口径修正，不代表文件内容有变（md5 与既有佐证一致）。

## 已完成 Task

### M0-001 — 仓库清单与真相基线文档
- 状态：TASK_PASS
- Commit：`abc6a78`
- 产物：`deliverables/baseline/REPO_INVENTORY.md`（246 行 / 27457 bytes）

### M0-002 — 后端测试基线
- 状态：TASK_PASS
- Commit：`7be3c50`
- 产物：`deliverables/baseline/BACKEND_TEST_BASELINE.md`（304 行 / 23890 bytes，16/16 section）
- GATE_HEALTH=PASS；PROJECT_BASELINE_HEALTH=DEGRADED（§71 M0 合法）

### M0-003 — 前端构建基线
- 状态：TASK_PASS
- **权威 Commit：`f73cb01`**（FULL 模式重跑的交付物 commit，父提交为治理 `c61bfd3` D5 恢复 FULL；工作树与提交内容一致：sha256 `12b3c013fecac9b65424b0fa8ed1fa42c68b7219153dfd76549ed2dab7773e1c` / 71572 B）
- 历史 Commit：`2ab8ad5`（在 D3 FLASH_ONLY 期间产出的初版，30802 B / sha256 `a0de928f…`，已被重跑版本**取代**，仍在历史链中，不改写历史）
- 产物：`deliverables/baseline/FRONTEND_BASELINE.md`
- GATE_HEALTH=PASS；PROJECT_BASELINE_HEALTH=DEGRADED（§71 M0 合法）
- Findings：F-01 chunk>1000kB vendor-charts 1129.69kB(echarts)；F-02 package.json vs lockfile 版本漂移（semver 内）；F-03 40-frontend.md:36 称"5 test.tsx"实为 6 vitest 文件；F-04 本地 Windows+Node24 ≠ CI ubuntu+Node20；F-05 覆盖薄（10 测试/6 文件，1 e2e spec）
- 模型使用：重跑在 FULL 下 PLAN=qmodel_38max / IMPLEMENT=qfmodel / REVIEW=qmodel_38max（无违规）
- 记账订正说明：本文件与 ledger 此前把 M0-003 提交记为 `2ab8ad5`，与 HEAD 实际内容不符；已按主证据（`git log`、`git show` 字节数与 sha256、`merge-base --is-ancestor c61bfd3 f73cb01` = true）改为 `f73cb01`，并保留 `supersededCommit`。

### M0-004 — API/DB/迁移基线审计
- 状态：TASK_PASS（relaunch #3，run `wf_bcb74f36-ae9`）
- Commit：`a78b10f`（交付物单独封存）
- 产物：`deliverables/baseline/DB_API_BASELINE.md`（388 行 / 29081 bytes，4 章：§1 迁移真相 / §2 API 盘点 / §3 pytest 基线 / §4 口径与安全）
- GATE_HEALTH=PASS（required 7/7，record 6/6，blockedMissingSafeTestEnv=false）；PROJECT_BASELINE_HEALTH=DEGRADED（§71 M0 合法）
- AC：9/9 met；MAX REVIEW PASS（round 1）；REPAIR_CYCLES_USED=0；ATTEMPT_HISTORY=[]
- 模型使用：PLAN=qmodel_38max / IMPLEMENT=qfmodel / REVIEW=qmodel_38max（无违规）
- 迁移真相（隔离 :55432）：`upgrade 001` exit 0 → current `001`；`downgrade base` exit 0 → current 空；`upgrade head` exit 1（TypeError@002_seed_items.py:55，F-15）；失败后 current=**base**（非 001，F-16：env.py:26-29 单事务整体回滚）
- API 盘点：37 条路由 vs docs/api-reference.md，三类差异（A 文档缺失 / B 文档存在未实现 / C 契约不一致，含 C-3=F-01 文档侧）
- pytest：1 failed / 231 passed / 33 warnings / exit 1，与 M0-002 基线逐条一致，**no NEW failures**（F-01）；F-13 本轮未复现（未复现≠已修复）；ENV-DRIFT 已声明（本地 Py3.12.10/alembic1.13.1/pytest9.1.1 vs CI Py3.11/pytest8.x）
- Max Verify（Orchestrator 亲跑）：独立抽查重跑 `alembic current`（外部 ini、:55432）→ exit 0 / 仅两行 INFO=base，证实 F-16 记录属实、无虚报；qgraphflow 指纹不变；Task Delta 仅 DB_API_BASELINE.md，治理文件零改动，HEAD 未被 Flash 改动
- 历程：首轮 SPEC_CONFLICT（false premise，A+C+D）→ relaunch-2 瞬时 BLOCKED_MODEL_UNAVAILABLE（probe:flash，未换模型，单次 resume 重试恢复）→ relaunch-2 SPEC_CONFLICT（revision token 001_init_tables→001，Option A + §71 真相口径加固）→ relaunch-3 TASK_PASS。两次 SPEC_CONFLICT 均 ATTEMPTS=0，非修复轮（§126），未占用 ≤3 修复预算

## M0 DAG（来自 docs/workflow/TASK_CATALOG.md，权威）

| Task | Title | Pri | Deps | 状态 |
|---|---|---|---|---|
| M0-001 | 仓库清单 | P0 | — | TASK_PASS |
| M0-002 | 后端测试基线 | P0 | M0-001 | TASK_PASS |
| M0-003 | 前端构建基线 | P0 | M0-001 | TASK_PASS |
| M0-004 | API/DB/迁移基线 | P0 | M0-001 | TASK_PASS（`a78b10f`，Critical Path） |
| M0-005 | 集成测试基线 | P0 | M0-002,M0-004 | **BLOCKED（F-20 治理缺陷，未提交）** |
| M0-006 | 安全基线 | P0 | M0-002 | BLOCKED（同 F-20，预测未执行） |
| M0-007 | 性能基线 | P0 | M0-005 | BLOCKED（同 F-20 + dep 未 PASS） |
| M0-008 | 部署基线 | P0 | M0-003,M0-004 | BLOCKED（同 F-20，预测未执行） |

## M0-004（API/DB/迁移基线）— 历程：SPEC_CONFLICT×2 + 瞬时模型不可用 → relaunch #3 TASK_PASS

选择依据 §17 优先级 1（当前 Milestone 的 P0 + Critical Path Ready Task）。
Critical Path：`M0-001 → M0-004 → KB-001 → …`

**DB 安全（§31-35）**：`backend/alembic.ini:5` 默认 URL 指向 `localhost:5432/cochlear_rehab`（未知 listener = 外部 `opengauss-lab` 容器，§31 永不连接/变更）。
迁移三连**已在 Goal 自建一次性隔离容器 `aiear-m0004-pg-test`（端口 55432、test-only DB `aiear_m0004_test`、随机测试密码、无生产卷挂载）上真实执行**（§32-35 授权）。

### 首轮 Workflow（run `wf_881c57ca-678`）结论：BLOCKED / SPEC_CONFLICT（ATTEMPTS=0）

Flash 在 IMPLEMENT 前发现 Max 首轮 TASK_SPEC 的两条**验收前提与真实代码冲突**，依 00-model-policy.md 立即停止上报（未改任何禁改文件、无 Task Delta、无 git 写操作，HEAD 仍 `7e027c7`；qgraphflow 指纹不变）：

- **冲突1（AC-05/06/13）**：SPEC 断言迁移三连 exitCode 全 0 且三连后 `item_bank=19`。真实 `backend/alembic/versions/002_seed_items.py:55-58` 用 `op.execute(sa.text("INSERT ... VALUES (:level,...)"), item)` —— 第 2 个位置参数与锁定的 `alembic==1.13.1`（pyproject.toml:18 / requirements.txt:6）签名 `execute(self, sqltext, *, execution_options=None)` 不兼容 → `TypeError: execute() takes 2 positional arguments but 3 were given`，`upgrade head` exit 1，head 不可达。唯一修复途径是编辑 002（在 FILES_FORBIDDEN_TO_CHANGE），Flash 无权越权。
- **冲突2（AC-11）**：SPEC 断言全量 `pytest -q` exitCode=0（并称 21 文件）。真实为 exit 1、`1 failed / 231 passed`、20 文件；唯一失败即 M0-002 已如实记录的既有红项 F-01（`tests/test_middleware.py:34` assert 401==200，因 `app/api/metrics.py:14-15` 需认证）。R12 污染控制实验（卸载/重装 psycopg2-binary 复跑）结果一致，与本任务无关。
- **隔离库真实证据**：`upgrade 001` exit 0（public_tables=9 含 8 张迁移表，item_bank=0，knowledge_states 不存在，vector 扩展未装，server_version=15.18）；`downgrade base` exit 0（alembic_version 清空）；`upgrade head` exit 1（002 TypeError，事务性 DDL 回滚至干净空库）。全仓 grep alembic 执行路径零命中（CI/compose/deploy/scripts/runbook/Dockerfile），建表实际走 `create_all`（database.py:42 / init_db.py:15 / conftest.py:68）→ 002 缺陷长期潜伏。

### Max 决策（本 Orchestrator 持 Max 权，非治理文件变更，非降低标准放水）

采用 **A+C+D**（保持 M0-004「只读 Audit」定位，零代码改动产出全部剩余价值）：

- **A**：迁移 AC 据实记录（`upgrade 001` exit 0 / `downgrade base` exit 0 / `upgrade head` exit 1 并附 TypeError 证据）；新增 P1 finding **F-15**（002 与 alembic 1.13.1 不兼容导致迁移链 head 不可达）；F-08 处置改为 `NOT_CLOSED_ROOT_CAUSE_IDENTIFIED`（关闭前置 = FIX-M0-004-001）。
- **C**：pytest AC 改为「须与 M0-002 基线一致：1 failed / 231 passed，不得新增失败；测试文件数 20」（变绿属 F-01 修复任务 Scope，不由 Audit 改测试）。
- **D**：门禁命令固定为 `cd backend && venv312/Scripts/python.exe -m alembic -c <仓库外临时 ini> <cmd>`（alembic.exe shim 因非 ASCII 仓库路径静默失败）；AC-01 指纹校验用 `git hash-object`（与已记录口径一致）。
- **B（延后）**：真正修复 002（改 `op.get_bind().execute(...)` 或 `sa.text(...).bindparams(**item)`，并评估种子幂等性与 downgrade 宽删除）列为独立 **FIX-M0-004-001**（P1，M2 KB-001+ 前必做，非 M0 Critical Path），该任务须显式解禁 002_seed_items.py。

重跑用**修订后 TASK_SPEC**（新 SHA 后缀 spec.json，不覆盖原 m0-004 spec，符合 AGENTS.md §3）。产物目标：`deliverables/baseline/DB_API_BASELINE.md`（迁移真相 + 全量 API 端点盘点对照 docs/api-reference.md + F-15/F-08/pytest 基线）。GATE_HEALTH 与 PROJECT_BASELINE_HEALTH 分离（§71 M0 合法 DEGRADED）。

### 后续历程（A+C+D 之后 → TASK_PASS）

1. **relaunch-2 瞬时 BLOCKED_MODEL_UNAVAILABLE**（run `wf-5f1ac58d-72f`）：Preflight 阶段 `probe:flash` 报错（"Sorry, something went wrong. Please try again."），`probe:max` 已成功。Workflow 正确拒绝 fallback（模型政策 §5）。ATTEMPTS=0、FILES_CURRENTLY_CHANGED=[]、未触任何文件、HEAD 仍 `c5546e1`。Orchestrator 判为**瞬时**（错误文案可重试、probe:max 刚成功），做**单次 resume 重试**（resumeFromRunId，复用缓存 probe:max），**未换模型、未改 Workflow/治理文件** → 重试成功，Flash 恢复（agents_error 0）。
2. **relaunch-2 SPEC_CONFLICT**（revision token）：Max 修订 spec 误将迁移 step1 冻结为 `upgrade 001_init_tables`，但 `001_init_tables`/`002_seed_items` 是**文件名**而非 alembic revision token（真实为 `001`/`002`）。Flash 实测 `Can't locate revision` / exit 127，正确停止上报（未擅自换 token/改 spec/改代码）。库仍 base、tracked 零改动、凭据零泄露。Max 独立复核源码（001_init_tables.py:11 `revision="001"`、002_seed_items.py:11 `revision="002"`）后采 **Option A**：token 改 `upgrade 001`、AC-03 current 期望改 `revision=001`；并按 **§71 M0 真相口径**把迁移 AC 全部加固为「如实记录真实 exitCode + revision，expected 仅为指引」以防第三次冲突。
3. **relaunch-3 TASK_PASS**（run `wf_bcb74f36-ae9`，spec `m0-004-db-api-baseline-c5546e199e14.spec.json`）：完整链 Preflight→Classify→Explore→Scope→TASK_SPEC(9 AC)→Implement(1 新文件)→Task Delta clean→MACHINE_PASS(required 7/7,record 6/6)→MAX REVIEW PASS(round1)→Max Verify。AC 9/9 met，REPAIR_CYCLES_USED=0。交付物 `a78b10f` 单独封存。新采集 **F-16**（env.py 单事务致 upgrade head 失败整串回滚至 base）。

> 两次 SPEC_CONFLICT + 一次瞬时模型不可用均 ATTEMPTS=0、非修复轮（§126），未占用 ≤3 修复预算；全程未切换模型、未改治理/Workflow 文件。

## M0-005 — 集成测试基线：**BLOCKED / GOVERNANCE_POLICY_VIOLATION（未提交）**

Workflow：run `wf_bd5d9d4f-2c7`（workflowTaskId `wf-2f194400-ed3`），`executionMode=FULL`，`ATTEMPTS=0`，`FAILED_PHASE=Machine Gate`，
`BLOCK_REASON=GOVERNANCE_POLICY_VIOLATION`，`GIT_TIER=REQUIRED_DOWNGRADE`。

### 缺陷性质：守卫与契约互斥，执行手被误归因

- Gate 契约（`.qoder/workflows/project-feature-delivery.js:1798-1799`）**要求**基线采集类命令使用 `kind=record`："record 命令 exitCode!==0 属正常基线发现，写入 findings，绝不使本 Task MACHINE_FAIL"。
- 反降级守卫 `detectRequiredDowngrade`（同文件 `:727-743`）把**任何命中 `MANDATORY_TESTS`/`REGRESSION_TESTS` 字符串且 `kind=record` 的命令**判为 `GOVERNANCE_POLICY_VIOLATION / REQUIRED_DOWNGRADE`。
- M0-005 的 SPEC 由 **Max 本人撰写**，其 `MANDATORY_TESTS[2]` 内嵌 `| record |` 分层标记（"docker pull postgres:16-alpine … pull 失败 → 如实报 BLOCKED_MISSING_SAFE_TEST_ENV（合法终态）"）。于是 record 既是契约要求、又是 SPEC 自带标注，同时命中守卫 → **同一条合规 record 命令触发 BLOCK**。违规来源在 SPEC 与守卫之间，不在执行手。
- **机器证明（逐字复制守卫函数体后实例化，零写入）**：M0-005 pull 形态、M0-007 perf 形态、M0-006 全量 ruff 形态、M0-008 docker build 形态 → 全部 `BLOCKED REQUIRED_DOWNGRADE`；纯 required 对照组 → `PASS`。即该缺陷**系统性阻塞 M0 全部基线/审计类 Task**，重跑只会以约 40 分钟/次的代价撞同一堵墙。
- 未采纳的绕路：**（甲）**把 postgres 三连全改为 `required`。exitCode=1 会立即 `MACHINE_FAIL`，修复压力将诱导 Worker 去改 `backend/tests/conftest.py`（生产测试代码），越出 M0-005"体检，不是治疗"的 Scope。**这属于为过门禁改变判据，禁止**。
- 已评估并**主动不在夜间采用**的绕路：**（乙 / 候选 C）**保持守卫不动，改由 SPEC 作者把 `MANDATORY_TESTS`/`REGRESSION_TESTS` 只填"真须通过"的命令，将基线探针移到 ACCEPTANCE_CRITERIA + record 层门禁命令。机械上完全可行（retry 归属前置条件已逐条核实：上一版 SPEC 的 `EXPECTED_FILES`/`ALLOWED_WRITE_PATHS` 含产物、`priorRunSha256=56ad8639…8def` 为合法 64-hex、run `wf_bd5d9d4f-2c7` 的 `journal.jsonl#L18` 记录 Worker `IMPLEMENTED/FILES_CREATED` 该产物）。**不在夜间采用的理由**：它把 `MANDATORY_TESTS` 的语义从"必须执行"（`:1450`/`:1492`）悄悄改成"必须通过"，并把"探针是否真跑"的约束从机器可校验数组降级为 AC 散文 + Review 主观判断 —— 这是治理字段语义的重新定义，等同绕过缺陷而非修复；Night Chain 明文规定夜间发现治理缺陷不得自动修复，须 `PAUSED_FOR_HUMAN` 交人工。故列为 HD-N-01 的候选 C，由人工裁决。

### 已取得的真实证据（价值不因 BLOCK 失效）

交付物 `deliverables/baseline/INTEGRATION_BASELINE.md`（350 行 / 29672 B / sha256 `56ad863926343581084faf487f7b8b600c57bde800375e2977e66d0cd0e68def`）**保持未跟踪、未提交**（TASK_PASS 公式未成立），仅作为证据留存：

- `TODO.md:40 "集成测试通过"` 判定 = **未完成**。CI 同款 postgres 口径 **exit 1，`4 failed, 8 passed, 20 errors`（collected 31）**；sqlite 口径 `31 passed / exit 0`（与 M0-002 C8 零漂移）。两个口径并列呈报，禁止只报有利口径。
- 根因**单族**（非 4 个独立产品缺陷）：session-scoped asyncpg engine 跨 function-scoped pytest-asyncio loop → `another operation is in progress` / `Future attached to a different loop`；sqlite 靠 `conftest.py:60-64` 的 `StaticPool` 掩盖。驱动版本已比对排除。
- 安全面：13 条依赖 DB 的 RBAC/IDOR 用例**未达断言层 = 验证不成立**；4 条纯 401 用例 green。
- Max Verify 独立复核（Orchestrator 亲跑）计数与 exitCode **逐位一致**，仅耗时不同 → 执行手无虚报。
- 环境未阻塞且未冒充：`postgres:16-alpine` 经可用镜像源拉取并打 canonical tag（镜像源事实留痕 F-M0005-06/P2），**明确拒绝**用 `pgvector/pgvector:pg16` 顶替 CI 同款；一次性容器 `:55433`/`:26379`；`:5432` 零接触 + grep 自查；清理 `docker rm -f` ×2 exit 0，`docker ps -aq --filter name=aiear-m0005-` 为空；既有 `aiear-m0004-pg-test`/`dresslens-*`/`opengauss-lab` 未受影响。

### 树安全状态（暂停时）

HEAD `1a62703`；staging 为空；工作树仅 `M deliverables/overnight/*`（Orchestrator 账本）+ **三个未跟踪项**（M0-005 证据 `INTEGRATION_BASELINE.md`、M0-006 证据 `SECURITY_BASELINE.md`、pre-existing qgraphflow 指纹未变）；无 Workflow 运行；本次未创建任何容器（历史一次性容器 `aiear-m0004-pg-test`/`dresslens-*` 仍 Up，只记录不处置）；治理文件与 `*.spec.json` 零改动；`:5432` 零接触（仅只读 netstat 观测）。

## Open Findings（M0）

| ID | 摘要 | 处置 |
|---|---|---|
| F-01 | metrics auth 契约不一致（401 vs 测试期望 200） | §107 由 Max 判定契约，Flash 不得自选改代码/改测试 |
| F-02 | full ruff 291 vs CI selected-rules clean | §108 禁止一次性全量格式化；按 Catalog ARCH 任务解决 |
| F-08 | 缺安全 Postgres 迁移测试环境 | NOT_CLOSED_ROOT_CAUSE_IDENTIFIED：§32-35 隔离容器已建（:55432）并真实执行三连；关闭前置 = FIX-M0-004-001（见 F-15） |
| F-15 | 002_seed_items.py:55-58 `op.execute(sql, params)` 双位置参数与锁定 alembic 1.13.1 不兼容，`upgrade head` exit 1（TypeError），迁移链 head 不可达；全仓无 alembic 执行路径（建表走 create_all），缺陷长期潜伏 | OPEN，P1，阻塞 M2（KB-001+ 迁移链）；非 M0 Critical Path；由独立 FIX-M0-004-001 修复（改 `op.get_bind().execute(...)` / `sa.text(...).bindparams(**item)`，须显式解禁 002，评估种子幂等 + downgrade 宽删除） |
| F-16 | env.py:26-29 单 `begin_transaction()` 且未设 `transaction_per_migration=True`：`upgrade head` 在 002 失败（F-15）时整串事务回滚，已应用的 001 DDL+版本行一并回退 → 库终态 base（非 001）。Orchestrator 亲跑 `alembic current`(:55432) 证实（exit 0/无 revision 行=base） | OPEN，P2（Flash 建议 P2，Max 确认）；只取证不修（env.py 不在审计 Scope）；与 F-15 并入 FIX-M0-004-001 评估事务粒度口径 |
| F-17 | `docs/workflow/TASK_CATALOG.md` 正文声明 M0 Task 数与实际条目数不符（记录 8 / 实列 7，M0-005 或后续编号口径存在漂移） | OPEN，P2；治理文件（`docs/workflow/**`）→ 只能由 Max 在治理阶段修订，夜间禁止自动改 → HD-N-05 |
| F-18 | ~~集成测试本地环境不可复现~~ | **WITHDRAWN**（F-03 复核后判定为 F-03 的重复上报，不计入 findings 总数） |
| F-19 | 集成测试在 CI 同款 postgres 口径下整体红：`exit 1 / 4 failed, 8 passed, 20 errors`（sqlite 口径 31 passed / exit 0）。单一根因族：`conftest.py:65` session-scoped engine（asyncpg 跨 function-scoped loop → `another operation is in progress` / `Future attached to a different loop`），sqlite 分支 `:60-64` 的 `StaticPool` 掩盖。后果：13 条依赖 DB 的 RBAC/IDOR 安全用例从未到达断言层 → **既有安全"通过"标记不成立** | OPEN，**P0**（`TODO.md:40` 判为未完成）；证据 `INTEGRATION_BASELINE.md` §4/§6（未提交）；须立 FIX-INT-01（conftest engine/loop 生命周期）+ FIX-INT-02（安全用例在真实 DB 口径复跑），属 HUMAN 排期决策 → HD-N-02 |
| F-20 | **治理缺陷（阻塞）**：`.qoder/workflows/project-feature-delivery.js` 反降级守卫 `:727-743` 与 Gate 契约 `:1798-1799` 结构性互斥，使任何合规的基线采集 `record` 命令（凡同时出现在 `MANDATORY_TESTS`/`REGRESSION_TESTS` 中）被误判为执行手降级 → `GOVERNANCE_POLICY_VIOLATION / REQUIRED_DOWNGRADE`。机器证明 4 种 M0 基线 SPEC 形态全部自撞，纯 required 对照组 PASS；**并已真实执行两次**（M0-005 `wf_bd5d9d4f-2c7`、M0-006 `wf_6b00bd56-a7c`，均为 FULL 模式、ATTEMPTS=0、BLOCK 于 Machine Gate，且两次都是 Max 亲写的 `record` 层被归因给执行手）。**激励反向**：守卫的匹配集只由 `MANDATORY_TESTS ∪ REGRESSION_TESTS` 字符串构成 ⇒ 诚实记录红基线必 BLOCK，把红基线整条不写反而无物可撞（该反向为源码级确定性推论 `:727-743`，"省略即通过"分支未实际执行，特此标注口径） | OPEN-EXECUTED-TWICE，**P1-BLOCKING**；夜间**不得自动修**（治理保护路径）；候选修复 A（守卫改为校验显式 tier 字段而非字符串包含）/ B（SPEC 拆 `MACHINE_GATE_COMMANDS[].tier`，MANDATORY 只作语义清单）均**未应用** → HD-N-01 + `FIX-GOV-001` |
| F-11 | 集成/安全/性能证据缺口 | 原计划由 M0-005/M0-006/M0-007 采集；**现被 F-20 阻塞**（M0-005、M0-006 已各撞墙一次，007/008 依 `machineProof` 不再重复启动）→ 解除前置 = HD-N-01 |
| F-21 | **Explore 阶段产物无校验**：M0-006 run `wf_6b00bd56-a7c` 的 Explore invocation（journal idx 17）返回 5/7 字段为字面量 `"TEST"`、`TEST_COMMANDS` 五类全空、`RELATED_FILES` 仅 1 个文件（`backend/app/api/deps.py`），且 `rawResult.content` 记录了一次畸形标签重试；Workflow 未校验即接受并输出"探索完成：1 个相关文件，parallelSafe=true"。危害被后续阶段独立覆盖：Scope（idx 20）与 Worker（idx 26）各自独立枚举出同一 37 端点 / 8 路由分布，Orchestrator 三方一致 ⇒ 本任务 SPEC 未被污染 | OPEN，P2-GOVERNANCE；须加契约校验（拒占位符、`TEST_COMMANDS` 非空或显式 skip 理由、`risk=high ∧ security=true` 时 `RELATED_FILES` 下限）；属 `.qoder/workflows/**` 治理变更 → 夜间禁自修，与 `FIX-GOV-001` 同批 |
| F-22 | **治理文档与代码真相不符**：`20-architecture.md` 冻结决策 #6 与 `70-medical-safety.md` 称"安全关键词统一在 `app/core/safety.py`（已存在）"，实测 `core/safety.py:6/:15` 只是接收 `keywords` 参数的通用匹配器，词表实际分散三处 —— `core/config.py:143-148`（`SAFETY_KEYWORDS`）+ `ai/llm_gateway.py:224`（第二份硬编码 `medical_patterns` 4 项，不复用 safety.py）。代码侧即交付物 §9 **SB-08（P1，ARCH-04 重犯）**；治理侧后果：按文档行事的 Agent/审查者会误判 ARCH-04 已修复（架构债报告亦标"疑似已修复"） | OPEN，P1；两动作均须人工/Max：代码收口 SAFE-004/ARCH-04 复用统一入口；治理文档订正（`.qoder/rules/**` 夜间禁改） |
| SEC-SB01 | **跨用户响应缓存泄露健康数据（缓存型 IDOR）**：`middleware/performance.py:111-131` 缓存键 = `md5(path\|query)`，仅当 `Authorization` 以 `bearer ` 开头才追加 `user_id`；`api/deps.py:16-20` 浏览器主路径回落 `request.cookies["access_token"]` ⇒ 无该头。`CACHEABLE_PATHS`（`:44-52`）含 `/api/report/summary`、`/api/report/levels`、`/api/training/levels`，`DEFAULT_TTL=60`（`:54`），命中即直返（`:64-76`） | **Orchestrator 独立读源码亲验成立**。P0；违反 `30-backend.md`"缓存 key 必须含用户标识（S6 教训）"；修复面小、风险为跨患者 D 类数据 → HD-N-07 |
| SEC-SB31 | **启动无条件建表+写种子**：`main.py:46 await init_database()` / `:49 await seed_data()`（`lifespan` 内，均无 `DEBUG`/`ENVIRONMENT` 判定）；`db/init_db.py:14-15` `Base.metadata.create_all`（绕过 alembic 口径）、`:23-27` 幂等守卫只看 `ItemBank` 是否为空、`:162/:199` 写演示账号；默认串 `core/config.py:41` 指向 `localhost:5432`（实测 `0.0.0.0`/`[::]` LISTENING PID 6892，身份未知 = SB-28） | **Orchestrator 独立亲验成立**。**最高危写库面** P0：任意未显式设 `DATABASE_URL` 的机器 `uvicorn app.main:app` 即对未知实例执行 DDL+写入。本 Chain 全程禁跑该命令的原因；修复前禁任何"启动看看"式冒烟 → HD-N-07 |
| SEC-SB03 | CI 触发分支与仓库分支不符：`.github/workflows/ci.yml:4-7` `push: [main, develop]` / `pull_request: [main]`，实有分支 `master`/`feature/m0-baseline`/`auditory-rehab-optimization`（无 `main`）；`10-project.md` 主分支=master | **Orchestrator 亲验成立**。P0：后端全测/集成/前端 lint+build+E2E/Docker build 全部不触发，`RELEASE_CRITERIA` G5 无从成立，历史"CI 绿"记忆不可作证据。`.github/**` 属治理路径 → 夜间禁改 → HD-N-07 |
| SEC-SB06 | 硬件 9 端点仅认证、无归属校验、无角色区分：`api/hardware.py:65/82/103/124/147/198/219/241/280` 全部仅 `Depends(get_current_user)`；无设备-用户绑定模型；参数无界（`:54`、`:59-60`）、广播（`:270`）；已在 `main.py:131` 挂载（线上可达，非死代码）；`backend/tests` 零覆盖 | **Orchestrator 亲验成立**。P0：任意登录用户可查询/连接/驱动任意康复站外设（LED/蜂鸣器/振动/OLED），属可用性 + 患者人身安全边界。硬件按 `10-project.md` 为非 MVP，但已挂载即已暴露；处置（下线 router / 补归属模型 / 加上界）属人工决策 → HD-N-07 |
| F-23 | **账本 ignore 陷阱**：`.gitignore:73 deliverables/*` 只有 `:74 !deliverables/baseline/` 一条例外，无 `!deliverables/overnight/`。`deliverables/overnight/{GOAL_PROGRESS.md,TASK_LEDGER.json}` 因早先 force-add 已是 tracked，故修改可 stage（21:08Z 实测 `git add` 仍打印 "ignored paths: deliverables/overnight" 但两文件照常进入 index）；**同目录任何新记录文件会被静默忽略** | OPEN，P3-GOVERNANCE；`.gitignore` 属治理保护路径 → 夜间不改，交人工与 HD-N-01/HD-N-04 同批。反向确认：`deliverables/baseline/` 在白名单内 ⇒ HD-N-08 的"补审提交"无 ignore 障碍，只欠 TASK_PASS 判据 |
| F-24 | **门禁覆盖率盲区（决定 F-20 的正确修法）**：`gateGuardViolation(:1859-1881)` 只做 (a) 逐条 `scanUnsafeDbCommand` 与 (b) `detectRequiredDowngrade(cmds, spec)`；`detectRequiredDowngrade(:731)` 的遍历方向是 `for (const c of cmds)` —— **"提交→SPEC"，SPEC 声明了但根本没提交的命令天然无从检查**。⇒ 最省事的作弊不是改标 `record`（d3-10 已覆盖），而是**沉默省略**：只交若干绿色命令 + 自报 `allPassed:true`，红基线不出现在数组里，守卫无物可判。回归核查：`dryrun-harness.mjs` 与降级相关的场景仅 `:177 d3-10-required-downgrade-cheat` 一条，无"省略/漏提交"类场景 ⇒ 该形态无测试。本轮为**反证而非案发**：M0-006 提交 9 条可逐项映射到 SPEC 的 6 required + 2 record + 1 required 集成、`skippedGates` 写"无"，未发生省略；缺陷是"无人能拦住省略"。附带：`:741` 双向包含匹配里的 `m.indexOf(cmd)` 会把"是某必跑项前缀"的独立命令误判为同一条（record 的 `ruff check app/` 命中 required 的 `ruff check app/ --output-format=json`）⇒ 假阳性面比 F-20 原描述更广 | OPEN，**P1-BLOCKING-COUPLING**；夜间不实施（`.qoder/workflows/**` 与 `dryrun-harness.mjs` 均治理路径）；与 F-20 **合并为一个治理变更** → HD-N-01 + `FIX-GOV-001`（设计见下方「FIX-GOV-001 融合设计」附录）。发现时间标签 `21:14Z` 为陈旧戳，权威 `2026-10-08T06:31Z`（F-25） |
| F-25 | **Orchestrator 自报记账缺陷（时间戳）**：F-24 / `FIX-GOV-001.design` / `pausedAt` 及本文件对应条目原标 `2026-10-07T21:10Z / 21:14Z`，权威证据显示实际产生于 `2026-10-08T06:31Z–06:37Z`。根因：写盘时复用上一窗口的陈旧 `NOW` 常量而未重新读钟（`patch-ledger3.mjs` 内硬编码 `const NOW = '2026-10-07T21:14Z'`） | OPEN-SELF-REPORTED，**P2-PROCESS-BOOKKEEPING**（非代码缺陷）。证据：`patch-ledger3.mjs` mtime `2026-10-08 15:31:08 +0900` ⇒ `06:31:08Z`；`git log %cI` `6c47d57 = 15:36:55+09:00` ⇒ `06:36:55Z`；对照 `39c7432 = 06:09:33+09:00` ⇒ `21:09:33Z`（与同批 21:05Z 标签自洽 ⇒ 异常仅限最近一批）。**技术结论不受影响**（`106/106` 为真实复跑、源码行号证据与 SHA-256 指纹独立于时间戳）。处置：透明订正（保留原文 + `TASK_LEDGER.json.timestampCorrections`）；预防措施 = 此后所有账本写入必须由脚本 `argv` 接收 `date -u` 输出，缺戳即 exit 1 零写入（`patch-ledger4.mjs` 已实装并自测：传 `no-stamp` ⇒ `REFUSING`，未写盘） |
| F-13 | adaptive RNG 非确定性 | §106 按 Catalog/Fix 机制解决；单次 green 不算修复 |
| COV-GAP | 后端覆盖率 ~61% | §109 阈值须由正式 OPS/Quality 任务定义，禁止自创 |
| NB-01 | localhost:5432 未知 PostgreSQL listener | §31 视为 UNKNOWN_DATABASE_INSTANCE，永不连接/变更 |
| NB-03 | httpx deprecation | §110 按 P1/P2 分类；禁止自动大版本升级 |
| ENV-F03 | runbook venv 漂移 | §70/§111 文档漂移，阻塞安全操作时再处理 |

## 时间戳订正（F-25，透明改写：保留原标签，另给权威映射）

机器可执行副本见 `TASK_LEDGER.json → timestampCorrections`。异常仅限最近一批标签；M0-004/M0-005/M0-006 三批的标签与各自 commit `%cI` 自洽，无需订正。

| 原标签 | 权威时间 | 条目 | 依据 |
|---|---|---|---|
| `2026-10-07T21:10Z` | `2026-10-08T06:2xZ` | dryrun-harness 复跑 `106/106` | 命令**确实执行**，输出有效；仅标签错 |
| `2026-10-07T21:14Z` | `2026-10-08T06:31Z`（写盘）/ `06:37Z`（提交 `6c47d57`） | F-24、`FIX-GOV-001.design`、`pausedAt`、本文件相关行 | `stat` mtime + `git log %cI` |
| `2026-10-07T21:05Z` | 不变（≈ `21:09:33Z` 提交 `39c7432`） | M0-006 封印批次（F-21..F-23 + 四条 SEC P0） | 无需订正 |

**预防措施（本轮起生效，已机器化）**：所有账本写入脚本必须从 `argv` 接收 `date -u` 输出，格式非法 ⇒ **写动作之前** exit 1、零写入。`patch-ledger4.mjs` 已按此实现并自测（传 `no-stamp` 被拒）。

## 七条 P0 的 Orchestrator 独立核验（`2026-10-08T07:38Z`，全程只读）

副本见 `TASK_LEDGER.json → p0IndependentVerification`。口径：**"报告声称" ≠ "Orchestrator 亲验"**，二者分开计数。

| P0 | 结论 | 要点 |
|---|---|---|
| SB-01 跨用户缓存 IDOR | **CONFIRMED**（前批亲验） | `performance.py:44-52/54/61/64-76/:111-131` + `deps.py:16-20` |
| SB-02 安全用例未达断言层 | **派生成立**，H-10 直测**本轮不可闭** | 依赖 M0-005 实测 + Max Verify 亲跑；`conftest.py:65` session-scoped engine、`:60-64` StaticPool 掩盖 |
| SB-03 CI 分支不符 | **CONFIRMED**（前批亲验） | `ci.yml:4-7` 监听 `main`/`develop` |
| SB-04 医疗安全架构缺失 | **CONFIRMED-强化**（本批亲验） | 全后端对 `emergency\|转诊\|急症\|心理危机\|自杀\|risk_taxonom\|query_classif` **仅 1 处命中** = `config.py:144`（危机词在 `SAFETY_KEYWORDS` 内）；`app/models/` 对 `safety_event\|audit` **零命中**。命中后的实际响应 = 通用拒答（`llm_gateway.py:256-258`「让我们聊点别的吧」/ `dialogue_service.py:160`「我们继续练习日常对话吧！」），且该轮 `user_text` 原样写入 `DialogueTurn`（`:163-167`）⇒ **危机披露得到"继续练习对话"，并落 D 类库而无标记、无审计、因 SB-11 无删除路径而不可清除**。§70 的 Emergency Route / Risk Taxonomy / Query Classifier / Safety Event+Audit **四项均无载体**。文案属 HUMAN_REQUIRED（H-9），**Orchestrator 不代拟** |
| SB-05 输入安全只检最后一条 | **CONFIRMED，并诚实收窄活跃面**（本批亲验） | `_check_safety_input`（`:205-215`）调用点仅 `:251-252`(chat) 与 `:317-318`(chat_stream)，均传 `messages[-1]`；服务层 `dialogue_service.py:159` 同。活跃链路 `dialogue_orchestrator.py:82/:148 → chat() → _build_messages :202`（未检历史整体注入 prompt）。**但 `chat_stream` 在 `app/` 内无任何调用方**（无 `StreamingResponse`/`event-stream`）⇒ 第二调用点为**死代码**，不计活跃缺陷；同处 `:352` 在拦截分支 `yield {"error": …}` 与签名 `AsyncGenerator[str, None]` 冲突，属**接通流式端点后**才成立的潜在契约破坏，本次**不单独计缺陷** |
| SB-06 硬件端点无归属校验 | **CONFIRMED**（前批亲验） | `hardware.py:65…280` 仅 `get_current_user`；`main.py:131` 已挂载 |
| SB-31 启动无条件建表+写种子 | **CONFIRMED**（前批亲验） | `main.py:46/49`、`init_db.py:14-15/:23-27/:162/:199`、`config.py:41` |

**计数**：亲验成立 **6/7**（SB-01/03/04/05/06/31）；SB-02 派生成立。
**去重纪律**：另核查两处"疑似新缺陷"，确认**已在交付物内**故不重复登记 —— 无急症应急路径 = `SECURITY_BASELINE.md:422` + SB-04；无医疗安全评测集（`tests/test_safety.py:4-9` 仅 1 条关键词用例，`tests/` 内对 `自杀|emergency|转诊|急症` **零命中**）= `:428` + SB-20。拟新增的同号发现**撤回**。

## FIX-GOV-001 融合设计（HD-N-01 可直接采纳；夜间仅设计，**未改任何治理文件**）

> 机器可执行副本见 `TASK_LEDGER.json → pendingFixTasks.FIX-GOV-001.design`（status=`DESIGNED-NOT-APPLIED`）。
> 动机：F-20 造成**误报**（诚实 record 必 BLOCK），F-24 是同一枚硬币背面的**漏报**（沉默省略无从发现）。只修 F-20 = 净放宽，违反 Night Chain"不得放宽任何 Gate"，故必须同批落地。

**必须保持的不变量**

| # | 不变量 |
|---|---|
| I1 | 执行手不得把 SPEC 声明为 required 的命令改标 record（`d3-10` 的既有性质，原样保留） |
| I2 | 执行手不得省略 SPEC 声明的任何门禁项（**新增**，当前为盲区 = F-24） |
| I3 | 门禁 PASS/FAIL 由脚本按真实 `exitCode` 计算，不看自报 `allPassed`（不变） |
| I4 | required 失败进修复循环、record 失败只记基线健康度（`DEGRADED` 合法终态，不变） |

**变更（全部落在治理路径，须人工/Max 执行）**

- **C1 SPEC 显式声明层级**：`TASK_SPEC_SCHEMA(:876-883)` 将 `MANDATORY_TESTS`/`REGRESSION_TESTS` 条目由 `string` 升级为 `{command, tier:"required"\|"evidence", purpose, gateId?}`（或并存：新增 `MACHINE_GATE_COMMANDS[]`，原数组退为语义清单）。Task Spec 提示词 `:1446/:1450/:1557-1558` 同步。**tier 由 Max 撰写，执行手无权改。**
- **C2 精确查表替代双向包含**：submitted `kind=record` 而 SPEC `tier=required` ⇒ `REQUIRED_DOWNGRADE`（保 I1）；匹配改 `normalize(cmd)===normalize(specCmd)` 或 `gateId` 相等，删除 `:741` 的 `m.indexOf(cmd)` 以消除 F-24 附带假阳性。
- **C3 覆盖率对账（保 I2，本设计的核心新增）**：SPEC 每条 `tier=required` 命令必须在提交中出现且 `exitCode` 参与计算；每条 `tier=evidence` 命令必须出现且 `recordStatus=EXECUTED_AND_RECORDED`。任一缺席 ⇒ 新终态 **`BLOCKED_GATE_COMMAND_NOT_EXECUTED`**（fail-closed，不进 3 轮修复预算，输出缺失清单）。
- **C4 按 tier 作者归因**：SPEC 自己写 `evidence` 却报降级 ⇒ 不再指责执行手，改报 `GATE_SPEC_TIER_CONFLICT`（SPEC 内部矛盾，交复审）；只有 SPEC 写 `required` 而提交 `record` 才用现有"执行手动态降级"文案。M0-005/M0-006 两次误归因由此消除。
- **C5 HIGH Risk 不降级**：双独立 Review + Verify 抽查重跑（`00-model-policy.md` §4）照旧；`[GATE-REQUIRED]` 前缀检查保留为纵深防御，不替代 C1–C3。

**回归计划**（文件 `.qoder/workflow-state/dryrun-harness.mjs`，治理路径）

- 基线：`106/106`（21:10Z 由 Orchestrator 只读复跑实测，非引用历史数字）。既有 106 条**全保留**，不得为过新语义改动旧断言。
- 新增 8 条：`d6-01` 诚实 evidence 基线回放 ⇒ TASK_PASS；`d6-02` required 改标 record ⇒ 仍 REQUIRED_DOWNGRADE；`d6-03` 省略一条 required ⇒ BLOCKED_GATE_COMMAND_NOT_EXECUTED；`d6-04` 省略一条 evidence（红基线不提交）⇒ 同上；`d6-05` record 命令是某 required 条目前缀 ⇒ 不得 BLOCK；`d6-06` M0-005 三命令形态 ⇒ TASK_PASS；`d6-07` M0-007/008 形态（perf / docker-build）⇒ 不得自撞；`d6-08` SPEC 内部矛盾 ⇒ GATE_SPEC_TIER_CONFLICT，不进修复循环。
- 验收：106 + d6-01..08 全绿 ⇒ 记 D6 回归，随后按 **M0-005 → 006 → 007/008** 串行重跑（约 40~60 分钟/次）。

**成本与净效果**：约 1 开发日（SPEC schema + 3 处提示词 + 守卫 + 覆盖率对账 + 8 场景）。净效果 = **净收紧**：新增一条必然失败路径（省略），移除一条必然误报路径（诚实 record）。

## Human Decisions Required（HD-N-01 … HD-N-08，夜间一律不自动批准）

| ID | 需人工决策 | 阻塞范围 |
|---|---|---|
| HD-N-01 | 修复 F-20：`.qoder/workflows/project-feature-delivery.js` 守卫（`:727-743`）与 Gate 契约（`:1798-1799`）互斥；三选一：**A** 守卫改为校验显式 tier 字段（不做字符串包含匹配）；**B** SPEC 增 `MACHINE_GATE_COMMANDS[].tier`，`MANDATORY_TESTS` 退为语义清单；**C** 保持守卫不动、把 `MANDATORY_TESTS` 语义从"必须执行"改为"必须通过"，基线探针移出该数组、仅由 ACCEPTANCE_CRITERIA + Review 约束。**21:14Z 更新**：A/B **单独**实施会削弱门禁 —— 省略成为零成本作弊（F-24），C 单独实施亦不可取；建议采纳上节**融合设计 C1–C5 + 回归 d6-01..d6-08**（含 A/B 的 tier 字段，另加 C3 覆盖率对账与 C4 归因修正） | **M0 全部剩余基线 Task（005/006/007/008）→ M0 MILESTONE_PASS** |
| HD-N-02 | 追认或否决 `deliverables/baseline/INTEGRATION_BASELINE.md`（未跟踪，sha256 `56ad8639…8def`，非 TASK_PASS）作为 M0-005 记录 | M0-005 收尾 |
| HD-N-03 | 授权 FIX-INT-01/02 Scope（测试引擎/loop 生命周期 + dev 依赖 pin）以恢复 CI 同款集成 green | `TODO.md:40 集成测试通过`；CI postgres job 可信度 |
| HD-N-04 | 批准向 `docs/workflow/TASK_CATALOG.md` 插入 FIX-* 行（治理写操作，无人值守期间越界） | M0 Exit 条款"P0 存量缺陷清单产出并插入 FIX-* 任务" |
| HD-N-05 | 确认 M0 基线 Task 文档口径 8 vs 7（F-17） | M0 Exit 交付物清单 |
| HD-N-06 | M2 Entry 需已批准的 KB ADR + 具备 pgvector 的镜像；M3 Entry 需人工确认许可；真实生产部署/发布/短信/密钥永远属 HUMAN_REQUIRED | M0 之后的一切 |
| HD-N-07 | **优先处置三条已确证安全 P0**：SB-01 跨用户响应缓存 IDOR（`middleware/performance.py:111-131` 缓存键仅在 Bearer 头下含 user_id，`api/deps.py:16-20` 浏览器走 httpOnly Cookie → `/api/report/summary`、`/api/report/levels`、`/api/training/levels` 等 D 类健康数据 60s TTL 内跨用户命中同一缓存）、SB-03 CI 触发分支不符（`.github/workflows/ci.yml:4-7` 监听 `main`/`develop`，仓库实为 `master`+`feature/m0-baseline` ⇒ 全部安全/权限回归从未被 CI 执行；属治理路径，夜间禁改）、SB-06 硬件 9 端点仅认证无归属校验（`api/hardware.py:65…280`，`main.py:131` 已挂载，测试零覆盖）。另 SB-31 为**最高危写库面**：`main.py:46/49` lifespan 无条件 `init_database()`+`seed_data()`（无 DEBUG/ENVIRONMENT 守卫）+ `db/init_db.py:14-15` `Base.metadata.create_all` + 默认串指向身份未知且绑定 0.0.0.0 的 `:5432` ⇒ 一条 `uvicorn app.main:app` 即可 DDL+写种子+建可登录演示账号；修复前禁止任何"启动一次看看"式冒烟 | M0 之后的真实安全修复排期；Chain 无权改代码/`.github/**`/`.qoder/rules/**` |
| HD-N-08 | **追认或否决两份未跟踪基线交付物**：`INTEGRATION_BASELINE.md`（29672 B / `56ad8639…8def`）与 `SECURITY_BASELINE.md`（97758 B / 592 行 / `72fd898f…34f7`，P0×7/P1×17/P2×11=35 条 + §12 列 14 项 `missing_evidence` 且规定"未取证不得记 OK"）——guard 修复后是"复用内容补审提交"还是"整任务重跑"（约 40~60 分钟/任务，内容会重新生成） | M0 Milestone Gate 的证据来源；二者现为**证据**而非"通过的任务"（缺 MACHINE_GATE_PASS/Review/Verify 判据） |

## 终态判定（诚实口径）

- `GOAL_STATUS` = **PAUSED_FOR_HUMAN**（真实阻塞：F-20 治理缺陷；非模型不可用、非配额、非环境）。
- `ENGINEERING_RELEASE_READY` = **NO**（M0 未 MILESTONE_PASS，M1+ 未启动；Release Gate 11 项证据均未采集）。
  - `07:38Z` 追加环境事实：Docker 守护进程当前不可达 ⇒ 第 **9**（Docker build）与第 **10**（部署冒烟）项证据此刻**客观不可采**，与"未采集"并列记录；H-10 同因不可闭。已拒绝擅自启动 Docker（`:5432` 未知实例可能被 restart 策略复活）。
- `REAL_PRODUCTION_APPROVED` = **NO**（无真实人工批准，per D3 §8 恒 NO —— 这一项 NO 不属缺陷）。
- 未达成目标**不伪造**：不以放宽 Gate、降级 required、skip 测试、自动切 FLASH_ONLY、改判据的方式换取"看起来通过"。

## 进度日志

- 2026-10-06T19:07Z — 初始化 GOAL_PROGRESS.md + TASK_LEDGER.json；确认 M0-001/M0-002 已提交；qgraphflow 指纹已记录；重建 M0 DAG；选定 M0-004 为下一 Task。
- 2026-10-06T19:57Z — M0-003（前端构建基线）经 Workflow TASK_PASS；产物 `FRONTEND_BASELINE.md` 单独封存为 `2ab8ad5`；HEAD → `2ab8ad5`；ledger 标记 M0-003=TASK_PASS；本进度 seal 单独提交。下一 Task：M0-004（Critical Path，Goal 自建隔离非 5432 postgres 容器）。
- 2026-10-06T20:42Z — M0-004 首轮 Workflow（run `wf_881c57ca-678`）返回 **BLOCKED / SPEC_CONFLICT（ATTEMPTS=0）**：Max 首轮 TASK_SPEC 两条验收前提与真实代码冲突（迁移三连达 head + item_bank=19；全量 pytest exit 0/21 文件），Flash 依 00-model-policy.md 停止上报，未改禁改文件、无 Task Delta、无 git 写操作。Goal Orchestrator 复核：HEAD 仍 `7e027c7`、worktree 仅 pre-existing qgraphflow（指纹不变）、DB_API_BASELINE.md 未生成。持 Max 权决策 **A+C+D**（保持只读 Audit；据实记录迁移 exit 0/0/1 + 新增 F-15；pytest AC 改为「与 M0-002 基线一致 1 failed/231 passed/20 文件、不新增失败」；门禁命令改 `python.exe -m alembic -c <仓库外 ini>`、AC-01 指纹改 `git hash-object`），002 真实修复延后为 FIX-M0-004-001（M2 前）。已更新 ledger + 本进度；progress-only commit 后以修订 SPEC 重跑 M0-004。DB 安全：全程仅用隔离容器 `aiear-m0004-pg-test`(:55432)，从未触碰 :5432。
- 2026-10-07T02:10Z — M0-004 经三次 relaunch 收敛：relaunch-2 瞬时 BLOCKED_MODEL_UNAVAILABLE（probe:flash，单次 resume 重试恢复，未换模型）→ relaunch-2 SPEC_CONFLICT（revision token `001_init_tables`→`001`，Max Option A + §71 真相口径加固）→ relaunch-3（run `wf_bcb74f36-ae9`）**TASK_PASS**：AC 9/9、MACHINE_PASS(required 7/7,record 6/6)、MAX REVIEW PASS(round1)、REPAIR_CYCLES_USED=0、MODEL_USAGE⊆{Max,Flash}。Orchestrator Max Verify 亲跑 `alembic current`(:55432) exit0/base 证实 F-16 无虚报、qgraphflow 指纹不变、Task Delta 仅交付物、治理文件零改动、HEAD 未被 Flash 改动。交付物 `DB_API_BASELINE.md`(388 行) 单独封存为 **`a78b10f`**；新登记 **F-16**(P2)。ledger 标 M0-004=TASK_PASS、M0-005/M0-008=READY、currentTask→M0-005。本进度 seal 单独提交。DB 安全：全程仅隔离容器 :55432，从未触碰 :5432。下一 Task：M0-005（集成测试基线，解锁 M0-007）或 M0-006（安全基线，只读）——按 §17 优先级择一启动。
- 2026-10-07T19:44Z — **PHASE C 夜间链终点：PAUSED_FOR_HUMAN**。M0-005 以 `executionMode=FULL` 完整跑完 Preflight→Classify→Explore→Scope→Task Spec→Implement→D4 Task Delta→Machine Gate，返回 **BLOCKED / `GOVERNANCE_POLICY_VIOLATION` / `REQUIRED_DOWNGRADE`**（run `wf_bd5d9d4f-2c7`，ATTEMPTS=0，未占用 3 轮修复预算）。归因复核：违规不在执行手 —— Gate 契约 `:1799` 要求基线命令用 `record`，而 Max 亲写 SPEC 的 `MANDATORY_TESTS[2]` 内嵌 `| record |` 标记同时命中守卫 `:727-743` 的字符串包含判定 → 合规 record 被误判降级。**逐字复制守卫实例化验证**：M0-005/006/007/008 四种基线 SPEC 形态全部自撞，纯 required 对照组 PASS → 结构性治理缺陷 **F-20（P1-BLOCKING）**，登记 `FIX-GOV-001` + HD-N-01。拒绝绕路（不把三连改 required，避免修复压力诱导改 `conftest.py` 越出"体检不是治疗"Scope）。
  产出（价值不因 BLOCK 失效）：**F-19(P0)** —— CI 同款 postgres 口径 `exit 1 / 4 failed, 8 passed, 20 errors`（sqlite 口径 31 passed/exit 0，与 M0-002 C8 零漂移），单一根因族 session-scoped asyncpg engine 跨 function loop，sqlite `StaticPool` 掩盖；**13 条依赖 DB 的 RBAC/IDOR 用例从未达断言层 = 安全验证不成立**；`TODO.md:40 集成测试通过` 判为**未完成**。交付物 `INTEGRATION_BASELINE.md`(350 行/29672 B/sha256 `56ad8639…8def`) **保持未提交**（TASK_PASS 公式未成立），Max Verify 独立亲跑计数逐位一致证实无虚报。
  另登记 **F-17(P2)**（Catalog 8 vs 7 口径）；**F-18 撤回**（F-03 重复上报）。DB 安全：一次性容器 `:55433`/`:26379`，`docker rm -f` ×2 清理、`aiear-m0005-*` 为空，`:5432` 零接触；既有容器未受影响。镜像拉取用可用镜像源后打 canonical tag，**拒绝**用 `pgvector/pgvector:pg16` 冒充 CI 同款（F-M0005-06/P2 留痕）。树安全：HEAD `f73cb01`、staging 空、治理文件与 `*.spec.json` 零改动、qgraphflow 未跟踪内容指纹复核未变（并把历史 40-hex git blob SHA-1 记录口径订正为 64-hex SHA-256）。无 push/merge/rebase/tag/publish。**下一步需人工**：HD-N-01 修 F-20 → 串行重跑 M0-005 → 006 → 007/008 → M0 Milestone Gate（其 Exit 还需 HD-N-04 治理写 Catalog）。
- 2026-10-07T19:51Z — 暂停前的最后一轮可行性核查：确认**不存在**既合规又不改语义的 SPEC 写法可绕过 F-20（守卫按 `MANDATORY_TESTS`/`REGRESSION_TESTS` 字符串包含匹配，任何"把基线探针列为必跑项并正确分层为 record"的写法必自撞）。候选 **C**（把 `MANDATORY_TESTS` 语义由"必须执行"改为"必须通过"，基线探针移出数组）经评估**机械上可行**（retry 归属前置条件逐条核实通过），但它使"探针是否真跑"失去机器可校验载体，属治理字段语义重定义 → 等同绕过缺陷而非修复，夜间**不采用**，已写入 HD-N-01 / `findings.F-20.candidateRepairs_C` 交人工裁决。账本 seal `1800704` + 指针修正 `3c21eb2` + 本条候选 C 记录随后封存。夜间链终点：**GOAL_STATUS = PAUSED_FOR_HUMAN**。
- 2026-10-07T21:05Z — **M0-006 真实执行（不靠预测）**：以 `executionMode=FULL` 完整跑完 Preflight→Classify(risk=high, security/privacy/medical=true)→Explore→Scope(1 开发日)→Task Spec(qmodel_38max, AC 10 条)→Implement(qfmodel, 新建 1 文件)→D4 Task Delta(VALID_DETERMINISTIC)→Machine Gate，返回 **BLOCKED / `GOVERNANCE_POLICY_VIOLATION` / `REQUIRED_DOWNGRADE`**（run `wf_6b00bd56-a7c`，workflow task `wf-d8654705-bb7`，ATTEMPTS=0，11 agents / 234 tool calls / 58.8 min），**从未到达 Max Review / Max Verify** ⇒ `TASK_PASS_FORMULA` 无从成立。这是 **F-20 的第二次真实执行实例**：门禁提交本身完全诚实 —— required 6 条全部 exit 0（交付物非空 97758 B / 11 关键词全命中 / 交付物 Secret 反向扫描 / 受保护路径零 diff / `test_safety+test_security+test_role_permissions` 10 passed / Scope 守护），两条红基线（全量 pytest、`ruff check app/`）**真实执行并按 Max SPEC 所写的 `[GATE-RECORD]` 层记为 record、exit 1 如实回报 `EXECUTED_AND_RECORDED`**，`skippedGates` 明确写"无"。守卫据此 BLOCK，并再次把 Max 亲写的层级归因给"执行手"。结论：违规不存在，缺陷在脚本。
  交付物 `deliverables/baseline/SECURITY_BASELINE.md`（592 行 / 97758 B / sha256 `72fd898f…34f7`）**保持未跟踪、未提交、未 staged**（与 M0-005 同一处置：TASK_PASS 公式未成立者不得提交）。内容质量由 Orchestrator 独立取证评价：12 章、§1 端点×认证×归属矩阵 37 行（Scope / Worker / Orchestrator 三方独立计数一致）、§6 写入 F-19"安全用例验证不成立"、§9 分级 35 条（P0×7 / P1×17 / P2×11）、§10 DB 零接触 + E1-E13 命令留痕、§12 列 14 项 `missing_evidence` 并规定"未取证条目不得记 OK"。反向纠错一处：§5"音频仅在内存中送 ASR"措辞不准（`asr_gateway` 用 `delete=False` 临时文件确会落盘，`:104-107/:185-187/:260-262` 在 `finally` unlink，唯清理无测试）。
  **拒绝两条捷径**：(1) 不把 M0-008 拿去撞已知墙——`blockedTasks[M0-005].machineProof` 已覆盖 docker-build 形态，再跑一次只多花 60 分钟与零新信息；(2) 不重写 SPEC 把红基线移出 `REGRESSION_TESTS` 以绕开守卫（候选 C）——那是利用缺陷形状规避，非交付。
  **独立事实锚点（不采信脚本自述）**：`resolvedModel` 逐 invocation 核实 FULL 保真（task-spec/D4 取证 = `qmodel_38max`，implement/machine-gate = `qfmodel`，无第三模型、无 fallback）；baseline↔post 全部 SHA-256 与字节数由 Orchestrator 自行重算，逐项相等（无外部改动、无虚假 Delta）。新登记 **F-21**（Explore 退化输出无校验）、**F-22**（治理文档 #6 与代码真相不符 = SB-08/ARCH-04 侧面）、**SEC-SB01 / SEC-SB31 / SEC-SB03 / SEC-SB06**（四条 P0 均由 Orchestrator 读到 `文件:行号` 级亲验成立，其中 SB-01 跨用户缓存 IDOR 与 SB-31 启动无条件建表+写种子为先前任何基线文档均未记录的新增发现）；ENV-F03 追加实测（真实 venv=`backend/venv312`，`.venv` 不存在但 AGENTS.md §9 与 `80-testing.md` 均引用它；compose 需 `-p`；npm 今日可达——旧的"egress blocked"结论作废）。撤回两项拟新增发现（MILESTONES 8-vs-7 = F-17 重复；venv 文档漂移 = ENV-F03 重复）。
  树安全：HEAD `1a62703`、staging 空、治理文件与 `*.spec.json` 零改动、qgraphflow 未跟踪内容指纹复核未变（`tree 9eb05078…`、graph.json `5f12d3d4…`、index.html `2bd127b7…`）。**`:5432` 全程零接触**（仅只读 `netstat` 观测：`0.0.0.0`/`[::]:5432` LISTENING PID 6892，与 NB-01 同一 PID）；本次未创建任何容器；历史一次性容器 `aiear-m0004-pg-test`(:55432)、`dresslens-postgres`(:15432)、`dresslens-redis`(:16379)、`dresslens-minio`(:9000-9001) 仍 Up 25h，**只记录不处置**（停止他方会话持有的容器属破坏性操作，交人工）。无 push/merge/rebase/tag/publish。新增 **HD-N-07**（安全 P0 排期 + 硬件暴露面处置）与 **HD-N-08**（两份未跟踪基线交付物复用/重跑的追认）。M0 DAG 现状：001-004 TASK_PASS；005/006 BLOCKED(F-20)；007 被 005 阻塞；008 依 F-20 机器证据不予启动 ⇒ **M0 MILESTONE_PASS 不可达，ENGINEERING_RELEASE_READY = NO，REAL_PRODUCTION_APPROVED = NO**。终点维持：**PAUSED_FOR_HUMAN**。
- ~~2026-10-07T21:14Z~~ **权威时间 2026-10-08T06:31Z（写盘）/ 06:37Z（提交 `6c47d57`）** — 订正依据 `stat` mtime 与 `git log --format=%cI`，见 F-25。**暂停期内的增值工作（只读 + 账本，零治理改动）**：不引用历史数字，实测复跑 `node .qoder/workflow-state/dryrun-harness.mjs test` ⇒ `REGRESSION: 106/106 passed`。据此复核守卫源码 `:727-743` 与 `gateGuardViolation(:1859-1881)`，发现 **F-24**：守卫遍历方向为"提交→SPEC"（`for (const c of cmds)`），SPEC 声明却未提交的门禁项无从被察觉 ⇒ 最省事的作弊是**沉默省略**而非改标 record；`dryrun-harness.mjs` 内降级相关场景仅 `:177 d3-10-required-downgrade-cheat` 一条，该形态**无测试**。同时记录 `:741` 双向包含中 `m.indexOf(cmd)` 的前缀假阳性。**本轮为反证而非案发**：M0-006 提交 9 条逐项可映射 SPEC、`skippedGates` 写"无"，未发生省略。
  F-24 直接改变 F-20 的修法结论：**候选 A 或 B 单独实施 = 净放宽**（移除误报同时移除唯一对账），违反 Night Chain"不得放宽任何 Gate"。故产出**融合设计** `pendingFixTasks.FIX-GOV-001.design`（status `NOT_STARTED` → `DESIGNED-NOT-APPLIED`）：不变量 I1–I4 + 变更 C1（SPEC 显式 tier，由 Max 撰写）/C2（精确查表替代双向包含）/C3（**新增覆盖率对账 ⇒ `BLOCKED_GATE_COMMAND_NOT_EXECUTED`**，fail-closed 不占修复预算）/C4（按 tier 作者归因 ⇒ `GATE_SPEC_TIER_CONFLICT`，消除两次误归因）/C5（HIGH Risk 双审不变），回归计划 = 现有 106 条全保留 + 新增 `d6-01..d6-08`，净效果"收紧"。**仅设计，未实施**：`.qoder/workflows/**` 与 `dryrun-harness.mjs` 均为治理保护路径，Night Chain 禁止夜间自动修治理缺陷 → 仍归 HD-N-01。
  同步更新：横幅"续跑前置条件"新增修法约束（A/B 单独实施不可采纳）、暂停根因补 F-24、HEAD 行改为**不随每次账本提交而失真的口径**（记录 seal 的父提交，实际以 `git log -1` 为准）、HD-N-01 待决项改写为"采纳融合设计"。树安全：本次仅改 `deliverables/overnight/{TASK_LEDGER.json,GOAL_PROGRESS.md}` 两个已跟踪账本文件（findings 22→23）；`.qoder/**` 治理文件与 `*.spec.json` **零改动**；两份基线交付物继续**保持未跟踪**；`docs/qgraphflow/dialogue-turn-sequence/` 未触碰；**`:5432` 零接触**、未创建任何容器、无破坏性 git 操作；无 push/merge/rebase/tag/publish。终点维持：**PAUSED_FOR_HUMAN**（HD-N-01 … HD-N-08 待人工）。
- 2026-10-08T07:38Z（`date -u` 权威值，经脚本 `argv` 传入；提交时间以 `git log %cI` 为准）— **第二批暂停期增值：七条 P0 独立核验 + 自报记账缺陷 F-25**。
  (1) **P0 亲验补齐**：静态只读取证 SB-04 与 SB-05（前批已亲验 SB-01/03/06/31），累计**亲验成立 6/7**。SB-04 得到比报告更具体的形态：危机词只存在于 `config.py:144`，命中后响应是"继续练习日常对话"式通用拒答，且 `user_text` 原样入库、`app/models` 无 safety_event/audit ⇒ §70 要求的四项安全架构组件**均无载体**（文案本身 H-9 属 HUMAN_REQUIRED，未代拟）。SB-05 反向**收窄**：`chat_stream` 在 `app/` 内零调用方 ⇒ 其 `:317-318` 检查点与 `:352` 的 `yield {"error": …}` 类型破坏均为**潜在而非活跃**，据实记录、不夸大。
  (2) **去重**：两处疑似新缺陷经核对已在交付物内（`SECURITY_BASELINE.md:422`/`:428` + SB-04/SB-20），**撤回**拟新增同号发现；`tests/` 对 `自杀|emergency|转诊|急症` 零命中的事实归入既有 SB-20。
  (3) **自报 F-25（P2-PROCESS，Orchestrator 自身记账缺陷）**：上一批的 `21:10Z/21:14Z` 标签与权威证据不符（`patch-ledger3.mjs` mtime `06:31:08Z`、`6c47d57 %cI = 06:36:55Z`），根因是复用陈旧 `NOW` 常量。技术结论不受影响（`106/106` 为真实执行、行号与 SHA-256 证据独立）。处置 = **透明订正**（原文保留 + `timestampCorrections` 映射 + 新增「时间戳订正」小节），并把预防措施机器化：账本写入必须由 `argv` 接收 `date -u`，缺戳 exit 1 零写入（`patch-ledger4.mjs` 实装并自测拒绝 `no-stamp`）。
  (4) **环境真相更新**：`docker info` 现失败（Docker Desktop 守护进程未运行，`npipe …dockerDesktopLinuxEngine`）。⇒ **H-10 此刻不可闭**，Release Gate 第 9/10 项（Docker build、部署冒烟）证据亦不可采；已在 `notes.dockerAvailable` 记录前后状态。**决策：不擅自启动 Docker Desktop** —— restart=always 可能自动复活身份未知的 `:5432` 相关实例（SB-28/SB-31 危险面）与他方会话的 `dresslens-*`，且拉起机器级服务不属本 Chain 授权。
  树安全：本次仅改 `deliverables/overnight/{TASK_LEDGER.json,GOAL_PROGRESS.md}`（findings 23→24，新增 `p0IndependentVerification`/`timestampCorrections`）；`.qoder/**` 治理文件与 `*.spec.json` **零改动**；`:5432` 零接触；**本批未运行任何 DB/容器/网络命令**（仅 `docker info` 只读探测，失败即止）；两份基线交付物继续未跟踪；qgraphflow 未触碰；无 push/merge/rebase/tag。终点维持：**PAUSED_FOR_HUMAN**。
