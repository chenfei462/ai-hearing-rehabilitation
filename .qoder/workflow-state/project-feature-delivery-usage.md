# project-feature-delivery Workflow 使用说明

项目级可复用 Dynamic Workflow，用于「完成一个单独、可验收的原子开发任务」（0.5~1.5 开发日）。
整个项目通过反复调用推进：Task 1 → Gate → Task 2 → Gate → …

## 文件位置

| 文件 | 用途 |
|---|---|
| `.qoder/workflows/project-feature-delivery.js` | Workflow 本体（保存后按名称可发现） |
| `.qoder/workflow-state/dryrun-harness.mjs` | 语法/静态/控制流干跑校验器（不启动真实 Agent） |
| `.qoder/workflow-state/<TASK_ID>.spec.json` | 运行时由 Max 生成的不可变 TASK_SPEC（审计留痕） |
| `.qoder/workflow-state/project-feature-delivery-usage.md` | 本说明 |

## 模型强制策略（禁止 fallback）

| 角色 | 模型 | 真实标识（当前 CLI） |
|---|---|---|
| 架构师/项目经理/验收官 | Qwen3.8-Max | `qmodel_38max` |
| 程序员（实施者） | Qwen3.8-Flash | `qfmodel` |

标识来源：`~/.qoder-cn/settings.json` 的 `model.name` 与运行日志
`model_config={"key":"qfmodel","display_name":"Qwen3.8-Flash"}`。
若未来模型标识变更，只需修改脚本顶部的 `MAX` / `FLASH` 两个常量。
探针失败时 Workflow 返回 `BLOCKED_MODEL_UNAVAILABLE`，绝不自动换模型。

## 启动方式（在 Qoder CN 会话中）

Task 模式（默认）：
```
Workflow({ name: "project-feature-delivery", args: { task: "实现知识库 PDF 解析器，支持文本与元数据提取", mode: "task" } })
```
也可直接告诉助手：「用 project-feature-delivery 工作流完成：<任务描述>」。

Milestone Gate：
```
Workflow({ name: "project-feature-delivery", args: { task: "知识库 M1 Milestone", mode: "milestone_gate" } })
```

Release Gate：
```
Workflow({ name: "project-feature-delivery", args: { task: "v1.0 发布", mode: "release_gate" } })
```

## 终态一览（所有路径都有终点）

- `TASK_PASS` / `TASK_FAIL`
- `NEEDS_DECOMPOSITION`（Mega Task，附 recommendedTasks[]，绝不边说大边实施）
- `MILESTONE_PASS` / `MILESTONE_BLOCKED`
- `PROJECT_READY` / `PROJECT_NOT_READY`
- `BLOCKED`：`BLOCKED_DIRTY_MAIN` / `BLOCKED_MODEL_UNAVAILABLE` / `BLOCKED_UNCLEAR_TASK` /
  `SPEC_CONFLICT` / `BLOCKED_MISSING_SAFE_TEST_ENV` / `BLOCKED_REPAIR_LIMIT`（修复循环硬上限 3 轮）/
  `MISSING_TASK` / `INVALID_MODE` / `BLOCKED_NOT_GIT_REPO` / `BLOCKED_WRONG_REPO`

## 流程（task 模式）

Preflight(模型探针+Git守护) → Classify(Max) → Explore(Max只读) → Scope Check(Max)
→ TASK_SPEC(Max,落盘) → Implement(Flash) → Machine Gate(Flash执行命令,退出码裁判)
→ [失败: Self-Repair(Flash,1次) → RCA(Max)+FIX(Flash)，合计≤3轮]
→ Max Review(Max独立审查,只许 PASS/REQUEST_CHANGES) → [REQUEST_CHANGES: Fix(Flash)→重跑Gate→重审]
→ Verify(Max) → Final Report

## Machine Gate 命令分类：required vs record（治理修复 D1）

Machine Gate 的每条命令由 Max 在 TASK_SPEC 指定 `kind`，脚本（非执行手）按 kind 分层裁判：

