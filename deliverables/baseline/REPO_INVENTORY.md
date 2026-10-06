# M0-001 仓库清单与真相基线（REPO_INVENTORY）

- 任务 ID：m0-001-repo-inventory
- 任务类型：NO_BUSINESS_CODE_CHANGE 纯只读审计（缺陷只记录不修复）
- Git 基线：branch=feature/m0-baseline，HEAD=d9b031056912c4ffb3ff0b7d4df2775ce8a97069（短 d9b0310）
- 生成时间：2026-10-07（本地）
- 工具链实测：node v24.15.0 / npm 11.12.1 / docker 29.5.2 / docker compose v5.1.4 / backend venv312 Python 3.12.10（pytest 9.1.1、ruff 0.16.8、alembic 1.13.1）
- 重要声明：本文档不含任何真实 Secret 值、完整手机号或生产数据库口令；涉及凭据处一律用占位符 `<口令>` / `<redacted>` 描述。历史文档中的 `[x]` 标记不作为通过证据，一切以本文件记录的当前真实命令 exitCode 为准。

---

## S1 仓库结构总览

顶层（`git ls-files` 视角 + 实测目录）：

- `backend/`：FastAPI 单体后端（Python 3.11 目标，实测运行环境为 venv312=3.12.10）。
- `frontend/`：React 18 + TS + Vite 前端。
- `deploy/`：`serverless.yml`、`nginx-production.conf`（阿里云 FC + OSS + Nginx）。
- `docker-compose.yml`：frontend/backend/db/redis 四服务。
- `.github/workflows/ci.yml`：CI/CD 主流水线（详见 S9）。
- `docs/`：文档集，含 `docs/workflow/`（治理规划）、`docs/runbook.md`、`docs/api-reference.md`、`docs/qgraphflow/dialogue-turn-sequence/`（PRE_EXISTING_UNTRACKED，禁止触碰）。
- `deliverables/`：历史产物目录（engineering-assurance/、gstack/、product-strategy/、security-audit-report.md 均被 `.gitignore:73` 忽略）；`deliverables/baseline/` 由 `.gitignore:74` 反忽略，为本任务正式基线产物目录。
- 根目录治理/规格文档：`AGENTS.md`、`README.md`、`TODO.md`、`PRD_技术规格.md`、`system_design.md`、`architecture-debt-assessment.md`、`code-review-report.md`、`功能规格书_v1.md`、`修复完成报告.md`、`overview.md`。
- 根目录遗留杂物（H6/F-10，只记录不清理）：`temp_fix.py`、`fix_syntax.py`、`update_todo.py`、`test_output.txt`、`test_output2.txt`、`nul`、`temp_script.py`、`dump.rdb`、`class-diagram.mermaid`、`sequence-diagram.mermaid`、`demo.html`、`stderr.txt`、`stdout.txt`、`spec_review.txt`、`code_quality_review.txt`、`final_summary.txt`、`task11_report.txt`、`todo.txt`、`opc-doc/`、`hardware/`。其中 `nul` 为 Windows 保留设备名（禁止删除），`nul`、`temp_script.py`、`*.rdb` 已被 `.gitignore` 覆盖。

## S2 后端模块清单

`backend/app/` 子包（实测目录）：

- `api/`（路由层）：`auth.py`、`deps.py`、`dialogue.py`、`hardware.py`、`health.py`、`metrics.py`、`pronunciation.py`、`report.py`、`training.py`。端点走统一响应 `{code,data,message}`（`app/schemas/response.py` success_response）。
- `services/`（业务层，11 个）：`auth_service.py`、`dialogue_service.py`、`dialogue_orchestrator.py`、`scenario_service.py`、`training_service.py`、`training_stats_service.py`、`pronunciation_service.py`、`pronunciation_scorer.py`、`irt_engine.py`、`patient_service.py`、`report_service.py`。
- `ai/`（网关 + 引擎）：`asr_base.py`/`asr_gateway.py`、`tts_base.py`/`tts_gateway.py`、`llm_base.py`/`llm_gateway.py`、`retry.py`、`adaptive_engine.py`（BKT）。（详见 S6）
- `models/`（SQLAlchemy 8 文件/9 表，详见 S4）。
- `schemas/`（Pydantic v2）：`auth.py`、`dialogue.py`、`pronunciation.py`、`report.py`、`common.py`、`response.py`。注意 `schemas/common.py` 与 `schemas/response.py` 双轨并存（ARCH-001 待统一）。
- `core/`（横切）：`config.py`、`database.py`、`database_sync.py`、`redis.py`、`errors.py`、`safety.py`、`security.py`。
- `middleware/`：`performance.py`、`monitoring.py`。
- `monitoring/`：`metrics.py`。
- `tasks/`（ARQ worker）：`worker.py`、`report_weekly.py`。
- `db/`：`init_db.py`（种子/初始化）。
- `utils/`：`logger.py`（loguru）、`date_utils.py`。
- `hardware/`（非 MVP 实验模块）：`manager.py`、`base.py`、`config.py`、`schemas.py`、`devices/esp32_station.py`。

