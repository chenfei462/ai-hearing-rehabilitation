# M0-002 Backend Test Baseline（后端测试基线 · 只体检不治疗）

> Task: `m0-002-backend-test-baseline` · Type: baseline/audit · Mode: NO_BUSINESS_CODE_CHANGE
> 目标：用项目真实命令体系跑通并如实记录后端当前真实测试状态（不是把测试修绿）。
> 权威定义：`docs/workflow/TASK_CATALOG.md`。所有结论以本任务当前真实命令输出为准，历史 `[x]` 不构成证据。
> 执行时间：2026-10-07（本地）。执行手：qfmodel(Flash)。裁判：脚本按真实 exitCode 计算。

---

## 结论摘要（GATE_HEALTH 与 PROJECT_BASELINE_HEALTH 分离）

- **GATE_HEALTH（M0-002 任务自身）**：见文末 REQUIRED 门禁自检 —— 产物存在、Scope 合规、治理文件未改、HEAD/branch 未变、零业务代码改动、每条强制基线命令按安全策略真实执行或安全记录。
- **PROJECT_BASELINE_HEALTH（被测后端项目基线）**：**DEGRADED**（预期且合法）。
  - 1 个确定性失败（F-01 契约不一致）+ 1 个结构性偶发失败（F-13 未播种全局 RNG）+ full-repo ruff 291 errors。
- **重要语义声明**：本任务中 pytest/ruff 的非零退出码属于 RECORD 类基线发现，**不**导致 M0-002 IMPLEMENTATION FAILURE；REQUIRED 类（Scope/产物/治理/指纹/Secret）才决定本任务 PASS/FAIL。

---

## 1. Execution Environment

| 项 | 真实值（本任务实测） |
|---|---|
| 测试解释器 | `backend/venv312/Scripts/python.exe` → **Python 3.12.10** |
| pytest | **9.1.1** |
| ruff | **0.16.8**（`venv312/Scripts/ruff.exe`） |
| pytest 插件 | pytest-asyncio / pytest-timeout / pytest-cov / aiosqlite 均可 import（collect 成功） |
| 规则文档所称 `backend/.venv` | **不存在** → **F-03 CONFIRMED**（`docs/runbook.md:7` 引用失效） |
| `backend/venv/` | Python 3.14.5，无 pytest/ruff，**非测试环境**（本任务未使用） |
| DB backend（默认） | `sqlite+aiosqlite://` **内存库** + `StaticPool`（`tests/conftest.py:24`、`:60-65`），进程退出即销毁 |
| Redis | `_MemoryRedis` 全 mock，注入 `sys.modules["redis"]/["redis.asyncio"]`（`conftest.py:190`、`:221-230`、`:256`）；本机 6379 无监听 |
| 外部 AI（dashscope/TTS/ASR/LLM） | 全 mock（`conftest.py:236` autouse `mock_external_tts`；HTTP 走 ASGITransport 离线）；tests 目录 `grep dashscope` 零命中 |
| `backend/.env` | 存在，含 key：`SECRET_KEY`、`DATABASE_URL`、`REDIS_URL`、`DASHSCOPE_API_KEY`、`CORS_ORIGINS`、`ACCESS_TOKEN_EXPIRE_MINUTES`、`LOG_LEVEL`、`DEBUG`、`ENVIRONMENT`；**无 `TEST_DATABASE_URL`**（故测试不会引向 postgres）。仅列 key 名，**未读取、未输出任何值**。 |
| 版本漂移声明 | 本地 **Py3.12 / pytest 9.1.1** 与 CI **Py3.11 / pytest 8.x** 存在漂移，本基线为**本地口径**，与 CI 结果不完全等价。 |
| 工作目录 | 所有 pytest/ruff 命令在 `backend/` 下执行。 |

---

## 2. Test Inventory

命令：`venv312/Scripts/python.exe -m pytest --collect-only -q -p no:cacheprovider` → **232 tests collected，exit 0**（耗时 ~0.62s）。20 个测试文件 + `conftest.py`。

按域分类（def test_ 函数计数；collected 232 略高因 `parametrize` 展开）：

