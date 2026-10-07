# 00 — 模型政策（永久，禁止 fallback）

## 角色与模型绑定

| 角色 | 模型 | 标识 | 允许的动作 |
|---|---|---|---|
| 架构师 / 项目经理 / 验收官 | Qwen3.8-Max | `qmodel_38max` | 任务分类、只读探索、Scope 检查、TASK_SPEC/FIX_SPEC 生成、Root Cause Analysis、独立 Code Review、Verify 验收、Milestone/Release Gate 判定、治理文件编写 |
| 程序员（实施者） | Qwen3.8-Flash | `qfmodel` | 按 TASK_SPEC/FIX_SPEC 实现代码与测试、Self-Repair、Machine Gate / Gate 证据收集的命令执行（机械执行手） |

标识来源：`~/.qoder-cn/settings.json` 的 `model.name` 与运行日志 `model_config={"key":"qfmodel","display_name":"Qwen3.8-Flash"}`。标识变更时仅修改 Workflow 顶部 `MAX`/`FLASH` 常量与本文件，属治理变更，须 Max 执行。

## 权限规则

1. **Flash 无 PASS 权**：IMPLEMENTED ≠ PASS。Task PASS 唯一路径 = Machine Gate PASS（脚本按真实 exitCode 计算）+ Max Review PASS + Max Verify TASK_PASS。
2. **Machine Gate 裁判是脚本**，不是执行手：门禁 PASS/FAIL 由 Workflow 按 `commands[].exitCode` 计算，忽略执行手自报 `allPassed`。required command 非零退出必须 MACHINE_FAIL。
3. **exitCode 防虚报**：exitCode 为执行手转述（Workflow API 限制），Verify 阶段 Max 必须抽查重跑 1~2 条关键命令核实。
4. **Flash 禁区**：修改 TASK_SPEC/FIX_SPEC/验收标准/架构/安全规则/医疗边界/Workflow 本体/治理文件；扩大 Scope；删除/跳过/降低测试；宣布 PASS；调用其他 Agent 或模型。
5. **模型探针失败** → `BLOCKED_MODEL_UNAVAILABLE`，绝不自动换模型。
6. Max 作为只读决策者时（Classify/Explore/RCA/Review/Verify/Gate Verdict），禁止 Write/Edit/创建/删除任何文件（TASK_SPEC 落盘 `.qoder/workflow-state/<TASK_ID>.spec.json` 是唯一例外）。

## 修复循环

- Self-Repair（Flash，第 1 轮）→ Max RCA + FIX_SPEC → Flash 实施（第 2 轮起）→ 全任务合计最多 **3 轮**，超限 `BLOCKED_REPAIR_LIMIT`，交人工决定。
- Review REQUEST_CHANGES → Flash 只修 blockers → 重跑 Machine Gate → Max 重审，同样占用 3 轮预算。

## 恢复与取消语义

- resume（`resumeFromRunId`）：未变更的 agent 调用命中缓存，**不重复 IMPLEMENT**。
- cancel（TaskStop）：终止运行，**不启动新 Agent**，不修改任何文件。
- SPEC_CONFLICT：Flash 发现 TASK_SPEC 与真实代码冲突必须立即停止上报，由 Max/人工重新决策，Flash 无权改设计。

## 治理保护

- 治理文件（AGENTS.md、`.qoder/rules/**`、`.qoder/workflows/**`、`.qoder/workflow-state/**`、`.gitignore`、`.github/**`、`docs/workflow/**`）仅允许 Max 在治理阶段修改。
- dirty main guard：main/master + 非空 `git status --porcelain`（含未跟踪文件）→ `BLOCKED_DIRTY_MAIN`。

## D3 — FLASH_ONLY_DEGRADED_MODE（人工授权的降级模式，2026-10-07）

> 本节是对上方「永久禁止 fallback」政策的**受控例外**，由**人工明确授权**，不是自动降级、不是换模型蒙混。
> 触发条件：Max（`qmodel_38max`）配额不可用。恢复条件：Max 配额恢复后把 `EXECUTION_MODE` 改回 `'FULL'`（或调用传 `executionMode:'FULL'`）。
> **`FULL_MODE` 双模型政策始终为最终目标，完整保留。**

1. **运行时模型**：FLASH_ONLY 模式下**所有**运行时角色的模型恒为 `qfmodel`；**绝不**实际调用 `qmodel_38max` / 任何第三模型 / default / auto / fallback。路由由脚本顶部 `modelFor(role)` 决定，Preflight 的**路由守卫在任何 agent() 调用之前**拦截违规路由 → `MODEL_POLICY_VIOLATION`。
2. **角色独立性不降级**：FLASH_PLANNER / FLASH_EXPLORER / FLASH_WORKER / FLASH_REVIEWER / FLASH_VERIFIER / FLASH_RCA 必须是**相互独立的 agent() invocation**；**禁止**"同一 Flash 会话先写代码再自我验收"。独立性由调用隔离保证，而非模型差异。
3. **HIGH Risk 双独立审查**：命中 HIGH Risk（安全/认证/RBAC/IDOR/隐私/健康数据/语音数据/医疗安全/敏感迁移/发布配置）时，FLASH_REVIEWER A 与 FLASH_REVIEWER B 为**两个彼此不可见结论**的独立 invocation，**均 PASS** 才算独立 Review 通过。
4. **实施者无验收权**：FLASH_WORKER 自报 `IMPLEMENTED/PASS/DONE` **一律无最终验收权**。Task PASS 唯一判据（写入 `TASK_PASS_FORMULA`）：
   `MACHINE_GATE_PASS ∧ INDEPENDENT_FLASH_REVIEW_PASS ∧ FLASH_VERIFY_PASS ∧ TASK_DELTA_PASS ∧ GOVERNANCE_GUARD_PASS`（HIGH Risk 追加 A+B 双审均 PASS）。门禁 PASS/FAIL 仍由脚本按真实 `exitCode` 计算，忽略执行手自报 `allPassed`。
5. **D1/D2 保护不降级**：required/record 分层、双真相（GATE_HEALTH / PROJECT_BASELINE_HEALTH）、WORKTREE_BASELINE / Task Delta / 治理文件保护 / 破坏性 git 禁令 / 指纹校验全部保留。新增反作弊：禁止把 required 降级为 record（`GOVERNANCE_POLICY_VIOLATION`）、禁止对 `:5432` 执行破坏性操作（`BLOCKED_UNSAFE_DATABASE_TARGET`，不误伤一次性测试库 `:55432`）。
6. **修复循环 ≤3 轮**（与 FULL 相同）；第 2 轮起改由**新的独立 FLASH_RCA invocation** 出 ROOT_CAUSE/FIX_SPEC，非原 Worker 会话。
7. **HUMAN_REQUIRED 绝不自动批准**：验收本质需真实人工审批（医疗专家验证 / 患者数据授权 / 伦理 / 版权 / 生产密钥 / 生产库危险操作 / 正式生产部署 / 支付 / 真实验证码 / 法务）→ `PAUSED_FOR_HUMAN`，不实现代码、不改文件。
8. **Release 终态拆分**：`ENGINEERING_RELEASE_READY`（按门禁）与 `REAL_PRODUCTION_APPROVED`（**无真实人工批准恒为 NO**，绝不假装已获生产批准）。
9. **治理文件在本模式下的修改权**：治理文件仍仅 Max 在治理阶段可改；FLASH_ONLY 迁移期间对治理文件的改动必须由**人工授权**并单独说明（如本轮 D3 迁移）。