配置关键事实（`core/config.py`）：APP_NAME=AI听觉康复助手，APP_VERSION=0.1.0，DEBUG 默认 False（line 37），SECRET_KEY 默认为空并配 `_INSECURE_SECRET_KEYS` 启动校验（line 17-24），DASHSCOPE_API_KEY 默认为空。`ACCESS_TOKEN_EXPIRE_HOURS` 见 S11-H2（=2）。DATABASE_URL/alembic 默认指向本地 dev 串（见 F-09）。

## S3 前端模块清单

`frontend/src/` 目录：`api/`、`assets/`、`components/`、`hooks/`、`pages/`、`services/`、`stores/`、`test/`、`theme/`、`types/`、`utils/`。

- `pages/`（9 页面）：`ConversationPage.tsx`、`DialoguePage.tsx`、`HomePage.tsx`、`LoginPage.tsx`、`NotFoundPage.tsx`、`PronunciationPage.tsx`、`ReportPage.tsx`、`SettingsPage.tsx`、`TrainingPage.tsx`（+ 6 个 `.test.*`，见 S7/H9）。
- `components/`：`charts/`、`common/`、`hardware/`、`layout/`。
- `stores/`（Zustand，实测 2 个业务 store）：`authStore.ts`（+ `authStore.test.ts`）、`a11yStore.ts`。注意：`40-frontend.md` 规则提及 `sessionStore` 与 deprecated `useAppStore.ts`，仓库中并不存在对应文件（见 F-06 附带观察）。
- `services/`：`api.ts`（统一 axios + `{code,data,message}` 解包 + 40101/401 处理）、`dialogueService.ts`、`hardwareService.ts`、`pronunciationService.ts`、`reportService.ts`、`trainingService.ts`。
- `hooks/`：`useRecorder.ts`、`useAudioPlayer.ts`、`useSpeechGuide.ts`、`useAccessibility.ts`、`useLocalStorage.ts`、`useHardware.ts`。
- 构建脚本（`package.json`）：`build`=tsc && vite build；`lint`=eslint --max-warnings 0；`test`=vitest run；`test:e2e`=playwright test。

## S4 数据库清单（models+迁移链）

- ORM 模型文件：`backend/app/models/{user,ability,training,item_bank,knowledge_state,dialogue,pronunciation}.py`。
- 表清单（`__tablename__`，9 张，与规则一致）：
  1. `users`（user.py）
  2. `user_abilities`（ability.py）
  3. `training_sessions`（training.py）
  4. `training_items`（training.py）
  5. `item_bank`（item_bank.py）
  6. `knowledge_states`（knowledge_state.py —— BKT 知识追踪状态，**非 RAG 知识库**，见 S11-H5）
  7. `dialogue_sessions`（dialogue.py）
  8. `dialogue_turns`（dialogue.py）
  9. `pronunciation_attempts`（pronunciation.py）
- Alembic 迁移链（`backend/alembic/versions/`）：仅 `001_init_tables.py` → `002_seed_items.py`。二者均实现 `upgrade()`（001:16 / 002:16）与 `downgrade()`（001:117 / 002:60）——代码级 downgrade 可用（历史 Task 4 修复保留）。
- 连接配置：`backend/alembic.ini:5` 与 `backend/app/core/config.py:41` 默认串指向本地 dev 库 `postgresql://<user>:<口令>@localhost:5432/cochlear_rehab`（内嵌默认凭据，见 F-09）。
- 向量/pgvector/知识库表：**当前无任何向量表、无 pgvector 扩展、无知识库 Schema**（见 H5）。本任务零 Schema 变更。

