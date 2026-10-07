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

> **执行模式（D5 起）**：顶部 `EXECUTION_MODE` 默认 `'FULL'`——`qmodel_38max` 承担规划/探索/审查/验收/RCA，
> `qfmodel` 承担实施/门禁/修复，即 AGENTS.md §2 的原始双模型政策。
> `FLASH_ONLY`（D3 人工授权降级）**未删除**，改为**显式 opt-in**：只有调用方传 `executionMode:'FLASH_ONLY'`
> 或人工把顶部常量改为 `'FLASH_ONLY'` 时生效；生效时所有运行时角色模型恒为 `qfmodel`，
> 绝不实际调用 `qmodel_38max`/第三模型/default/auto/fallback，且决策角色仍由**相互独立的 agent() invocation** 承担、
> HIGH Risk 双审查与 D1/D2/D4 保护**一分不降**。
> 传入其他值（拼写错误等）→ `INVALID_EXECUTION_MODE`，在任何 agent 调用之前 fail-closed，绝不静默回落默认值。
> Max 不可用 → `BLOCKED_MODEL_UNAVAILABLE`，**绝不自动改用 Flash**。详见下文「第六轮治理修复 D5」。

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
- `PROJECT_READY` / `PROJECT_NOT_READY`（D3：Release 另出 `ENGINEERING_RELEASE_READY` 与 `REAL_PRODUCTION_APPROVED`，无真实人工批准时后者恒为 `NO`）
- `PAUSED_FOR_HUMAN`（D3：`BLOCK_REASON=HUMAN_REQUIRED`，验收本质需真实人工审批，Agent 绝不代批）
- `BLOCKED`：`BLOCKED_DIRTY_MAIN` / `BLOCKED_MODEL_UNAVAILABLE` / `BLOCKED_UNCLEAR_TASK` /
  `SPEC_CONFLICT` / `BLOCKED_MISSING_SAFE_TEST_ENV` / `BLOCKED_REPAIR_LIMIT`（修复循环硬上限 3 轮）/
  `MISSING_TASK` / `INVALID_MODE` / `BLOCKED_NOT_GIT_REPO` / `BLOCKED_WRONG_REPO`
- `BLOCKED`（D2 治理）：`BLOCKED_GOVERNANCE_CONFLICT` / `BLOCKED_EXTERNAL_WORKTREE_CHANGE` / `BLOCKED_GIT_HISTORY_MUTATED` / `BLOCKED_GIT_INDEX_MUTATED` / `BLOCKED_REPAIR_OUT_OF_SCOPE` / `GOVERNANCE_POLICY_VIOLATION`
- `BLOCKED`（D3 新增）：`MODEL_POLICY_VIOLATION`（FLASH_ONLY 路由守卫在任何 agent 调用前拦截被禁模型）/ `GOVERNANCE_POLICY_VIOLATION`（执行手把 required 降级为 record）/ `BLOCKED_UNSAFE_DATABASE_TARGET`（对 `:5432` 破坏性操作）

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

## 第四轮治理迁移 D3（2026-10-07）：FLASH_ONLY_DEGRADED_MODE（人工授权的降级模式）

### 背景与授权

Max（`qmodel_38max`）配额耗尽，无法承担规划/探索/审查/验收/RCA 等决策角色。经**人工明确授权**，
新增 `FLASH_ONLY_MODE` 作为降级运行模式：所有运行时角色的**模型**改为 `qfmodel`，但角色**独立性**、
门禁裁判权、D1/D2 全部保护**一分不降**。`FULL_MODE`（Max+Flash 双模型）**完整保留**，为未来恢复路径。

- （D3 时点）顶部常量曾为 `EXECUTION_MODE = 'FLASH_ONLY'`；**D5 起默认已恢复 `'FULL'`**，FLASH_ONLY 改为显式 `executionMode:'FLASH_ONLY'` 才生效。
- 回到双模型：默认即是（无需传参），或显式传 `executionMode:'FULL'` —— `qmodel_38max` 规划/审查/验收 + `qfmodel` 实施/门禁。
- FLASH_ONLY 运行期间**绝不**实际调用 `qmodel_38max` / 任何第三模型 / default / auto / fallback。

