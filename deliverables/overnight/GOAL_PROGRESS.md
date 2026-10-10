# GOAL_PROGRESS — Autonomous Delivery Orchestrator

> **🟢 当前状态（2026-10-10T05:55:20Z 入账）：HD-N-04 获人工**限定范围**批准（仅 FIX-PERF-03 实施，见下方日志与 `TASK_LEDGER.humanDecisionsRequired`）；首跑 `wf_e7c7af02-88c` 因规划侧缺陷 F-57 BLOCKED（六条 required 门禁全绿，唯一红的是我自设计的文件型自证命令），实施三文件在位且经独立复跑全绿（全量 235 passed / 0 failed，F-01 闭合）。正重新派发同一任务取 Machine Gate → Review A+B → Verify 正式结论。M0 基线 DAG 8/8 仍全绿；Milestone Gate 门前仍等人工：HD-N-04 的另一半（`docs/workflow/TASK_CATALOG.md` 治理写）、HD-N-05、HD-N-09、HD-N-10。**
> **🔴 当前状态（2026-10-10T06:15:24Z 入账，取代上一行的预期）：重试 run `wf_64827cc9-6ae`（FULL）在 **Task Spec 阶段 BLOCKED_MODEL_UNAVAILABLE** —— 机器报错原文是 Max 信用额度耗尽（**F-29 复发**，已挂 `findings['F-29'].recurrences`），**不是**模型标识失效：同 run 内 `qmodel_38max` 与 `qfmodel` 两次探针都返回 OK，Classify/Explore/Scope Check 三个 Max 只读角色也真实产出。政策禁止换模型、禁止自动降级 FLASH_ONLY ⇒ 终点 **PAUSED_FOR_HUMAN**，需人工三择一：**(甲)** 恢复/提升 Max 额度后 `resumeFromRunId:"wf_64827cc9-6ae"` + 完全相同 args 复跑（7 个已完成 agent 命中缓存，复跑前须重取三文件 sha256 确认未变）〔**⚠ 06:18:13Z 订正：本项作废 —— resume 必现假阳性 BLOCK，见 F-58。正确姿势是"同 args 全新派发"（新 runId、不用 resume）：该 blocked run 的缓存 baseline 里 `H|d7c3092b34a2…` 锁死了派发时 HEAD，而我随后落了记账 commit（→ `d8a36ab`）；脚本 :580/:627/:2426 把 `baseline.head ≠ current.head` 判为 `BLOCKED_GIT_HISTORY_MUTATED` 且不进仲裁 ⇒ 照原建议做必然 BLOCK。全新派发则新 baseline 取当前 HEAD，且任务期间本链不再产生任何 commit；三条 retryArtifacts 仍成立（工作树 sha 逐字节未变）**〕；**(乙)** 显式授权 FLASH_ONLY；**(丙)** 人工自行跑门禁并封存。本链不自选。**FIX-PERF-03 未封存**：三个测试文件仍为工作树未提交状态，sha256 与派发前逐字节相同，本次 run **零仓库写入**（该 run 派发时 HEAD 为 `d7c3092`；记账后当前 HEAD `d8a36ab`）。**
> **🟡 当前状态（2026-10-10T07:09:46Z 入账，取代上一行的三择一）：人工已裁决 = **甲** ⇒ FIX-PERF-03 以**同一 args 全新派发**（新 runId，**不 resume**，理由见 F-58）。乙（FLASH_ONLY）未被选中 ⇒ 不生效；治理写与其它 HD/FIX 项一律未授权。本链承诺 **run 期间零 commit**，记账待终判后落；终判为 TASK_PASS 才精确封存三测试文件，否则继续 `PAUSED_FOR_HUMAN`。**
> **🔴 当前状态（2026-10-10T07:16:55Z 入账，取代上一行的执行预期）：甲 已如实执行一次并**结构性受阻** —— run `wf_a5710a52-f4d`（args 逐字节同上批、未传 resume）在 **Preflight 的 Max 探针**即 `BLOCKED_MODEL_UNAVAILABLE`（`agentCount=2 / totalToolCalls=0 / 11597ms`），断点比第 1 次复发（Task Spec）更靠前：额度已从"够跑几步就断"的渐变退化为布尔 false ⇒ **`FULL` 模式当前不可执行**，重复派发只会以零进展重付一次 Preflight。探针 transcript 逐字节佐证身份而非采信标签：`…-b774ef1d102474b2.jsonl` 的 assistant 消息 `model":"<synthetic>"` 正文即额度提示（平台在模型侧之前拦截），`…-bfcec9dd47f2fb88.jsonl` 的 `model":"qfmodel"` 正常返回 `OK` ⇒ 有证据的结论是 **qfmodel 可用 / qmodel_38max 不可用**；编排侧本会话不在这两个 invocation 内，不得据"我还能写记账"反推 workflow 内 Max 可用。**全程零仓库写入**：HEAD 仍 `fea2053`，三测试文件 sha256 与派发前逐字节相同（`a788ef6e…6ca4` / `fa639d5e…889c` / `a32d3875…52d4`）。五个 Task-PASS 判据**一个都未取得**，机器侧 `RETRY_OWNED` 判定仍未产生（`applyRetryOwnership()` 在 Task Spec 之后，脚本 line 1578，本次连 Task Spec 都没到）。现回 **PAUSED_FOR_HUMAN**，请人工在 **甲-等待**（额度恢复后同 args 再全新派发）/ **乙**（显式授权 `FLASH_ONLY`，D3 要求调用方显式请求，本链绝不自动降级；六角色独立 invocation + HIGH 双独立审查等判据原样保留）/ **丙**（人工自跑门禁并封存，本链已独立复跑取证过一次：A 7 passed / B 1 / C 1 / D 10 / E **235 passed 0 failed** / 零文件负向自证实测 FAIL 并报「有效成功样本数不足」）之间裁决；**本链不自选**。HD-N-04 批准仍然有效且范围未变（仅 FIX-PERF-03），本条只问"用什么执行模式跑完"。**
> **🟢 当前状态（2026-10-10T07:23:47Z 入账）：HD-N-11 = 乙，人工**显式**授权 `FLASH_ONLY`（原文「乙 授权 FLASH_ONLY」）⇒ 这是 D3 要求的调用方显式请求形态，不是本链自动降级。执行方式经只读核实：args 传 `executionMode:"FLASH_ONLY"` 由脚本 :1187 覆盖，**:62 在该模式下不探测 Max**（正是越过本次 Preflight 死因的机制），故**脚本顶部 `EXECUTION_MODE` 仍为 `'FULL'`，本批零治理文件改动**；D5 默认双模型政策不受影响，仅这一次调用降级。判据一条不降：Machine Gate（真实 exitCode）∧ 独立 Review（HIGH ⇒ A+B 两个彼此不可见 invocation 均 PASS）∧ Verify TASK_PASS ∧ Task Delta ∧ Governance Guard。范围一条不扩：FIX-PERF-04 / FIX-GOV-006 / FIX-GOV-007 / HD-N-05 / HD-N-09 / HD-N-10 仍未授权，`docs/workflow/**` 仍禁改，push/merge/reset/clean/stash 仍禁。依 F-58 纪律先记账（本行）后派发，**run 期间零 commit**；三测试文件 sha256 逐字节未变，未取得五判据前不封存。**
> 门禁契约已在 4 次真实执行中现场验证：M0-005（declared 9 == submitted 9）、M0-006、M0-007（declared 8 == submitted 8，required 6/6）、M0-008（declared 10 == submitted 10，required 6/6 + record 4/4，其中 `docker compose config/build` 真实 exitCode=1 原样记录、未降级未绕过）。
> 交付物：`REPO_INVENTORY.md`/`BACKEND_TEST_BASELINE.md`（M0-001/002）、`FRONTEND_BASELINE.md`（003）、`DB_API_BASELINE.md`（004）、`INTEGRATION_BASELINE.md`（005）、`SECURITY_BASELINE.md`（006）、`PERF_BASELINE.md`（007）、`DEPLOY_BASELINE.md`（008），提交 sha 见 `TASK_LEDGER.json.taskCommits`。
> **需人工的新裁决 = HD-N-09**：`docs/workflow/TASK_CATALOG.md:29` 对 M0-008 要求『docker build exitCode=0』，而本轮实测该命令在本仓库路径下结构性不可达（compose 项目名为空，`PROJECT_PATH` 派生自中文目录名）。三种口径（甲/乙/丙）见「M0-008」节 E 小节，自治链不自选、无权改 `docs/workflow/**`。
>
> ~~🟡 前置条件只剩最后一步（2026-10-08T11:05Z，HD-N-01 已执行但未封存）~~ —— 以下为该时刻的**历史记录原文**，其"未封存/禁止重启 005-008"结论已被后续真实执行覆盖；原文完整保留于下方「FIX-GOV-001-R1（人工授权治理修复…）」与「FIX-GOV-001-R1 封存 + M0-005 首次实战 TASK_PASS」两节，不做删除。
> **FIX-GOV-001-R1** 已在两个授权治理文件里实施完毕（`.qoder/workflows/project-feature-delivery.js` + `.qoder/workflow-state/dryrun-harness.mjs`），机器证据 `REGRESSION: 115/115 passed`、既有 106 条断言摘要逐字节未变，独立 `qmodel_38max` **Review = PASS（Q1..Q11 全 YES，0 blocker）**。
> **但独立 `qmodel_38max` Verify 两次尝试均被账户 credit 用量上限直接拦死**（`agent[2] max-verify-r1 failed`，第二次经 `resumeFromRunId` 只重跑该调用，2.3s 内同一错误）⇒ 按 §27 该 Fix **不具备 PASS 资格，因此不执行 §28 封存**。改动完整留在工作区，HEAD 仍为 `77fdb32`，未 push / merge / rebase / reset / clean / stash。**（订正：额度恢复后已重跑独立 Verify = TASK_PASS，封存 `d2d7ddb`。）**
> 修复本身已生效的语义（供人工审阅 diff）：Machine Gate 与 TASK_SPEC 的唯一对账键改为 **`MACHINE_GATE_COMMANDS[].gateId`**（声明冻结于 Implement 之前；执行手无权增删 gateId、无权改 `kind`、不得把 required 提交为 record）；`MANDATORY_TESTS`/`REGRESSION_TESTS` 退回**语义清单**，不再与 shell 命令字节串跨层比对（这正是 F-20 假红的根因，d6-01 为回归哨兵）；新增终态 `GATE_SPEC_MALFORMED`（Implement 前 fail-closed，零实施 Agent）／`BLOCKED_GATE_COMMAND_NOT_EXECUTED`（沉默省略）／`GATE_COMMAND_NOT_DECLARED`（未声明 gateId 或顶替成会绿命令）。
> 当时的解锁顺序（已按此执行到底）：恢复 Max 额度 → resume 该 run 只补 Verify → TASK_PASS → 精确封存两文件 → 按 DAG 推进 M0-005 → M0-006 → M0-007/M0-008 → **M0 Milestone Gate**（Exit 仍需 HD-N-04/HD-N-05/HD-N-09 人工裁决）。
>
> 人类可读进度日志。每完成一个 Task 更新一次。禁止记录任何 Secret 真实值。
> 机器可读状态见同目录 `TASK_LEDGER.json`。

- Goal 启动时间：2026-10-06T19:03Z
- 当前分支：`feature/m0-baseline`
- 当前 HEAD：**账本/进度字段按约定记录"本 seal commit 的父提交"**（详见 `TASK_LEDGER.json.headPointerNote`），因此本行数字恒比 `git log -1` 落后一个账本提交 —— 这是记录口径而非漂移，最新提交请以 `git log --oneline -1` 为准。最近两个账本提交：`39c7432`（M0-006 BLOCKED 封印，F-21..F-23 + 四条安全 P0）→ 其父 `1a62703`（候选 C 撤回）。任务侧最后一个安全交付提交 = **`a78b10f`（M0-004 TASK_PASS）**；M0-005 与 M0-006 均 **未提交**，见下。
- 当前 Milestone：**M0 — Repository Truth & Baseline**
- Goal 状态：**PAUSED_FOR_HUMAN**（2026-10-07T19:41Z 起；2026-10-08T11:05Z 因 F-29 账户额度上限再次暂停 —— 暂停原因已从「治理缺陷」变为「无法执行独立 Max 验收」）
- 暂停根因（当前）：**F-29（P0-BLOCKING-CHAIN）** — 账户 credit 用量上限使 `qmodel_38max` 调用无法建立，Task PASS 公式里"独立 Max 验收"这一必要条件不可运行，整条自治链（含后续每个 Task 的 Review/Verify）因此冻结。原 F-20 根因的代码修复已完成并通过独立 Review，仅差 Verify。历史记录如下：
- 暂停根因（历史）：**F-20（P1-BLOCKING 治理缺陷，已真实执行两次确证）** — Workflow 反降级守卫 `detectRequiredDowngrade`（`.qoder/workflows/project-feature-delivery.js:727-743`）与 Gate 契约（同文件 `:1798-1799`「基线采集类命令必须 `kind=record`」）**结构性互斥**。M0-005（`wf_bd5d9d4f-2c7`）与 M0-006（`wf_6b00bd56-a7c`）两次 FULL 模式全程执行均 BLOCK 于 Machine Gate，两次都是 Max 亲写的 `record` 层被归因给执行手。修复需改治理保护路径 → Night Chain 禁止夜间自动修复治理缺陷。配套登记 **F-24（P1-BLOCKING-COUPLING）**：守卫同样缺少"SPEC↔提交覆盖率"对账，此缺陷**决定 F-20 的正确修法** → 融合设计见「FIX-GOV-001 融合设计」附录。
- 模型政策：仅 `qmodel_38max`(Max) / `qfmodel`(Flash)；执行器 `.qoder/workflows/project-feature-delivery.js`；**全程无违规、无 fallback、无换模型**。
- 串行策略（§18）：夜间默认串行；进度文件在 Workflow 启动前提交，仅在 TASK_PASS 后更新（§116/§117）。


## FIX-GOV-001-R1（人工授权治理修复：**未封存**，卡在独立 Verify；2026-10-08T11:05Z，HEAD `77fdb32`）