## S5 Redis 用途

- 客户端：`core/redis.py` 单例 `redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)` —— 符合“decode_responses=True、禁止 .decode()”规则（30-backend.md）。
- 实测用途（grep）：
  - 短信验证码：`services/auth_service.py:28/44/46` 键命名空间 `sms:{phone}`（set/get/delete）。
  - 对话上下文：`services/dialogue_service.py:314/347/367` 按 session 读取/删除上下文。
  - 登录限流/锁：`api/auth.py:30/40/41/43` `lock_key`/`key`（get/delete）。
- 用途限定符合 50-database.md（验证码/上下文/限流/队列），未见把 Redis 当持久主存储。CI 中 `REDIS_URL=redis://localhost:6379/1`。

## S6 AI 网关清单（ASR/TTS/LLM/Safety/Retry）

- ASR：`ai/asr_base.py`（抽象）+ `ai/asr_gateway.py`（dashscope Fun-ASR）。
- TTS：`ai/tts_base.py` + `ai/tts_gateway.py`（Qwen TTS）。
- LLM：`ai/llm_base.py` + `ai/llm_gateway.py`（通义千问）。
- 公共重试：`ai/retry.py` 提供 `retry_with_backoff`/`make_retry_wrapper`，`ai/__init__.py:25` 导出；被 `asr_gateway.py:19`、`llm_gateway.py:367`、`tts_gateway.py:231` 复用 —— ARCH-12 已落地（H4）。
- 安全匹配：`core/safety.py` 提供 `find_safety_keyword`/`contains_safety_keyword`（统一关键词匹配入口）；被 `dialogue_service.py:19`、`llm_gateway.py:26` 复用 —— ARCH-04 逻辑统一入口已存在（H3）。注意该模块集中“匹配逻辑”，关键词列表仍由各调用方传入（非集中词表），审计如实标注。
- 自适应：`ai/adaptive_engine.py`（BKT）。业务层未见直连 dashscope（统一走 gateway）。

## S7 测试清单

后端 `backend/tests/`（23 个文件，pytest asyncio_mode=auto）：
`conftest.py`、`__init__.py`、`test_adaptive_engine.py`、`test_ai_gateways.py`、`test_auth_service.py`、`test_config.py`、`test_dialogue_api.py`、`test_dialogue_service.py`、`test_errors.py`、`test_health.py`、`test_integration.py`、`test_irt_engine.py`、`test_middleware.py`、`test_models_and_schemas.py`、`test_performance.py`、`test_pronunciation.py`、`test_report.py`、`test_role_permissions.py`、`test_safety.py`、`test_security.py`、`test_training_api.py`。

- unit：services/ai/models/schemas/core/engines 等。
- integration：`test_integration.py` + `test_training_api.py` + `test_role_permissions.py`（CI postgres 专跑）。
- performance：`test_performance.py`（存在；未见阈值结论，见 UNVERIFIED）。
- security：`test_security.py`、`test_role_permissions.py`（角色/IDOR 回归基线）。
- safety：`test_safety.py`。

前端单测（vitest，实测 6 文件 / 10 用例）：
`src/utils/errors.test.ts`、`src/stores/authStore.test.ts`、`src/pages/HomePage.test.tsx`、`src/pages/LoginPage.test.tsx`、`src/pages/DialoguePage.test.tsx`、`src/pages/TrainingPage.test.tsx`。

前端 E2E（playwright）：`frontend/e2e/core-flow.spec.ts`（登录→开始音节训练冒烟，chromium，webServer=vite dev @4173；外部 API 以 `page.route` mock，无真实配额消耗）。

## S8 命令清单（含真实 exitCode）

> 门禁语义：AUDIT-EXEC-* / COND-EXEC-* 的判据是“真实执行 + 如实记录 exitCode”，或“NOT_EXECUTED + 真实原因”。其 exitCode 非零属基线红，不直接使 M0-001 FAIL，但必须生成对应 Finding（见 S12）。所有命令在 `backend/venv312`、`frontend/node_modules` 下执行。