| 类别 | 文件 | def test 数 | 依赖真实服务 | 说明 |
|---|---|---|---|---|
| pronunciation | tests/test_pronunciation_service.py | 49 | 否（mock/离线） | DTW 音素对齐评分 |
| IRT | tests/test_irt_engine.py | 29 | 否 | 结构化题库选题 |
| BKT/adaptive | tests/test_adaptive_engine.py | 27 | 否 | 含 F-13 偶发用例 |
| report | tests/test_report.py | 19 | 否 | 报告聚合 |
| integration | tests/test_integration.py | 15 | 否（本地 sqlite 口径） | CI postgres job 同款清单成员 |
| training_service | tests/test_training_service.py | 13 | 否 | |
| auth_service | tests/test_auth_service.py | 12 | 否 | 短信码+JWT |
| training_api | tests/test_training_api.py | 9 | 否（sqlite） | postgres job 清单成员 |
| dialogue_service | tests/test_dialogue_service.py | 9 | 否 | |
| dialogue_api | tests/test_dialogue_api.py | 8 | 否 | |
| ai_gateways | tests/test_ai_gateways.py | 8 | 否（全 mock） | ASR/TTS/LLM 网关降级 |
| role_permissions | tests/test_role_permissions.py | 7 | 否（sqlite） | **RBAC/IDOR 回归基线** |
| performance | tests/test_performance.py | 7 | 否 | 阈值断言（工程指标） |
| health | tests/test_health.py | 4 | 否 | |
| errors | tests/test_errors.py | 3 | 否 | |
| middleware | tests/test_middleware.py | 3 | 否 | 含 F-01 失败用例 |
| models_and_schemas | tests/test_models_and_schemas.py | 3 | 否 | |
| config | tests/test_config.py | 2 | 否 | |
| security | tests/test_security.py | 2 | 否 | **安全回归输入** |
| safety | tests/test_safety.py | 1 | 否 | **医疗安全回归输入** |

Fixture/依赖要点：数据库经 `conftest` 建表（`Base.metadata`）于内存 sqlite；`client` 为 `AsyncClient`+ASGITransport；认证用直发 JWT token；Redis 与外部 AI 全 mock；无测试消耗真实 API 配额或出网。

---

## 3. Commands Executed

| # | 命令原文（在 backend/ 下） | kind | 真实 exitCode | 结果摘要 | 耗时 |
|---|---|---|---|---|---|
| C1 | `venv312/Scripts/python.exe --version` | (env) | 0 | Python 3.12.10 | - |
| C2 | `venv312/Scripts/ruff.exe --version` | (env) | 0 | ruff 0.16.8 | - |
| C3 | `python -m pytest --collect-only -q -p no:cacheprovider` | RECORD | 0 | 232 collected | 0.62s |
| C4 | `python -m pytest -q -p no:cacheprovider` | RECORD | **1** | **1 failed, 231 passed, 33 warnings** | 2.11s |
| C5 | `python -m pytest -q --cov=app --cov-report=term -p no:cacheprovider` | RECORD | **1** | 2 failed, 230 passed；TOTAL 61% | 4.15s |
| C6 | `ruff.exe check app/ --select E,F,W --ignore E501` | RECORD | 0 | All checks passed! | - |
| C7 | `ruff.exe check app/` | RECORD | **1** | 291 errors（199 fixable） | - |
| C8 | `python -m pytest tests/test_integration.py tests/test_training_api.py tests/test_role_permissions.py -q` | RECORD | 0 | 31 passed（sqlite 口径） | 1.04s |
| C9 | `python -m pytest tests/test_performance.py -v` | RECORD | 0 | 7 passed | 0.62s |
| C10 | `python -m pytest "…adaptive_engine.py::TestAdaptiveEngineIntegration::test_full_adaptive_session" -q` ×4 | RECORD(flaky) | 0,0,0,0 | 4 次全部 PASS | ~单次<1s |
| M-A | `alembic upgrade head → downgrade -1 → upgrade head` | SAFELY_NOT_EXECUTED_AND_RECORDED | — | **禁止执行**（5432 库身份不可证明安全） | — |
| M-B | `TEST_DATABASE_URL=postgresql+asyncpg://… pytest …`（postgres 集成） | SAFELY_NOT_EXECUTED_AND_RECORDED | — | **禁止执行**（缺安全一次性测试库） | — |