### 角色 → 模型路由（`modelFor(role)`）

| 角色 | FULL 模型 | FLASH_ONLY 运行时模型 | 独立性来源 |
|---|---|---|---|
| FLASH_PLANNER（preflight/classify/scope/spec） | Max | `qfmodel` | 独立 agent() invocation |
| FLASH_EXPLORER（explore） | Max | `qfmodel` | 独立 invocation（只读） |
| FLASH_WORKER（implement） | Flash | `qfmodel` | 独立 invocation |
| FLASH_GATE/证据执行手（machine-gate/milestone/release-evidence） | Flash | `qfmodel` | 机械执行手，无判定权 |
| FLASH_REVIEWER A（max-review） | Max | `qfmodel` | 独立 invocation，与 Worker 分离 |
| FLASH_REVIEWER B（max-review-b，仅 HIGH Risk） | Max | `qfmodel` | **第二个**独立 invocation，看不到 A 的结论 |
| FLASH_VERIFIER（verify/verdict） | Max | `qfmodel` | 独立 invocation |
| FLASH_RCA（rca，第 2 轮起） | Max | `qfmodel` | **新独立** invocation，非原 Worker 会话 |
| 快照（worktree-snapshot） | Max | `qfmodel` | 只读 |

**关键约束**：Planner / Worker / Reviewer / Verifier 必须是**相互独立的 invocation**；
禁止"同一个 Flash 会话先写代码再自我验收"。HIGH Risk 追加 A+B 双独立审查（不同 label、不同调用）。

### HIGH Risk 判定（触发双独立审查）

`isHighRisk(cls)` = `riskLevel==='high'` ∨ `securitySensitive` ∨ `medicalSensitive` ∨
`taskType ∋ {auth, security, medical, migration, deployment}`。
（**不含泛化 privacySensitive**，以保证 legacy 场景仍单审查、D1/D2 回归不受影响。）
HIGH Risk 最小集合覆盖：安全、认证、RBAC、IDOR、隐私、健康数据、语音数据、医疗安全、敏感迁移、发布配置。

### Normal / HIGH Task 的 PASS 合成判据（写入 `TASK_PASS_FORMULA`）

```
TASK_PASS = MACHINE_GATE_PASS ∧ INDEPENDENT_FLASH_REVIEW_PASS ∧ FLASH_VERIFY_PASS
          ∧ TASK_DELTA_PASS ∧ GOVERNANCE_GUARD_PASS
HIGH Risk 追加：INDEPENDENT_FLASH_REVIEW_PASS 要求 Reviewer A 与 B【均】PASS
```

- **实施者（FLASH_WORKER）自报 IMPLEMENTED/PASS/DONE 一律无最终验收权**；Machine Gate 由脚本按真实 `exitCode` 计算（忽略执行手自报 `allPassed`）。
- 最终报告含 `WORKER_SELF_REPORT.finalAuthority = NONE`、`REVIEW_INVOCATIONS`、`HIGH_RISK`。

### D1 / D2 在 FLASH_ONLY 下全部保留（不得因降级降低门禁）