| # | 命令（原文） | 域 | 状态 | exitCode | 结果摘要 |
|---|---|---|---|---|---|
| AUDIT-EXEC-1 | `cd backend && venv312\Scripts\python.exe -m pytest -q` | 后端单测 | EXECUTED | **1** | 稳定结论：1 failed / 231 passed / 33 warnings（Self-Repair 复跑同一 HEAD 复现同一结果）；确定性失败=`tests/test_middleware.py::test_metrics_endpoint_is_available`（断言 200，实得 401）→ F-01。另有一次采样报 2 failed，第二条为 `tests/test_adaptive_engine.py::TestAdaptiveEngineIntegration::test_full_adaptive_session`（assert -0.7506639538616398 > 0，total_reward）——经实测为**偶发（flaky）失败**：单跑 5 次 = 4 passed / 1 failed，非稳定基线 → F-13 |
| AUDIT-EXEC-2 | `cd backend && venv312\Scripts\python.exe -m ruff check app/` | 后端 lint（本地全量 E,F,W,I,N,UP,B） | EXECUTED | **1** | Found 291 errors（199 fixable）。分布：I001×65,B008×56,UP045×55,UP006×54,UP035×19,UP017×15,B904×9,UP042×9,N818×3,UP041×3,B007×2,N806×1 → F-02 |
| AUDIT-EXEC-3 | `cd backend && venv312\Scripts\python.exe -m ruff check app/ --select E,F,W --ignore E501` | 后端 lint（CI 窄口径） | EXECUTED | **0** | All checks passed（口径差异见 S10/S11）→ F-02 |
| AUDIT-EXEC-4 | `cd frontend && npx tsc --noEmit` | 前端 typecheck | EXECUTED | **0** | 无类型错误 |
| AUDIT-EXEC-5 | `cd frontend && npm run lint` | 前端 lint | EXECUTED | **0** | eslint --max-warnings 0 通过 |
| AUDIT-EXEC-6 | `cd frontend && npm test -- --run` | 前端单测（vitest） | EXECUTED | **0** | Test Files 6 passed (6) / Tests 10 passed (10) |
| AUDIT-EXEC-7 | `cd frontend && npm run build` | 前端构建 | EXECUTED | **0** | tsc && vite build 成功，产出 `frontend/dist/`（被 `.gitignore:9` 忽略） |
| COND-EXEC-8 | `cd backend && venv312\Scripts\python.exe -m pytest tests/test_integration.py tests/test_training_api.py tests/test_role_permissions.py -q` | 集成/API/角色 | EXECUTED | **0** | 31 passed / 27 warnings。本地 conftest 默认 `sqlite+aiosqlite://`（安全内存库，非生产）。CI postgres 专跑路径本地未覆盖 → F-12 |
| COND-EXEC-9 | `cd backend && venv312\Scripts\python.exe -m alembic upgrade head` → `downgrade -1` → `upgrade head` | 迁移链 | **NOT_EXECUTED** | n/a | BLOCKED_MISSING_SAFE_TEST_ENV：唯一目标 `localhost:5432`（port 实测 NO_LISTENER）非干净/临时库；downgrade 在未知库具破坏性，禁止打生产。代码级 upgrade()/downgrade() 已在 001/002 实现 → F-08 |
| COND-EXEC-10 | `docker compose build` | Docker 构建 | EXECUTED | **1** | compose v5.1.4 报 `project name must not be empty`；`docker-compose.yml` 无 `name:` 且保留 obsolete `version:'3.8'`。docker 29.5.2 daemon 可用（info exit 0）但构建未开始 → F-07 |
| COND-EXEC-11 | `cd frontend && npm run test:e2e` | E2E（playwright） | EXECUTED | **0** | 1 passed（`core-flow.spec.ts`，chromium，本地已装 chromium-1217/1228/1243） |
| CI 覆盖 | 见 S9：backend-test / backend-postgres-integration / frontend-test / docker-build / deploy | CI/CD | 说明 | — | CI 覆盖：后端 lint(窄)/单测(sqlite+coverage)、postgres 集成、前端 tsc/lint/vitest/build/e2e、docker 构建与 FC/OSS 部署（后两者仅 main） |