> 说明：C5 覆盖率 run 额外失败的 `test_full_adaptive_session` 见 §6。M-A/M-B 为授权的安全不执行记录（见 §11），非本任务实现失败。

---

## 4. Full Pytest Result（C4）

- Summary 行（原文）：**`1 failed, 231 passed, 33 warnings in 2.11s`**，exitCode = **1**。
- passed=231 / failed=1 / skipped=0 / xfailed=0 / xpassed=0。
- 唯一失败：`tests/test_middleware.py::test_metrics_endpoint_is_available` → `assert 401 == 200`（`tests/test_middleware.py:34`）。
- 33 warnings 主要为 `httpx` per-request cookies DeprecationWarning（dialogue_api/integration/training_api），非错误。
- 未删除/注释/skip/xfail 任何测试；未修改任何代码。

---

## 5. Deterministic Failures

| Finding | 用例 | 断言差异 | 根因（代码级证据，本任务新采集） |
|---|---|---|---|
| F-01 | `test_middleware.py::test_metrics_endpoint_is_available` | 测试期望 `200`，实际 `401`（`test_middleware.py:34`） | `app/api/metrics.py:14-15` `GET /api/metrics` 依赖 `Depends(get_current_user)`；测试（`test_middleware.py:31-34`）发**未认证** GET → 命中认证守卫返回 401。属**测试与被保护实现的契约不一致**（端点被有意加了认证/角色门槛，旧测试未同步）。非业务功能缺陷。 |
| 复现 | `cd backend && venv312/Scripts/python.exe -m pytest tests/test_middleware.py::test_metrics_endpoint_is_available -q` | exit 1 | |
| 处置 | 仅记录，不修复。修复（更新测试携带 therapist 认证，或明确端点契约）归后续正式 Task。 | | |

---

## 6. Flaky Tests

**用例**：`tests/test_adaptive_engine.py::TestAdaptiveEngineIntegration::test_full_adaptive_session` → 标记 **FLAKY（CONFIRMED）**。

采样协议合规：单测重跑合计 ≤5 次（首次全量 run + 4 次 targeted = 5），另 C5 覆盖率 run 为独立授权基线命令（非 flaky 采样计数）。

| 执行 | 场景 | 结果 |
|---|---|---|
| Sample-1 | C4 全量 pytest run | **PASS** |
| Sample-2..5 | C10 targeted 重跑 ×4 | **PASS, PASS, PASS, PASS** |
| （旁证） | C5 coverage run（同一 suite、同顺序） | **FAIL**（该用例） |

**结果分布**：5 次采样协议执行全 PASS，但独立覆盖率 run 中该用例 FAIL → 存在真实不确定性（约 1/6 观测失败率）。

**Nondeterminism 来源（代码级证据）**：
- `app/ai/adaptive_engine.py:16` `import random`；`:228` `return random.random() < p_correct` —— 使用**未播种的全局 RNG**。
- `tests/test_adaptive_engine.py:234-249` `test_full_adaptive_session`：20 轮循环（`:239-244`）累积 `total_reward`，`:249` `assert total_reward > 0`。
- `random` 模块在进程启动时以 OS 熵播种 → 每个 pytest 进程初始全局 RNG 状态不同；20 轮 `random.random()` 抽样序列不同，`is_correct` 组合随之变化，存在使 `total_reward <= 0` 的路径（答错惩罚）→ 偶发失败。
- 对比：同文件 `tests/test_adaptive_engine.py:276` 使用 `random.Random(1)`（**已播种局部实例**），故其余用例稳定；问题用例未采用该模式。
- 该用例与 `is_correct`/难度奖励耦合，慢机器/不同 run 触发概率不同，符合 F-13 结构性偶发描述。

**结论**：FLAKY。Candidate Fix（不执行）：为 `simulate_response`/`p_correct` 判定注入可播种 RNG（如 `random.Random(seed)` 参数或测试内 monkeypatch `random.seed`），与同文件 `Random(1)` 模式一致。修复归后续正式 Task。

---

## 7. Lint Baseline（双口径）