| kind | 语义 | exitCode!==0 的后果 | 缺安全环境无法执行的后果 |
|---|---|---|---|
| `required` | 本 Task 自身**必须成功**的验证：产物存在、Scope/forbidden-file 校验、Git HEAD/branch 校验、pre-existing untracked 指纹校验、Feature/Bugfix 的目标测试/build/migration 等 | **MACHINE_FAIL**（进入修复循环，≤3 轮，超限 BLOCKED_REPAIR_LIMIT） | 置顶层 `blockedMissingSafeTestEnv=true` → **BLOCKED_MISSING_SAFE_TEST_ENV** |
| `record` | 采集**当前基线事实**：全量 pytest、全量 ruff、安全扫描、性能探针、迁移安全环境可用性等 | **不 MACHINE_FAIL**；结果写入 `findings`（红色基线 ≠ 实现缺陷） | 记 `recordStatus=SAFELY_NOT_EXECUTED_AND_RECORDED` + finding，**不阻塞本 Task** |

- record 命令必须"真执行并记录"（`EXECUTED_AND_RECORDED`）或"安全地不执行并记录原因+环境证据"（`SAFELY_NOT_EXECUTED_AND_RECORDED`）；二者都算采集完成。
- record 命令**采集本身失败**（命令不存在 / 输出无法解析 / 报告无法落盘）→ `RECORD_COLLECTION_FAILED`，按 TASK_SPEC 判定（默认视为未完成 → MACHINE_FAIL）。
- **RECORD_OK ≠ 项目健康**：只表示基线状态被采集，不代表测试全绿。
- **防滥用**：`kind` 只能由 Max 在 TASK_SPEC / Gate Schema 指定；Flash **无权**把 required 降级为 record、无权降低门禁（违者 MODEL/GOVERNANCE POLICY VIOLATION）。普通 Feature Task 默认全部 required；失败的测试**绝不**自动变 record。
- **record 红色不触发 Flash Self-Repair**（基线发现 ≠ 实现缺陷），只有 required FAIL 进入正常修复循环。

### MACHINE_PASS 判据

```
MACHINE_PASS = 所有 required 命令 exitCode===0
             AND 所有 record 命令均 EXECUTED_AND_RECORDED 或 SAFELY_NOT_EXECUTED_AND_RECORDED
             AND blockedMissingSafeTestEnv===false
```

### 双真相（Dual Truth）——最终报告必须分开呈现

- **GATE_HEALTH**：本 Task 自身 required 门禁的 PASS/FAIL。
- **PROJECT_BASELINE_HEALTH**：由 record 结果推导的 HEALTHY / DEGRADED。

绝不允许把 "Gate PASS" 暗示为 "所有测试全绿"。

### Audit Task 示例（M0-001 基线审计形态）

审计类任务只产出报告、不改业务代码。其 Gate 命令：

- required（全绿才 PASS）：Scope 白名单校验、forbidden-file 校验、产物存在（`test -s deliverables/baseline/REPO_INVENTORY.md`）、必备章节完整、branch 校验、HEAD 校验、pre-existing untracked 指纹校验、无业务代码改动、治理文件未改动。
- record（红/缺环境只记录、不阻断）：当前全量 pytest（可能 1 failed/231 passed）、全量 ruff（可能 291 errors）、CI 窄 ruff、集成可用性、安全基线、性能基线、PostgreSQL 迁移安全环境可用性。

结果示例：required 全部 exit0 → **GATE_HEALTH=PASS**；record 中 pytest/ruff 红、迁移无安全环境 → **PROJECT_BASELINE_HEALTH=DEGRADED**，F-01/F-02/F-08 进 `findings`。二者互不冲突：审计任务本身 PASS，同时如实记录项目基线是红的。

> 迁移专项：M0-001 不搭建测试库；若无可证明安全的一次性 PostgreSQL 测试库，**禁止**连未知的 localhost:5432 执行 downgrade（会破坏未知库）→ 该 record 命令记 `SAFELY_NOT_EXECUTED_AND_RECORDED` + finding F-08，**不得**为了让任务通过而创建正式库 / 改 DB 配置 / 改 Docker / 改业务代码。安全测试环境本身是后续任务（CT-5）。