> 本节为**当时时点**的真实记录，保留不改写。该 Fix 已于 `2026-10-09T14:31Z` 取得独立 Verify 并封存为 `d2d7ddb`，见下文「FIX-GOV-001-R1 封存 + M0-005 首次实战 TASK_PASS」。

- **机器证据（本 Orchestrator 于记账前复跑）**：`node .qoder/workflow-state/dryrun-harness.mjs test` → `REGRESSION: 115/115 passed`、exitCode 0；`SCENARIO_ROSTER: OLD_SCENARIO_COUNT=106 NEW_SCENARIOS_ADDED=9 TOTAL_SCENARIOS=115`；`OLD_EXPECTATION_DIGEST=cecf72bcb036d66b319f6dfd8c77d119bf2a4bdd8a63fea913394bfb0272a7bf`（与工作区版本及 `git show 77fdb32` 侧同法计算逐字节相等 ⇒ A1「断言语义零改动」机器证明）。
- **独立 `qmodel_38max` Review = PASS**：runId `wf_375e92e7-2b8` / taskId `wf-f131bca2-d3c`，Q1..Q11 全 YES、0 blocker、6 条 non-blocking notes。逐条核实了：C2 精确匹配保留（d3-10 命令仍与 `MANDATORY_TESTS[0]` 字节相同且仍被拦）、旧跨层子串对账整段删除（Grep `indexOf(m)` 无残留）、对账只发生在 gateId 层、`validateGateSpec` 在任何实施 Agent 之前（d6-02/09/12 实测 `gateCalls=0`）、三类攻击路径均被拦（未声明 gateId／顶替会绿命令／沉默省略）、四个 `runMachineGate` 调用点全部覆盖且 `:5432` 破坏扫描仍排在最前、无隐藏 required→record 削弱、D1–D5 全数原样通过。
- **独立 `qmodel_38max` Verify = 未运行**：两次尝试（`1791457040380`、`1791457150414`）同一错误 "You've reached your credit usage limit"。绝不以 `qfmodel` 代替（D3 降级须人工显式授权；Night Chain 禁止自动降级）。
- **新增 9 条 d6 场景**：d6-01 前缀不误伤（F-20 哨兵，TASK_PASS）｜d6-02 kind 非法、d6-09 声明缺失、d6-12 gateId 重复 → `GATE_SPEC_MALFORMED` 且零实施 Agent｜d6-03 省略 required、d6-04 省略"本会红"的 record → `BLOCKED_GATE_COMMAND_NOT_EXECUTED`｜d6-05 未声明 gateId、d6-06 顶替成另一条会绿命令 → `GATE_COMMAND_NOT_DECLARED`｜d6-13 FULL 下 required→record → `GOVERNANCE_POLICY_VIOLATION`。
- **F-27（有意保留的残余面）**：Max 若把本应 required 的目标测试声明成 `kind=record`，机器层不再跨层字符串捕获，改由 Review/Verify 的 blocker 类 `REQUIRED_GATE_MISDECLARED_AS_RECORD` / `GATE_CONTRACT_UNDER_DECLARED` 拦截（人工授权 §4-A3 明确要求解耦，不可两头都要）。Review 判定"可接受、无需上报升级"。
- **F-28（本次自纠的干跑器缺陷）**：`dryrun-harness.mjs` 语法临时文件用固定名 `pfd-wrapped-check.mjs` 并在 `finally` 删除 —— 并发调用互相删除对方临时文件，产生**假 SYNTAX_FAIL**。已改为按 pid 命名，并以两条 suite 并发（各 115 PASS）复验。
- **工作区状态**：仅两个授权治理文件为 `M`；`deliverables/baseline/INTEGRATION_BASELINE.md`、`SECURITY_BASELINE.md`、`docs/qgraphflow/dialogue-turn-sequence/` 为 pre-existing 未跟踪内容，未修改、未暂存、未归属本任务。

## F-30 独立 Verify 重试（2026-10-09，Orchestrator 亲自执行，非夜间链）

- **F-29 已解除**：`nightchain-model-smoke` runId `wf_b8413f35-914` 的 MAX-PROBE 于 `2026-10-09T13:23:05Z` 返回 `marker=MAX_SMOKE_OK` / `bytes=8411` / 首行 `# 00 — 模型政策（永久，禁止 fallback）` ⇒ `qmodel_38max` 调用**可以建立**，不再是 credit 上限。同一探针的 FLASH-PROBE 反而失败（`13:25:17Z`，`Sorry, something went wrong`）⇒ 当前故障是**模型服务间歇性断连**，与额度、与本次 Fix 质量都无关。
- **两次 v1 重试均无 verdict（诚实记录，不记为验收）**：
  - `12:51:50Z` 启动 resume `wf_375e92e7-2b8`（脚本逐字未改）：`max-verify-r1` 于 `12:52:57Z`（67s）报 `Sorry, something went wrong`；`max-review-r1` 干跑 28 次工具调用后于 `13:07:22Z` 被 harness 判 `stalled after 180000ms` → attempt 2 → `13:14:53Z` 报 `The connection to the model service was interrupted`。
  - `13:31:44Z` 第二次 resume：两个 invocation 于 `13:38:30Z` / `13:38:35Z`（约 405s）同样报 `Sorry, something went wrong`，仅 7 次工具调用。
  - 合计 **4 次 Max 尝试、0 个 verdict**。按 §27 / 证据纪律，Fix 仍**不具备 PASS 资格**，仍不封存。
- **Root cause 假设（v1 失败的可解释成因，属 Orchestrator 自身 brief 缺陷）**：被审的两个治理文件为 `project-feature-delivery.js` **2458 行 / 178462 B** 与 `dryrun-harness.mjs` **1264 行 / 130624 B**，而 v1 的 CTX 要求 Reviewer 与 Verifier **各自整读二者**（≈4.5 万 token × 并行两路）⇒ 上游连接被截断是合理结果。**这不是实现质量缺陷**：机器证据与既有 106 条断言摘要零改动仍成立。
- **v2 缓解（不改判据、不降模型、不降门禁）**：新脚本 `fix-gov-001-r1-review-verify-v2.js`（runId `wf_3855e53c-a89`）
  1. **限窗读取纪律**：禁止整文件 Read；只允许 Grep + `Read offset/limit ≤200 行`；并逐字下发已知行锚点（validateGateSpec `:754-775`、detectRequiredDowngrade `:776-794`、detectGateDeclaration `:795-820`、scanUnsafeDbCommand `:821-845`、gateGuardViolation `:1987-2010`、四个 `runMachineGate` 调用点 `:2026/:2111/:2221/:2263`；harness 侧 `:37-43/:186/:313-329/:431-432/:556-575/:988/:1095-1128`）。Q1..Q11 / V1..V7 判据**逐条原样保留**。
  2. **并行改串行**：Review 不再可用（agent 失败或自报 `aborted=true`）或 verdict≠PASS 时**不启动 Verify**——省额度，且杜绝"Review 缺失却合成 PASS"。
  3. **反假绿加固**：两个 schema 新增 `aborted`/`abortReason`，prompt 明写"证据不足时绝不给 PASS/TASK_PASS"；`BLOCKS_SEAL` 由脚本按 `verify.verdict==='TASK_PASS' ∧ !aborted` 计算。
- **工作区完整性复核（`13:32Z`，失败的两个只读 invocation 之后）**：HEAD 仍 `29f2775`；`git status --porcelain` 与 `TASK_LEDGER.worktreeAtPause` 逐条一致；6 个关键文件 SHA-256 实测 `5512598f…`(workflow) / `441daf23…`(harness) / `56ad8639…`(INTEGRATION_BASELINE.md) / `72fd898f…`(SECURITY_BASELINE.md) / `5f12d3d4…`+`2bd127b7…`(qgraphflow) 全部与既有记录相等 ⇒ **只读取证未落任何写入**，无 `GOVERNANCE_POLICY_VIOLATION`。另机器核实：这两文件在 `77fdb32..29f2775` 之间逐字节未变 ⇒ 验收基线取 `git show 77fdb32:<path>` 与 HEAD 等价。
- **仍未变的事实**（`2026-10-09T14:31Z` 之后由 v2 脚本推翻，见下一节）：M0-005/006/007/008 禁止重启；Goal 状态仍 `PAUSED_FOR_HUMAN`，暂停根因由 F-29（额度）改为 **F-30（Max 调用不稳定，独立验收 0/4 取得 verdict）**。若 v2 再次无 verdict，则停止自动重试交人工（不在同一失效形态上连烧第三次）。

## FIX-GOV-001-R1 封存 + M0-005 首次实战 TASK_PASS（2026-10-09，Orchestrator 亲自执行）

### A. v2 一次通过：F-30 的根因确实是 brief，不是 Fix

- runId `wf_3855e53c-a89`（`qmodel_38max`，未换模型、未降级、未降判据）：**Review = PASS**（Q1..Q11 全 YES、0 blocker、9 条 non-blocking notes、`aborted=false`）→ **Verify = TASK_PASS**（harness exit 0 `115/115`；`OLD_EXPECTATION_DIGEST=cecf72bc…` 由 Verifier **从 baseline blob 独立重算**得到同一值；9 条抽查重跑 `matchesClaim` 全 true；106 条非 d6 EXPECT 行全字段空 diff；scope CLEAN；rollback HOLDS；7 条诚实 residualRisks）。
- 与 v1 的唯一差异是**读取方式**（限窗 ≤200 行 + 逐字行锚点、Review→Verify 串行）⇒ 上一节"4 次尝试 0 verdict"的成因确认为我的 brief 要求整读 178 KB + 130 KB 两文件，不是实现质量，也不是额度。
- **封存 = `d2d7ddb`**（仅两个授权治理文件；`git show --stat` 可核）。Task PASS 五判据逐条落账：115/115 exit 0 ∧ 独立 Review PASS ∧ 独立 Verify TASK_PASS ∧ Task Delta 恰为这两文件 ∧ 治理授权 HD-N-01 + `:5432` 零接触。

### B. M0-005 重跑：F-20 的现场证明（不只是单元测试）

- runId `wf_5a685efc-fc6`，`ACTIVE_EXECUTION_MODE=FULL`，终态 **`TASK_PASS`**；`REPAIR_CYCLES_USED=0`；HIGH risk ⇒ **双独立 Review**（`max-review` + `max-review-b`，各 8 条 AC 全 met、各 0 blocker，B 独立重跑 7 条命令）。
- **新门禁合同首次实战**：Max 亲写 16 条 `MACHINE_GATE_COMMANDS`（gateId+kind+命令原文），`validateGateSpec` 通过 ⇒ 推进到 Implement。这正是 F-20 时代必 BLOCK 于 `REQUIRED_DOWNGRADE` 的形态。**对账键 = gateId**，`DECLARED_COUNT=16 == SUBMITTED_COUNT=16`，沉默省略不再免费。
- 双真相成立：`GATE_HEALTH=PASS`（required 7/7 exit 0、record 9/9 采集完成）**与** `PROJECT_BASELINE_HEALTH=DEGRADED`（`G-INT-PG-RUN` exit 1 = 4 failed/8 passed/20 errors；`G-BASE-PYTEST` 1 failed/231 passed；`G-BASE-RUFF` 291 errors）——三条 record 红全部如实入 Findings，**未删测/未 skip/未降断言/未触发修复循环**。
- 环境自律：一次性自建容器 `aiear-m0005-*`（postgres:16-alpine @ `127.0.0.1:55433`、redis:7-alpine @ `127.0.0.1:26379`），SPEC 自行加了两条 required 守护 `G-REPORT-NO-5432-URL`（报告内不得出现 `@…:5432/`）与 `G-ENV-NO-RESIDUE`（`aiear-m0005-` 前缀零残留），宿主 `:5432` 全程零接触。
- Verify 的独立复现是关键一环：它**重建同款一次性容器逐字重跑**核心链路，`G-INT-PG-RUN` 再次 exit 1 且 summary `4 failed, 8 passed, 20 errors in 17.40s` 与门禁记录（17.34s）一致 ⇒ 红项被真实复现，不是转述。
- 唯一仓库改动 = `deliverables/baseline/INTEGRATION_BASELINE.md`（`56ad8639…`/29672 B → `b2d2f04aa1250a31…`/43027 B），经 `RETRY_OWNED_APPLIED` 归属本任务；`SECURITY_BASELINE.md`（`72fd898f…`）与 qgraphflow 树单元两个成员指纹逐字不变（`5f12d3d4…`/`2bd127b7…`）。交付物提交 = **`317341b`**。

### C. 传输不稳定（F-34）与执行工具层转义缺陷（F-37，新）

- 本 run 前两次阶段各遇一次 `other side closed`（Task Spec 一次、Implement 一次），`resumeFromRunId` + 逐字相同 args 分段续跑，**每次只补失败的那一相**（已成功 Agent 命中缓存），三次续跑合计 15 agents / 177 tool uses / 2453 s。全程未换模型、未启用 `FLASH_ONLY`。
- **F-37**：`G-ENV-PG-READY` 的冻结命令是 `sh -c 'for …'` 单引号形态，首次经**执行工具层**被追加输出重定向 ⇒ `exitCode=127`。Worker 在报告 §3.5 诚实留痕且**未改写冻结命令**，逐字原样重跑 exit 0；Reviewer B 与 Verify 各自复跑亦 exit 0。风险在于：若这次复跑没发生，脚本会按真实 exitCode 判 `MACHINE_FAIL`，**把工具层缺陷冒充成项目缺陷而误 BLOCK 一个健康任务**。`.qoder/workflows/project-feature-delivery.js` 内 grep 重定向包装零命中 ⇒ 属 Agent 外层 shell 工具，非治理脚本缺陷。候选 FIX-GOV-003：门禁命令规避 `sh -c` 单引号形态，或对 `exitCode=127` 且命令含单引号 `sh -c` 者要求逐字复跑一次再计数。

### D. 现在的状态