- **D1**：required/record 分层、recordStatus、findings、GATE_HEALTH、PROJECT_BASELINE_HEALTH 双真相全部保留；required 失败必须阻断，record 红只如实记录。
- **D2**：WORKTREE_BASELINE、Task Delta、GOVERNANCE_PROTECTED_PATHS、SELF_REPAIR_ELIGIBILITY、DESTRUCTIVE_GIT_PROTECTION、pre/post 指纹、PRE_EXISTING_UNCHANGED、EXTERNAL_CHANGED_DURING_TASK 全部保留。Flash 修复仍禁 `git checkout/restore/reset/clean/stash/revert/merge/rebase/cherry-pick/switch`。绝不重演"D1 回滚被 Flash 执行"事故。
- **新增反作弊扫描（`gateGuardViolation()`，门禁后、判定前）**：
  - `detectRequiredDowngrade()`：执行手把 TASK_SPEC 必跑项或含 `[GATE-REQUIRED]` 的命令记为 `kind:record` → `GOVERNANCE_POLICY_VIOLATION / REQUIRED_DOWNGRADE`。
  - `scanUnsafeDbCommand()`：命令指向 `:5432`（UNKNOWN/可能生产实例，精确匹配、不误伤一次性测试库 `:55432`）且含 drop/truncate/delete/downgrade 等破坏词 → `BLOCKED_UNSAFE_DATABASE_TARGET`。同样扫描修复 Worker 自报的 `gitCommandsRun[]`/`commandsRun[]`。

### HUMAN_REQUIRED 绝不自动批准（`PAUSED_FOR_HUMAN`）

Classify 阶段判定 `humanDecisionRequired=true`（真实医疗专家验证 / 患者数据授权 / 伦理审查 /
版权许可 / 生产密钥 / 生产库危险操作 / 正式生产部署 / 支付 / 真实验证码 / 法务）→
立即返回 `PAUSED_FOR_HUMAN` / `BLOCK_REASON=HUMAN_REQUIRED`，**不实现任何代码、不改任何文件**，交人工审批。

### Release 终态拆分（工程就绪 ≠ 生产已批准）

Release Gate 返回新增 `ENGINEERING_RELEASE_READY: YES/NO`（按门禁判定）与
`REAL_PRODUCTION_APPROVED: 'NO'`（**恒 NO**，除非有真实人工/授权主体批准，绝不假装已获生产批准）。

### D3 新增终态

`PAUSED_FOR_HUMAN`（`BLOCK_REASON=HUMAN_REQUIRED`）、`MODEL_POLICY_VIOLATION`（FLASH_ONLY 路由守卫在任何 agent 调用前拦截被禁模型）、
`GOVERNANCE_POLICY_VIOLATION`（required 降级）、`BLOCKED_UNSAFE_DATABASE_TARGET`（:5432 破坏性目标）。

### D3 回归场景（新增 25 条 d3-01..d3-25，总数 36→61）

d3-01 happy(qfmodel-only/单审/合成判据全真/角色分离)｜d3-02 trip-wire 强制路由 Max→MODEL_POLICY_VIOLATION(0 agent)｜
d3-03/d3-20 required 永远红(含执行手自报 allPassed:true)→BLOCKED_REPAIR_LIMIT（自报无验收权）｜
d3-04 独立 Review 首轮 RC 次轮 PASS→TASK_PASS｜d3-05 Reviewer A 永远 RC→BLOCKED_REPAIR_LIMIT｜
d3-06 Verifier TASK_FAIL→BLOCKED/TASK_FAIL｜d3-07 HIGH 双审均 PASS｜d3-08 B 首否次允→TASK_PASS｜
d3-09 B 永远否决→BLOCKED_REPAIR_LIMIT｜d3-10 required 降级 record→GOVERNANCE_POLICY_VIOLATION｜
d3-11 :5432 DROP→BLOCKED_UNSAFE_DATABASE_TARGET｜d3-12 record 红不降门禁→TASK_PASS｜
d3-13 required 迁移缺安全环境→BLOCKED_MISSING_SAFE_TEST_ENV｜d3-14 Worker 写 AGENTS.md→BLOCKED_GOVERNANCE_CONFLICT｜
d3-15 Self-Repair 报 `git checkout HEAD`→GOVERNANCE_POLICY_VIOLATION｜d3-16 Self-Repair 合法→TASK_PASS｜
d3-17 humanDecisionRequired→PAUSED_FOR_HUMAN｜d3-18 privacy→命中 HIGH，走 A+B 双独立审查（dualReview）｜
d3-19 securitySensitive→HIGH 双审｜d3-21 migration taskType→HIGH 双审｜
d3-22 连红两轮→第 2 轮起新独立 RCA invocation→TASK_PASS｜d3-23 显式 executionMode:'FULL' 恢复路径→qmodel_38max 被调用→TASK_PASS｜
d3-24 HIGH 且 A/B 均永远否决→BLOCKED_REPAIR_LIMIT（有界，无死循环）｜
d3-25 一次性测试库 `:55432` downgrade 不被 `:5432` 反作弊误伤→单审 TASK_PASS。