覆盖域数：后端单测、后端 lint（双口径=2）、前端 typecheck、前端单测、前端 lint、前端构建、迁移、集成、E2E、Docker、CI 覆盖 —— ≥8 域，满足 AC-02。

GATE-REQUIRED 门禁命令结果（详见任务收尾核对）：
| # | 命令 | 期望 | 实测 |
|---|---|---|---|
| GATE-REQUIRED-12 | `git status --porcelain` | 仅 `?? deliverables/baseline/` 与 `?? docs/qgraphflow/dialogue-turn-sequence/` | 另含 `?? .qoder/workflow-state/m0-001-repo-inventory.spec.json`（SPEC 落盘，Max 所建、治理保护区、Flash 禁止增删）——见“Scope 说明” |
| GATE-REQUIRED-13 | `git diff --stat` / `git diff --cached --stat` | 均空 | 均空（零 tracked 改动、零 staged） |
| GATE-REQUIRED-14 | `md5sum .../graph.json .../index.html` | 2fe742d810f7cd0ce2f5eb401f0050a0 / c1bb9c9b90d92db933577e4056e3ba91 | 两值精确匹配（未被改动/未被 add） |
| GATE-REQUIRED-15 | `test -s` + S1~S12 标题 | 存在非空且 12 标题齐 | 本文件满足 |
| GATE-REQUIRED-16 | `git rev-parse HEAD` / `git branch --show-current` | d9b0310.../feature/m0-baseline | 精确匹配（全程零 commit/零切分支） |

## S9 部署与 CI/CD 清单

- `docker-compose.yml`：frontend(3000:80, 依赖 backend healthy)、backend(8000:8000, env DATABASE_URL/REDIS_URL、healthcheck `/api/health`)、db(postgres:15-alpine + pg_isready healthcheck)、redis(redis:7-alpine + ping healthcheck)、volumes postgres_data/redis_data。含 `version:'3.8'`（obsolete）。引用 `.env` 与 `${POSTGRES_PASSWORD}`（值不读取）。
- `deploy/`：`serverless.yml`（阿里云 FC 后端部署）、`nginx-production.conf`（生产反代）。
- Dockerfile：`backend/Dockerfile`、`frontend/Dockerfile` 均存在。
- 健康端点：`/api/health`（基础，version+status）、`/api/health/detailed`（DB+Redis+Hardware 检查，degraded 返回 503）。
- CI `.github/workflows/ci.yml`：
  - 触发：`push` → branches `[main, develop]`；`pull_request` → branches `[main]`（H8 漂移源）。
  - `backend-test`：py3.11 + redis:7 service；lint `ruff check app/ --select E,F,W --ignore E501`（窄口径）；`pytest tests/ -v --cov=app --cov-report=xml`，env `DATABASE_URL/TEST_DATABASE_URL=sqlite+aiosqlite://`、`SECRET_KEY=ci-only-secret-key-...`（占位说明，非生产）。→ 上传 coverage。
  - `backend-postgres-integration`：postgres:16-alpine + redis:7；`DATABASE_URL=postgresql+asyncpg://...@localhost:5432/cochlear_rehab_test`；跑 test_integration/test_training_api/test_role_permissions。
  - `frontend-test`：node20；`npx tsc --noEmit`、`npm run lint`、`npm test -- --run`、`npm run build`、`playwright install --with-deps chromium`、`npm run test:e2e`；上传 `frontend/dist/`。
  - `docker-build`（仅 main push）：login Aliyun CR（凭据来自 GitHub Secrets）+ build/push backend/frontend。
  - `deploy`（仅 main push）：Serverless Devs 部署后端 + ossutil 上传前端到 OSS。
- Secret 处理：CI 通过 GitHub Secrets（ALIYUN_CR_*、ALIYUN_ACCESS_KEY_*）引用，未见明文写入 workflow；本地 `.env` 存在于根与 backend（值未读取）。

## S10 文档漂移清单

双侧证据（文档声明 vs 真实值/位置），且本任务未通过改动任何文档消除漂移：