- `goalStatus: PAUSED_FOR_HUMAN → RUNNING-M0-DAG`；`blockedTasks` 仅剩 M0-006（其 F-20 阻塞已随 `d2d7ddb` 解除，待重跑）；`completedTasks` = M0-001..M0-005。
- 下一步（DAG 顺序）：**M0-006 安全基线重跑**（HIGH risk ⇒ Review A+B 双独立 + 医疗安全回归；sqlite 口径先行恢复 RBAC/IDOR 裁决层，显式引用 F-M0005-01 作为 postgres 口径的已知验证缺口）。
- M0 里程碑门禁仍需人工：**HD-N-04**（把 FIX-* 行写入 `docs/workflow/TASK_CATALOG.md`，属治理写）、**HD-N-05**（基线文档 8 vs 7 口径）。
- 记账工具自纠：`patch-ledger-seal.mjs` 在沙箱里跑了 BLOCKED / PASS-缺提交号 / PASS-带提交号三条路径，含新守卫「TASK_PASS 却无交付物提交号 ⇒ `REJECTED`、零写入」——避免账本写下指向不存在 commit 的 `completedTasks`。

> 本节 D 小路（`blockedTasks 仅剩 M0-006`）已被下节更新：M0-006 于 `2026-10-09T19:22:47Z` 入账为 TASK_PASS。保留原文以留痕当时的判断依据。

## M0-006 安全基线重跑：**TASK_PASS**（2026-10-09T19:22:47Z 入账，交付物 commit `8c81df5`）

### A. 终态与五判据（runId `wf_6c897bee-ab8`，`ACTIVE_EXECUTION_MODE=FULL`，`HIGH_RISK=true`）

- **门禁合同**：Max 亲写 12 条 `MACHINE_GATE_COMMANDS`，`DECLARED_COUNT=12 == SUBMITTED_COUNT=12`（对账键 = gateId；F-20 修复后第二次现场成立）。`GATE_HEALTH=PASS`：required 8/8 exit 0、record 4/4 采集完成、`BLOCKED_MISSING_SAFE_TEST_ENV=false`。
- **双真相并存互不掩盖**：`PROJECT_BASELINE_HEALTH=DEGRADED` —— `G-BASE-PYTEST-FULL` exit 1（1 failed/231 passed，另见 F-38 非确定性）、`G-BASE-RUFF-FULL` 291 errors（CI 窄口径 `G-BASE-RUFF-CI` exit 0 是真实事实，报告未迎合 SPEC 的"预期非零"）、`G-BASE-POSTGRES-TRIPLE` 4 failed/8 passed/20 errors（F-M0005-01/02）。全部红项以 `record` 落 Findings，**未删测/未 skip/未降断言**。
- **独立 Review 两路相互不可见，且都真的抓到了东西**：第 1 轮 A 报 `BLK-M0006-R1-01`、B 独立报 `BLK-M006-RB-01`/`BLK-M006-RB-02`；第 2 轮复又报 `BLK-M006-R2-01`（`test_auth_service.py` 12 例计数与夹具取证口径）。⇒ 双独立审查不是形式。`REPAIR_CYCLES_USED=2`（预算 ≤3，剩 1 轮），两轮均"只修 blocker、单文件写入"；第 3 轮 A 与 B 均 `PASS`（`maxReview.rounds=3`），独立 Verify `TASK_PASS`。
- **Task Delta 恰好一份**：唯一改动 `deliverables/baseline/SECURITY_BASELINE.md`；`taskGovernance=[]`、`externalChangedDuringTask=[]`、`treeUnitChanges=[]`、`headChanged=false`、`stagedAppeared=[]`；pre-existing qgraphflow 树单元不变（成员 `5f12d3d4…`/`2bd127b7…`，树 `9eb05078…`）。交付物最终身份 = **602 行 / 94736 B / sha256 `65aa374df9b06ae0f88cd1277fde6926176908b90ffbc305264194c639cc0370`**（Orchestrator 记账时实测，与门禁 `G-DELIVERABLE-EXISTS` 及 Review 同值）。

### B. 交付物说了什么（不粉饰）

- "安全测试通过"类宣称**不成立**。端点×认证×归属全量矩阵给出 P0/P1 定级，其中 **SB-02（P0）= 13 条 RBAC/IDOR 用例在 postgres/CI 同款口径下未达断言层 ⇒ 当前安全结论仅在 sqlite 口径成立**，是 MVP 安全验证链上唯一的 P0 验证能力缺口。
- 医疗安全回归（`test_safety.py` 10 passed，无 skip）作为三件套之一真实执行；但完整评测集（诱导性提问 / 多轮绕过 / 历史消息注入）**不存在** → 记 `F-MEDICAL-EVAL-GAP`，按 `70-medical-safety.md` §9 把补齐纳入后续 SAFE-* Scope，而非以"没有测试"视为通过。
- 用户删除/注销路径缺失（`models/user.py:18-22` 无 cascade）为 PRIV-002 的前提证据。§7 把该证据写成"英文正则仅硬件语义命中"，实测该正则 0 命中（命中实际来自中文"注销"，`hardware/manager.py:136/:143` 等）——实质结论因零命中反而更强，转写瑕疵列为非阻塞、留待下轮修订。
- 下游任务编号仅为**建议**，未写入 `docs/workflow/TASK_CATALOG.md`（治理写需 HD-N-04），故 AC-08「零 ID 冲突」判据成立。

### C. 环境自律与残留

- 宿主 `:5432` 全程零接触（政策禁区）；postgres 三连走一次性隔离实例 `127.0.0.1:55433`，用后 `docker rm -f`；本任务声明的 `aiear-m0006-*` 零残留。
- 实测宿主仍有**前序任务**遗留容器 `aiear-m0004-pg-test` → **F-41（P3 运维卫生，不属本 Task Scope）**，建议归 OPS-005/OPS-006 处置；未擅自删除他人资产。
- `backend/venv` 无 pytest，全部 pytest 走 `backend/venv312/Scripts/python.exe`（ENV-NOTES 留痕）。

### D. 本任务新增 Findings（F-38..F-43）

- **F-38（P1 基线不稳定）**：同一份代码全量 pytest 在 `1 failed/231 passed` 与 `2 failed/230 passed` 间漂移；根因 `app/ai/adaptive_engine.py:228` 未播种的 `random.random() < p_correct` ⇒ 基线须以区间记录读数，禁止把单次结果当确定性事实。
- **F-39（P1 治理）**：`RETRY_OWNED` 覆写使上一 run 产物字节不可恢复（本次被覆写的 97758 B / `72fd898f…` 版本只剩哈希与规格缓存）。凡验收条款写成"与上一版本 diff"，该路径下会静默失去可比对对象 ⇒ 候选 FIX-GOV-004。
- **F-40（P2 规划）**：`FIX-INT-02` 在两份基线工件里被赋予两种 Scope（pyproject dev 依赖钉版本 vs 安全用例真实 DB 口径复跑），且已占用编号曾被误标"建议新增" ⇒ 消歧 gated on HD-N-04。
- **F-41 / F-42（P3 卫生）**：见 C 节；F-42 = 交付物第 462/510 行以完整字面量引用演示种子手机号（来源为被跟踪源码 `init_db.py:162/:199`，非真实用户数据，且正是 SB-33 的证据本体），建议后续统一掩码形态 + 行号引用。
- **F-43（P2 工具自纠 —— 我自己记账脚本的缺陷）**：`patch-ledger-task.mjs` 自算的未跟踪目录树单元身份为 `37b7e370…`，与 Workflow `V|D4-1` 协议的 `9eb05078…` 不等；成因 = 成员路径双斜杠 + manifest 缺 md5 字段。已独立复现协议算法、改正脚本并现实测 `treeSha ok=true`。若不钉住协议口径，任何以账本为依据的"外部改动"判定都会产生**假 `BLOCKED_EXTERNAL_WORKTREE_CHANGE`**。此条如实入账，不隐藏。

### E. 状态（M0-006 后）

- `completedTasks` = M0-001..M0-006（提交号 `abc6a78`/`7be3c50`/`f73cb01`/`a78b10f`/`317341b`/`8c81df5`）；`blockedTasks` 清空；findings = 42 条；`goalStatus=RUNNING-M0-DAG`。
- `m0Dag`：M0-007、M0-008 → **READY**。原 BLOCKED 记录以 `priorBlockedNote` 原样保留（M0-008 当时的阻塞理由是"引用 `blockedTasks[M0-005].machineProof` 推断会撞同一堵墙"，该推断随 F-20 修复失效）。
- 下一个：`currentTask = 下一个：M0-007（deps=["M0-005"]）`。M0 里程碑门禁仍需人工 **HD-N-04**（把 FIX-*/SEC-*/OPS-*/PRIV-* 行写入目录，属治理写）与 **HD-N-05**（基线文档 8 vs 7 口径）。

> 本行是 M0-006 入账时点的状态；M0-007 已于 `2026-10-09T20:03:41Z` TASK_PASS 入账，见下节。

## M0-007 性能基线：**TASK_PASS**（2026-10-09T20:03:41Z 入账，交付物 commit `7dcf2f8`）

### A. 终态与五判据（runId `wf_cc12b79d-5be`，`ACTIVE_EXECUTION_MODE=FULL`，`HIGH_RISK=true`）

- **门禁合同**：Max 亲写 8 条 `MACHINE_GATE_COMMANDS`，`DECLARED_COUNT=8 == SUBMITTED_COUNT=8`，`validateGateSpec` 在 Implement 之前通过（`GATE_SPEC_MALFORMED_NOT_RAISED`）。`GATE_HEALTH=PASS`：required 6/6 exit 0（`G-INTERPRETER`/`G-PERF-TARGET`/`G-LINK-SAMPLE`/`G-MEDICAL-SAFETY`/`G-DELIVERABLE`/`G-SCOPE`）、record 2/2 采集完成、`blockedMissingSafeTestEnv=false`。
- **双真相**：`PROJECT_BASELINE_HEALTH=DEGRADED` —— `G-BASE-PYTEST` exit 1（`1 failed, 231 passed, 33 warnings in 2.14s`，签名 = F-01 `test_middleware.py:34 assert 401==200`）、`G-BASE-RUFF` exit 1（291 errors，199 fixable；CI 窄口径仍绿）。两条均为存量、本任务零代码改动，未删测/未 skip。
- **一次干净跑完**：`REPAIR_CYCLES_USED=0`、`ATTEMPT_HISTORY=[]`、`agents=15`、`tool_uses=127`、`duration=1779557ms`（约 29.7 分钟），本 run 无上游断连（对比 F-34 时代的分段续跑）。HIGH risk ⇒ `max-review` + `max-review-b` **两个相互不可见的 `qmodel_38max` invocation**，`MAX_REVIEW.verdict=PASS rounds=1`，独立 Verify `TASK_PASS`。
- **Task Delta 恰好一份**：唯一 `taskChanged = deliverables/baseline/PERF_BASELINE.md`；`taskGovernance=[]`、`externalChangedDuringTask=[]`、`treeUnitChanges=[]`、`headChanged=false`、`stagedAppeared=[]`；`RETRY_OWNERSHIP=NOT_A_RETRY`（全新文件，不涉 F-39 覆写路径）。D4 三次取证（Preflight/Implement/Verify）全部 `evidenceValid=true`、`commandVerbatim=true`，`ADJUDICATION_COUNT=0`（无需仲裁）。pre-existing qgraphflow 树单元 `9eb05078…` 逐字不变。
- **交付物身份**：200 行 / 29586 B / sha256 `78d6eb265121d5c5938ed9069809ffeff173dbb2087fefbf16e1ddf1a511e2b7`，提交 `7dcf2f8`（该文件此前不存在，属新增）。
- **Orchestrator 亲自复跑核实**（入账前，只读）：`G-PERF-TARGET` → `7 passed in 0.72s` / exit 0；`G-BASE-PYTEST` → `1 failed, 231 passed, 33 warnings in 2.54s` / exit 1（与门禁记录签名逐字一致）。F-38 的偶发项 `test_adaptive_engine.py::test_full_adaptive_session` 本轮亦**未复现**（与报告 §8 记录一致）。

### B. 报告的真实结论（不粉饰）

- **三条链路只有"进程内 mock 口径"有读数**：全部数字来自 `httpx ASGITransport` 进程内 + `sqlite+aiosqlite://` 内存库 + `_MemoryRedis` 替身（`conftest.py:24/:135-136/:190-229`），零网络。§4 与 §5 强制声明：这些读数**不得外推为生产 SLA**，且工程指标与临床指标分离（延迟/准确率是待验证工程目标，禁止写成医学规律或"听力恢复程度"）。
- **ASR 流式首包 <500ms（PRD:118）＝ 零验证**：仓库无该专项计时测试（`grep 首包|first_packet|streaming_latency|first_chunk backend/tests` = 0 命中，Reviewer 独立复核），真实 dashscope 调用属 `80-testing.md` 规则 5 禁止项且未获人工授权 ⇒ NF-03/PF-05 记 `missing_evidence`。**M0-007 通过 ≠ 该目标有证据**，Milestone Gate 与 EVAL-001 引用时必须携带这一限定。
- 未执行清单 NF-01..NF-09 全部写明原因（授权禁止 / 环境缺失 / 属 OPS-003 或前端范畴），报告不含任何"已实测真实 API"表述。
- 对话 <3s、发音评分 <2s：mock 口径形式达标（直读 0.81/0.86ms；`test_pronunciation.py` 49 passed/0.41s），但端到端链路（录音上传→ASR→DTW）与大数据量 DTW 未覆盖（NF-04/PF-06）。
- `SAMPLE_COUNT=3` + 中位数对机器噪声敏感（首轮 18.72/13.45/9.79ms 离群被中位数吸收），阈值与采样次数**零改动**（`git diff --exit-code HEAD` exit 0，门禁与 Review 各验一次）。

### C. 本任务新增 Findings（F-44..F-47）