D1 的 21 条 + D2 的 15 条（含 legacy 11 条已并入 D1 计数）全部保留且仍 PASS；
所有 d3-*（除 d3-23）运行模型集合恒为 `{qfmodel}`；gateCalls 有上界（≤4），无死循环。
运行：`node .qoder/workflow-state/dryrun-harness.mjs test` → **61/61**。

## 第五轮治理修复 D4（2026-10-08）：确定性字节证据 + 内容身份仲裁

### 事故根因（D4 要根治的真实事件）

D2 的 `WORKTREE_BASELINE` 依赖执行手**自报**的 hash 摘要。M0-003 因此被误判 BLOCK：
执行手交回的是 40 位 git blob SHA-1（`git status`/`git diff` 的 index 摘要形态），
脚本拿它与任务前的另一形态摘要相比 → 永远不等 → 判成"pre-existing 文件被外部改动"。
**摘要来源与格式不由脚本固定，内容身份就不可信。**

### 内容身份权威（§6/§22/§23）

```
FINGERPRINT_BACKEND            = AGENT_EXECUTOR_FALLBACK   （实测：脚本沙箱无 fs/crypto/require，SCRIPT_SIDE_HASH_AVAILABLE=false）
CONTENT_IDENTITY_AUTHORITY     = DETERMINISTIC_BYTE_HASH
```

- 文件内容身份 = **SHA-256**；未跟踪目录 = **目录单元** `tree:treeSha256`（成员 manifest 先 `LC_ALL=C sort`，枚举顺序绝不改变身份）。
- `size` 与 `md5` 只做**佐证**（不自洽 → 证据非法），绝不参与身份判定；`mtime` 从未被采集，协议里只允许以 `#` 注释出现，解析器直接忽略 → **"只改了 mtime" 结构上不可能是内容变更**。
- 命令由脚本生成并逐字下发（`git rev-parse HEAD` / `git branch --show-current` / `git status --porcelain=v1 -unormal` / `find|sort` / `wc -c` / `sha256sum` / `md5sum`），执行手（只读 invocation）只负责跑这一条命令并原样回传 stdout；
  **所有判定在脚本侧完成**：`parseFingerprintEvidence` 校验协议头、命令逐字一致、零写入、退出码 0、X/Y 状态、路径 canonical、无重复、SHA-256 必须 64 位小写 hex（40 hex → `DIGEST_IS_40HEX_GIT_BLOB_SHA1`）、md5 32 hex、size 非负整数、目录单元 fileCount 与成员自洽。任一不过 → 该快照**不参与 Task Delta**。

### 接线点（每次都走确定性取证）

Preflight 建 `WORKTREE_BASELINE`｜Implement 前/后｜Self-Repair/受守卫 Flash 修复前/后｜Verify｜Final Governance Guard。

### FINGERPRINT_ADJUDICATION（§16–§20，首次不一致不再直接 BLOCK）

```
baseline ↔ post 身份不一致
→ 两个彼此不可见的独立只读 invocation 重新取证（fingerprint-rehash-a / fingerprint-rehash-b）
→ 脚本比较两者的确定性签名：
   一致且与 baseline 相同 → SNAPSHOT_FALSE_POSITIVE_RECOVERED（继续，M0-003 形态在此被纠正）
   一致且确实不同         → EXTERNAL_CHANGED_DURING_TASK（有字节证据，BLOCK 成立）
   A/B 不一致 / 任一非法   → BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN（停止交人工，绝不猜）
   任务前基线本身非法      → 由两个收敛 invocation 重建（BASELINE_REESTABLISHED_BY_CONVERGENCE）
   非法证据被合法证据替代  → EVIDENCE_REESTABLISHED_BY_CONVERGENCE
```

