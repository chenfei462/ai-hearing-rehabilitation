# GOAL_PROGRESS — Autonomous Delivery Orchestrator

> 人类可读进度日志。每完成一个 Task 更新一次。禁止记录任何 Secret 真实值。
> 机器可读状态见同目录 `TASK_LEDGER.json`。

- Goal 启动时间：2026-10-06T19:03Z
- 当前分支：`feature/m0-baseline`
- 当前 HEAD：`7e027c7`
- 当前 Milestone：**M0 — Repository Truth & Baseline**
- Goal 状态：**IN_PROGRESS**
- 模型政策：仅 `qmodel_38max`(Max) / `qfmodel`(Flash)；执行器 `.qoder/workflows/project-feature-delivery.js`；无违规。
- 串行策略（§18）：夜间默认串行；进度文件在 Workflow 启动前提交，仅在 TASK_PASS 后更新（§116/§117）。

## Pre-existing untracked（§8，PRE_EXISTING_UNCHANGED）

- `docs/qgraphflow/dialogue-turn-sequence/` — 2 文件
  - `graph.json` = `e88c0295861951c58b55028eae611218e1f15089`
  - `index.html` = `cde38f82a5404a2dab46dbda86aa5e070545a676`
  - 每个 Task 结束须复核指纹不变；变化则 BLOCKED_EXTERNAL_WORKTREE_CHANGE。

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
- Commit：`2ab8ad5`
- 产物：`deliverables/baseline/FRONTEND_BASELINE.md`（~30802 bytes，16/16 section）
- GATE_HEALTH=PASS；PROJECT_BASELINE_HEALTH=DEGRADED（§71 M0 合法）
- Findings：F-01 chunk>1000kB vendor-charts 1129.69kB(echarts)；F-02 package.json vs lockfile 版本漂移（semver 内）；F-03 40-frontend.md:36 称"5 test.tsx"实为 6 vitest 文件；F-04 本地 Windows+Node24 ≠ CI ubuntu+Node20；F-05 覆盖薄（10 测试/6 文件，1 e2e spec）
- 模型使用：PLAN=qmodel_38max / IMPLEMENT=qfmodel / REVIEW=qmodel_38max（无违规）

## M0 DAG（来自 docs/workflow/TASK_CATALOG.md，权威）

| Task | Title | Pri | Deps | 状态 |
|---|---|---|---|---|
| M0-001 | 仓库清单 | P0 | — | TASK_PASS |
| M0-002 | 后端测试基线 | P0 | M0-001 | TASK_PASS |
| M0-003 | 前端构建基线 | P0 | M0-001 | TASK_PASS |
| M0-004 | API/DB/迁移基线 | P0 | M0-001 | IN_PROGRESS（SPEC_CONFLICT→Max A+C+D，重跑中，Critical Path） |
| M0-005 | 集成测试基线 | P0 | M0-002,M0-004 | BACKLOG |
| M0-006 | 安全基线 | P0 | M0-002 | READY |
| M0-007 | 性能基线 | P0 | M0-005 | BACKLOG |
| M0-008 | 部署基线 | P0 | M0-003,M0-004 | BACKLOG |

## M0-004（API/DB/迁移基线）— SPEC_CONFLICT 已由 Max 决策（A+C+D）

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

## Open Findings（M0）

| ID | 摘要 | 处置 |
|---|---|---|
| F-01 | metrics auth 契约不一致（401 vs 测试期望 200） | §107 由 Max 判定契约，Flash 不得自选改代码/改测试 |
| F-02 | full ruff 291 vs CI selected-rules clean | §108 禁止一次性全量格式化；按 Catalog ARCH 任务解决 |
| F-08 | 缺安全 Postgres 迁移测试环境 | NOT_CLOSED_ROOT_CAUSE_IDENTIFIED：§32-35 隔离容器已建（:55432）并真实执行三连；关闭前置 = FIX-M0-004-001（见 F-15） |
| F-15 | 002_seed_items.py:55-58 `op.execute(sql, params)` 双位置参数与锁定 alembic 1.13.1 不兼容，`upgrade head` exit 1（TypeError），迁移链 head 不可达；全仓无 alembic 执行路径（建表走 create_all），缺陷长期潜伏 | OPEN，P1，阻塞 M2（KB-001+ 迁移链）；非 M0 Critical Path；由独立 FIX-M0-004-001 修复（改 `op.get_bind().execute(...)` / `sa.text(...).bindparams(**item)`，须显式解禁 002，评估种子幂等 + downgrade 宽删除） |
| F-11 | 集成/安全/性能证据缺口 | 由 M0-005/M0-006/M0-007 基线任务采集 |
| F-13 | adaptive RNG 非确定性 | §106 按 Catalog/Fix 机制解决；单次 green 不算修复 |
| COV-GAP | 后端覆盖率 ~61% | §109 阈值须由正式 OPS/Quality 任务定义，禁止自创 |
| NB-01 | localhost:5432 未知 PostgreSQL listener | §31 视为 UNKNOWN_DATABASE_INSTANCE，永不连接/变更 |
| NB-03 | httpx deprecation | §110 按 P1/P2 分类；禁止自动大版本升级 |
| ENV-F03 | runbook venv 漂移 | §70/§111 文档漂移，阻塞安全操作时再处理 |

## Human Decisions Required

（当前无。§93 类事项出现时在此登记并 PAUSED_FOR_HUMAN。）

## 进度日志

- 2026-10-06T19:07Z — 初始化 GOAL_PROGRESS.md + TASK_LEDGER.json；确认 M0-001/M0-002 已提交；qgraphflow 指纹已记录；重建 M0 DAG；选定 M0-004 为下一 Task。
- 2026-10-06T19:57Z — M0-003（前端构建基线）经 Workflow TASK_PASS；产物 `FRONTEND_BASELINE.md` 单独封存为 `2ab8ad5`；HEAD → `2ab8ad5`；ledger 标记 M0-003=TASK_PASS；本进度 seal 单独提交。下一 Task：M0-004（Critical Path，Goal 自建隔离非 5432 postgres 容器）。
- 2026-10-06T20:42Z — M0-004 首轮 Workflow（run `wf_881c57ca-678`）返回 **BLOCKED / SPEC_CONFLICT（ATTEMPTS=0）**：Max 首轮 TASK_SPEC 两条验收前提与真实代码冲突（迁移三连达 head + item_bank=19；全量 pytest exit 0/21 文件），Flash 依 00-model-policy.md 停止上报，未改禁改文件、无 Task Delta、无 git 写操作。Goal Orchestrator 复核：HEAD 仍 `7e027c7`、worktree 仅 pre-existing qgraphflow（指纹不变）、DB_API_BASELINE.md 未生成。持 Max 权决策 **A+C+D**（保持只读 Audit；据实记录迁移 exit 0/0/1 + 新增 F-15；pytest AC 改为「与 M0-002 基线一致 1 failed/231 passed/20 文件、不新增失败」；门禁命令改 `python.exe -m alembic -c <仓库外 ini>`、AC-01 指纹改 `git hash-object`），002 真实修复延后为 FIX-M0-004-001（M2 前）。已更新 ledger + 本进度；progress-only commit 后以修订 SPEC 重跑 M0-004。DB 安全：全程仅用隔离容器 `aiear-m0004-pg-test`(:55432)，从未触碰 :5432。