- **F-44（P1 测量可信性，价值最高）**：`test_performance.py:38-45` 的 `_measure` 丢弃响应对象，只断言 `median_ms < threshold_ms`；`test_metrics_performance:137` 用无 auth 的 `client` 直取 `/api/metrics`，而 `app/api/metrics.py:14-25` 要求 `get_current_user` + therapist ⇒ **三次请求全落 401 错误路径，用例仍 PASSED 并"通过 100ms 阈值"**。我已在源码逐行核实该链路（并复跑确认 7 passed）。危害不止 metrics：任何 401/403/422 端点都能以"比错误处理还快"的名义被判性能达标 —— 这是**门禁断言语义缺陷**，与 F-01 同源但影响面更大。
- **F-45（P2 可观测性）**：性能用例不导出任何读数，AC-01 的 ms 只能靠门禁之外的两次不落盘只读插桩取得（Reviewer 另用等价内联插件独立复现全部 7 项，读数同量级）。证据成立但不自包含 ⇒ 建议 `FIX-PERF-01`（未落库）或并入 OBS-002，在不降断言强度的前提下导出 raw/median ms。
- **F-46（P1 验证缺口）**：见 B 节首包零验证；并含"读数外推纪律"——下游（OPS-003/EVAL-001/OBS-002）引用本报告数字必须携带"进程内口径"限定。
- **F-47（P3 执行手卫生，与 F-37 同族）**：首次插桩因**执行手自身**闭包晚绑定触发 `RecursionError`，产生一次 7 failed 的非门禁辅助运行；未触碰任何仓库文件，修正后复跑 7 passed，且 traceback 中的 fixture JWT 未被摘录进报告。风险形态与 F-37 一致：非门禁运行的红色若不留痕，会被后来人当成项目缺陷。治理候选并入 FIX-GOV-003。

### D. 一次我自己的操作留痕（诚实记录）

- 本任务**第一次启动的 Workflow 被我主动取消**：`args.task` 在序列化时被截断成半句（brief 缺了 dashscope 禁令、`:5432` 禁触达、gateId 合同等关键约束）。`TaskStop` 后立即复核：HEAD 仍 `ac3b0ae`、无新 spec、无 perf 产物 ⇒ 取消那一枪零写入（符合"cancel 不启动新 Agent、不改文件"的语义）。随后以完整 brief 重发，才得到本节的 `wf_cc12b79d-5be`。

### E. 状态（M0-007 后）

- `completedTasks` = M0-001..M0-007（`abc6a78`/`7be3c50`/`f73cb01`/`a78b10f`/`317341b`/`8c81df5`/`7dcf2f8`）；`blockedTasks` 空；findings = 46 条；`goalStatus=RUNNING-M0-DAG`。
- `currentTask = 下一个：M0-008（deps=["M0-003","M0-004"]）`，它是 M0 基线 DAG 的最后一个节点；完成后即可进入 M0 Milestone Gate，但该门禁仍需人工 **HD-N-04**（目录治理写）与 **HD-N-05**（基线文档 8 vs 7 口径）。
- 串行未破：M0-008 依赖 docker 与 compose 构建，与 M0-007 同工作树并发会互触 D4 外部改动误判，故按 §18 串行推进。

## M0-008 部署/容器基线：**TASK_PASS**（2026-10-09T20:43:35Z 入账，交付物 commit `ed36481`）— M0 基线 DAG 至此 8/8

### A. 终态与五判据（runId `wf_dfb3e8e5-ed5`，`ACTIVE_EXECUTION_MODE=FULL`，`HIGH_RISK=true`）

- **门禁合同**：Max 亲写 10 条，`DECLARED_COUNT=10 == SUBMITTED_COUNT=10`，`validateGateSpec` 在 Implement 之前通过。`GATE_HEALTH=PASS`：required 6/6 exit 0（`G-DELIVERABLE`/`G-SCOPE-DIFF`/`G-HEAD-FIXED`/`G-GOVERNANCE-DIFF`/`G-TREE-UNIT`/`G-SECRET-ZERO`）、record 4/4 采集完成（`G-COMPOSE-CLI` exit 0、`G-COMPOSE-CONFIG` exit 1、`G-BUILD` exit 1、`G-DOCKER-PS` exit 0）。
- **双真相**：`PROJECT_BASELINE_HEALTH=DEGRADED`。本任务的 required 里**没有**"构建必须成功"，因为构建在本仓库路径下结构性不可达（见 B 节）。
- **一次干净跑完**：`REPAIR_CYCLES_USED=0`、`raw.failures=[]`、`agents=15`、`tool_uses=158`、`duration=2196279ms`（约 36.6 分钟），无上游断连。HIGH risk ⇒ `max-review` + `max-review-b` 双独立 `qmodel_38max`，`MAX_REVIEW.verdict=PASS rounds=1`，独立 Verify `TASK_PASS`。
- **Task Delta 恰好一份**：唯一 `taskChanged = deliverables/baseline/DEPLOY_BASELINE.md`（全新文件，`RETRY_OWNERSHIP=NOT_A_RETRY`）；`taskGovernance=[]`、`externalChangedDuringTask=[]`、`headChanged=false`、`stagedAppeared=[]`；`G-TREE-UNIT` 用 `sha256sum -c -` 逐文件校验 qgraphflow 两成员（`5f12d3d4…`/`2bd127b7…`）exit 0。
- **交付物身份**：363 行 / 41800 B / sha256 `ff214b643a3b58a107b525530e7ac1c5571597849a302d98a99e101cfbec70bd`，提交 `ed36481`。

### B. 本轮最大的真实发现：`docker compose` 在此仓库路径下根本跑不起来（P0）

- 我（Orchestrator）入账前**独立复跑**：`docker compose config --quiet` 与 `docker compose build` 均 **exit 1**，stderr 恒为 `project name must not be empty`，并附 `the attribute version is obsolete` 警告。三重根因（报告 §A.4）：目录名『听觉康复』非 ASCII ⇒ compose 无法从工作目录推导项目名；`docker-compose.yml` 无顶层 `name:`（obsolete `version:` 在 `:6`）；根 `.env` 的 11 个键名集合不含 `COMPOSE_PROJECT_NAME`。
- 后果：catalog 第 29 行对 M0-008 写的门禁要求『docker build exitCode=0』在本路径下**不可能达成**；`docker compose` 的一切子命令（含 OPS-002 冒烟演练所需的 `up`）都先败在项目名解析。失败发生在镜像/缓存工作之前 ⇒ **零副作用**（无新镜像、无新容器、宿主既有资产未动）。
- **治理层的一个正面证据**：`G-BUILD`/`G-COMPOSE-CONFIG` 被 SPEC 定为 `record`，Reviewer B 专门按 FIX-GOV-001-R1 的补偿控制审了"这是否构成 `REQUIRED_GATE_MISDECLARED_AS_RECORD`/`GATE_CONTRACT_UNDER_DECLARED`"，结论是不成立（冻结 SPEC 设计阶段的既有决策，且 AC-02/AC-08 明确要求如实引用 exitCode=1；执行手未使用 `-p` 等绕过参数改写命令）。⇒ F-31 提出的那条 blocker 类**第一次在真实任务里被消费并给出可审计结论**。
- 顺带坐实：宿主没有 compose 引用的 `postgres:15-alpine` tag（实测仅 `16-alpine` 与 `pgvector/pg15`、`pgvector/pg16`）⇒ 修好项目名后首次 `up` 还要触发拉取，OPS-002 演练须预期该事实。

### C. 配置完整性审计（8 对象，结论全部带 file:line）

- **healthcheck 路径四处同源失配（P1）**：真实路由是 `backend/app/api/health.py:14 /health`、`:30 /health/detailed`（`app/main.py:124` 挂载时**未加 prefix**），而 `docker-compose.yml:39`、`backend/Dockerfile:30`、`deploy/serverless.yml:12`、`docs/runbook.md:9/:41-42` 四处全部探 `http://localhost:8000/api/health`。我已在源码逐行核实。配置级推论：backend 永不 healthy ⇒ `depends_on` 的 frontend 卡死，runbook 四条冒烟路径的第一条即失效。
- **构建上下文与镜像层的秘密入层风险（P1）**：三级 `.dockerignore` 全缺（`ls` exit 2 即取证）+ 两个 Dockerfile 均 `COPY . .`，而上下文内含 `backend/.env`（存在，本任务零值读取）、`backend/venv312` 574M、`backend/venv` 14M、`frontend/node_modules` 390M。
- **发布通道事实断裂（P1）**：`ci.yml:3-7` 触发分支写 `main/develop`，仓库主干实为 `master`（本工作在 `feature/m0-baseline`）；deploy job（`:186-212`）只 checkout，既未构建前端也未 `download-artifact` 就 `ossutil cp -r frontend/dist/`（`:211`）⇒ 确定性缺件失败。凭证只以引用名出现。
- 其余：`.env.example` 缺 OSS 五键 / `COOKIE_SECURE`·`COOKIE_SAMESITE` / VPC 三键（`config.py:152` 的 `COOKIE_SECURE` 默认 `False`，而 runbook:5 要求 `true`）；`serverless.yml:77/:84` 匿名公网触发器；`backend/Dockerfile:17` gunicorn 裸装未锁版本；compose 无 worker/ARQ 服务。
- **双列结论**：`ENGINEERING_DEPLOY_READY = NO` 与 `REAL_PRODUCTION_APPROVED = NO` 分列（后者无真实人工批准恒 NO）；Secret 零输出（`G-SECRET-ZERO` required），`.env` 只取存在性与键名集合。

### D. 本任务新增 Findings（F-48..F-52）

- **F-48（P0 部署阻塞）**：compose 项目名解析失败 ⇒ 容器路径全阻塞；建议独立 `FIX-DEP-01`（加顶层 `name:` 或显式 `COMPOSE_PROJECT_NAME`，移除 obsolete `version`），是 OPS-002/SEC-003 的前置。
- **F-49（P1 配置漂移）**：healthcheck 四处同源失配（修复须先决定"改探针"还是"给路由加 /api 前缀"，后者属公开 API 契约变更 ⇒ 需 ADR，不得由实施侧顺手改）。
- **F-50（P1 秘密面）**：`.dockerignore` 缺失 + `COPY . .` + env 模板缺口 + 匿名触发器 ⇒ 归 SEC-003 生产硬化清单。
- **F-51（P1 发布通道）**：CI 分支名与产物依赖双重断裂 ⇒ 归 OPS-001（注意其『`.github/**` 属 Flash 禁区，实际变更由治理阶段或人工应用』的既有约束）。
- **F-52（P2 治理证据，我的输入质量缺陷）**：SPEC 摘要两处与已封存源文档不符——把 M0-004 写成"迁移三连 exit 0"（实录 `upgrade head` exit 1，F-15），把虚拟环境写成 `.venv`（实测 `venv/`+`venv312/`）。执行手按源文档真实口径引用并以非门禁失败留痕，Review 判"按差异记录而非 `SPEC_CONFLICT` 停止"恰当；误差源头在规划侧未回读已封存基线 ⇒ 候选 `FIX-GOV-005`：Task Spec 中"前序任务终态"类断言必须引用已封存交付物的 file:line。
- 另有两条不影响结论的计数口径偏差（文件总行数 +1、`OSS_REGION` 行号偏 1），留作下游修订。

### E. 状态：M0 基线 DAG 8/8 全绿，停在 Milestone Gate 门前

- `completedTasks` = M0-001..M0-008（`abc6a78`/`7be3c50`/`f73cb01`/`a78b10f`/`317341b`/`8c81df5`/`7dcf2f8`/`ed36481`）；`blockedTasks` 空；findings = 51 条。
- `goalStatus = M0-DAG-COMPLETE-PENDING-MILESTONE-GATE`；`currentTask = M0 DAG 全绿，待 Milestone Gate（需 HD-N-04/HD-N-05 人工授权）`。
- **需要人工新增一条裁决（建议记为 HD-N-09）**：catalog 对 M0-008 的门禁要求『docker build exitCode=0』与本轮真实终态（结构性不可达，已以 record 如实记录）冲突。Milestone Gate 不能把这条冲突当作不存在。三种口径请择一：(甲) 先做 `FIX-DEP-01` 再复跑 M0-008 的 build 门禁，令 catalog 原要求成立；(乙) 由 Max 在治理阶段把 catalog 该行的门禁要求改写为"构建可用性如实记录"，随后 M0-008 以当前证据直接计入；(丙) Milestone Gate 判 `MILESTONE_BLOCKED` 并把 F-48 列为唯一阻塞项。**我不会自选**，夜间/自治链无权改 `docs/workflow/**`。

## Pre-existing untracked（§8，PRE_EXISTING_UNCHANGED）

- `docs/qgraphflow/dialogue-turn-sequence/` — 2 文件
  - `graph.json` sha256 = `5f12d3d4503d2305f352b21b8d275bb5e2ea544a32f3d539ea6909951373f138`（34972 B；md5 `2fe742d810f7cd0ce2f5eb401f0050a0`）
  - `index.html` sha256 = `2bd127b7c22c25b20e04804cc5c745f686f7f462cae96649aa9b47612d4bf600`（794348 B；md5 `c1bb9c9b90d92db933577e4056e3ba91`）
  - 每个 Task 结束须复核指纹不变；变化则 BLOCKED_EXTERNAL_WORKTREE_CHANGE。
  - **摘要口径订正（D4）**：本文件历史版本曾把这两个值记为 40 位 hex（`e88c0295…`/`cde38f82…`）。40 位 hex 是 **git blob SHA-1**，按 `.qoder/rules/90-quality-gates.md` D4 节**不得充当内容身份**。现只认上方 64 位小写 hex SHA-256；md5/size 仅佐证。此订正属记录口径修正，不代表文件内容有变（md5 与既有佐证一致）。

## 已完成 Task

> 本节详录 M0-001..M0-004；M0-005..M0-008 的完整判据与交付物各自成节（见上文「M0-006/M0-007/M0-008 … TASK_PASS」与「FIX-GOV-001-R1 封存 + M0-005 首次实战 TASK_PASS」），提交 sha 汇总见「M0 DAG」表与 `TASK_LEDGER.json.taskCommits`。八项均 TASK_PASS。

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
| M0-005 | 集成测试基线 | P0 | M0-002,M0-004 | TASK_PASS（`317341b`；guard 封存后重跑，五判据成立） |
| M0-006 | 安全基线 | P0 | M0-002 | TASK_PASS（`8c81df5`，HIGH risk 双独立 Review A+B 均 PASS） |
| M0-007 | 性能基线 | P0 | M0-005 | TASK_PASS（`7dcf2f8`，required 6/6 + record 4/4，读数不达标一律如实记录未改阈值） |
| M0-008 | 部署基线 | P0 | M0-003,M0-004 | TASK_PASS（`ed36481`，required 6/6 + record 4/4；`docker compose` 真实 exit 1 记为 F-48 → **HD-N-09 待裁决**） |