仲裁预算 1 轮；治理/HEAD/index 违规**不仲裁、不降级**，立即 BLOCK。仲裁全程写入终态报告 `ADJUDICATION` 链。

### 同任务重试产物归属（§26–§30）

`retryOfTaskId` + `retryArtifacts[{path, priorSpecExpected, priorRunSha256, priorRunWorkerEvidence}]` 全部满足才认定 `RETRY_OWNED`：
同任务身份、非治理路径、同时在上一 run 与当前 SPEC 的写白名单内、上一 run 由 Worker 创建/修改的 manifest 证据（≥8 字符）、
`priorRunSha256` 为 64 hex 且与**已验证的**任务前基线字节逐字相等。任一不满足 → 拒绝并给出原因
（`TASK_ID_MISMATCH` / `GOVERNANCE_PROTECTED` / `NOT_IN_CURRENT_TASK_SPEC_ALLOWLIST` / `PRIOR_RUN_SHA256_NOT_64HEX` / `NO_PRIOR_RUN_*` / `ARTIFACT_ABSENT_AT_RETRY_START`）。
`LAST_TASK_OUTPUT_HASH ≠ CURRENT_RETRY_START_HASH` → **在任何写动作之前** `BLOCKED_RETRY_ARTIFACT_CHANGED_EXTERNALLY`：retry 绝不吞掉用户在两次 run 之间的改动。

### 目录单元与写白名单（§25）

pre-existing 未跟踪目录内的新增/删除，先看成员是否落在 `SPEC_SCHEMA.ALLOWED_WRITE_PATHS`（新增，缺省回退 `EXPECTED_FILES`）：
全在 → 归 `taskChanged`；否则 → 目录单元身份变化 → `externalChangedDuringTask`，并把**成员级明细**写入 `treeUnitChanges[{dir, addedOrChanged}]`（删除记 `path (DELETED)`），BLOCK 证据可直接指到具体文件。

### D4 新增终态

`BLOCKED_FINGERPRINT_EVIDENCE_UNCERTAIN`（取证链路不可信，停止而非推断）、
`BLOCKED_RETRY_ARTIFACT_CHANGED_EXTERNALLY`（retry 起点字节与上一 run 产物不符）、
`GOVERNANCE_POLICY_VIOLATION:FINGERPRINT_EXECUTOR_WROTE_FILES` / `:FINGERPRINT_EXECUTOR_FORBIDDEN_GIT`（只读取证执行手写入或跑破坏性 git）。

### D4 回归场景（新增 28 条 d4-01..d4-28，总数 61→89）

d4-01 字节未变→UNCHANGED｜d4-02 仅 mtime 变→绝不判变更｜d4-03 同 size 1 字节差异→SHA-256 捕获+双确认 BLOCK｜
d4-04 size 变→BLOCK｜d4-05/d4-06/d4-07 目录单元增/删/改名→BLOCK 且成员级明细｜d4-08 枚举顺序反转→treeSha 相同→无 Delta｜
d4-09 40-hex SHA-1（M0-003 根因）→UNCERTAIN｜d4-10 非 hex 摘要→UNCERTAIN｜d4-11 协议头缺失→基线重建+证据重建→继续｜
**d4-12 M0-003 误报复现：post 摘要与 baseline 不符但两个独立 rehash 均显示未变 → SNAPSHOT_FALSE_POSITIVE_RECOVERED → TASK_PASS**｜
d4-13 两个 rehash 一致显示真变→BLOCK｜d4-14 A/B 矛盾→UNCERTAIN｜d4-15 qgraphflow 真实形态两次取证签名一致｜
d4-16 同任务产物→RETRY_OWNED_APPLIED｜d4-17 任务号不同→绝不继承｜d4-18 产物被外部编辑→写之前 BLOCK｜
d4-19 治理产物绝不 retry-owned｜d4-20 required 永远红→BLOCKED_REPAIR_LIMIT（D1 未削弱）｜
d4-21 目录在 ALLOWED_WRITE_PATHS 内→归本任务｜d4-22 Self-Repair 破坏性 git→仍 BLOCK｜
d4-23 HIGH 双审+确定性证据→TASK_PASS｜d4-24 HUMAN_REQUIRED→仍 PAUSED_FOR_HUMAN｜
d4-25 执行手改写命令→UNCERTAIN｜d4-26 执行手写文件→标记违规且 fail-closed｜
d4-27 fileCount 不自洽 / d4-28 孤儿树成员→证据非法→UNCERTAIN。