1. 测试环境路径：`docs/runbook.md:3`（“执行 backend/.venv/Scripts/python -m pytest”，另 `AGENTS.md §9`、`30-backend.md` 同引 `.venv`）vs 真实——`backend/.venv` **不存在**；`backend/venv` 存在但缺 pytest/ruff；实际可用 `backend/venv312`（pytest 9.1.1/ruff 0.16.8/alembic 1.13.1）。
2. Token 有效期：`system_design.md:728` “token 有效期 7 天”（另 `code-review-report.md:366`、`deliverables/security-audit-report.md:364` F-014 沿用 7 天）vs 真实 `config.py:56 ACCESS_TOKEN_EXPIRE_HOURS = 2`（2 小时）。`docs/workflow/DECISIONS.md:72` 已承认“从 7 天改为 2 小时”。
3. 主分支命名：`10-project.md` 称主分支 `master` vs 真实 `ci.yml:5` 触发 `[main, develop]`、`:7` PR `[main]`。
4. 前端测试数量：`40-frontend.md` 称“现有 *.test.tsx 5 个”vs 实测 6 个 vitest 文件（AUDIT-EXEC-6 “Test Files 6 passed”）。附带：规则提及 `sessionStore`/deprecated `useAppStore.ts`，实测 `stores/` 仅 `a11yStore.ts`/`authStore.ts`。
5. 后端 lint 口径：本地全量 `E,F,W,I,N,UP,B`（exit 1，291 errors）vs CI 窄口径 `E,F,W --ignore E501`（exit 0，`ci.yml:41`）——CI 通过掩盖本地全量问题。
6. 迁移环境：`50-database.md`/规则称集成用 postgres vs 本地 `conftest.py:24` 默认 sqlite 回退；CI 另设 postgres 专 job。

## S11 HYPOTHESIS 验证分类

分类取值：VERIFIED_FACT / DOCUMENTED_CLAIM / STALE_DOCUMENTATION / UNVERIFIED。