> M0-005..008 四行原为 `BLOCKED（F-20）`，那是 2026-10-08 的时点事实；HD-N-01 执行并封存 `d2d7ddb` 后已逐一重跑，上表现为当前真相，详细判据见各 Task 的 `## … TASK_PASS` 小节。Milestone Gate 的 M0 Exit 仍受 **HD-N-04 / HD-N-05 / HD-N-09** 人工裁决约束。

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

> **本节为历史留痕（不改写结论本身）**：该 BLOCK 的根因是治理缺陷 F-20，已由人工授权的 FIX-GOV-001-R1 修复并封存为 `d2d7ddb`；M0-005 于 2026-10-09 以 runId `wf_5a685efc-fc6` 重跑取得 **TASK_PASS**（见上文「FIX-GOV-001-R1 封存 + M0-005 首次实战 TASK_PASS」B 节），交付物提交 `317341b`。下方"未提交"指当时该 BLOCK 状态下产物保持未跟踪，非当前状态。

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
| F-26 | **我自己的设计有实施级缺陷（自纠，非代码缺陷）**：上一轮给出的 `FIX-GOV-001` 融合设计中，C3 覆盖率判据与"既有 106 条全保留"验收口径**互相矛盾、无法同时成立**。实测：全场景共享的 `specObj`（`dryrun-harness.mjs:447-457`）声明 `REGRESSION_TESTS: ['pytest backend/tests']`（`:454`），而 21 个门禁 fixture 提交的全部去重命令串共 **22 个**，其中 `grep -cx "pytest backend/tests"` = **0** —— **声明项从未被任何 fixture 提交过**。⇒ 若按字符串清单做覆盖率对账，所有走到门禁的场景都会 BLOCK，含 **44 条 `status: TASK_PASS` 断言** | OPEN-SELF-CORRECTED-DESIGN，**P1-DESIGN-DEFECT**；最危险的失败模式已点名：人工照原设计落地 ⇒ harness 大面积转红 ⇒ 在"让它重新变绿"的压力下删掉 C3 或降级 required，**那才是门禁真正被削弱的一刻**。已出 `design.amendmentR1`（A1 断言不变量 / A2 fixture 迁移 / A3 覆盖率只认 gateId / A4 SPEC 完备性前移到 Max 侧 `GATE_SPEC_MALFORMED` / A5 `d3-10` 精确相等已验证不回退 / A6 新增 `d6-09..11`）；真实变更面 = **2 个治理文件**，成本由"约 1 开发日"**上修至 1.5~2 开发日**。夜间仍不实施 → HD-N-01 |
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
- 验收：~~106 + d6-01..08 全绿~~ ⇒ **F-26 撤回"既有 106 条全保留"作为实施承诺**（与 C3 不可同时成立：实测 44 条 `TASK_PASS` 断言会转红）。可执行口径改为下方 **A1/A2 二分** —— `(scenario → 期望终态)` 断言逐条不动，**共享 `specObj` 与 `req()/rec()` fixture 必须迁移**。+ `d6-01..11` 全绿 ⇒ 记 D6 回归，随后按 **M0-005 → 006 → 007/008** 串行重跑（约 40~60 分钟/次）。

**amendmentR1（`2026-10-08T07:52Z`，因 F-26 自纠；机器副本见 `TASK_LEDGER.json → pendingFixTasks.FIX-GOV-001.design.amendmentR1`）**

- **A1 断言不变量**：106 条中每条 `(scenario → 期望终态/期望 block 码)` 映射不改。
- **A2 fixture 迁移（允许且必须）**：`specObj`（`dryrun-harness.mjs:447-457`，**全场景共享**）增加结构化门禁清单；`req()/rec()` 补 `gateId`；"故意省略"类新场景自建 fixture。**改 fixture ≠ 改断言** —— 被撤回的口径正是混淆了这两者。
- **A3 覆盖率只认结构化清单**：C3 对账集合 = `MACHINE_GATE_COMMANDS[].gateId`，**不再**由 `MANDATORY_TESTS`/`REGRESSION_TESTS` 的字符串推导义务（否则 F-26 大面积转红必然复现）。
- **A4 legacy 逃逸口前移到 Max 侧**：Task Spec 校验阶段 fail-closed —— 必跑项非空而无对应结构化清单 ⇒ `GATE_SPEC_MALFORMED`，在任何 Implement 之前终止（零门禁调用）⇒ F-24 的省略盲区由此关闭，且不冲击既有 fixture 的命令字符串形状。
- **A5 I1 可行性已实测验证**：`d3-10-required-downgrade-cheat` 的降级命令（`:949` `pytest backend/tests/kb`）与 `MANDATORY_TESTS[0]`（`:454`）**逐字相等** ⇒ C2 精确匹配/gateId 化后该反作弊断言不回退。
- **A6 新增回归**：`d6-09` 有必跑项但无结构化清单 ⇒ `GATE_SPEC_MALFORMED` 且 `gateCalls=0`；`d6-10` 声明 3 条只交 2 条 ⇒ `BLOCKED_GATE_COMMAND_NOT_EXECUTED`（附缺失 gateId 清单）；`d6-11` 提交的 gateId 不在 SPEC 内 ⇒ `GATE_COMMAND_NOT_DECLARED`（防"自造绿灯命令"顶替）。

**成本与净效果**：~~约 1 开发日（SPEC schema + 3 处提示词 + 守卫 + 覆盖率对账 + 8 场景）~~ ⇒ **因 F-26 上修为约 1.5~2 开发日**：真实变更面是 **2 个治理文件**（`project-feature-delivery.js` + `dryrun-harness.mjs`），含 1 个共享 `specObj`、2 个 `req()/rec()` 构造器、21 个门禁分支复核、22 个去重命令串的 gateId 映射、`d6-01..11` 共 11 条新场景。净效果 = **净收紧**：新增一条必然失败路径（省略），移除一条必然误报路径（诚实 record）。**风险点名**：若照 amendmentR1 之前的原设计落地，harness 会大面积转红，而"让它变绿"的压力极易诱导删掉 C3 或把 required 降级 —— 那才是门禁真正被削弱的一刻，故本修正与 C1–C5 同批交付。

## Human Decisions Required（HD-N-01 … HD-N-11，夜间一律不自动批准）

| ID | 需人工决策 | 阻塞范围 |
|---|---|---|
| HD-N-01 | ~~修复 F-20~~ **已裁定并执行完毕（2026-10-09 封存 `d2d7ddb`）**：采纳 `design.amendmentR1`（A1–A6）—— 对账键改为 `MACHINE_GATE_COMMANDS[].gateId`，`MANDATORY_TESTS`/`REGRESSION_TESTS` 退为语义清单，覆盖率对账 + `GATE_SPEC_MALFORMED` 前置 fail-closed + 按 tier 作者归因。机器证据 `REGRESSION: 115/115`、既有 106 条断言摘要逐字节未变、独立 Review PASS + 独立 Verify TASK_PASS + Task Delta 恰为两文件。F-20 缺陷家族（guard/契约互斥）自此在 4 次真实基线 Task 中未再复发 | 已解除（原阻塞：M0 全部剩余基线 Task → M0 MILESTONE_PASS）。原三选一 A/B/C 论证与 F-24/F-26 两次上修完整保留于上方 findings 表（`F-20`/`F-24`/`F-26` 行）、「FIX-GOV-001 融合设计」附录及进度日志，未删除 |
| HD-N-02 | ~~追认或否决 `deliverables/baseline/INTEGRATION_BASELINE.md`~~ **已由重跑消解（2026-10-09，无需裁决）**：F-20 封存后 M0-005 以完整五判据重跑 TASK_PASS，交付物单独封存为 `317341b`。原问题（未跟踪证据能否算任务）不复存在 | 已解除；仅剩历史留痕 |
| HD-N-03 | 授权 FIX-INT-01/02 Scope（测试引擎/loop 生命周期 + dev 依赖 pin）以恢复 CI 同款集成 green | `TODO.md:40 集成测试通过`；CI postgres job 可信度 |
| HD-N-04 | **部分裁定（2026-10-10，24 节授权书）**：批准范围**仅限 FIX-PERF-03 的实施**（延迟样本只在 `status == 200` 时计入），明确不批准公开 `/api/metrics`、改端点鉴权契约、改 `THRESHOLDS`/`SAMPLE_COUNT`、重定义缓存口径、改生产中间件，并排除 FIX-PERF-04 / FIX-GOV-006 / HD-N-05/09/10。**未获授权 = 原事项的另一半**：向 `docs/workflow/TASK_CATALOG.md` 插入 FIX-* 行（授权书 §4 仍把 `docs/workflow/**` 列为禁改）⇒ 该行插入仍未执行 | 已解除：FIX-PERF-03 实施链。**仍阻塞** M0 Exit 条款"P0 存量缺陷清单产出并插入 FIX-* 任务"（治理写欠账） |
| HD-N-05 | 确认 M0 基线 Task 文档口径 8 vs 7（F-17） | M0 Exit 交付物清单 |
| HD-N-06 | M2 Entry 需已批准的 KB ADR + 具备 pgvector 的镜像；M3 Entry 需人工确认许可；真实生产部署/发布/短信/密钥永远属 HUMAN_REQUIRED | M0 之后的一切 |
| HD-N-07 | **优先处置三条已确证安全 P0**：SB-01 跨用户响应缓存 IDOR（`middleware/performance.py:111-131` 缓存键仅在 Bearer 头下含 user_id，`api/deps.py:16-20` 浏览器走 httpOnly Cookie → `/api/report/summary`、`/api/report/levels`、`/api/training/levels` 等 D 类健康数据 60s TTL 内跨用户命中同一缓存）、SB-03 CI 触发分支不符（`.github/workflows/ci.yml:4-7` 监听 `main`/`develop`，仓库实为 `master`+`feature/m0-baseline` ⇒ 全部安全/权限回归从未被 CI 执行；属治理路径，夜间禁改）、SB-06 硬件 9 端点仅认证无归属校验（`api/hardware.py:65…280`，`main.py:131` 已挂载，测试零覆盖）。另 SB-31 为**最高危写库面**：`main.py:46/49` lifespan 无条件 `init_database()`+`seed_data()`（无 DEBUG/ENVIRONMENT 守卫）+ `db/init_db.py:14-15` `Base.metadata.create_all` + 默认串指向身份未知且绑定 0.0.0.0 的 `:5432` ⇒ 一条 `uvicorn app.main:app` 即可 DDL+写种子+建可登录演示账号；修复前禁止任何"启动一次看看"式冒烟 | M0 之后的真实安全修复排期；Chain 无权改代码/`.github/**`/`.qoder/rules/**` |
| HD-N-08 | ~~追认或否决两份未跟踪基线交付物~~ **已由重跑消解（2026-10-09，无需裁决）**：guard 封存后 M0-005/M0-006 均**整任务重跑**（非复用补审），五判据成立后各自封存为 `317341b` / `8c81df5`；`SECURITY_BASELINE.md` 重跑版为 602 行 / 94736 B / sha256 `65aa374d…0370`。原"证据 ≠ 任务"的口径缺口已闭合 | 已解除 |
| HD-N-09 | **M0-008 的 catalog 门禁口径裁决（新）**：`docs/workflow/TASK_CATALOG.md:29` 要求『docker build exitCode=0』，实测 `docker compose config` 与 `build` 在本仓库路径下均 **exit 1 / `project name must not be empty`**（中文目录名派生的 project name 非法；compose 无顶层 `name:`）⇒ 该要求在此环境下**结构性不可达**，不是实现失败。三择一：**(甲)** 先做 `FIX-DEP-01`（**建议编号，catalog 尚未占用 ⇒ 落库本身需 HD-N-04**；实为 compose 加顶层 `name: aiear` 或显式 `COMPOSE_PROJECT_NAME`，并移除 obsolete `version` 键 —— 根因三重证据见 `DEPLOY_BASELINE.md` §A.4）再复跑 M0-008 build 门禁，令 catalog 原要求成立；**(乙)** 由 Max 在治理阶段把该行改为"构建可用性如实记录"，M0-008 以现有证据直接计入；**(丙)** Milestone Gate 判 `MILESTONE_BLOCKED`，F-48 列为唯一阻塞项。**自治链不自选**（改 `docs/workflow/**` 属治理写，且任何口径都不得由实施侧自行放宽） | M0 MILESTONE_PASS 能否成立；OPS-002 / SEC-003 /  Release Gate 第 9、10 项证据 |
| HD-N-10 | **宿主 `:5432` 的 PostgreSQL 实例身份确认（新，F-54）**：当前监听者是 **原生 Windows `postgres.exe` 服务（PID 6740）**，不是容器；它里面有哪些库、是否含真实健康数据/生产数据、是否允许被测试触达，Agent **无法证明**（历史 NB-01 记的 PID 6892 已失效）。需人工给出处置：认定为可安全使用的一次性开发库并给出隔离口径（建独立库/独立端口），或明确禁止触达并要求所有测试继续用 sqlite / 自建一次性容器。 | OPS-002 部署冒烟、FIX-M0-004-001 迁移修复、SEC-003 生产硬化、任何"连本地库看一眼"的诱惑；在此之前 `BLOCKED_UNSAFE_DATABASE_TARGET` 继续生效 |
| HD-N-11 | **执行模式裁决（新，2026-10-10T07:16:55Z）**：人工上次选的 **甲**（同 args 全新派发 FULL）已如实执行一次，run `wf_a5710a52-f4d` 断在 **Preflight 的 Max 探针**（`totalToolCalls=0`，F-29 第 2 次复发，断点前移 ⇒ Max 额度由渐变退化为布尔 false）。探针 transcript 逐字证据：Max 侧 `model":"<synthetic>"` + 额度提示（平台拦截），Flash 侧 `model":"qfmodel"` 返回 `OK` ⇒ **qmodel_38max 不可用、qfmodel 可用** 是机器可复核事实。三择一：**(甲-等待)** 额度恢复后再同 args 全新派发（双模型政策原样满足，代价是等待、三文件继续悬置）；**(乙)** 显式授权 `executionMode:"FLASH_ONLY"`（D3 受控例外，政策要求调用方**显式**请求，本链绝不自动降级；六角色独立 invocation、HIGH ⇒ Reviewer A+B 双独立、required/record 分层、Task Delta、D4 指纹、治理写保护全部保留，D5 默认 FULL 不变）；**(丙)** 人工自跑门禁并封存（本链独立复跑取证：A 7 passed / B 1 / C 1 / D 10 / E 235 passed 0 failed / 零文件负向自证实测 FAIL）。 | FIX-PERF-03 能否取得五个 Task-PASS 判据并封存；HD-N-04 批准本身仍有效且范围未变（仅 FIX-PERF-03），本条只问执行模式。**本链不自选、不自动降级、不在取得终判前 commit 那三个测试文件** |
| HD-N-11（裁决） | **= 乙（人工显式授权，2026-10-10T07:23:47Z）**：原文「乙 授权 FLASH_ONLY」⇒ FIX-PERF-03 以 `executionMode:"FLASH_ONLY"` 跑完整流水线。这是 D3 要求的"调用方显式请求"形态，**不是**自动降级。落实方式经脚本只读核实：`project-feature-delivery.js:1187` 接受 args 覆盖、`:62` 在 FLASH_ONLY 下**不探测 Max**（这正是它能越过本次 Preflight 死因的机制），故**脚本顶部 `EXECUTION_MODE` 保持 `'FULL'`、零治理文件改动**（`:40` 明文列出这两种启用方式）。判据一条不降（Machine Gate 真实 exitCode ∧ 独立 Review HIGH⇒A+B 均 PASS ∧ Verify ∧ Task Delta ∧ Governance Guard）；范围一条不扩（FIX-PERF-04 / FIX-GOV-006 / 007 / HD-N-05 / 09 / 10 仍未授权）；push / merge / rebase / reset / clean / stash 仍禁。 | 已解除（原阻塞：Max 额度耗尽下 FULL 无法取得五判据）。**D5 默认双模型政策不受影响 —— 仅这一次调用降级** |