D1 21 条 + D2 15 条 + D3 25 条 + D4 28 条 = 89（legacy 已并入 D1 计数）**全部保留且仍 PASS**；
运行：`node .qoder/workflow-state/dryrun-harness.mjs test` → **89/89**（含 `SYNTAX_OK` + `STATIC_OK`）。
> 上面是 **D4 时点**的总数；D5 起全量为 **106/106**（89 条既有场景全部保留 + 17 条 d5-*），见下文「第六轮治理修复 D5」。
终态报告新增 `GOVERNANCE_D4`（backend/authority/PINNED_COMMAND_PROTOCOL/EVIDENCE_RUNS/INVALID_EVIDENCE_DETECTED/FALSE_POSITIVES_RECOVERED/ADJUDICATION）
与 `TASK_DELTA.retryOwnedArtifacts` / `TASK_DELTA.treeUnitChanges`。

## 第六轮治理修复 D5（2026-10-08）：恢复 FULL 为默认执行模式（FLASH_ONLY 完整保留为显式降级）

### 背景与授权

Max（`qmodel_38max`）配额恢复。D3 的 `FLASH_ONLY_DEGRADED_MODE` 本是为配额耗尽而设的**受控例外**，
例外不应长期成为默认——否则"Flash 无验收权"的原始双模型政策只剩调用隔离一层保障。
经**人工授权**，D5 的唯一目标是把默认执行模式从 `'FLASH_ONLY'` 改回 `'FULL'`，同时
**完整保留 FLASH_ONLY 能力**（显式 opt-in）与 D1/D2/D3/D4 的全部保护。

### 改动清单（5 处，全部在 Workflow 脚本内）

1. `let EXECUTION_MODE = 'FULL'`（原 `'FLASH_ONLY'`）——顶部默认值即双模型。
2. `modeSummary()` 新增审计字段：`DEFAULT_EXECUTION_MODE:'FULL'`、`FULL_MODE_PRESERVED:true`、
   `FLASH_ONLY_MODE_PRESERVED:true`、`AUTO_MODEL_FALLBACK:'FORBIDDEN — …'`、`DEGRADED_MODE_OPT_IN:'…'`。
   终态报告因此**自证**当前模式与政策，而不是靠文档声明。
3. 输入解析 fail-closed：`executionMode` 只接受 `'FULL' | 'FLASH_ONLY'` 或缺省；
   其他值 → `INVALID_EXECUTION_MODE`（`FAILED_PHASE=Input`，**零 agent 调用**），绝不静默回落默认值——
   否则 `'flashonly'` 这类拼写错误会把任务悄悄换成另一套模型政策。
4. 新增 `EXPECTED_RUNTIME_MODEL`（FULL / FLASH_ONLY 两张"角色 → 应有运行时模型"真值表）。
5. Preflight 路由守卫在原有"允许模型集合"检查之后追加**逐角色矩阵校验**：
   FULL 下决策角色（planner/explorer/reviewer/reviewerB/verifier/rca/snapshot）必须是 `qmodel_38max`、
   实施角色（worker/gate/fixer/evidence）必须是 `qfmodel`；反向串位同样在**任何 agent() 调用之前**
   `MODEL_POLICY_VIOLATION`（`VIOLATION_KIND=ROLE_MODEL_MISMATCH`）。这让"默认已恢复 FULL"成为机器可校验事实。