## 安全守则（已内置于所有 Agent 提示词）

- 禁止 git push / force push / reset --hard / clean / checkout -- . / restore . / merge 到 main|master
- main/master + dirty → 直接 BLOCKED_DIRTY_MAIN，不改任何文件
- 禁止读取/输出真实 Secret；**required** 命令无安全测试环境 → BLOCKED_MISSING_SAFE_TEST_ENV（**record** 命令无安全环境只记录不阻塞，见上节）
- 医疗安全、隐私数据隔离、架构纪律（禁止推倒重构/换栈/新增微服务等）逐条注入
- Flash 无权：改 SPEC、扩 scope、删/skip 测试、宣布 PASS、调用其他 Agent/模型

## 修改与校验

1. 编辑 `.qoder/workflows/project-feature-delivery.js`
2. 运行校验：
   ```bash
   node .qoder/workflow-state/dryrun-harness.mjs check          # 语法+静态
   node .qoder/workflow-state/dryrun-harness.mjs test           # 全场景回归断言（推荐）
   node .qoder/workflow-state/dryrun-harness.mjs happy          # 干跑单个场景，打印结果 JSON
   ```
   `test` 会 spawn 子进程逐一干跑并按 EXPECT 表断言终态、模型路由子集（仅 qmodel_38max/qfmodel）、gateCalls 上界（防死循环）。
   既有场景：happy / mega / dirtymain / gatefail / gatealwaysfail / reviewfix / modeldown / notask / badmode / milestone / release
   Gate 语义回归（D1 §8 A–H）：feature-required-fail / feature-required-build-fail / feature-required-migration-noenv / scope-required-fail / forbidden-required-fail / audit-record-test-red / audit-record-lint-red / audit-migration-noenv / audit-combined / audit-record-collection-failed

## Git 文件策略（.qoder/ 分类）

| 文件 | 分类 | 建议 |
|---|---|---|
| `.qoder/workflows/project-feature-delivery.js` | A 应提交 | Workflow 本体，团队复用 |
| `.qoder/workflow-state/project-feature-delivery-usage.md` | A 应提交 | 使用说明 |
| `.qoder/workflow-state/dryrun-harness.mjs` | C 临时校验工具 | 可提交（便于改后复检）也可本地保留 |
| `.qoder/workflow-state/*.spec.json`（运行时生成） | D 运行时保留不提交 | 建议 gitignore：`.qoder/workflow-state/*.spec.json` |
| `.qoder/settings.local.json`、`.qoder/sessions/**` | B/D 本地状态 | 建议 gitignore：`.qoder/settings.local.json`、`.qoder/sessions/` |

注：本 Workflow 不修改 .gitignore（属项目文件）；是否提交/忽略由人工决定。

## 第二轮审计记录（2026-10-06）