| 口径 | 命令 | exitCode | 结论 | 计数 |
|---|---|---|---|---|
| **CI_LINT_HEALTH** | `ruff.exe check app/ --select E,F,W --ignore E501`（ci.yml 窄口径） | **0** | **CLEAN** | All checks passed! |
| **FULL_REPO_LINT_HEALTH** | `ruff.exe check app/`（pyproject `[tool.ruff.lint]` select=E,F,W,I,N,UP,B / line-length 120 / ignore E501） | **1** | **DEGRADED** | **Found 291 errors，199 fixable**（+11 需 --unsafe-fixes） |

> 本任务未使用 `ruff --fix` / `ruff format`（改 backend/** 属 FORBIDDEN）。

---

## 8. CI-vs-Full-Lint Drift

**核心事实**：CI 窄口径（E,F,W）exit 0，full-repo（E,F,W,I,N,UP,B）291 errors。CI 的 select 是 full config 的**真子集**（`pyproject.toml:54-56` select=`["E","F","W","I","N","UP","B"]`, ignore=`["E501"]`；CI 仅跑 `--select E,F,W --ignore E501`）。

**291 条按规则族分布**：

| 族 | 计数 | 是否 CI 口径内 | 代表码 |
|---|---|---|---|
| UP（pyupgrade） | **155** | 否 | UP045=55, UP006=54, UP035=19, UP017=15, UP042=9, UP041=3 |
| B（bugbear） | **67** | 否 | B008=56, B904=9, B007=2 |
| I（isort） | **65** | 否 | I001=65 |
| N（pep8-naming） | **4** | 否 | N818=3, N806=1 |
| **E/F/W** | **0** | **是（CI 跑）** | —— CI 口径零错误 |

**Drift 解释**：**100% 的 291 错误来自 CI 未启用的规则族（I/N/UP/B），E/F/W 族零错误**，故 CI lint job 恒绿而 full-repo lint 恒红。
- UP006/UP045（109 条，占 37%）：`typing.List/Dict` → 内建 `list/dict`、`Optional[X]` → `X | None`（PEP 585/604 现代化），多为风格性、可 `--fix`。
- B008（56 条，19%）：默认参数内函数调用 —— 绝大多数是 FastAPI `Depends(...)` 惯用法，属**误报性**（业界常对 B008 加 per-file-ignores 或忽略）。
- I001（65 条）：import 排序，纯格式、可 `--fix`。
- B904（9 条）：except 内 `raise ... from`（错误链），小范围。

**风险**：本地开发者若以 CI 口径为准，会持续掩盖 291 条技术债；若以 full 口径为准则 pre-commit/本地 lint 噪声大。建议（仅建议，不执行）在后续治理 Task 明确统一 lint 口径：要么把 CI 对齐 full 并先清偿/豁免（含 B008 FastAPI 惯例豁免），要么在文档标注 full 为技术债清单来源。

---

## 9. Coverage Baseline

命令：`pytest -q --cov=app --cov-report=term -p no:cacheprovider`（**仅 term**，未生成 xml/html）。

- **TOTAL：3996 statements, 1549 missed, 61% 覆盖**。
- 该覆盖率 run 同时执行全量测试，结果 `2 failed, 230 passed in 4.15s`（额外失败为 §6 偶发用例）。

关键模块覆盖（Cover %）：

| 模块 | Cover | 备注 |
|---|---|---|
| `app/core/safety.py` | 100% | 医疗安全关键词模块 |
| `app/core/config.py` / `errors.py` / `security.py` | 100% / 95% / 89% | |
| `app/core/database_sync.py` | 0% | 未被测试路径触达 |
| `app/core/database.py` | 50% | |
| `app/services/auth_service.py` | 98% | |
| `app/services/irt_engine.py` / `pronunciation_scorer.py` / `adaptive_engine(ai)` | 94% | 核心算法覆盖良好 |
| `app/services/training_stats_service.py` / `report_service.py` / `scenario_service.py` | 96% / 100% / 100% | |
| `app/services/pronunciation_service.py` | 29% | **偏低**（重音频/网络路径 mock 下少执行） |
| `app/services/dialogue_service.py` / `dialogue_orchestrator.py` | 75% / 78% | |
| `app/api/health.py` / `deps.py` | 93% / 83% | |
| `app/api/auth.py` / `dialogue.py` / `report.py` / `training.py` | 71% / 73% / 71% / 66% | |
| `app/api/metrics.py` | 40% | F-01 端点测试即在此，覆盖但断言红 |
| `app/api/hardware.py` | 45% | ESP32 非 MVP |
| `app/ai/adaptive_engine.py` | 94% | 但含 §6 偶发用例 |
| `app/ai/asr_gateway.py` / `tts_gateway.py` / `llm_gateway.py` | 15% / 19% / 44% | **真实 SDK 路径被 mock/离线，覆盖低（预期）** |

> 覆盖率解读须谨慎：gateway 低覆盖源于外部 AI 全 mock（符合测试纪律，禁止打真实 dashscope），不代表质量缺陷；核心算法（IRT/BKT/评分器）覆盖高。当前**无强制覆盖率阈值**（阈值落地归 OPS/M0 治理），本任务仅记录基线数值。

---

## 10. Integration Test Status

命令：`pytest tests/test_integration.py tests/test_training_api.py tests/test_role_permissions.py -q -p no:cacheprovider` → **31 passed, 27 warnings in 1.04s，exit 0**。

- 该清单为 CI `backend-postgres-integration` job 同款文件集合，但本地以 `conftest` 默认 **sqlite+aiosqlite 内存库** 口径执行（真实 DB backend = **sqlite**，非 postgres）。
- 31 = integration 15 + training_api 9 + role_permissions 7。
- **重要区分**：本结果证明这 31 条在 **sqlite** 下通过，**不等价于** postgres 集成通过（postgres 专有行为如方言/约束/pgvector 未覆盖）。postgres 口径的正式验证归 **M0-005**（见 §11）。
- `test_role_permissions.py`（7 条）为 RBAC/IDOR 回归基线，全绿 → F-11 证据链一环。

---

## 11. PostgreSQL Test Status

**recordStatus = `SAFELY_NOT_EXECUTED_AND_RECORDED`（SAFE_POSTGRES_TEST_ENV_MISSING）**

| 项 | 状态 | 理由 |
|---|---|---|
| 迁移三连 `alembic upgrade head → downgrade -1 → upgrade head` | **未执行（安全）** | 命令真实存在于 `backend/alembic/versions/001_init_tables.py`→`002_seed_items.py`；唯一目标 `localhost:5432` 现**有 LISTENER**（见下），但库身份/内容**不可证明安全**（可能是用户 dev 库 `cochlear_rehab`）。`downgrade` 具破坏性 → 硬性禁止。正式验证归 **M0-004 / CT-5**。 |
| postgres 集成（`TEST_DATABASE_URL=postgresql+asyncpg://…`） | **未执行（安全）** | 缺可证明安全的一次性测试库；禁止连接身份未知的 5432 执行任何 DDL/DML/测试。归 **M0-005**。 |
| pgvector 相关 | N/A | 当前未安装 pgvector、无向量表。 |

**本任务对 5432 的实际操作**：**零**。`git status` 与 `test.db`（102400B / Sep 19）均未被改动，`backend/` 无新增 `.db`。所有单测跑在内存 sqlite，进程退出即销毁。

---

## 12. External Service Mocking

| 外部依赖 | Mock 方式（代码位置） | 是否出网 | 消耗真实配额 |
|---|---|---|---|
| PostgreSQL | `sqlite+aiosqlite://` 内存库 + StaticPool（`conftest.py:24`,`:60-65`） | 否 | 否 |
| Redis | `_MemoryRedis` 注入 `sys.modules["redis"]`/`["redis.asyncio"]`，替换 `get_redis`（`conftest.py:190`,`:221-230`,`:256`） | 否 | 否 |
| 短信验证码 | 经 mock Redis（内存 hash） | 否 | 否 |
| TTS（dashscope） | autouse `mock_external_tts`（`conftest.py:236`） | 否 | 否 |
| ASR / LLM | 经 `app/ai/*_gateway` 抽象，测试路径不实例化真实 SDK；`grep dashscope tests/` 零命中 | 否 | 否 |
| HTTP 端点 | `httpx.AsyncClient` + `ASGITransport`（进程内，离线） | 否 | 否 |

**结论**：测试矩阵满足"外部依赖全 mock"的测试纪律，无真实用户触达、无 API 配额消耗。

---

## 13. Confirmed M0-001 Findings（独立复核，不抄结论）

| Finding | M0-001 结论 | 本任务独立复核证据（本任务新采集） | 状态标签 |
|---|---|---|---|
| **F-01** | metrics 未认证 401 vs 测试断言 200 | 运行级：C4 `1 failed` 唯一失败即该用例，`assert 401 == 200`（`test_middleware.py:34`）；代码级：`app/api/metrics.py:14-15` `Depends(get_current_user)` + `:21` role 判定 | **CONFIRMED**（运行级复现） |
| **F-02** | full-repo ruff 291 vs CI clean | C7 exit 1 恰 **291 errors/199 fixable**；C6 CI 窄口径 exit 0；§8 分布证 100% 属 I/N/UP/B（CI 不跑） | **CONFIRMED**（运行级复现） |
| **F-08** | postgres 安全测试环境缺失（M0-001 记 5432 NO_LISTENER） | 本任务 `netstat` 实测 5432 **LISTENING**（PID 6892）→ 环境已变；库身份仍不可证明安全 → 迁移/集成记 SAFELY_NOT_EXECUTED。**结论方向仍成立，但底层事实变化**（见 §14 New Finding） | **CONFIRMED**（结论成立）+ **ENV_CHANGED** |
| **F-11** | integration/security/performance 证据链 | C8 31 passed（sqlite 集成）；test_security.py(2)+test_safety.py(1)+role_permissions(7) 随 C4 全绿；C9 7 passed（性能阈值）；本任务**首次以真实命令输出建立**该证据链（M0-001 时部分为静态推断） | **CONFIRMED**（证据链已建立，本地 sqlite/工程口径） |
| **F-13** | adaptive RNG 偶发 | C4 内 PASS、C5 内 FAIL、C10 ×4 PASS 的运行级不一致；`adaptive_engine.py:16/228` 未播种全局 RNG、`test:234-249` 断言 `total_reward>0`、`test:276` 对比局部播种 | **FLAKY**（CONFIRMED 结构性偶发） |

---

## 14. New Findings

| Finding ID | 标题 | 证据 | 状态 |
|---|---|---|---|
| **NB-01** | 5432 端口环境漂移（攻击面/破坏性风险） | `netstat -ano`：`TCP 0.0.0.0:5432 LISTENING 6892`、`TCP [::]:5432 LISTENING 6892`；M0-001 记录为 NO_LISTENER。监听者身份/所托管库未知（可能用户 dev 库 cochlear_rehab）。 | **New / ENV_CHANGED** |
| **NB-02** | `test_full_adaptive_session` 与 C5 覆盖率 instrumentation 交互下失败率非零 | 同 §6；即使同 suite 同顺序，进程 OS 熵播种差异导致结果不同。 | New（F-13 细化） |
| **NB-03** | httpx per-request cookies DeprecationWarning（33 warnings） | C4/C5/C8 warnings 段落，源自 `venv312/…/httpx/_client.py:1559`，测试以 `cookies=` 传认证 cookie。当前非错误。 | New / P2（前瞻，CI 升级 httpx 后或变红） |

---

## 15. Risk Classification（Finding Register）

八字段规范：Finding ID / Severity / Evidence / Command / Exit Code / Affected Area / Reproducibility / Suggested Follow-up。Severity 不夸大（既有测试失败不自动=P0）。

| ID | Severity | Evidence | Command | Exit | Affected Area | Reproducibility | Suggested Follow-up |
|---|---|---|---|---|---|---|---|
| F-01 | P2 | `assert 401==200` @ test_middleware.py:34；metrics.py:14-15 要求认证 | `pytest tests/test_middleware.py::test_metrics_endpoint_is_available -q` | 1 | api/metrics 契约 vs 测试 | 确定性（100%） | 更新测试携带 therapist 认证或明确端点契约（CT-*，非本任务） |
| F-13 | P1 | 覆盖率 run 该用例 FAIL、全量/targeted run PASS；adaptive_engine.py:16/228 未播种全局 RNG | `pytest "…test_full_adaptive_session" -q`（多次）+ C5 | 0/1 混合 | ai/adaptive_engine + 测试确定性 | 偶发（观测 ~1/6） | 注入可播种 RNG，对齐 test:276 模式（CT-*） |
| F-02 | P2 | full ruff 291 errors / CI 0 | `ruff check app/` | 1 | 全仓 lint 口径漂移 | 确定性 | 统一 CI/本地 lint 口径或清偿/豁免 B008 等（治理 Task） |
| NB-01 | P1 | netstat 5432 LISTENING PID 6892，身份未知 | `netstat -ano | grep 5432` | 0 | 数据库安全测试环境/攻击面 | 确定性（当前快照） | 建立一次性 postgres 测试库/容器（**M0-004 / M0-005**）；M0-006 记录暴露面 |
| COV-GAP | P2 | TOTAL 61%；pronunciation_service 29%；无阈值配置 | `pytest --cov=app --cov-report=term` | 1(因失败) | 覆盖率治理 | 确定性 | 设定并检查覆盖率阈值（OPS-001） |
| PERF | P2(观察) | 7 条阈值断言本机器全绿，慢机器可能波动 | `pytest tests/test_performance.py -v` | 0 | 性能基线（工程指标） | 机器敏感 | 建立稳定性能基线环境（**M0-007**） |

> 医疗安全相关：`test_safety.py`（1）、`app/core/safety.py`（100% 覆盖）随 C4 全绿；本任务未产生任何诊断/处方/调机/疗效保证类输出。性能阈值（health<50ms 等）**仅为工程指标**，非临床指标（AGENTS §1）。

---

## 16. Candidate Follow-up Tasks（只建议不执行）

优先引用 `docs/workflow/TASK_CATALOG.md` 既有正式 Task ID：

| 建议 | 归属 | 依据 |
|---|---|---|
| clean DB 迁移 upgrade→downgrade→re-upgrade 三连验证 | **M0-004**（迁移验证 / CT-5） | §11 安全不执行，需一次性安全测试库 |
| postgres 集成（CI 同款清单跑真 postgres） | **M0-005**（postgres 集成） | §10 仅 sqlite 口径通过，postgres 专有未验证 |
| 安全基线（认证/IDOR/RBAC + 医疗安全 + Secret 管理）扩展回归 | **M0-006**（安全基线） | §13 F-11 输入；role_permissions/security/safety 现状 |
| 性能基线（稳定环境下的 ASR/对话/评分延迟） | **M0-007**（性能基线） | §15 PERF 机器敏感 |
| 修复 F-01（metrics 端点测试契约）、F-13（adaptive RNG 播种）、291 lint（含 B008 豁免/口径统一） | CT-* / 对应正式 Task | §5/§6/§8，本任务 NO_BUSINESS_CODE_CHANGE，禁止顺手修 |
| 覆盖率阈值设定与检查 | OPS-001 | §9 无阈值 |
| 一次性 postgres 测试容器（化解 NB-01 环境漂移风险） | 环境/OPS 前置，服务 M0-004/005 | §14 NB-01 |

---

## 附：本任务 REQUIRED 门禁自检（供脚本/Max 核对）

- Scope：本任务唯一持久产物 = 本文件（`deliverables/baseline/BACKEND_TEST_BASELINE.md`）；无 tracked 文件改动；治理文件未触碰；HEAD=abc6a7859501be9b2887073f7a24b3174f503d87、branch=feature/m0-baseline 未变；pre-existing untracked `docs/qgraphflow/dialogue-turn-sequence/` 保持。
- 零业务代码改动（`git diff` 为空）。
- 零 Secret：全文仅出现 `.env` 的 **key 名**，无任何 value/token/连接串密码/`sk-` 片段。
- PostgreSQL 安全纪律：Commands Executed 无任何 alembic/psql/连 5432 执行记录。
- PROJECT_BASELINE_HEALTH = **DEGRADED**（预期）；GATE_HEALTH 由 REQUIRED 项决定。
