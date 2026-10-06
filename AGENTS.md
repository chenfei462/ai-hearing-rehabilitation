# AGENTS.md — ai-hearing-rehabilitation 项目治理宪章

> 本文件是所有 AI Agent（含 Max/Flash、subagent、Workflow）在本仓库工作的最高约束。
> 与任何提示词冲突时，以本文件与 `.qoder/rules/**` 为准。
> 治理文件修改权限：仅 Max（qmodel_38max）在治理阶段可修改；Flash 绝对禁区。

## 1. 项目定位（不可逾越）

- 本项目是 **人工耳蜗术后听觉康复训练与健康教育辅助工具**，**不是医疗器械**。
- 禁止实现或输出任何会直接：诊断疾病、开处方、建议停药/改药量、替代医生判断、给出人工耳蜗 programming/调机参数、宣称训练必然产生临床疗效 的功能或文案。
- 禁止把工程指标（ASR 准确率、音素评分、≥80% 正确率阈值）表述为临床指标或医学规律。
- 详细边界见 `.qoder/rules/70-medical-safety.md`。

## 2. 模型分权政策（永久）

| 角色 | 模型 | 标识 | 职责 |
|---|---|---|---|
| 架构师/项目经理/验收官 | Qwen3.8-Max | `qmodel_38max` | 分析、架构、TASK_SPEC/FIX_SPEC、复杂根因、Review、Verify、Milestone/Release Gate 判定 |
| 程序员（实施者） | Qwen3.8-Flash | `qfmodel` | 实现、测试编写、简单修复、FIX_SPEC 实施、机械性命令执行 |

- Flash **无 PASS 权**。Task PASS 唯一路径：Machine Gate PASS（真实 exitCode）+ Max Review PASS + Max Verify PASS。
- 禁止 fallback 到其他模型；模型不可用时返回 `BLOCKED_MODEL_UNAVAILABLE`。
- 详见 `.qoder/rules/00-model-policy.md`。

## 3. 交付流水线契约

- 所有功能开发任务必须通过 `.qoder/workflows/project-feature-delivery.js`（task 模式）执行，一次一个原子任务（0.5~1.5 开发日）。
- Mega Task 会被拒绝（`NEEDS_DECOMPOSITION`），禁止边拆解边实施。
- 规划文件：`docs/workflow/PROJECT_PLAN.md`、`ARCHITECTURE.md`、`MILESTONES.md`、`TASK_CATALOG.md`、`QUALITY_GATES.md`、`RELEASE_CRITERIA.md`、`DECISIONS.md`。
- TASK_SPEC 落盘于 `.qoder/workflow-state/<TASK_ID>.spec.json`，进入 IMPLEMENT 后不可变；同名已存在时追加 git 短 SHA，禁止覆盖。
- 修复循环硬上限 3 轮，超限 `BLOCKED_REPAIR_LIMIT` 交人工。

## 4. 治理文件保护

以下文件为 Flash 与任何实施性 Agent 的**绝对禁区**（禁止创建/修改/删除）：

- `AGENTS.md`
- `.qoder/rules/**`
- `.qoder/workflows/**`
- `.qoder/workflow-state/**`（含 `*.spec.json` 任务合同）
- `.gitignore`、`.github/**`
- `docs/workflow/**`（规划治理文件）

Verify 阶段发现治理文件被实施任务改动 → 直接 TASK_FAIL。

## 5. Git 与操作安全

- 禁止：`git push`（含 force）、`git reset --hard`、`git clean`、`git checkout -- .`、`git restore .`、merge 到 main/master、发布 release、删除/覆盖用户已有修改。
- main/master 分支 + dirty working tree → `BLOCKED_DIRTY_MAIN`，不改任何文件。
- 禁止读取/输出真实 Secret；禁止提交生产密钥；禁止硬编码数据库密码；禁止对生产环境运行测试或执行删除。
- 破坏性操作（删表、删分支、覆盖数据）一律需人工确认，Agent 不得自行执行。

