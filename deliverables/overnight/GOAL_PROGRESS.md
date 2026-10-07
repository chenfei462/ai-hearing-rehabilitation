# GOAL_PROGRESS — Autonomous Delivery Orchestrator

> **⛔ 续跑前置条件（勿跳过）**：M0-005/006/007/008 **禁止在未修复 F-20 前重启** —— Workflow 守卫与 Gate 契约互斥（HD-N-01 / `FIX-GOV-001`），重启必以 `GOVERNANCE_POLICY_VIOLATION / REQUIRED_DOWNGRADE` 再次撞墙（每次约 40 分钟）。唯一正确顺序：人工修 `.qoder/workflows/project-feature-delivery.js` → 重跑 M0-005 → M0-006 → M0-007/M0-008 → M0 Milestone Gate（Exit 还需 HD-N-04 治理写 Catalog）。

> 人类可读进度日志。每完成一个 Task 更新一次。禁止记录任何 Secret 真实值。
> 机器可读状态见同目录 `TASK_LEDGER.json`。

- Goal 启动时间：2026-10-06T19:03Z
- 当前分支：`feature/m0-baseline`
- 当前 HEAD：`1800704`（夜间账本 seal 提交；其上无未提交 Task 判定，仅账本自身）→ 任务侧最后一个安全提交 = `f73cb01`（M0-003 FULL 重跑交付物，父为治理 `c61bfd3` D5 恢复 FULL）；M0-005 **未提交**，见下
- 当前 Milestone：**M0 — Repository Truth & Baseline**
- Goal 状态：**PAUSED_FOR_HUMAN**（2026-10-07T19:41Z 起）
- 暂停根因：**F-20（P1-BLOCKING 治理缺陷）** — Workflow 反降级守卫 `detectRequiredDowngrade`（`.qoder/workflows/project-feature-delivery.js:727-743`）与 Gate 契约（同文件 `:1798-1799`「基线采集类命令必须 `kind=record`」）**结构性互斥**。修复需改治理保护路径 → Night Chain 禁止夜间自动修复治理缺陷。
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

HEAD `f73cb01`（账本 seal 后 `1800704`）；staging 为空；工作树仅 `M deliverables/overnight/*`（Orchestrator 账本）+ 两个未跟踪项（M0-005 证据、pre-existing qgraphflow 指纹未变）；无 Workflow 运行；无 `aiear-m0005-*` 残留容器；治理文件与 `*.spec.json` 零改动。

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
| F-20 | **治理缺陷（阻塞）**：`.qoder/workflows/project-feature-delivery.js` 反降级守卫 `:727-743` 与 Gate 契约 `:1798-1799` 结构性互斥，使任何合规的基线采集 `record` 命令（凡同时出现在 `MANDATORY_TESTS`/`REGRESSION_TESTS` 中）被误判为执行手降级 → `GOVERNANCE_POLICY_VIOLATION / REQUIRED_DOWNGRADE`。机器证明 4 种 M0 基线 SPEC 形态全部自撞，纯 required 对照组 PASS | OPEN，**P1-BLOCKING**；夜间**不得自动修**（治理保护路径）；候选修复 A（守卫改为校验显式 tier 字段而非字符串包含）/ B（SPEC 拆 `MACHINE_GATE_COMMANDS[].tier`，MANDATORY 只作语义清单）均**未应用** → HD-N-01 + `FIX-GOV-001` |
| F-11 | 集成/安全/性能证据缺口 | 原计划由 M0-005/M0-006/M0-007 采集；**现被 F-20 阻塞**（M0-005 已撞墙，006/007 未执行）→ 解除前置 = HD-N-01 |
| F-13 | adaptive RNG 非确定性 | §106 按 Catalog/Fix 机制解决；单次 green 不算修复 |
| COV-GAP | 后端覆盖率 ~61% | §109 阈值须由正式 OPS/Quality 任务定义，禁止自创 |
| NB-01 | localhost:5432 未知 PostgreSQL listener | §31 视为 UNKNOWN_DATABASE_INSTANCE，永不连接/变更 |
| NB-03 | httpx deprecation | §110 按 P1/P2 分类；禁止自动大版本升级 |
| ENV-F03 | runbook venv 漂移 | §70/§111 文档漂移，阻塞安全操作时再处理 |

## Human Decisions Required（HD-N-01 … HD-N-06，夜间一律不自动批准）

| ID | 需人工决策 | 阻塞范围 |
|---|---|---|
| HD-N-01 | 修复 F-20：`.qoder/workflows/project-feature-delivery.js` 守卫（`:727-743`）与 Gate 契约（`:1798-1799`）互斥；三选一：**A** 守卫改为校验显式 tier 字段（不做字符串包含匹配）；**B** SPEC 增 `MACHINE_GATE_COMMANDS[].tier`，`MANDATORY_TESTS` 退为语义清单；**C** 保持守卫不动、把 `MANDATORY_TESTS` 语义从"必须执行"改为"必须通过"，基线探针移出该数组、仅由 ACCEPTANCE_CRITERIA + Review 约束 | **M0 全部剩余基线 Task（005/006/007/008）→ M0 MILESTONE_PASS** |
| HD-N-02 | 追认或否决 `deliverables/baseline/INTEGRATION_BASELINE.md`（未跟踪，sha256 `56ad8639…8def`，非 TASK_PASS）作为 M0-005 记录 | M0-005 收尾 |
| HD-N-03 | 授权 FIX-INT-01/02 Scope（测试引擎/loop 生命周期 + dev 依赖 pin）以恢复 CI 同款集成 green | `TODO.md:40 集成测试通过`；CI postgres job 可信度 |
| HD-N-04 | 批准向 `docs/workflow/TASK_CATALOG.md` 插入 FIX-* 行（治理写操作，无人值守期间越界） | M0 Exit 条款"P0 存量缺陷清单产出并插入 FIX-* 任务" |
| HD-N-05 | 确认 M0 基线 Task 文档口径 8 vs 7（F-17） | M0 Exit 交付物清单 |
| HD-N-06 | M2 Entry 需已批准的 KB ADR + 具备 pgvector 的镜像；M3 Entry 需人工确认许可；真实生产部署/发布/短信/密钥永远属 HUMAN_REQUIRED | M0 之后的一切 |

## 终态判定（诚实口径）

- `GOAL_STATUS` = **PAUSED_FOR_HUMAN**（真实阻塞：F-20 治理缺陷；非模型不可用、非配额、非环境）。
- `ENGINEERING_RELEASE_READY` = **NO**（M0 未 MILESTONE_PASS，M1+ 未启动；Release Gate 11 项证据均未采集）。
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
