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
