# RELEASE_CRITERIA — 发布门禁清单

> v1.0（2026-10-06）。执行方式：`project-feature-delivery`（release_gate 模式）。
> 判定规则：**任何必须项缺少当前有效证据 → PROJECT_NOT_READY**；存在 blocking 安全发现 → PROJECT_NOT_READY。
> 历史 TODO `[x]`（含 TODO.md 中已勾选的 P0/P1 修复）不构成证据，必须重新验证。

## A. 功能与回归证据（必须）

| # | 项 | 命令/方式 | 通过标准 |
|---|---|---|---|
| A1 | 后端全量测试 | `python -m pytest -q`（backend venv） | exitCode=0，0 failed |
| A2 | 后端 lint | `ruff check app/` | exitCode=0 |
| A3 | 集成测试 | postgres+redis 环境 `pytest tests/test_integration.py tests/test_training_api.py tests/test_role_permissions.py -q` | exitCode=0 |
| A4 | 前端类型 | `npx tsc --noEmit` | exitCode=0 |
| A5 | 前端 lint | `npm run lint` | exitCode=0（--max-warnings 0） |
| A6 | 前端测试 | `npm test -- --run` | exitCode=0 |
| A7 | 前端构建 | `npm run build` | exitCode=0，产物生成 |
| A8 | 前端 E2E | `npm run test:e2e` | exitCode=0（chromium 冒烟） |

## B. 数据库（必须）

| # | 项 | 命令/方式 | 通过标准 |
|---|---|---|---|
| B1 | clean 迁移 | 全新库 `alembic upgrade head` | exitCode=0 |
| B2 | 回滚验证 | `alembic downgrade base` → `alembic upgrade head` | 两步 exitCode=0 |
| B3 | 种子幂等 | 种子脚本重复执行 | 无重复数据/报错 |
| B4 | 迁移链完整 | 全部版本文件 down_revision 链核对 | 无断链/分叉 |

## C. 安全（必须，Max 只读审查 + 测试证据）

| # | 项 | 通过标准 |
|---|---|---|
| C1 | 认证/授权 | 全端点 auth+归属校验矩阵测试通过；无 IDOR（安全专项测试绿） |
| C2 | Secret 管理 | .env 被 gitignore；仓库无硬编码密码/Key（扫描证据，不输出 Secret 值）；启动拒绝弱 SECRET_KEY |
| C3 | 生产配置 | DEBUG=False、CORS 白名单、COOKIE_SECURE、docs 关闭/受限、安全响应头 |
| C4 | 日志脱敏 | 手机号/验证码/token/语音 URL 脱敏测试与抽查证据 |
| C5 | 依赖漏洞 | pip-audit/npm audit 高危清零或 Max 批准豁免记录 |
| C6 | 限流 | 对话/发音/登录限流测试通过 |

## D. 医学安全与隐私（必须）

| # | 项 | 通过标准 |
|---|---|---|
| D1 | 医疗安全回归 | SAFE-007 评测集全过（诱导/绕过/注入/疗效诱导/调机索取） |
| D2 | 高危路由 | Emergency/转诊路径端到端测试通过；高风险 query 不进自由生成 |
| D3 | 输出拦截 | 流式缓冲拦截测试通过（先发后检路径不存在） |
| D4 | 数据隔离 | D 类数据不入向量库隔离回归绿；OSS 前缀隔离+越权访问拒绝测试 |
| D5 | 删除/导出 | 账号删除级联完整性测试；本人数据导出+归属校验测试 |
| D6 | Consent | 未同意时受限功能拒绝访问测试 |
| D7 | 免责与文案 | 产品入口/教育回答免责声明展示证据；无诊断/处方/调机/疗效保证文案（Max 审查） |

## E. 知识与 RAG（上线含教育问答则必须）

| # | 项 | 通过标准 |
|---|---|---|
| E1 | 检索过滤 | unapproved/expired/unlicensed exclusion 回归绿 |
| E2 | 引用真实性 | citation validation 测试（含编造引用用例）绿 |
| E3 | 拒答兜底 | 无依据问题明确拒答测试 |
| E4 | RAG 评测 | EVAL-005 报告落盘（引用真实率/拒答正确率量化） |
| E5 | 来源合规 | 全部入库内容 license/provenance 完整（抽查证据） |

## F. 性能与评测（必须）

| # | 项 | 通过标准 |
|---|---|---|
| F1 | 性能测试 | `pytest tests/test_performance.py -v` 绿；或 OPS-003 压测报告达标 |
| F2 | 延迟指标 | ASR 首包<500ms、对话<3s、评分<2s 有当前采样证据（mock 与真实分别标注） |
| F3 | ASR 评测 | EVAL-001 报告落盘；未达 85% 目标时须有人工接受的降级决策记录 |
| F4 | 并发 | 100 并发压测报告（OPS-003）或人工批准的豁免 |

## G. 部署与回滚（必须）

| # | 项 | 通过标准 |
|---|---|---|
| G1 | Docker build | `docker compose build` exitCode=0 |
| G2 | 部署配置 | docker-compose.yml、deploy/serverless.yml、nginx、环境变量引用完整性核对（零 Secret 输出） |
| G3 | 部署冒烟 | 本地/预发全栈起服务后四路径通过：/api/health/detailed、登录、训练开始、报告查询 |
| G4 | 回滚就绪 | 上一版本镜像存在；迁移向后兼容确认；runbook 回滚章节可执行；OPS-002 演练记录 |
| G5 | CI 绿 | 最近一次 CI 全 job 通过（推送/触发由人工执行，Agent 只读核验） |

## H. 流程完整性（必须）

| # | 项 | 通过标准 |
|---|---|---|
| H1 | 任务留痕 | 全部 P0 任务有 TASK_PASS spec/报告留痕；P1 完成或有人工豁免记录 |
| H2 | 里程碑 | 相关里程碑 MILESTONE_PASS 记录 |
| H3 | 无未闭环 blocker | 全仓库无 open blocker（Review/Verify/审计产出） |
| H4 | 治理文件完整 | AGENTS.md/rules/docs/workflow 未被实施任务篡改 |

## 判定输出

- `PROJECT_READY`：A–H 全部有当前有效证据。
- `PROJECT_NOT_READY`：任一缺口 → 输出 reasons + missingEvidence 清单；补齐后重跑 release_gate。
- 上线动作（push/部署/发布）本身**永远由人工执行**；Workflow 与 Agent 只产出证据与结论。
