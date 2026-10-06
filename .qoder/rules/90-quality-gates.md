# 90 — 质量门禁规则

## Task Gate（每个原子任务）

PASS 必须同时满足，缺一不可：

1. **Machine Gate PASS**：脚本按真实 `commands[].exitCode` 计算；required command 非零 → MACHINE_FAIL，忽略执行手自报 allPassed。必跑项按任务分类计算（后端测试/lint、前端 typecheck/test/build、迁移 up/down/up、安全测试、知识库检索与隔离测试、医疗安全回归、TASK_SPEC 的 MANDATORY_TESTS 与 REGRESSION_TESTS）。
2. **Max Review PASS**：Max 真实读取 TASK_SPEC、git diff、测试与 Gate 结果，逐条核对 ACCEPTANCE_CRITERIA（每条 met + evidence）；只能 PASS / REQUEST_CHANGES，blocker 必附 BLOCKER_ID/LOCATION/EVIDENCE/IMPACT/REQUIRED_FIX/VERIFICATION_METHOD。
3. **Max Verify TASK_PASS**：验收标准全满足、Scope 未越界（对照 IN_SCOPE/EXPECTED_FILES/FILES_FORBIDDEN_TO_CHANGE）、抽查重跑 1~2 条关键命令核实 exitCode、治理文件未被改动、ROLLBACK_PLAN 成立。

- 修复循环 ≤3 轮；超限 BLOCKED_REPAIR_LIMIT 交人工。
- 无安全测试环境 → BLOCKED_MISSING_SAFE_TEST_ENV，禁止打生产。

## Milestone Gate（每个里程碑）

- 前置：该里程碑全部 Task 状态为 TASK_PASS（以 Workflow 输出/spec 留痕为准，不以文档 `[x]` 为准）。
- 证据（Flash 收集命令 + Max 复核判定）：里程碑级回归、相关集成测试、架构一致性、迁移链干净、无未关闭 blocker。
- 知识/RAG 里程碑附加：retrieval、citation、provenance、data isolation 验证。
- 医疗安全里程碑附加：unsafe answer regression、high-risk routing、emergency escalation 验证。
- 判定只有 MILESTONE_PASS / MILESTONE_BLOCKED；缺当前有效证据即 BLOCKED。

## Release Gate（发布）

必查证据清单（无证据 → PROJECT_NOT_READY）：

1. 后端全量测试通过
2. 前端 production build + typecheck 通过
3. clean DB 迁移 upgrade → downgrade → re-upgrade 通过
4. 集成测试通过
5. 安全审查（认证/IDOR/Secret 管理/CORS/日志脱敏/依赖漏洞）无 blocking finding
6. 性能测试证据（延迟指标：ASR 首包、对话响应、发音评分；并发目标）
7. RAG 回归（如适用）：检索过滤、引用真实性
8. 医学安全回归（如适用）：评测集全过
9. Docker build 成功；部署配置完整（deploy/、docker-compose.yml、环境变量引用，不输出 Secret 值）
10. 部署冒烟（health/detailed、登录、训练开始、报告查询四条路径，参照 docs/runbook.md）
11. 回滚就绪（上一版本镜像 + 迁移向后兼容 + runbook 回滚章节可执行）

详见 `docs/workflow/RELEASE_CRITERIA.md`。

## 证据纪律

- 一切判定基于当前真实 command/exitCode/stdout/stderr 与文件内容；历史报告、TODO `[x]`、"上次通过"均不构成证据。
- 每项 check 记录 name/performed/result/command/exitCode/evidence；无证据项显式标 missing_evidence，禁止沉默跳过。
- skippedGates 必须写明原因（项目不支持该命令等），Max Verify 复核其正当性。

## 治理文件门禁

- 实施任务改动治理文件（AGENTS.md、.qoder/rules/**、.qoder/workflows/**、.qoder/workflow-state/**、.gitignore、.github/**、docs/workflow/**）→ 直接 TASK_FAIL。
- 治理文件变更只能由 Max 在治理阶段进行，并单独提交说明。