- H1（TODO 集成/安全/性能未勾选）：**VERIFIED_FACT**。证据 `TODO.md:40 - [ ] 集成测试通过`、`:41 - [ ] 安全审查通过`、`:42 - [ ] 性能测试通过`（同文件其余 P0/P1 多为 `[x]`，但 `[x]` 非证据）。
- H2（token 7 天文档 vs config=2 小时）：**STALE_DOCUMENTATION**（文档侧 7 天，见 system_design.md:728）+ **VERIFIED_FACT**（代码侧 `config.py:56 ACCESS_TOKEN_EXPIRE_HOURS = 2`）。
- H3（安全护栏统一至 core/safety.py）：**VERIFIED_FACT**。证据 `app/core/safety.py` 存在并被 `dialogue_service.py:19`、`llm_gateway.py:26` 复用；`DECISIONS.md:72` 亦称 ARCH-04 疑似已修复。注：模块统一“匹配逻辑”，关键词列表由调用方传入。
- H4（公共重试 app/ai/retry.py）：**VERIFIED_FACT**。证据 `app/ai/retry.py` 存在，`ai/__init__.py:25` 导出，被 `asr_gateway.py:19`、`llm_gateway.py:367`、`tts_gateway.py:231` 复用。
- H5（知识库/RAG 零代码、无 pgvector、无向量表）：**VERIFIED_FACT**。精确 grep（pgvector/CREATE EXTENSION/Vector(/Embedding/text-embedding/vector_cosine）在 `app/` 无命中；唯一“knowledge”命中为 `models/knowledge_state.py`（BKT，非 RAG）。
- H6（根目录遗留物存在）：**VERIFIED_FACT**。根 `ls` 见 `temp_fix.py`、`fix_syntax.py`、`update_todo.py`、`test_output.txt`、`test_output2.txt`、`nul`、`temp_script.py`、`dump.rdb`。
- H7（backend/.venv 不存在 vs venv312 可用）：**VERIFIED_FACT**（漂移）。实测 `.venv` MISSING、`venv` 缺 pytest/ruff、`venv312` 三工具齐备；`runbook.md:3` 引用 `.venv`。
- H8（master vs main/develop）：**VERIFIED_FACT**（漂移）。`ci.yml:5/7` main/develop，vs `10-project.md` 称 master。
- H9（前端测试 5 vs 6）：**VERIFIED_FACT**（漂移）。`40-frontend.md` 称 5，实测 glob+vitest 均 6。
- 补充 UNVERIFIED：见下节。

## S12 FINDINGS 与 candidateFixTasks

严重级：BLOCKER / P0 / P1 / P2。所有 Finding 均为“只记录、未修复”。

| ID | Severity | Evidence（路径/命令+exitCode） | Affected Area | Suggested Follow-up Task |
|---|---|---|---|---|
| F-01 | P1 | AUDIT-EXEC-1 exit 1：`test_middleware.py::test_metrics_endpoint_is_available` 断言 200 实得 401；`api/metrics.py:15` 现要求 `get_current_user` | 后端测试基线 / 监控 API | 更新 metrics 鉴权测试或明确预期（M0-002 候选） |
| F-02 | P1 | AUDIT-EXEC-2 exit 1（291 errors）vs AUDIT-EXEC-3 exit 0；`ci.yml:41` 窄口径 | 后端代码风格 / CI 口径 | lint 清理 + CI 规则集是否纳入 I/UP/B（治理决策，Max） |
| F-03 | P2 | runbook.md:3/AGENTS §9/30-backend.md 引 `.venv` MISSING vs venv312 可用 | 文档 / DevOps | runbook/AGENTS 文档同步（治理阶段，Max） |
| F-04 | P2 | system_design.md:728 “7 天” vs config.py:56=2 小时（DECISIONS.md:72 已承认） | 文档 | 文档 token 口径同步（Max） |
| F-05 | P2 | 10-project.md “master” vs ci.yml:5/7 main/develop | 治理文档 / CI | 分支命名澄清（Max） |
| F-06 | P2 | 40-frontend.md “5 个” vs 实测 6 个；规则提及 sessionStore/useAppStore 不存在 | 文档 | 前端测试/stores 文档同步（Max） |
| F-07 | P2 | COND-EXEC-10 exit 1：“project name must not be empty”；compose 无 `name:` + obsolete `version:'3.8'` | 部署 / CI docker-build | 修 compose（加 name/去 version）+ docker 构建验证 |
| F-08 | P1 | COND-EXEC-9 NOT_EXECUTED（port 5432 NO_LISTENER）；001/002 downgrade() 代码存在 | 数据库迁移验证缺口 | 搭建一次性 postgres/临时库，验证 up→down→up（安全测试环境任务） |
| F-09 | P2 | config.py:41 与 alembic.ini:5 内嵌 localhost 默认 user/pass（非生产，占位描述） | 配置卫生 | 评估移除硬编码默认凭据（Max 决策，安全/配置治理） |
| F-10 | P2 | 根目录 temp_fix.py/fix_syntax.py/update_todo.py/test_output*.txt/nul/temp_script.py/dump.rdb（部分已 gitignore） | 仓库整洁 | 人工决定清理（Agent 禁删用户文件） |
| F-11 | P1 | TODO.md:40-42 三项未勾选；本地集成(sqlite)/e2e 虽通过但 postgres 集成/安全审查/性能证据链未建 | 质量门禁 | 后端测试基线（postgres 集成 + 安全 + 性能）——M0-002 |
| F-12 | P2 | ci.yml:46/49 backend-test 用 sqlite；仅 postgres-integration job 用 postgres；本地亦 sqlite | 测试环境一致性 | 本地提供 postgres 冒烟（M0-002） |
| F-13 | P1 | AUDIT-EXEC-1 偶发失败：`tests/test_adaptive_engine.py:234-249 test_full_adaptive_session` 以 20 轮 `simulate_response` 累积奖励后断言 `total_reward > 0`（`:249`），而被测实现使用**未播种全局 RNG**（`app/ai/adaptive_engine.py:16 import random`、`:228 return random.random() < p_correct`），答错惩罚为负（`:248 return -0.5 * (1.0 - difficulty)`）。实测单跑 5 次 = 4 passed / 1 failed（失败值 -0.7506639538616398）；同文件 `:276-279` 另一用例已改用 `random.Random(1)` 播种，本用例未跟进 | 后端测试稳定性 / 自适应引擎（BKT） | 为 `test_full_adaptive_session` 播种（monkeypatch/`random.Random`）或改为确定性属性断言；勿放宽断言强度（M0-002 候选，CT-9） |

candidateFixTasks（建议清单，只建议不执行）：
- CT-1 ← F-01：修正/明确 metrics 鉴权测试。
- CT-2 ← F-02：后端 ruff 全量清理并决定 CI 口径（I/UP/B 是否纳入）。
- CT-3 ← F-03/F-04/F-05/F-06：文档漂移批量同步（治理阶段，Max 专属）。
- CT-4 ← F-07：`docker-compose.yml` 增加 `name:`、移除 `version:`，验证 `docker compose build`。
- CT-5 ← F-08/F-12：搭建安全 postgres 测试库，完成迁移 up/down/up 与 postgres 集成回归。
- CT-6 ← F-11：安全审查 + 性能测试基线（对应 TODO 未勾三项）。
- CT-7 ← F-09：配置默认凭据治理评估。
- CT-8 ← F-10：根目录遗留物人工清理决议。
- CT-9 ← F-13：消除 `test_full_adaptive_session` 偶发失败（播种 RNG 或确定性断言，随 M0-002 后端测试基线一起做）。

---

## VERIFIED_FACTS（正向基线快照，供 M0-002/M0-003 回归对照）

- 后端单测 231/232 通过（确定性失败唯一为 F-01；F-13 为偶发失败，实测 4/5 通过，不构成稳定基线红）。
- 前端 tsc/lint/vitest（10 用例/6 文件）/build/e2e（1 通过）全绿。
- 集成/API/角色（sqlite）31 通过。
- `core/safety.py` + `ai/retry.py` 存在且被多点复用（ARCH-04/12 现状）。
- 无 RAG/pgvector/embedding 代码；9 张业务表；迁移链 001→002 且 downgrade 代码实现；Redis `decode_responses=True`；DEBUG 默认 False；SECRET_KEY 空默认 + 弱值启动校验。

## DOCUMENTATION_DRIFT（汇总，见 S10/S11/S12 交叉）

环境路径(.venv)、token(7天↔2h)、分支(master↔main/develop)、前端测试数(5↔6)、lint 口径(全量↔窄)、stores 命名。均未通过改动文档消除。

## P0/P1/P2 FINDINGS 汇总计数

- BLOCKER：0；P0：0；P1：5（F-01,F-02,F-08,F-11,F-13）；P2：8（F-03,F-04,F-05,F-06,F-07,F-09,F-10,F-12）。
- 基线大面积“红/缺口”属 M0 预期（MILESTONES.md），不构成 M0-001 FAIL；M0-001 FAIL 判据仅为其自身 AC 未完成。

## UNVERIFIED_ITEMS

- 历史 `[x]` 标记对应的修复是否真实达成（未逐条重跑历史验证）。
- 真实 dashscope/OSS/短信线上行为（本审计全 mock，未消耗配额）。
- postgres 路径下集成/迁移真实通过性（本地仅 sqlite）。
- 性能/并发指标是否达标（`test_performance.py` 存在但未评估阈值）。
- ARCH-04 词表是否已“集中”（safety.py 仅集中匹配逻辑，未集中关键词数据）。

## Scope 说明（PRE_EXISTING_UNTRACKED_STATUS）

- `docs/qgraphflow/dialogue-turn-sequence/`（graph.json md5=2fe742d810f7cd0ce2f5eb401f0050a0、index.html md5=c1bb9c9b90d92db933577e4056e3ba91）：任务前已存在，全程未 add/改/删，收尾核对指纹一致。保持原样，不判超 Scope。
- `.qoder/workflow-state/m0-001-repo-inventory.spec.json`：SPEC 落盘文件（Max 在规划阶段生成，属任务合同，治理保护区 Flash 绝对禁改/禁删）。它在 `git status` 中显示为额外 `??` 条目，非本实施任务（Flash）产物，请 Machine Gate/Verify 按“SPEC 落盘唯一例外”处理。
- M0-001 自身新增：`deliverables/baseline/REPO_INVENTORY.md`（本文件，唯一新增文件）。
- 全程零 git 写操作；HEAD/branch 不变；`git diff`/`git diff --cached` 为空。

## SUGGESTED_NEXT_TASK（只建议，不执行）

- 建议下一步：M0-002（后端测试基线，聚焦 CT-1/CT-5/CT-6：postgres 集成、安全审查、性能与 metrics 测试修正）。
- STOP_CONDITION：TASK_PASS 后立即停止，不自动开始 M0-002 或任何并行组。
