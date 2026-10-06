# QUALITY_GATES — 质量门禁体系

> v1.0（2026-10-06）。与 `.qoder/rules/90-quality-gates.md`、`.qoder/rules/00-model-policy.md` 一致；
> 机制实现以 `.qoder/workflows/project-feature-delivery.js` 为准（本文件不得与 Workflow 本体冲突）。

## 1. Task Gate（每个原子任务，三关缺一不可）

### 1.1 Machine Gate（机器裁判）

- 执行手：Flash（机械执行命令）；裁判：Workflow 脚本按 `commands[].exitCode` 计算，**忽略执行手自报 allPassed**。
- 证据字段：command / purpose / exitCode / stdoutSummary / stderrSummary，全部真实；禁止虚报（Verify 阶段 Max 抽查重跑 1~2 条关键命令核实）。
- **required command 非零退出 → MACHINE_FAIL**，无条件进入修复循环。
- 必跑项按 Classify 结果计算：
  - backendTouched → 目标测试 + 相关区域测试 + `ruff check app/`
  - frontendTouched → `npx tsc --noEmit` + 相关 vitest + `npm run build`
  - schema/migration → clean `alembic upgrade head` → `downgrade` → `upgrade head`（不得只验 upgrade）
  - auth/security → 权限/IDOR/认证测试
  - knowledge/rag → retrieval、metadata filter（unapproved/expired exclusion）、citation、provenance、隔离测试
  - medicalSensitive → 医疗安全回归（SAFE-007 评测集就绪后为常跑项；未就绪时不得视为通过，记 skippedGates 并把补测试写入 Scope）
  - TASK_SPEC 的 MANDATORY_TESTS + REGRESSION_TESTS
- 项目不支持的门禁项 → skippedGates 写明原因，Max Verify 复核正当性。
- 无安全测试环境且无法 mock → `BLOCKED_MISSING_SAFE_TEST_ENV`（禁止打生产库）。

### 1.2 修复循环（≤3 轮硬上限）

1. 第 1 轮：Flash Self-Repair（只修失败项，禁扩 scope）。
2. 第 2 轮起：Max 只读 RCA → FIX_SPEC → Flash 实施。
3. 超限 → `BLOCKED_REPAIR_LIMIT`，人工决定（继续修复/缩小任务/回滚——回滚命令由人工执行）。

### 1.3 Max Review（独立审查）

- 禁止只看 Implementation Report；必须真实读取 TASK_SPEC、git diff、测试、Gate 结果。
- 逐条核对 ACCEPTANCE_CRITERIA（每条 met + evidence）。
- 审查维度（最少集）：Correctness / Scope Compliance / Regression Risk / Architecture Compliance / Database Safety / API Compatibility / Error Handling / Logging / Security / Privacy / Test Quality / Maintainability；按分类追加 Medical Safety / Citation-Provenance-Isolation / Privacy 专项。
- 结论仅 PASS / REQUEST_CHANGES；blocker 必附 BLOCKER_ID/LOCATION/EVIDENCE/IMPACT/REQUIRED_FIX/VERIFICATION_METHOD。
- REQUEST_CHANGES → Flash 只修 blockers → 重跑 Machine Gate → 重审（占用 3 轮预算）。

### 1.4 Max Verify（最终验收）

- 全部 AC 满足；Gate 全过且抽查重跑核实；blockers 关闭；diff 在 Scope 内（对照 IN_SCOPE/EXPECTED_FILES/FILES_FORBIDDEN_TO_CHANGE）；无意外文件（区分 Preflight 既有 dirty）；**治理文件被改动 → 直接 TASK_FAIL**；无明显回归风险；ROLLBACK_PLAN 成立。
- 结论仅 TASK_PASS / TASK_FAIL；产出 suggestedNextTask。

## 2. Milestone Gate

- 模式：`project-feature-delivery`（milestone_gate）。Flash 收集证据 → Max 只读复核并判定。
- 通过条件（全部满足）：
  1. 该里程碑全部 Task 有 TASK_PASS 留痕（Workflow 输出/spec 文件，非文档 `[x]`）；
  2. 依赖的外里程碑任务已 PASS；
  3. 里程碑级回归 + 相关集成测试当前真实通过（命令来自 M0-001 清单）；
  4. 架构一致性（依赖方向、无新增 God Module、AI 全走 gateway）；
  5. 迁移链干净（clean up/down/up）；
  6. 无未关闭 blocker；
  7. 知识/RAG 里程碑附加：retrieval、citation、provenance、data isolation 验证；
  8. 医疗安全里程碑附加：unsafe answer regression、high-risk routing、emergency escalation 验证。
- 每项 check 记录 name/performed/result/command/exitCode/evidence；缺证据 → missing_evidence → MILESTONE_BLOCKED。

## 3. Release Gate

见 `RELEASE_CRITERIA.md`（完整清单）；模式 release_gate：Flash 证据收集 + Max 安全审查 + Max 判定，仅 PROJECT_READY / PROJECT_NOT_READY。

## 4. 证据纪律（全门禁通用）

1. 历史文档 `[x]`、旧报告、"上次通过"一律不构成证据；只认当前真实 command/exitCode/stdout/stderr 与文件内容。
2. 禁止为过门禁：删除/注释/skip/xfail 测试、降低断言、修改指标定义、硬编码结果、绕过安全配置。
3. 判定语言禁止模糊："基本通过/看起来可以/应该没问题/建议以后优化"均为无效结论。
4. 门禁失败是信息不是灾难：如实记录 → RCA → 修复或人工决策；禁止掩盖。

## 5. 治理文件保护清单

AGENTS.md、`.qoder/rules/**`、`.qoder/workflows/**`、`.qoder/workflow-state/**`（含 *.spec.json）、`.gitignore`、`.github/**`、`docs/workflow/**`。
实施任务触碰 → Verify 直接 TASK_FAIL；仅 Max 治理阶段可修改。