## 终态判定（诚实口径）

- `GOAL_STATUS` = **PAUSED_FOR_HUMAN**（2026-10-09T20:43Z 口径更新）。真实阻塞已从"F-20 治理缺陷"上移为**人工裁决缺位**：M0 基线 DAG 8/8 TASK_PASS，但 Milestone Gate 的 Exit 条款要 `docs/workflow/TASK_CATALOG.md` 治理写入（HD-N-04）、基线文档口径确认（HD-N-05）与 M0-008 build 门禁口径（HD-N-09）；下游 OPS-002/FIX-M0-004-001 另欠宿主 `:5432` 实例身份确认（HD-N-10）。自治链无权改 `docs/workflow/**`，亦不自选口径。
- `ENGINEERING_RELEASE_READY` = **NO**（M0 未 MILESTONE_PASS，M1+ 未启动）。Release Gate 11 项证据的当前覆盖：**第 6 项**（性能）已由 M0-007 采集，但为**进程内口径**（ASGITransport + sqlite 内存 + `_MemoryRedis`，零网络）且 `/api/metrics` 读数落在 401 错误路径（F-44）⇒ 不构成生产延迟证据；**第 9 项**（Docker build）已由 M0-008 真实尝试并 exit 1（F-48）⇒ 结论是"当前不可构建"，非"未采集"；其余 1/2/3/4/5/7/8/10/11 项仍为未采集或仅有基线侧证据。
  - ~~`07:38Z` 追加环境事实：Docker 守护进程当前不可达~~ 已于 2026-10-09 由人工授权启动后解除（M0-005 的 postgres+redis 与 M0-008 的 compose 均为真实执行）；该历史条目保留作时间线证据。
- `REAL_PRODUCTION_APPROVED` = **NO**（无真实人工批准，per D3 §8 恒 NO —— 这一项 NO 不属缺陷）。
- 未达成目标**不伪造**：不以放宽 Gate、降级 required、skip 测试、自动切 FLASH_ONLY、改判据的方式换取"看起来通过"。本轮的具体体现：M0-007 未动 `SAMPLE_COUNT=3` 与任何阈值（PF-03 仅记录）、M0-008 未给 compose 加 `-p` 绕过 project name 缺陷（F-48 以真实 exit 1 入档）、两次均未把红基线移出声明集。

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
  树安全：HEAD `1a62703`、staging 空、治理文件与 `*.spec.json` 零改动、qgraphflow 未跟踪内容指纹复核未变（`tree 9eb05078…`、graph.json `5f12d3d4…`、index.html `2bd127b7…`）。**`:5432` 全程零接触**（仅只读 `netstat` 观测：`0.0.0.0`/`[::]:5432` LISTENING PID 6892，与 NB-01 同一 PID）【`2026-10-09T20:58:02Z` 订正：该 PID 已过期，现由 PID 6740 = 原生 `postgres.exe` 服务持有 ⇒ **F-54**；实例身份依旧未知，零接触纪律不变】；本次未创建任何容器；历史一次性容器 `aiear-m0004-pg-test`(:55432)、`dresslens-postgres`(:15432)、`dresslens-redis`(:16379)、`dresslens-minio`(:9000-9001) 仍 Up 25h，**只记录不处置**（停止他方会话持有的容器属破坏性操作，交人工）。无 push/merge/rebase/tag/publish。新增 **HD-N-07**（安全 P0 排期 + 硬件暴露面处置）与 **HD-N-08**（两份未跟踪基线交付物复用/重跑的追认）。M0 DAG 现状：001-004 TASK_PASS；005/006 BLOCKED(F-20)；007 被 005 阻塞；008 依 F-20 机器证据不予启动 ⇒ **M0 MILESTONE_PASS 不可达，ENGINEERING_RELEASE_READY = NO，REAL_PRODUCTION_APPROVED = NO**。终点维持：**PAUSED_FOR_HUMAN**。
- ~~2026-10-07T21:14Z~~ **权威时间 2026-10-08T06:31Z（写盘）/ 06:37Z（提交 `6c47d57`）** — 订正依据 `stat` mtime 与 `git log --format=%cI`，见 F-25。**暂停期内的增值工作（只读 + 账本，零治理改动）**：不引用历史数字，实测复跑 `node .qoder/workflow-state/dryrun-harness.mjs test` ⇒ `REGRESSION: 106/106 passed`。据此复核守卫源码 `:727-743` 与 `gateGuardViolation(:1859-1881)`，发现 **F-24**：守卫遍历方向为"提交→SPEC"（`for (const c of cmds)`），SPEC 声明却未提交的门禁项无从被察觉 ⇒ 最省事的作弊是**沉默省略**而非改标 record；`dryrun-harness.mjs` 内降级相关场景仅 `:177 d3-10-required-downgrade-cheat` 一条，该形态**无测试**。同时记录 `:741` 双向包含中 `m.indexOf(cmd)` 的前缀假阳性。**本轮为反证而非案发**：M0-006 提交 9 条逐项可映射 SPEC、`skippedGates` 写"无"，未发生省略。
  F-24 直接改变 F-20 的修法结论：**候选 A 或 B 单独实施 = 净放宽**（移除误报同时移除唯一对账），违反 Night Chain"不得放宽任何 Gate"。故产出**融合设计** `pendingFixTasks.FIX-GOV-001.design`（status `NOT_STARTED` → `DESIGNED-NOT-APPLIED`）：不变量 I1–I4 + 变更 C1（SPEC 显式 tier，由 Max 撰写）/C2（精确查表替代双向包含）/C3（**新增覆盖率对账 ⇒ `BLOCKED_GATE_COMMAND_NOT_EXECUTED`**，fail-closed 不占修复预算）/C4（按 tier 作者归因 ⇒ `GATE_SPEC_TIER_CONFLICT`，消除两次误归因）/C5（HIGH Risk 双审不变），回归计划 = 现有 106 条全保留 + 新增 `d6-01..d6-08`，净效果"收紧"。**仅设计，未实施**：`.qoder/workflows/**` 与 `dryrun-harness.mjs` 均为治理保护路径，Night Chain 禁止夜间自动修治理缺陷 → 仍归 HD-N-01。
  同步更新：横幅"续跑前置条件"新增修法约束（A/B 单独实施不可采纳）、暂停根因补 F-24、HEAD 行改为**不随每次账本提交而失真的口径**（记录 seal 的父提交，实际以 `git log -1` 为准）、HD-N-01 待决项改写为"采纳融合设计"。树安全：本次仅改 `deliverables/overnight/{TASK_LEDGER.json,GOAL_PROGRESS.md}` 两个已跟踪账本文件（findings 22→23）；`.qoder/**` 治理文件与 `*.spec.json` **零改动**；两份基线交付物继续**保持未跟踪**；`docs/qgraphflow/dialogue-turn-sequence/` 未触碰；**`:5432` 零接触**、未创建任何容器、无破坏性 git 操作；无 push/merge/rebase/tag/publish。终点维持：**PAUSED_FOR_HUMAN**（HD-N-01 … HD-N-08 待人工）。
- 2026-10-08T07:38Z（`date -u` 权威值，经脚本 `argv` 传入；提交时间以 `git log %cI` 为准）— **第二批暂停期增值：七条 P0 独立核验 + 自报记账缺陷 F-25**。
  (1) **P0 亲验补齐**：静态只读取证 SB-04 与 SB-05（前批已亲验 SB-01/03/06/31），累计**亲验成立 6/7**。SB-04 得到比报告更具体的形态：危机词只存在于 `config.py:144`，命中后响应是"继续练习日常对话"式通用拒答，且 `user_text` 原样入库、`app/models` 无 safety_event/audit ⇒ §70 要求的四项安全架构组件**均无载体**（文案本身 H-9 属 HUMAN_REQUIRED，未代拟）。SB-05 反向**收窄**：`chat_stream` 在 `app/` 内零调用方 ⇒ 其 `:317-318` 检查点与 `:352` 的 `yield {"error": …}` 类型破坏均为**潜在而非活跃**，据实记录、不夸大。
  (2) **去重**：两处疑似新缺陷经核对已在交付物内（`SECURITY_BASELINE.md:422`/`:428` + SB-04/SB-20），**撤回**拟新增同号发现；`tests/` 对 `自杀|emergency|转诊|急症` 零命中的事实归入既有 SB-20。
  (3) **自报 F-25（P2-PROCESS，Orchestrator 自身记账缺陷）**：上一批的 `21:10Z/21:14Z` 标签与权威证据不符（`patch-ledger3.mjs` mtime `06:31:08Z`、`6c47d57 %cI = 06:36:55Z`），根因是复用陈旧 `NOW` 常量。技术结论不受影响（`106/106` 为真实执行、行号与 SHA-256 证据独立）。处置 = **透明订正**（原文保留 + `timestampCorrections` 映射 + 新增「时间戳订正」小节），并把预防措施机器化：账本写入必须由 `argv` 接收 `date -u`，缺戳 exit 1 零写入（`patch-ledger4.mjs` 实装并自测拒绝 `no-stamp`）。
  (4) **环境真相更新**：`docker info` 现失败（Docker Desktop 守护进程未运行，`npipe …dockerDesktopLinuxEngine`）。⇒ **H-10 此刻不可闭**，Release Gate 第 9/10 项（Docker build、部署冒烟）证据亦不可采；已在 `notes.dockerAvailable` 记录前后状态。**决策：不擅自启动 Docker Desktop** —— restart=always 可能自动复活身份未知的 `:5432` 相关实例（SB-28/SB-31 危险面）与他方会话的 `dresslens-*`，且拉起机器级服务不属本 Chain 授权。
  树安全：本次仅改 `deliverables/overnight/{TASK_LEDGER.json,GOAL_PROGRESS.md}`（findings 23→24，新增 `p0IndependentVerification`/`timestampCorrections`）；`.qoder/**` 治理文件与 `*.spec.json` **零改动**；`:5432` 零接触；**本批未运行任何 DB/容器/网络命令**（仅 `docker info` 只读探测，失败即止）；两份基线交付物继续未跟踪；qgraphflow 未触碰；无 push/merge/rebase/tag。终点维持：**PAUSED_FOR_HUMAN**。
- 2026-10-08T09:16Z（`date -u` 权威值）— **第三批暂停期增值：实施前影响分析，推翻我自己的设计（F-26）**。动机不是再攒证据，而是回答一个会让 HD-N-01 直接失败的问题：**FIX-GOV-001 照原文能不能落地？** 只读核查 `dryrun-harness.mjs`（1104 行）得到三条硬事实：
  (1) 干跑器**读真实源码**（`wfPath = ../workflows/project-feature-delivery.js`，wrap 成 async 后驱动），⇒ 它确实保护被测守卫，我的回归计划有机械意义；
  (2) **全场景共享同一个 `specObj`（`:447-457`）**，其中 `REGRESSION_TESTS: ['pytest backend/tests']`（`:454`）；而 21 个门禁 fixture 提交的全部去重命令串共 22 个，`grep -cx "pytest backend/tests"` = **0** ⇒ 声明项从未被提交过；
  (3) `status: 'TASK_PASS'` 断言共 **44 条** ⇒ 原 C3（按 SPEC 字符串清单做覆盖率对账）落地即大面积转红。**结论：我上一轮同时写下的 "C3" 与 "既有 106 条全保留" 两个承诺互斥，原设计不可实施。** 唯一站得住的保留项也顺带验证了：`d3-10` 的降级命令与 `MANDATORY_TESTS[0]` 逐字相等（`:949` vs `:454`），故 C2 精确匹配后反作弊断言不回退。
  产出 `design.amendmentR1`（A1 断言不变量 / A2 fixture 迁移 / A3 覆盖率只认 gateId / A4 SPEC 完备性 fail-closed 前移到 Max 侧 / A5 已验证 / A6 新增 `d6-09..11`），撤回不实口径并保留原文留痕，成本上修 1.5~2 开发日，并点名最危险的失败模式（harness 转红 → 压力之下删 C3 或降级 required = 门禁真被削弱）。
  口径说明：`TASK_LEDGER.json.pausedAt = 07:52Z` 是**最后一次状态变更**时刻（F-26 写入），非心跳值；本条 `09:16Z` 为记录时刻。树安全：本批仅改两个账本文件（findings 24→25，`FIX-GOV-001.status → DESIGNED-NOT-APPLIED (amended R1)`）；`.qoder/**` 治理文件与 `*.spec.json` 零改动（`git diff --name-only HEAD -- <治理路径>` 为空）；**未运行任何 DB/容器/网络命令**；`:5432` 零接触；qgraphflow 与两份基线交付物 SHA-256 复核不变；无 push/merge/rebase/tag。终点维持：**PAUSED_FOR_HUMAN**（HD-N-01 仍为唯一解锁点，且现已带可实施版本）。