## 6. 架构纪律

- 技术栈冻结：React 18 + TypeScript + Vite + MUI + Tailwind（前端）；Python 3.11 + FastAPI + SQLAlchemy 2 + PostgreSQL 15 + Redis 7（后端）；阿里云百炼 Fun-ASR / Qwen TTS / 通义千问（AI）；知识库向量层 = **PostgreSQL + pgvector**（不引入 Milvus/Qdrant/Pinecone，除非 DECISIONS.md 新增 ADR）。
- 分层依赖方向：`api → services → models/ai`，禁止反向依赖；AI 调用统一走 `app/ai/*_gateway.py`，业务层禁止直连 dashscope。
- 未经 TASK_SPEC 明确批准，禁止：推倒重构、更换框架、新增独立微服务、大规模升级依赖、修改现有公开 API 契约、修改认证方式、修改用户数据模型。
- 优先复用既有实现（IRT 引擎、BKT 引擎、发音评分器、中间件、错误体系），先搜索后新建。
- 详见 `.qoder/rules/20-architecture.md`。

## 7. 知识与数据分级（强制隔离）

| 类别 | 内容 | 存储 | 隔离要求 |
|---|---|---|---|
| A | 医学教育知识库（公开资料） | pgvector 公共向量库 | 需专家审查通过（review_status=approved）才可被 RAG 检索 |
| B | 结构化训练内容（题库/音频） | item_bank 等业务表 | 与 A 分离存储，不走公共向量库 |
| C | 内部规则/Prompt/安全策略 | 代码与配置 | 不得进入任何可检索语料，不得输出给用户 |
| D | 用户个人数据（健康、语音、训练记录） | 业务表 + 隔离对象存储 | **绝对禁止进入公共向量库**；脱敏后方可用于分析 |

详见 `.qoder/rules/50-database.md`、`60-knowledge-base.md`。

## 8. 质量门禁（摘要）

- Task Gate = Machine Gate（真实命令 exitCode=0）+ Max Review（PASS）+ Max Verify（TASK_PASS）。
- Milestone Gate = 该里程碑全部依赖 Task PASS + 回归 + 集成测试证据。
- Release Gate = 后端全测、前端 production build/typecheck、clean migration up/down/up、集成、安全、性能、RAG/医学安全回归、Docker build、部署冒烟、回滚就绪，全部有当前有效证据方可 PROJECT_READY。
- 历史文档中的 `[x]` 不构成证据；一切以当前真实命令输出为准。
- 详见 `docs/workflow/QUALITY_GATES.md`、`RELEASE_CRITERIA.md`。

## 9. 真实命令基线（已核实存在于仓库）

| 域 | 命令 | 来源 |
|---|---|---|
| 后端测试 | `python -m pytest -q`（venv：`backend/.venv`） | pyproject `[tool.pytest.ini_options]`、docs/runbook.md |
| 后端 lint | `ruff check app/` | pyproject `[tool.ruff]`、.github/workflows/ci.yml |
| 前端类型 | `npx tsc --noEmit` | ci.yml |
| 前端 lint | `npm run lint` | package.json |
| 前端测试 | `npm test -- --run`（vitest） | package.json、ci.yml |
| 前端构建 | `npm run build`（tsc && vite build） | package.json |
| 前端 E2E | `npm run test:e2e`（playwright） | package.json、ci.yml |
| 迁移 | `alembic upgrade head` / `alembic downgrade` | backend/alembic/versions/001、002 |
| 容器 | `docker compose build` / `docker-compose up -d` | docker-compose.yml、backend/Dockerfile、frontend/Dockerfile |

禁止假设项目存在未核实的命令（如 mypy、独立 typecheck 脚本）；新命令须先写入配置再引用。

## 10. 上下文纪律

- 先 search/grep/glob 定位，再按需读取文件；禁止一上来把整个仓库读入上下文。
- 结论必须有证据（文件路径:行号、命令输出、exitCode）；禁止"基本通过/看起来可以/应该没问题"。