- 模型路由：21 处 agent() 全部显式 `model: qmodel_38max|qfmodel`，无默认继承、无 fallback；真实冒烟测试双模型均返回 SMOKE_*_OK。
- 角色解释声明：Machine Gate「执行手」与 Milestone/Release「证据收集执行手」由 Flash 担任，属机械性命令执行；判定权不在 Flash——门禁 PASS/FAIL 由脚本按 exitCode 计算（忽略执行手自报 allPassed），Milestone/Release 结论由 Max 判定。
- exitCode 为执行手转述（Workflow API 无法从脚本直接执行 shell），缓解措施：Verify 阶段 Max 必须抽查重跑 1~2 条关键命令核实退出码。
- 治理文件禁区（AGENTS.md、.qoder/rules/**、.qoder/workflows/**、.qoder/workflow-state/**、.gitignore、.github/**）已显式写入 FLASH_RULES，Verify 清单含治理文件改动检查（被改则 TASK_FAIL）。
- TASK_SPEC 落盘防覆盖：同名 spec 已存在时改用 `<TASK_ID>-<git短SHA>.spec.json`，保护历史合同不可变。
- TASK_PASS 唯一路径：Max SPEC → Flash IMPLEMENTED → 脚本 MACHINE_PASS(exitCode) → Max REVIEW PASS → Max VERIFY TASK_PASS，无跳步路径。
- 修复循环硬上限 3 轮（干跑 gatealwaysfail 实证 BLOCKED_REPAIR_LIMIT）。

## 第三轮治理修复 D2（2026-10-07）：Self-Repair 破坏性 Git / 治理文件 / Scope 归属

### 事故根因（D2 要根治的真实事件）

M0-001 resume 期间，Flash Self-Repair 为"消除 git status 中的差异"自行执行了
`git checkout HEAD -- <治理文件>`，把已完成的 D1 治理改动（workflow 本体、harness、usage）
一并还原销毁。暴露三个缺陷：

- **D2-A**：Self-Repair 可执行破坏性 Git 命令（checkout/restore/reset/clean/stash/revert）。
- **D2-B**：Self-Repair 可触碰绝对禁改的治理文件。
- **D2-C**：Machine Gate 用裸 `git status` 判 Scope，无法区分"任务前已存在的授权改动
  （PRE_EXISTING_AUTHORIZED_CHANGE）"与"本任务改动（CURRENT_TASK_CHANGE）"，把前者的差异
  误判为当前任务越界，诱使执行手去"清理"。

### D2 五层防御（受 Workflow API 能力限制，非工具级硬拦截）

> **能力限制（重要）**：Qoder CN Workflow API 仅暴露 agent/parallel/pipeline/phase/log/budget/workflow，
> **没有 PreToolUse / Bash 拦截 / 工具权限过滤钩子**，脚本无法在 Flash 执行 shell 命令"之前"硬阻断。
> 因此 D2 采用纵深防御，其中第 4 层（指纹校验）捕获任何绕过第 3 层的破坏性命令的**后果**：

1. **提示词禁令**：`FLASH_REPAIR_RULES` 注入每个 Flash 修复类 agent，明令禁止破坏性 Git
   （含 cmd /c、powershell、bash -c、sh -c、git -C、&&、;、| 包装/链接）与治理文件写操作，
   要求遇到归属不明/治理/pre-existing 文件一律返回 `status=BLOCKED`，并如实上报 `gitCommandsRun[]`。
2. **编排器资格预检**：进入修复前脚本用 Task Delta 计算 `allowedRepairFiles` 与 `REPAIR_SCOPE`；
   若为空则直接 `BLOCKED_REPAIR_OUT_OF_SCOPE`，根本不派 Flash。
3. **命令 denylist 扫描**：对 Flash 自报的 `gitCommandsRun[]` 逐条 `detectForbiddenGit()`；
   命中 HARD_DENY（checkout/restore/reset/clean/stash/revert）或 MUTATING（commit/add/rm/mv/apply/am/
   push/pull/fetch/merge/rebase/cherry-pick/switch）→ 立即 `GOVERNANCE_POLICY_VIOLATION`。
   `gitSubcommands()` 会去引号、按 `&& || ; \n | &` 拆段、跳过 git 全局选项，识破包装绕过。
4. **修复后指纹校验**：Max 只读快照 `snapshotWorktree()` 在修复前后各拍一次；`verifyRepairFingerprints()`
   比对 pre→post 新变更是否 ⊆ allowedRepairFiles，并复核全局 Task Delta；越界 → `BLOCKED_*`。
5. **立即 BLOCK 交人工**：任一层命中即返回终态、写 attemptHistory，绝不重试放行。

### Task Delta（WORKTREE_BASELINE 指纹快照，D2-C 核心）

Preflight 在 dirty-main 守卫之后由 Max 只读拍 `WORKTREE_BASELINE`（head/branch/staged/
trackedModified/trackedDeleted/untracked/每文件 hash）。Implement 后与每次修复后再拍当前快照，
`classifyDelta(baseline, current, authorizedGovernanceWrites)` 把每个脏路径归类为：

| 分类 | 含义 | 处置 |
|---|---|---|
| `preExistingUnchanged` | 任务前已脏、hash 未变 | **不是违规**（授权基线改动，禁止清理） |
| `taskChanged` | 任务期间新出现/被改的非治理文件 | 本任务合法产物，参与 allowedRepairFiles |
| `taskGovernance` | 任务期间新出现/被改的治理文件（除授权 specPath） | `BLOCKED_GOVERNANCE_CONFLICT` |
| `externalChangedDuringTask` | 任务前已脏、hash 却变了（非治理） | `BLOCKED_EXTERNAL_WORKTREE_CHANGE` |
| `preExistingReverted` | 任务前已脏、现在消失了 | `BLOCKED_EXTERNAL_WORKTREE_CHANGE`（疑似被还原） |
| `headChanged` | HEAD 变了 | `BLOCKED_GIT_HISTORY_MUTATED` |
| `stagedAppeared` | 出现新暂存 | `BLOCKED_GIT_INDEX_MUTATED` |

Scope 判定权归**脚本**（`SCOPE_JUDGE=SCRIPT_TASK_DELTA`），Machine Gate 提示词与 Verify 均以 Task Delta
为准，**不再用裸 git status**；`preExistingUnchanged` 明确不算越界，杜绝"为过门禁去 checkout 还原"的动机。
授权的 `.qoder/workflow-state/<TASK_ID>.spec.json` 落盘通过 `authorizedGovernanceWrites` 豁免。

### 治理保护集中化

`GOVERNANCE_PROTECTED_PATHS = [agents.md, .qoder/rules/, .qoder/workflows/, .qoder/workflow-state/,
.gitignore, .github/, docs/workflow/]`（含 `SELF_WORKFLOW_PATH`）。`isGovernancePath()` 统一判定，
Classify/Implement/Repair/Verify 各阶段共用同一真相源。

### D2 新增终态

`BLOCKED_GOVERNANCE_CONFLICT`、`BLOCKED_EXTERNAL_WORKTREE_CHANGE`、`BLOCKED_GIT_HISTORY_MUTATED`、
`BLOCKED_GIT_INDEX_MUTATED`、`BLOCKED_REPAIR_OUT_OF_SCOPE`、`GOVERNANCE_POLICY_VIOLATION`。
均为"立即 BLOCK 交人工"，不进修复循环、不消耗 3 轮预算。

### D2 回归场景（新增 15 条，总数 21→36）

d2-01 治理文件任务前已脏且未变→TASK_PASS（不清理）｜d2-02 治理文件 hash 变→BLOCKED_GOVERNANCE_CONFLICT｜
d2-03~07 Self-Repair 分别报 checkout HEAD/restore/reset --hard(cmd /c)/clean -fd(bash -c)/stash→
GOVERNANCE_POLICY_VIOLATION（gateCalls=1，denylist 命中）｜d2-08 Flash 写 workflow.js、d2-09 写 AGENTS.md→
BLOCKED_GOVERNANCE_CONFLICT｜d2-10/d2-13 Self-Repair 合法（仅 git status/diff + 改允许文件）→TASK_PASS｜
d2-11 pre-existing 被改→BLOCKED_EXTERNAL_WORKTREE_CHANGE｜d2-12 治理根因→BLOCKED_GOVERNANCE_CONFLICT｜
d2-14 修复后 pre-existing 变化（benign git status，由第 4 层指纹捕获）→BLOCKED_EXTERNAL_WORKTREE_CHANGE｜
d2-15 dirty main→BLOCKED_DIRTY_MAIN（守卫未被 D2 削弱）。

D1 的 21 条全部保留且仍 PASS；模型路由仍仅 `qmodel_38max`/`qfmodel`，无新增模型/Agent/fallback；
gateCalls 有上界，无死循环。运行：`node .qoder/workflow-state/dryrun-harness.mjs test` → 36/36。

## 运行监控 / 暂停 / 恢复 / 取消

- 查看运行进度：会话内输入 `/workflows`
- Workflow 在后台运行，完成时自动通知
- 取消：`TaskStop`（传 Workflow 返回的 task id）
- 恢复/续跑：`Workflow({ name: "project-feature-delivery", resumeFromRunId: "<runId>" })`
  ——未变更的 agent 调用直接命中缓存，仅重跑改动之后部分
- 删除 Workflow：删除 `.qoder/workflows/project-feature-delivery.js` 即可