- 2026-10-09T14:31Z → 20:43:35Z（各批 `date -u` 权威值）— **HD-N-01 执行到底 + M0 基线 DAG 8/8 的真实推进（四批，明细见上方各 Task 小节）**：① 额度恢复后 `resumeFromRunId` 只补独立 `qmodel_38max` Verify = TASK_PASS，治理两文件封存 **`d2d7ddb`**；② M0-005 重跑 TASK_PASS → `317341b`；③ M0-006 重跑 TASK_PASS（HIGH risk，Reviewer A+B 彼此不可见结论、均 PASS）→ `8c81df5`；④ M0-007 → `7dcf2f8`、M0-008 → `ed36481`。新登记 **F-38..F-52**（含 F-44 错误路径延迟可"通过"阈值、F-48 compose 在本仓路径结构性不可构建、F-52 我自己写的 SPEC 摘要两处与已封存源文档不符）。每一批入账前均由 Orchestrator 独立复跑关键命令核实（perf 7 passed exit 0、全量 pytest 1 failed/231 passed exit 1、compose config/build 双双 exit 1、交付物字节与 SHA-256 重算）。
  口径纪律：红基线一律 `EXECUTED_AND_RECORDED` 原样入档，**未**降级、**未**省略、**未**改阈值/采样数、**未**用 `-p` 绕过 compose 缺陷；`.qoder/**` 治理文件在 ①之后的四批 Task 中零改动。DB 安全：隔离端口，**`:5432` 全程零接触**。终点：**M0 DAG 8/8，PAUSED_FOR_HUMAN**（阻塞上移至 HD-N-04 / HD-N-05 / HD-N-09）。
- 2026-10-09T20:51:23Z → 20:54:35Z — **账本自洽性修订批（零治理改动，仅两个账本文件）**：把仍停留在"HD-N-01 未封存 / 005-008 BLOCKED"的旧口径更新为当前真相。
  (1) **人类可读侧**：顶部横幅改写为"8/8 TASK_PASS，停在 Milestone Gate 门前"（旧🟡原文以删除线保留并指向历史小节，不删）；M0 DAG 表 M0-005..008 四行改为 TASK_PASS + 封存 commit；「已完成 Task」补指针说明；Human Decisions 表 HD-N-01 记"已裁定并执行、封存 `d2d7ddb`"、HD-N-02/HD-N-08 记"由整任务重跑消解，无需裁决"、新增 **HD-N-09**；终态判定把 Release Gate 第 6/9 项证据从"未采集"订正为"已采集但口径不足 / 当前不可构建"。
  (2) **机器侧（带 `date -u` argv 守卫 + double-apply 拒绝的脚本写入）**：`humanDecisionsRequired` 9 条（HD-N-01 状态跃迁 + HD-N-02/08 消解 + HD-N-09）；`currentTask` / `pausedReasonCurrent` 改写。随后逐字段自查发现**三处互相矛盾的历史字段**并登记 **F-53（P3-PROCESS，自报）**：`fixGov001R1.maxVerify` 在 Verify 成功后仍写 `ran:false / verdict:null / runId=失败的 v1 run`、`verifyAttempts` 中 IN_PROGRESS 行与 TASK_PASS 行**时间倒序**、`HD-N-01.decisionState` 仍写"EXCEPT-INDEPENDENT-VERIFY"。根因与 F-25 同族：账本只追加新块、不回改旧否定字段，且机器时间戳与分钟精度转写值混用。已按"原文保留于 `superseded*` + 新字段指向 v2 run `wf_3855e53c-a89` = TASK_PASS + `sealedAs{commit:d2d7ddb, commitUtc:2026-10-09T14:41:17Z}`"的方式订正，`goalStatus` 改为 **`PAUSED_FOR_HUMAN_AT_M0_MILESTONE_GATE`**（旧值保留于 `goalStatusSuperseded`）。
  (3) **本批我自己踩到的两个记录缺陷，如实上报**：① 改 DAG 表时把 M0-005 的 Deps 误写为 `M0-001`，与 `TASK_CATALOG.md:26`（`M0-002,M0-004`）不符，提交前按 catalog 与账本双真相回改，最终文本无误；② 账本脚本打印的 "bytes A -> B" 中 A 取的是 `readFileSync` 的 **UTF-16 字符数**、B 是 `statSync().size` 的**字节数**，二者不可比 —— 我据此写进上一条日志的"字节 116858 → 154446"是误导数字，权威实测为 **151889 B（`37e0c58` 版本）→ 159535 B（本批后）**；该显示缺陷并入 F-53 的 proposedFix（时间/大小字段一律取机器单一真相）。
  本批事实锚点（全部现场重取，非引用旧数字）：`git log -1` = `37e0c58`；`d2d7ddb` 经 `merge-base --is-ancestor` 验证在 HEAD 历史中且 `--stat` 恰含两治理文件；`taskCommits` 八项齐备、`blockedTasks = 0`、`findings = 52`；`SECURITY_BASELINE.md@8c81df5` = 602 行 / 94736 B / sha256 `65aa374d…0370`；`DEPLOY_BASELINE.md:315` 记录"未使用 `-p` 等绕过参数"；`backend/tests/test_performance.py` 与 `docker-compose.yml` 工作树零 diff。树安全：仅 `deliverables/overnight/{TASK_LEDGER.json,GOAL_PROGRESS.md}` 两文件被改；`.qoder/**` 治理文件与 `*.spec.json` 零改动；qgraphflow 未跟踪内容未触碰、未暂存；**`:5432` 零接触**、未创建/停止任何容器、无 push/merge/rebase/tag/reset/clean/checkout。终点维持：**PAUSED_FOR_HUMAN**（待 HD-N-04 / HD-N-05 / HD-N-09 人工裁决）。
- 2026-10-09T20:58:02Z — **收尾只读巡检发现 F-54（观测快照过期）**。`netstat -ano` + `tasklist` + `docker ps` 三项只读比对显示：历史记录（`BACKEND_TEST_BASELINE.md:259`/`:274` NB-01、本日志 M0-006 行、账本两处字段）里的 "`:5432` LISTENING **PID 6892**" 已失效 —— PID 6892 无匹配进程，当前 `0.0.0.0:5432` 与 `[::]:5432` 由 **PID 6740 = postgres.exe（会话 Services/0）** 持有，即一台**原生 Windows PostgreSQL 服务**而非容器（`opengauss-lab` 虽映射 `0.0.0.0:5432->5432` 但 Exited(255)，不可能持端口）。变化发生在人工授权启动 Docker Desktop 的机器级服务重启窗口附近，**只报相关、不宣称因果**。
  纪律复核：**全程零接触**（未发起任何连接/读写/启停，观测命令均只读）；`UNKNOWN_DATABASE_INSTANCE` 与 `BLOCKED_UNSAFE_DATABASE_TARGET` 口径**不变且更强化**。**不改写已封存交付物**（`BACKEND_TEST_BASELINE.md` 的 NB-01 保留为时点证据），订正一律落在Living log 与账本。新增 **HD-N-10**：该实例身份需要人工确认（是否本机开发库/是否含真实数据/是否允许被测试触达），在此之前任何任务（含 OPS-002 冒烟、FIX-M0-004-001 迁移修复）都不得使用它。
  容器残留复核：`docker ps -a` 显示 `aiear-m0005-*`/`m0006-*`/`m0007-*`/`m0008-*` **零残留**；`aiear-m0004-pg-test`(:55432) 与 `opengauss-lab` 现为 Exited(255)（Docker Desktop 重启导致，非本链处置），`dresslens-redis`/`dresslens-postgres`/`dresslens-minio` Up —— 全部**只记录不处置**（他方会话资产）。账本 true bytes 160326 → 162668，findings 52 → 53。树安全：本批仅两个账本文件；治理文件与 `*.spec.json` 零改动；qgraphflow 未触碰。终点维持：**PAUSED_FOR_HUMAN**。
- 2026-10-09T23:08:36Z — **F-44 只读复核（人工点名）+ 两项新缺陷**。解释器 `backend/venv312/Scripts/python.exe`（Python 3.12.10 / pytest 9.1.1）；插桩方式：在 `python -` 进程内包装 `httpx.AsyncClient.send` 以记录 path/status/X-Cache，**未写入仓库任何文件**。
  (1) **PF-01 独立复现**：`test_metrics_performance` → `1 passed` / exitCode=0，而其三次请求实测 `[401,401,401]`。全 7 条计时用例的请求→状态映射显示 `/health`、`/`、`/api/auth/sms/send`、`/api/auth/login`、`/api/training/sessions`、`/api/report/summary`、`/api/dialogue/scenarios` **均为 200x3** ⇒ 断言缺陷（`_measure:40-47` 丢弃 Response）是系统性的，但**当前只有 metrics 真的落在错误路径**；给 `_measure` 加状态码校验不会把其余 6 条改红（此结论已实测，非推断）。
  (2) **身份矩阵**：`GET /api/metrics` 无凭据 **401** / `auth_token`（patient） **403** / `therapist_token` **200**。⇒ 原 F-44 `proposedFix` 中"补 therapist 角色 fixture"一句**不必要**：`therapist_token` 早已存在于 `conftest.py:158-166`（现仅 `test_role_permissions.py:35/:64` 引用），性能用例从未使用；新增同义 fixture 只会制造第二个身份源。
  (3) **修正后不会翻红**：therapist 认证下 `/api/metrics` 三次采样中位数 **4.70ms**（匿名 401 为 2.02ms，阈值 100ms）⇒ "假绿变真红"的风险不存在，可安全收紧断言。
  (4) **为何能长期隐身（系统性偏差）**：`app/middleware/performance.py:83` 只缓存 `status == 200` 的响应 ⇒ **错误路径结构性更快**（不过缓存、不落库、不聚合）。"ms 越小越达标"的断言恰好在失败路径上最容易被满足——这就是 F-44 必须"先断言 2xx 再计量"、而不能只加告警的理由。
  (5) 新增 **F-55（P2-MEASUREMENT-INTEGRITY）**：`/api/dialogue/scenarios` 与 `/api/report/summary` 各 3 次采样实为 **MISSx1 + HITx2** ⇒ `statistics.median` 取到的是**缓存命中**值；`PERF_BASELINE.md` §2 第 5/6 号读数名义是端点延迟、语义是命中路径延迟，并与 F-44 的 401（永不入缓存）同表并列而三种口径未分列。**只取证不改判**：阈值应绑冷路径还是命中路径属测量口径决策，不自选，建议与 HD-N-09 同批交人工（建议编号 FIX-PERF-04）。
  (6) 自查发现 **F-56（P3-PROCESS-LEDGER-INTEGRITY）**：账本 `notes` 字段曾在 `506f5ee` 被 `对象 + 字符串` 拼接毁成 `"[object Object]"`，7 个键正文（dbSafety / dockerAvailable / serialPolicy / resumePrecondition / engineeringReleaseReady / realProductionApproved / bookkeepingIgnore）静默丢失，其后 4 次追加继续沿用字符串形式无人察觉——是被本批第一个脚本的 `TypeError` 暴露的，不是被校验器抓到的。本批从 `6fe4904` **逐字恢复**至 `notesPreCorruption`（现存 notes 原样保留，不做"顺手清理"）。属我自己的记账缺陷，与 F-53 / FIX-GOV-006 同族，修复建议（写前运行时类型断言 + 写后结构等值比较）已并入该候选项。
  (7) **顺带价值**：同一身份决策可关闭存量红 **F-01**（`tests/test_middleware.py:30-35` 断言 200 实得 401，即全量 pytest 目前唯一的 `1 failed`）⇒ 建议 FIX-PERF-03 同时覆盖两文件，使 Release Gate 第 1 项（后端全量测试）由红转绿。反向方案"把 `/api/metrics` 改为公开/去角色"属公开 API 契约与鉴权口径变更（须 ADR + `DECISIONS.md`），**不建议，也不得由测试侧单方面放宽**。
  纪律：本批**未改动任何测试或业务代码**（测试代码改动须走 project-feature-delivery task；FIX-PERF-03/04 写入 `docs/workflow/TASK_CATALOG.md` 仍受 **HD-N-04** 门禁）。账本 true bytes 165137 → 177042，findings 53 → 55（本批随后两笔 —— `pendingFixTasks` 登记 FIX-PERF-03/04 @23:10:21Z、notes 续记 @23:10:41Z —— 续至 **181208**；分笔数字逐笔真实，汇总口径见 F-53/FIX-GOV-006）。`pendingFixTasks` 由 2 → 4 键。树安全：本批仅两个账本文件；治理文件与 `*.spec.json` 零改动；qgraphflow 未触碰。终点维持：**PAUSED_FOR_HUMAN**。
