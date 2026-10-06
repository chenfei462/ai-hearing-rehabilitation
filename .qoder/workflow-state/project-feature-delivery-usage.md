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

## 安全守则（已内置于所有 Agent 提示词）

- 禁止 git push / force push / reset --hard / clean / checkout -- . / restore . / merge 到 main|master
- main/master + dirty → 直接 BLOCKED_DIRTY_MAIN，不改任何文件
- 禁止读取/输出真实 Secret；无安全测试环境 → BLOCKED_MISSING_SAFE_TEST_ENV
- 医疗安全、隐私数据隔离、架构纪律（禁止推倒重构/换栈/新增微服务等）逐条注入
- Flash 无权：改 SPEC、扩 scope、删/skip 测试、宣布 PASS、调用其他 Agent/模型

## 修改与校验

1. 编辑 `.qoder/workflows/project-feature-delivery.js`
2. 运行校验：
   ```bash
   node .qoder/workflow-state/dryrun-harness.mjs check          # 语法+静态
   node .qoder/workflow-state/dryrun-harness.mjs happy          # 干跑各场景
   ```
   场景：happy / mega / dirtymain / gatefail / gatealwaysfail / reviewfix / modeldown / notask / badmode / milestone / release

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

## 运行监控 / 暂停 / 恢复 / 取消

- 查看运行进度：会话内输入 `/workflows`
- Workflow 在后台运行，完成时自动通知
- 取消：`TaskStop`（传 Workflow 返回的 task id）
- 恢复/续跑：`Workflow({ name: "project-feature-delivery", resumeFromRunId: "<runId>" })`
  ——未变更的 agent 调用直接命中缓存，仅重跑改动之后部分
- 删除 Workflow：删除 `.qoder/workflows/project-feature-delivery.js` 即可