角色矩阵（FULL）：Preflight / Classify / Scope Check / Task Spec / Explore / RCA / Review A / Review B /
Verify / Milestone Verdict / Release Security / Release Verdict / 指纹取证执行手 = `qmodel_38max`；
Implement / Machine Gate / Self-Repair / FIX_SPEC 实施 / Gate 证据收集 = `qfmodel`。

### 无 fallback 的两条独立证明

- Max **探针**失败（`probe:max` 返回空）→ `BLOCKED_MODEL_UNAVAILABLE`，其后的 Preflight/Classify/Implement 等
  一个都不启动（d5-10）。
- Max **探针通过、但某个 Max 角色实际返回空**（运行中配额耗尽）→ 同一终态，绝不把该角色改用 `qfmodel` 重跑（d5-11）。
  实施者（`qfmodel`）在两条路径里都没有代替决策角色的机会。

### D3 能力保留证明

显式 `executionMode:'FLASH_ONLY'` 仍然完整可用且判据不变：运行时模型集合恒为 `{qfmodel}`、
单审查任务仍 `TASK_PASS`、HIGH Risk 仍是两个彼此独立的 `qfmodel` 审查 invocation 均 PASS（d5-12 / d5-13）。
D4 的确定性字节证据与同任务重试产物归属在 FULL 下同样成立（d5-15 / d5-16），
D2 的治理文件写保护在 FULL 下同样 `BLOCKED_GOVERNANCE_CONFLICT` 且不启动任何修复（d5-17）。

### D5 回归场景（新增 17 条 d5-01..d5-17，总数 89→106）

d5-01 **默认形态（完全不传 executionMode）**→ ACTIVE/DEFAULT_EXECUTION_MODE 均 `FULL` 且双模型真分工｜
d5-02 显式 `FULL` 与默认等价｜d5-03 Planner 族逐调用 = Max｜d5-04 Explorer = Max｜
d5-05 Worker/Gate = Flash 且 Review/Verify = Max｜d5-06 RCA = 独立 Max（Self-Repair/Fix 仍 Flash）｜
d5-07 Reviewer = Max｜d5-08 Verifier = Max｜d5-09 HIGH Risk A+B 均 Max 双独立审查｜
d5-10 Max 探针失败 → `BLOCKED_MODEL_UNAVAILABLE`（Flash 无任何代替调用）｜
d5-11 Max 角色返回空 → 同一终态（无 fallback）｜
d5-12 显式 `FLASH_ONLY` 降级路径保留（qfmodel-only + 默认字段仍 FULL）｜
d5-13 `FLASH_ONLY` + HIGH Risk 双独立审查仍生效（A/B 均 qfmodel）｜
d5-14 非法 `executionMode` → `INVALID_EXECUTION_MODE`，`FAILED_PHASE=Input`、零 agent 调用、不降级｜
d5-15 D4 确定性字节证据在 FULL 下保持｜d5-16 D4 retry 产物归属在 FULL 下保持｜
d5-17 D2 治理写保护在 FULL 下保持（Worker 改 `AGENTS.md` → BLOCK，gateCalls=0）。

既有 89 条（legacy 11 + §8 A–H 10 + D2 15 + D3 25 + D4 28）**全部保留且仍 PASS**；
运行：`node .qoder/workflow-state/dryrun-harness.mjs test` → **106/106**（含 `SYNTAX_OK` + `STATIC_OK`）。

## 运行监控 / 暂停 / 恢复 / 取消

- 查看运行进度：会话内输入 `/workflows`
- Workflow 在后台运行，完成时自动通知
- 取消：`TaskStop`（传 Workflow 返回的 task id）
- 恢复/续跑：`Workflow({ name: "project-feature-delivery", resumeFromRunId: "<runId>" })`
  ——未变更的 agent 调用直接命中缓存，仅重跑改动之后部分
- 删除 Workflow：删除 `.qoder/workflows/project-feature-delivery.js` 即可