- 2026-10-10T05:55:20Z — **人工授权 HD-N-04 到位，FIX-PERF-03 首跑 BLOCKED（F-57），实施已在位并独立复跑取证**。授权书为 24 节长文，核心裁定：批准"延迟样本仅在 `status == 200` 时计入"的测试度量修复，**范围仅限 FIX-PERF-03**；明确不批准公开 `/api/metrics`、移除 therapist 角色要求、改端点鉴权契约、改 `THRESHOLDS`、改 `SAMPLE_COUNT`、重定义缓存/冷路径口径、改生产性能中间件；明确排除 FIX-PERF-04 / FIX-GOV-006 / HD-N-05 / HD-N-09 / HD-N-10。
  (1) **范围收窄的如实后果**：原 HD-N-04 事项含"向 `docs/workflow/TASK_CATALOG.md` 插入 FIX-*/SEC-*/OPS-*/PRIV-* 行"，而授权书 §4 把 `docs/workflow/**` 列为默认禁改 ⇒ **catalog 插入子项未获授权、未执行**，M0 Exit 的该项仍未满足。账本里 HD-N-04 记为 `APPROVED-SCOPED-TO-FIX-PERF-03-ONLY`，旧状态按 F-25 纪律保留于 `supersededDecisionState`。
  (2) 首跑 `wf_e7c7af02-88c`（FULL 双模型）终态 **BLOCKED / BLOCKED_REPAIR_OUT_OF_SCOPE**，FAILED_PHASE=Repair，ATTEMPTS=1。Machine Gate 六条 required 全 exit 0（7 passed / 1 passed / 1 passed / 10 passed / 235 passed 0 failed / ruff CI 基线），唯一红的是我为负向自证设计的**文件型** required 命令 G-NEG-PROBE。
  (3) 新增 **F-57（P2-GOVERNANCE-ORCHESTRATION）**，责任在我（规划侧）：那条门禁命令的目标被 SPEC 具体化为"成功后自删"的一次性探针脚本，与授权书 §16"工作区必须恢复原样、禁止用 git restore/checkout/reset/clean 清理"结构互斥 ⇒ 该门禁**永远不可能 exit 0**；同时 Repair 阶段的 `allowedRepairFiles` 只取上一阶段 `filesChanged`（三个测试文件），不读 SPEC 自己的 `EXPECTED_FILES`/`ALLOWED_WRITE_PATHS`，于是执行手无论怎么做都会违规。执行手行为正确（拒绝造文件、如实上报、未降级门禁），但 BLOCK 消息把归因指向了实施者——与 F-20 同族的"planner 缺陷记到执行手头上"。建议编号 FIX-GOV-007（治理脚本改动，不在本批授权范围，故 `.qoder/workflows/**` 零改动）。
  (4) **独立复跑取证（`backend/venv312/Scripts/python.exe`）**：`test_performance.py` 7 passed；metrics 性能 1 passed；`test_middleware.py` F-01 用例 1 passed；`test_role_permissions.py` 10 passed；全量 **235 passed / 0 failed**（修复前基线 `1 failed / 231 passed` ⇒ **F-01 已闭合**）；`ruff check app/` 291 errors 与既有 record 基线同量（本任务禁改 `app/**`，故非本任务引入）。`THRESHOLDS` 与 `SAMPLE_COUNT` 在 diff 中逐字未变；未新建 therapist fixture（复用 `conftest.py` 既有 `therapist_token`）。
  (5) **修正后的零文件负向自证实测有效**：进程内把 `app.api.deps.verify_token` 置为恒返回 `None` ⇒ `test_metrics_performance` FAILED，断言原文"有效成功样本数不足：需要 3 个 status==200 的样本，实际仅 0 个，各样本 status=[401, 401, 401]"，且工作区零新增文件。
  (6) 临时产物处置：探针文件 `backend/_neg_probe_fix_perf_03.py` 由本链自建，先取 sha256（`189b2629ed4e577a…`）再 `rm` 清除，**未使用任何破坏性 git 命令**。
  纪律复核：本批账本外零代码改动（三个测试文件为首跑实施产物，仍在工作区未封存）；治理文件与 `*.spec.json` 零改动；qgraphflow 未触碰。账本 true bytes 181208 → 190822，findings 55 → 56。下一步：以修正后的门禁命令设计（零文件自证）重新派发同一任务，取正式 Machine Gate / Review A+B / Verify 结论，再精确封存三个测试文件，然后按授权书 §25 **停止**。
- 2026-10-10T06:15:24Z — **重试 run `wf_64827cc9-6ae` 于 Task Spec 阶段撞 Max 信用额度墙（F-29 复发），本链按政策停止，未降级、未换模型、未写任何文件**。
  (1) 派发前先把"重试归属"做成了**可核实的字节证据**而非口头断言：从本会话 subagent 转录里恢复了首跑 `wf_e7c7af02-88c` 自身的 D4 快照记录 —— post-Implement（05:35:52.568Z / 05:36:14.271Z）与 post-Repair（05:47:22.850Z / 05:47:49.853Z）两组 `F|…|backend/tests/xxx.py|size|sha256|md5` 行完全一致，且与我当时、以及 run 结束后两次自测的工作树 sha256 逐字节相等（`a788ef6e…` 6930B / `fa639d5e…` 1227B / `a32d3875…` 4219B）。这满足 §27/§28 的实质要求（同一 Task 的上一 run 产物 + 两次 run 之间未被外部修改），因此 args 里显式携带 `retryOfTaskId:'FIX-PERF-03'` + 三条 `retryArtifacts`。**关键如实限定**：`applyRetryOwnership()` 位于脚本 line 1578、在 Task Spec 产物之后才执行，本次没跑到 ⇒ **编排器侧的 RETRY_OWNED 机器判定至今未产生**，账本里不得写成"机器已接受重试归属"；已成立的只有 Explore（Max 只读角色）对我提交证据的独立逐字节复核。
  (2) 门禁设计按 F-57 修正后下发：负向自证改为**单条零文件命令**（`./venv312/Scripts/python.exe -c "…verify_token=lambda t: None…"`），required 清单 A–G 全为真实可跑命令，`ruff check app/` 全量 291 存量错误保持 `record` tier 不降级；EXPECTED_FILES/ALLOWED_WRITE_PATHS 严格限定为三个测试文件、禁止创建任何新文件。
  (3) 实际进度：Preflight 双模型探针（`qmodel_38max` + `qfmodel`）均 "OK" → git 守护（dirty 恰为三文件）→ D4 baseline 取证（只读，filesWritten=[]）→ Classify（blocked:false，taskType=backend/bugfix/security/observability）→ Explore（17213 B，确认三 sha 一致）→ Scope Check（atomic:true，0.5 开发日）→ **Task Spec 第 8 个 agent 报错** `You've reached your credit usage limit.` ⇒ 脚本判 `BLOCKED_MODEL_UNAVAILABLE / FAILED_PHASE=Task Spec / ATTEMPTS=0`。
  (4) 由此新增一条**可观测量**（写入 F-29.recurrences）：同一 run 内 Max 的可用性是"够跑几步就断"的渐变，而不是布尔量 —— Preflight 探针通过**不能**推出任务能跑完。这解释了为什么"探针通过即安全"的既有假设需要修正，也说明本链为何应在额度敏感阶段（Task Spec 之前）就先报告成本预估。成本：8 agents / 39 tool uses / 584953 ms。
  (5) 终点判定：**PAUSED_FOR_HUMAN**，选项三择一（甲 恢复额度后 resume 同 run；乙 显式授权 FLASH_ONLY；丙 人工自跑门禁并封存）。自治链不选、不自动降级（`.qoder/workflows/**` 与所有治理文件零改动）。FIX-PERF-03 **未封存**，账本 true bytes 190822 → 196707，findings 键数不变（56，F-29 增 `recurrences` 字段而非新增 ID）。
- 2026-10-10T06:18:13Z — **自检推翻我上一条自己写的恢复建议（新增 F-58）**。落完账后回读 `TASK_LEDGER.lastRun_FIX_PERF_03.redispatch.resumePrecondition`，逐行核对 `.qoder/workflows/project-feature-delivery.js`：`:580` 把 `baseline.head !== current.head` 置 `headChanged`、`:627` 直接产出 `BLOCKED_GIT_HISTORY_MUTATED`（**无 `adjudicable` 标记 ⇒ 不参与 FINGERPRINT_ADJUDICATION**）、`:2426` 把它并入 `GOVERNANCE_GUARD_PASS` 的反向条件。而 blocked run 的缓存 baseline `rawStdout` 第二行就是 `H|d7c3092b34a28abd7cd5669e5104adc7c168c4e7`，我随后的记账 commit 已把 HEAD 推到 `d8a36ab` —— **照我给的（甲）去做 resume，一定拿到一个把"记账"伪装成"历史改写"的假阳性 BLOCK**。守卫本身没错（自治链绝不该改历史），错的是我没把"resume 的适用前提 = run 期间 HEAD 不变"写进操作建议。
  更正与留痕：原文逐字保留在 `redispatch.supersededResumePrecondition` / `supersededNextAction`，更正写入 `redispatch.correction`（含 correctedOptions 甲/甲′/乙/丙）与新 finding **F-58（P2-GOVERNANCE-ORCHESTRATION）**，与 F-57 同族（编排约束未进入我给出的操作建议，责任在规划/记账侧，非执行手）。
  正确的（甲）：恢复额度后**同 args 全新派发**（新 runId，不传 resumeFromRunId）——新 run 的 baseline 取当前 HEAD，任务期间本链不再产生任何 commit；三条 `retryArtifacts` 依然成立，因为工作树三文件 sha256 自上一 run 产出以来逐字节未变（`a788ef6e…`/`fa639d5e…`/`a32d3875…`，我在派发前、派发后、以及本笔记账前共自测三次一致）。代价是 7 个已完成 agent 重跑（≈10 分钟 + 额度），但这正是额度紧张时唯一安全的路径；"省额度的推荐"必须先证明它不触发任何守卫，否则就是新的 F-57。
  （甲′）如实列出但不建议：坚持 resume 需人工把 HEAD 归位到 `d7c3092`，属破坏性历史操作，Agent 无权执行、也不得诱导自行执行，且会把记账证据与开发证据混在一笔操作里。
  纪律复核：本批只改两个账本文件（`.qoder/**`、`docs/workflow/**`、`backend/**` 零改动；工作树三测试文件仍未封存）；未调用任何模型、未跑门禁；账本 true bytes 196707 → 203350，findings 56 → 57。终点维持 **PAUSED_FOR_HUMAN**。
- 2026-10-10T07:09:46Z — **人工裁决「甲」，FIX-PERF-03 以同一 args 全新派发（不 resume）**。甲的字面含义已被 F-58 更正过一轮，故此处记的是更正后的甲：**新 runId、同 args、同 retryArtifacts**，视为在 HD-N-04 原范围内继续授权跑完整流水线（Machine Gate → 独立 Review（HIGH ⇒ A+B）→ Max Verify）。**未被选中 ⇒ 乙（FLASH_ONLY）不生效**，治理写、FIX-PERF-04 / FIX-GOV-006 / 007 / HD-N-05 / 09 / 10 一律仍未授权。派发前逐字节复核三文件 sha256 与两条 run 的 D4 快照完全一致（`MATCH ×3`），retryArtifacts 可继续提交。把 F-58 的教训固化为一条纪律：**run 期间本链不产生任何 commit**，记账一律在终判之后落（本次先记账、后派发，故新 run 的 baseline 将锁在记账后的 HEAD）。账本 true bytes 203350 → 205024，新增 `humanDecisionOnRedispatch`，findings 键数不变（57）。
- 2026-10-10T07:16:55Z — **甲 执行一次即结构性受阻，回 `PAUSED_FOR_HUMAN`（新增 HD-N-11）**。全新派发 run `wf_a5710a52-f4d`（args 逐字节同上批、未传 `resumeFromRunId`）终态 `BLOCKED / BLOCKED_MODEL_UNAVAILABLE / FAILED_PHASE=Preflight / ATTEMPTS=0`，机器计数 `agentCount=2 / totalToolCalls=0 / durationMs=11597`：**断点比第 1 次复发更靠前**（上次在 Task Spec，同 run 已跑完 2 探针 + 3 个 Max 决策角色；这次第 1 个 Max 调用即死）⇒ 额度状态从"渐变"退化为"布尔 false"，`FULL` 当前不可执行，再派只会零进展重付 Preflight。我没有采信 `UNAVAILABLE_MODEL` 标签本身，而是读了两枚探针 transcript：`…-b774ef1d102474b2.jsonl` 的 assistant 消息 `model":"<synthetic>"`、正文即 credit 提示（平台在模型之前拦截，非模型拒答），`…-bfcec9dd47f2fb88.jsonl` 的 `model":"qfmodel"` 正常返回 `OK` ⇒ 有字节证据的结论是 **qmodel_38max 不可用 / qfmodel 可用**；编排侧本会话不在这两个 invocation 之内，**不得**据"我还能读写记账"反推 workflow 内 Max 可用。**零写入复核**：HEAD 仍 `fea2053`，`git status --porcelain` 恰为三测试文件 + 未跟踪 `docs/qgraphflow/dialogue-turn-sequence/`，三 sha256 与派发前逐字节相同。诚实口径：五个 Task-PASS 判据**一个都没取得**，机器侧 `RETRY_OWNED` 判定**仍未产生**（`applyRetryOwnership()` 在脚本 line 1578、紧跟 Task Spec 之后，本次连 Task Spec 都没到），三文件继续不封存。本链不自选执行模式（D3 要求降级由调用方**显式**请求），故把裁决权交回人工：**甲-等待 / 乙 显式授权 FLASH_ONLY / 丙 人工自跑门禁并封存**。
- 2026-10-10T07:23:47Z — **人工裁决 HD-N-11 = 乙（「乙 授权 FLASH_ONLY」），FIX-PERF-03 转入 D3 显式降级路径**。我先做了两项只读核实再落账：**(1) 政策合法性** —— D3 第 1 条与 D5 第 2 条都写明 FLASH_ONLY 只能由"调用方显式传参"或"人工改顶部常量"启用，本次是前者，因此**脚本 `.qoder/workflows/project-feature-delivery.js` 一个字都不改**（`:40` 原文列出这两种方式；改治理文件反而需要另行授权）。**(2) 机制有效性** —— `:1187` 用 args 覆盖 `EXECUTION_MODE`；`:62` 在 FLASH_ONLY 下 `probeMax` 返回 `null` 即**根本不探测 Max**，而这正是甲 run 的唯一死因（Preflight 的 Max 探针被平台额度拦截）；`:69/:76` 把全部运行时角色路由到 `qfmodel`，Preflight 路由守卫在任何 `agent()` 之前拦截违规路由。⇒ 乙 不是"再赌一次额度"，而是绕开已证伪的依赖。账本新增 `hdN11Decision` + `humanDecisionsRequired[HD-N-11]=APPROVED-EXECUTION-MODE-FLASH-ONLY-SCOPE-FIX-PERF-03`，true bytes 212140 → 216533。**边界重申**：降级只改"谁来决策"，不改"要不要证据"——HIGH Risk 仍需 Reviewer A+B 两个彼此不可见的独立 invocation 均 PASS，required 门禁仍按真实 exitCode 计算，Task Delta / D4 指纹 / 治理写保护原样生效；FIX-PERF-04 / FIX-GOV-006 / 007 / HD-N-05 / 09 / 10 不因本批获得任何授权。派发前先记账（F-58），run 期间零 commit；三文件 sha256 再次逐字节复核未变。
