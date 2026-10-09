# INTEGRATION_BASELINE.md — M0-005 集成测试基线（重跑，FIX-GOV-001-R1 新门禁合同首跑）

- 任务：M0-005-integration-test-baseline（TASK_ID 逐字，与上一 run 身份一致；本 spec = M0-005-integration-test-baseline-d2d7ddb.spec.json）
- 日期：2026-10-10（本地测量执行日）
- 分支/HEAD：feature/m0-baseline @ d2d7ddb15b034a448209252589376276a90d1a7a（`git rev-parse HEAD` exitCode=0）
- 执行角色：FLASH_WORKER（qfmodel，实施者无验收权；IMPLEMENTED ≠ PASS）
- 本文档为本轮真实命令输出的 verbatim 留痕汇编，**非抄录上一 run/M0-002/M0-004 历史记录**；引用处均已显式标注"历史记录，非本轮证据"。
- 终态口径：本轮 Docker daemon 可用、postgres 一次性容器真实建立并真实执行三连——**非 BLOCKED_MISSING_SAFE_TEST_ENV 路径**，为 AC-01 的 EXECUTED_AND_RECORDED 形态。

---

## 1. 目的与测量口径声明（体检，不是治疗）

**体检，不是治疗。** 本任务只做一件事：在本任务自建的一次性隔离 PostgreSQL 容器（postgres:16-alpine，`127.0.0.1:55433`，库 `cochlear_rehab_test`，CI 公开凭据）+ 名义 Redis 容器（redis:7-alpine，`127.0.0.1:26379`）上，以 CI `ci.yml:97-103` 同款命令与 env 变量名真实执行集成三连（`tests/test_integration.py` + `tests/test_training_api.py` + `tests/test_role_permissions.py`），如实记录 postgres 口径与 sqlite 口径双真相；就 `TODO.md:40-42` 三条未勾选项基于本轮证据给出当前结论。本任务零代码/测试/配置改动，发现的任何问题一律列为 Finding + FIX-* 建议，由 M1 后续任务清偿；红项不触发本任务修复循环（任务原文冻结语义）。

**重跑背景（非质量问题）**：上一 run（wf_bd5d9d4f-2c7）Machine Gate BLOCK 的根因是治理缺陷 F-20（反降级守卫字符串双向子串比对与 kind=record 结构性互斥），已由人工授权（HD-N-01 amendmentR1）的 FIX-GOV-001-R1 修复并封存于 d2d7ddb。本 run = 该修复后首次真实执行。

**D1 双真相口径**：
- GATE_HEALTH 只评取证完整性与 required 行为项（环境建立/清理/交付物/工作区完整性），由 Workflow 按真实 exitCode 计算。
- PROJECT_BASELINE_HEALTH 按 record 实测红项独立判定；二者禁止互推。
- 本 run record 红项存在（postgres 三连红、全量 pytest 既有红、ruff 存量债、新见 flaky 红）→ 机器证据块置 **DEGRADED**。

**FIX-GOV-001-R1 门禁合同语义（SPEC 冻结）**：G-INT-PG-RUN kind=record——三连是本任务**测量对象**而非本任务产出的目标测试（零代码改动任务），"实际执行并取真实 exitCode"的 required 强制力由 G-REPORT-INT-EVIDENCE（本文 §12 机器证据块，标记值与 gate 提交 exitCode 逐字核对）+ I2 不可省略规则承担。record ≠ 可省略、≠ 可虚报；本轮已真实执行（§3/§4）。

**"CI 同款"的定义**：命令（`pytest tests/test_integration.py tests/test_training_api.py tests/test_role_permissions.py -q --tb=short`）、env 变量名（DATABASE_URL / TEST_DATABASE_URL / REDIS_URL / SECRET_KEY 四个全部显式覆盖，`ci.yml:97-101`）、镜像与库名（postgres:16-alpine + cochlear_rehab_test，`ci.yml:64-68`）、无 alembic 步骤（CI postgres job 同样依赖 conftest `Base.metadata.create_all`）。本机与 CI 的已知差异见 §2.2，**本文档任何结论均不表述为"等同 CI 通过/失败"，只表述为"本机 CI 同款命令口径"**。

---

## 2. 环境口径与任务文本纠正声明

### 2.1 本轮真实运行环境（取证命令留痕，全部 exitCode=0）

| 项 | 本轮实测值 | 取证命令（cwd=仓库根） |
|---|---|---|
| Python | `Python 3.12.10` | `backend/venv312/Scripts/python.exe --version` |
| pytest | `9.1.1` | `python -m pip list`（venv312） |
| pytest-asyncio | `1.4.0` | 同上 |
| asyncpg | `0.29.0` | 同上 |
| SQLAlchemy | `2.0.29` | 同上 |
| fastapi | `0.110.0` | 同上 |
| ruff | `0.16.8`（经 `python -m ruff` 调用） | 同上 |
| Docker 引擎 | Docker Desktop，Server 29.5.2，OS `Docker Desktop`，16 CPUs，11.34GiB，Containers 5（Running 4） | `docker info`（G-ENV-DOCKER，exitCode=0） |
| postgres 镜像 | `postgres:16-alpine`，digest `sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea`，image ID `721873c34ceb`，420MB | `docker pull postgres:16-alpine`（G-IMG-PULL，exitCode=0，输出含 Digest 行） |
| redis 镜像 | `redis:7-alpine`，digest `sha256:6ab0b6e7381779332f97b8ca76193e45b0756f38d4c0dcda72dbb3c32061ab99`，57.8MB（本地缓存命中） | `docker images --digests`（辅助留痕） |

### 2.2 与 CI 的已知差异（禁止外推为"等同 CI"）

| 维度 | CI（ci.yml） | 本轮本机 | 影响 |
|---|---|---|---|
| Python | 3.11（ci.yml:88） | 3.12.10（venv312） | warnings/内部行为可能有非实质漂移 |
| 依赖安装 | `pip install -e ".[dev,oss]"`，dev 依赖不锁版本（pyproject：`pytest>=8.0`、`pytest-asyncio>=0.23.5`） | pytest 9.1.1 / pytest-asyncio 1.4.0 | pytest-asyncio 未锁定 → CI 各次解析版本可能不同；本轮 postgres 红项（§7 F-M0005-02）与该版本形态直接相关，不能据此断言 CI 必红或必绿 |
| DB 宿主 | GitHub Actions 服务容器（runner 内 5432 映射，ci.yml 原文 env 值指向 runner 本地端口，本文按禁区自检规则以 `@<ci-runner>` 掩码表述） | 本机一次性容器 `127.0.0.1:55433` | 端口不同为宿主隔离所需；镜像/库名/命令一致 |
| SECRET_KEY | `ci-only-secret-key-with-at-least-32-characters`（ci.yml:99，公开 CI 值） | 同值 | 一致（非真实 Secret） |

### 2.3 SPEC 撰写时点 ↔ 执行时点的环境漂移（如实记录）

| SPEC 撰写时点事实 | 本轮执行时点实测 | 处置 |
|---|---|---|
| Docker daemon 不可用（docker info exit 1，Docker Desktop 未运行） | **daemon 可用**（G-ENV-DOCKER exitCode=0；docker ps 显示他任务容器"Up 3 minutes"，推测 Docker Desktop 在本 run 前刚启动） | 走 postgres 真实执行路径（非 BLOCKED 路径）；漂移本身记 §7 F-M0005-07（P2 观察） |
| docker.io 直连不可达需加速源（上一 run F-M0005-06） | 本轮 `docker pull postgres:16-alpine` 直连成功（"Image is up to date"，digest 与上一 run 经 docker.m.daocloud.io 拉取者逐字一致 → 镜像内容一致） | F-M0005-06 本轮**未复现**，渠道偏差消除；digest 留痕 §2.1 |
| :55432 被 aiear-m0004-pg-test（Up 23h/随后）占用 | `aiear-m0004-pg-test` 状态 `Exited (255) 3 minutes ago`（daemon 重启所致），:55432 无监听 | 该容器属 M0-004 遗留禁区，本任务未触碰、未重启（前后 docker ps 状态一致，§10） |
| 冻结端口 :55433/:26379 空闲 | 实测仍空闲（G-ENV-PORTS exitCode=0 输出无二者 LISTENING 行） | 按冻结命令原样使用，未换端口 |

### 2.4 任务文本口径纠正复核（与 SPEC 一致）

| 任务原文 | 实测事实（本轮复核） | 处置 |
|---|---|---|
| `backend/.venv` | 不存在；真实解释器为 `backend/venv312`（Python 3.12.10） | 全部命令按 SPEC 使用 venv312（冻结命令已内置） |
| alembic 迁移 | 不需要：conftest 用 `Base.metadata.create_all` 自建 schema 并自播 2 条 ItemBank 种子；CI postgres job 亦无 alembic 步骤 | **未执行任何 alembic**（alembic.ini:5 默认 URL 指向宿主 :5432 禁区且 F-15 已证 head 不可达，严禁裸跑） |
| Redis | conftest.py:215-257 `sys.modules` 注入 `_MemoryRedis` + `app.core.redis.get_redis/redis_client` 替换 + autouse `mock_external_tts` → 三连全程离线 | Redis 容器为 CI 契约保真的名义存在（§3.5 以 DBSIZE=0 程序化证明未使用） |

---

## 3. 环境建立与清理全程留痕（16 条门禁逐条 + 辅助操作）

> 凭据口径：一次性容器使用 **ci.yml:66-68 公开值 `postgres`/`postgres`** 与 ci.yml:99 公开 SECRET_KEY——均为 GitHub 仓库内公开的 CI 专用值，**非真实 Secret**（AC-06 允许 verbatim 留痕并如此标注）。所有端口绑定显式 `127.0.0.1`（最小暴露）。辅助操作（启动探测、ps 对比、inspect、psql/redis-cli 取证）只写入本节正文，未混入 Machine Gate commands[]。

### 3.1 G-ENV-PORTS（record）— exitCode=0

```
$ netstat -ano | grep -E ":(5432|15432|16379|26379|55432|55433)[[:space:]]" || true
TCP 0.0.0.0:5432   LISTENING 6740        ← 宿主 UNKNOWN_DATABASE_INSTANCE 绝对禁区（PID 6740，与 SPEC 撰写时点一致）
TCP 0.0.0.0:15432  LISTENING 35396       ← dresslens-postgres（他项目）
TCP 0.0.0.0:16379  LISTENING 35396       ← dresslens-redis（他项目）
TCP [::]:5432/:15432/:16379、[::1]:15432/:16379（IPv6 形态同 PID 6740/35396/35556）
```
:26379/:55432/:55433 无 LISTENING 行 → 冻结端口 :55433/:26379 空闲；:55432 因 aiear-m0004 容器 Exited 而无监听（禁区端口仅记录事实，零接触）。

### 3.2 G-ENV-DOCKER（record）— exitCode=0

```
$ docker info
Server Version: 29.5.2 / Operating System: Docker Desktop / CPUs: 16 / Total Memory: 11.34GiB / Containers: 5 (Running: 4)
```
daemon 可用（SPEC 撰写时点不可用 → 本轮已变化，§2.3）。辅助留痕：本 run 未需要启动 Docker Desktop（执行时点 daemon 已运行）。

### 3.3 G-IMG-PULL（record）— exitCode=0

```
$ docker pull postgres:16-alpine || (docker pull docker.m.daocloud.io/library/postgres:16-alpine && docker tag docker.m.daocloud.io/library/postgres:16-alpine postgres:16-alpine)
16-alpine: Pulling from library/postgres
Digest: sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea
Status: Image is up to date for postgres:16-alpine
docker.io/library/postgres:16-alpine
```
**pull 渠道 = docker.io 直连**（回退链未触发）。digest 与上一 run 经 docker.m.daocloud.io 加速源拉取者逐字相同 → 同一 `library/postgres:16-alpine` 内容，CI 同款镜像确认；未使用任何 `pgvector/pgvector:pg16` 等替代镜像。

### 3.4 G-ENV-PG-RUN（required）— exitCode=0

```
$ docker run -d --name aiear-m0005-pg-test -e POSTGRES_DB=cochlear_rehab_test -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 127.0.0.1:55433:5432 postgres:16-alpine
cdfd90ef567a9b53d32914b13af92249c752dfaad661b6ee0d6afaa58f0372fb
```
辅助取证：`docker port aiear-m0005-pg-test` → `5432/tcp -> 127.0.0.1:55433`（绑定地址合规）；`docker inspect --format {{.Config.Image}}` → `postgres:16-alpine`。凭据为 CI 公开值（§3 前言）。

### 3.5 G-ENV-PG-READY（required）— exitCode=0

```
$ sh -c 'for i in $(seq 1 30); do docker exec aiear-m0005-pg-test pg_isready -U postgres -d cochlear_rehab_test && exit 0; sleep 2; done; exit 1'
/var/run/postgresql:5432 - accepting connections
```
第 1 次探测即就绪。说明：`/var/run/postgresql:5432` 是**容器内部** unix 路径监听提示，宿主映射为 `127.0.0.1:55433`；本任务全程未连接宿主 :5432。留痕诚实注记：本命令首次经 harness 执行时因**执行工具层对单引号命令追加输出重定向的转义缺陷**出现一次 exitCode=127（非环境失败、非容器未就绪；`sh -c 'for …'` 形态经最小复现验证本身正常），随后以逐字命令原样执行成功如上——冻结命令未改写、未换语义。

### 3.6 G-ENV-REDIS-RUN（record）— exitCode=0

```
$ docker run -d --name aiear-m0005-redis -p 127.0.0.1:26379:6379 redis:7-alpine
6c798d5b5cf5697e90a4111f57889d97bba9545b4a389da559ec1afef0724048
```
**名义性声明（AC-07）**：三连实际经 `conftest.py:215-257` 注入 `_MemoryRedis`（sys.modules 替换 + `app.core.redis` 直接替换），**从不连接真实 Redis**。辅助取证（清理前）：`docker exec aiear-m0005-redis redis-cli PING` → `PONG`；`redis-cli DBSIZE` → `0`——容器全程零键写入，程序化证明测试未使用它；与 CI redis 服务容器（ci.yml:77-80）的名义性同构。

### 3.7 G-INT-PG-RUN（record）— exitCode=1（详见 §4）

verbatim 见 §4；`recordStatus=EXECUTED_AND_RECORDED`。

### 3.8 G-INT-SQLITE-RUN（record）— exitCode=0（详见 §5）

### 3.9 G-BASE-PYTEST（record）— exitCode=1（详见 §9.1）

### 3.10 G-BASE-RUFF（record）— exitCode=1（详见 §9.2）

### 3.11 容器内 schema 与数据取证（辅助，清理前执行，全部 exitCode=0）

```
$ docker exec aiear-m0005-pg-test psql -U postgres -d cochlear_rehab_test -tAc "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1"
dialogue_sessions / dialogue_turns / item_bank / knowledge_states / pronunciation_attempts /
training_items / training_sessions / user_abilities / users   （共 9 表，conftest create_all 自建）

$ … -tAc "SELECT count(*) FROM users"   → 0
$ … -tAc "SELECT count(*) FROM item_bank" → 2   （conftest 自播 2 条 ItemBank 种子）
```
解读：证明测试进程确实连上本任务一次性容器（四个 env 显式覆盖生效，未回落 config.py:41 默认值）；`users=0` + 种子 2 条 → **无任何真实用户数据（D 类零接触）**。

### 3.12 G-ENV-CLEANUP（record）— exitCode=0

```
$ docker rm -f aiear-m0005-pg-test aiear-m0005-redis
aiear-m0005-pg-test
aiear-m0005-redis
```
清理边界严格限 `aiear-m0005-*` 前缀自建容器；未对任何其他容器/镜像/卷/网络执行任何操作。

### 3.13 G-ENV-NO-RESIDUE（required）— exitCode=0

```
$ test -z "$(docker ps -aq --filter name=aiear-m0005-)"
（无输出，exitCode=0 —— 无任何 aiear-m0005-* 残留，含 exited 状态）
```

### 3.14 G-REPORT-EXISTS-SECTIONS / G-REPORT-INT-EVIDENCE / G-REPORT-NO-5432-URL / G-WORKTREE-PROTECTED（required）

以上 4 条作用于本交付文档与工作区，在文档写就后由 Machine Gate 按冻结命令逐字执行裁决（逐条命令见 SPEC MACHINE_GATE_COMMANDS）；本文档 §12 机器证据块为其核对对象。

---

## 4. postgres 口径三连结果（本任务核心测量对象，本轮真实执行）

**verbatim command**（凭据段为 ci.yml:66-68 **公开值**，非真实 Secret；四个 env 全部显式覆盖，变量名与 ci.yml:97-101 一致）：

```
cd backend
DATABASE_URL='postgresql+asyncpg://postgres:postgres@127.0.0.1:55433/cochlear_rehab_test' TEST_DATABASE_URL='postgresql+asyncpg://postgres:postgres@127.0.0.1:55433/cochlear_rehab_test' REDIS_URL='redis://127.0.0.1:26379/1' SECRET_KEY='ci-only-secret-key-with-at-least-32-characters' venv312/Scripts/python.exe -m pytest tests/test_integration.py tests/test_training_api.py tests/test_role_permissions.py -q --tb=short -p no:cacheprovider
```

- cwd：仓库根下 `backend/`
- **exitCode = 1**
- **pytest summary 行（原文）**：`4 failed, 8 passed, 20 errors in 17.34s`
- 耗时：17.34s；skipped：0
- collected：**31**（本轮独立取证 `--collect-only -q` → `31 tests collected in 0.10s`，exitCode=0，辅助留痕）
- **计数自洽性说明**：4+8+20=32 ≠ 31，因 `role_permissions::TestUserEndpointsWithRoles::test_dialogue_scenarios_public` **call 阶段通过（计入 8 passed）且 teardown 阶段报错（计入 20 errors）**，同一测试双计 1 次。真实构成：31 = 19（ERROR at setup）+ 4（call FAILED）+ 8（call PASSED，其中 1 条 teardown error）。进度行 `.F..EEEE.EEEFFF.EEEEEEEE.EEEE..E`（32 字符 = 8 `.` + 4 `F` + 20 `E`）与 short summary 逐条交叉核对一致；`ERROR at setup`=19、`ERROR at teardown`=1 经程序化 grep 计数核对。

**关键失败/错误输出摘录（原文）**：

```
E   asyncpg.exceptions._base.InterfaceError: cannot perform operation: another operation is in progress      （×22 处 tracebacks）
E   RuntimeError: Task <Task pending name='Task-224' coro=<_wrap_async_fixture…_async_fixture_wrapper…setup()
    running at …pytest_asyncio\plugin.py:451> …> got Future <Future pending cb=[Protocol._on_waiter_completed()]>
    attached to a different loop
ExceptionGroup: unhandled errors in a TaskGroup (1 sub-exception)                                            （test_login_success）
  | RuntimeError: Task <Task pending name='starlette.middleware.base.BaseHTTPMiddleware.__call__…call_next…coro'
    coro=<TaskHandle._run_coro()…anyio\_core\_tasks.py:327>…> got Future … attached to a different loop      （×4 处）
```

**逐用例结果**（依本轮进度行 + short summary + 31 节点收集序交叉核对；PASSED 名称由 collected 全集减去 FAILED/ERROR 全集推得，与进度行逐位吻合）：

| # | 用例 | postgres 口径结果 |
|---|---|---|
| 1 | integration::TestAuthAPI::test_send_sms | PASSED |
| 2 | integration::TestAuthAPI::test_login_success | **FAILED**（ExceptionGroup：starlette BaseHTTPMiddleware 任务 `got Future attached to a different loop`） |
| 3 | integration::TestAuthAPI::test_login_wrong_code | PASSED |
| 4 | integration::TestAuthAPI::test_get_me_without_token | PASSED |
| 5 | integration::TestAuthAPI::test_get_me_with_token | **ERROR**（at setup，InterfaceError） |
| 6 | integration::TestTrainingAPI::test_start_session | **ERROR**（at setup） |
| 7 | integration::TestTrainingAPI::test_submit_answer | **ERROR**（at setup） |
| 8 | integration::TestTrainingAPI::test_finish_session | **ERROR**（at setup） |
| 9 | integration::TestDialogueAPI::test_list_scenarios | PASSED |
| 10 | integration::TestDialogueAPI::test_start_dialogue | **ERROR**（at setup） |
| 11 | integration::TestPronunciationAPI::test_get_next_task | **ERROR**（at setup） |
| 12 | integration::TestReportAPI::test_get_summary | **ERROR**（at setup） |
| 13 | integration::TestUserFlow::test_complete_training_flow | **FAILED**（InterfaceError: another operation is in progress） |
| 14 | integration::TestUserFlow::test_complete_dialogue_flow | **FAILED**（InterfaceError） |
| 15 | integration::TestUserFlow::test_report_after_training | **FAILED**（InterfaceError） |
| 16 | training_api::TestTrainingAuth::test_start_session_requires_auth | PASSED |
| 17 | training_api::TestTrainingAuth::test_get_next_requires_auth | **ERROR**（at setup） |
| 18 | training_api::TestTrainingAuth::test_submit_answer_requires_auth | **ERROR**（at setup） |
| 19 | training_api::TestTrainingAuth::test_finish_session_requires_auth | **ERROR**（at setup） |
| 20 | training_api::TestTrainingOwnership::test_get_next_rejects_other_user | **ERROR**（at setup） |
| 21 | training_api::TestTrainingOwnership::test_submit_answer_rejects_other_user | **ERROR**（at setup） |
| 22 | training_api::TestTrainingOwnership::test_finish_session_rejects_other_user | **ERROR**（at setup） |
| 23 | training_api::TestTrainingOwnership::test_nonexistent_session_returns_403 | **ERROR**（at setup） |
| 24 | training_api::TestTrainingOwnership::test_owner_can_access_session | **ERROR**（at setup） |
| 25 | role_permissions::TestTherapistOnlyEndpoints::test_patients_requires_auth | PASSED |
| 26 | role_permissions::TestTherapistOnlyEndpoints::test_patients_rejects_normal_user | **ERROR**（at setup） |
| 27 | role_permissions::TestTherapistOnlyEndpoints::test_patients_allows_therapist | **ERROR**（at setup） |
| 28 | role_permissions::TestUserEndpointsWithRoles::test_report_summary_allows_user | **ERROR**（at setup） |
| 29 | role_permissions::TestUserEndpointsWithRoles::test_report_summary_allows_therapist | **ERROR**（at setup） |
| 30 | role_permissions::TestUserEndpointsWithRoles::test_training_requires_auth | PASSED |
| 31 | role_permissions::TestUserEndpointsWithRoles::test_dialogue_scenarios_public | PASSED（call）+ **ERROR**（teardown） |

分文件小计：integration 15 = 4 passed / 4 failed / 7 setup-error；training_api 9 = 1 passed / 8 setup-error；role_permissions 7 = 3 passed（含 1 条 teardown error 双计）/ 4 setup-error。合计 passed=8、failed=4、errors=20（19 setup + 1 teardown），与 summary 行一致。

全程离线（conftest 注入 `_MemoryRedis` + autouse `mock_external_tts`）；未观测任何真实 dashscope/OSS/短信外呼。

---

## 5. sqlite 口径对照结果与双口径对比（D1 双真相，禁止只报有利口径）

**verbatim command**（无任何 env 覆盖，conftest.py:24 默认回落 `sqlite+aiosqlite://`）：

```
cd backend
venv312/Scripts/python.exe -m pytest tests/test_integration.py tests/test_training_api.py tests/test_role_permissions.py -q --tb=short -p no:cacheprovider
```

- cwd：`backend/`；**exitCode = 0**（本轮同命令执行两次：第一次进度行 31 个 `.` 全绿、输出被工具截断未含 summary 行；第二次逐字重跑完整捕获 `31 passed, 27 warnings in 1.14s`，RC=0——两次结果一致，报告引用第二次完整 summary，如实注明））
- 与 M0-002 C8 基线（31 passed / exit 0：integration 15 + training_api 9 + role_permissions 7）**逐条一致，零漂移**（M0-002 为历史记录，非本轮证据；本轮独立执行结果与之一致是交叉印证）。
- 27 warnings 为 httpx per-request cookies DeprecationWarning（F-M0005-05，与 M0-002 NB-03 同源）。

**双口径对比表**：

| 口径 | collected | passed | failed | errors | skipped | exitCode | 耗时 |
|---|---|---|---|---|---|---|---|
| sqlite（aiosqlite 内存） | 31 | **31** | 0 | 0 | 0 | 0 | 1.14s |
| postgres（127.0.0.1:55433 一次性容器） | 31 | 8 | 4 | 20（19 setup + 1 teardown 双计） | 0 | **1** | 17.34s |

不一致项：**23 个测试仅在 postgres 口径变红**（19 setup error + 4 failed，根因同一，见 §7 F-M0005-02）；0 个测试仅 sqlite 变红。所有红色集中于 asyncpg 连接/事件循环层，**本轮证据无法区分"应用层在 postgres 下行为正确"与"真实行为差异被基础设施红掩盖"**（JSON 列、序列/显式主键插入等 SPEC 预警差异点未触达断言层）。

---

## 6. RBAC/IDOR 回归面逐用例结果（postgres 口径 vs sqlite 口径）

| 安全面 | 用例 | sqlite 口径 | postgres 口径 |
|---|---|---|---|
| 401 未认证（不触 DB 路径） | integration::test_get_me_without_token | PASSED | **PASSED** |
| 401 未认证 | training_api::test_start_session_requires_auth | PASSED | **PASSED** |
| 401 未认证 | role_permissions::test_patients_requires_auth | PASSED | **PASSED** |
| 401 未认证 | role_permissions::test_training_requires_auth | PASSED | **PASSED** |
| 401 未认证 | training_api::test_get_next_requires_auth / test_submit_answer_requires_auth / test_finish_session_requires_auth | PASSED | **ERROR at setup**（未触达断言） |
| 403 + detail.code==40301（patient 越权） | role_permissions::test_patients_rejects_normal_user | PASSED | **ERROR at setup**（未触达断言） |
| 200 therapist 授权 | role_permissions::test_patients_allows_therapist | PASSED | **ERROR at setup** |
| report/summary 双角色 | role_permissions::test_report_summary_allows_user / _allows_therapist | PASSED | **ERROR at setup** |
| IDOR 跨用户归属（403） | training_api::test_get_next_rejects_other_user / test_submit_answer_rejects_other_user / test_finish_session_rejects_other_user | PASSED | **ERROR at setup** |
| IDOR 不存在 session 403 | training_api::test_nonexistent_session_returns_403 | PASSED | **ERROR at setup** |
| IDOR owner 正常访问 | training_api::test_owner_can_access_session | PASSED | **ERROR at setup** |
| 认证后数据访问（归属前置） | integration::test_get_me_with_token | PASSED | **ERROR at setup** |
| 归属校验（端到端流） | integration::TestUserFlow 三条 | PASSED | **FAILED**（断言前死于连接层） |
| 公开端点不泄露 | role_permissions::test_dialogue_scenarios_public | PASSED | PASSED（call）+ ERROR（teardown） |

结论：postgres/CI 同款口径下，**依赖 DB 归属数据的 13 条安全用例（training_api 8 + role_permissions 4 + integration::get_me_with_token 1）全部无法执行到断言层**——既非"安全通过"也非"安全失败"，而是"该口径下安全回归验证不成立"（§7 F-M0005-01，P0）。纯 401/公开面（不触 DB）在该口径下 4 条 call 绿。**禁止将本表任何绿项外推为"安全审查通过"**：完整安全审查属 M0-006/Release Gate 独立项（AC-04）。

---

## 7. Findings（本轮全部红项如实列出；本任务零修复、零删测/skip/xfail）

> 定级依据：P0=安全回归验证面被阻断；P1=阻断 CI 同款口径/基线裁决能力的基础设施与测试可靠性面；P2=观察项。所有 FIX-* 指 M1 清偿建议，本任务未改任何代码。

| ID | 级别 | 现象 | 涉及用例 | 关键输出摘录 | FIX 建议 | 与上一 run 对照 |
|---|---|---|---|---|---|---|
| **F-M0005-01** | **P0** | RBAC/IDOR 安全用例在 postgres 口径死于 fixture setup，断言层未触达，CI 同款口径的安全回归验证不成立 | §6 表中 13 条（training_api 8 + role_permissions 4 + integration get_me_with_token 1） | `ERROR at setup of … InterfaceError: cannot perform operation: another operation is in progress` | FIX-INT-01（=F-M0005-02 根因修复）后必须重跑 postgres 口径并逐条核对 §6 恢复绿色 | **复现**（上一 run 同 13 条形态；本轮根因、用例集、计数与上一 run 历史记录逐位一致） |
| **F-M0005-02** | **P1** | 根因：session 作用域 `test_engine`（conftest.py:53-100）创建的 asyncpg 连接池被 function 作用域事件循环复用——pytest-asyncio 1.4.0 每测试独立 loop，跨 loop 复用连接/句柄非法（aiosqlite 线程化容忍，asyncpg 严格绑定 loop） | 全部 19 setup ERROR + 3 UserFlow FAILED + 1 teardown ERROR + login_success | `InterfaceError: another operation is in progress`（×22 tracebacks）；`RuntimeError: Task <…_async_fixture_wrapper…setup()…> got Future <Future pending…> attached to a different loop`（×4） | FIX-INT-01：postgres 口径下 engine/连接与事件循环同生命周期（候选 `poolclass=NullPool`、per-test engine、或 `loop_scope="session"`——须 Max 出 SPEC 并补双口径回归）；FIX-INT-02：pyproject dev 依赖钉版本消除解析漂移 | **复现**（缺陷至今未修，修复属 M1 FIX-* 且 OUT_OF_SCOPE 明令，本任务未动 conftest） |
| **F-M0005-03** | **P1** | 功能流用例 postgres 口径 FAILED——连接层先死，应用层在 postgres 的真实行为（JSON/JSONB 列、显式主键插入、序列）**未被证伪也未被证实** | test_login_success、TestUserFlow×3 | login_success = ExceptionGroup（BaseHTTPMiddleware 任务 different-loop）；UserFlow 3 条 = InterfaceError | 依赖 FIX-INT-01 后复测；仍红则升级应用层 postgres 兼容性 Finding 逐案定级 | **复现**（上一 run 同 4 条 FAILED；login_success 失败签名本轮为 ExceptionGroup 包装的 different-loop RuntimeError，实质同一根因） |
| **F-M0005-04** | P2 | `test_dialogue_scenarios_public` call 通过但 teardown ERROR → summary 计数 32 > collected 31（双计 1 次） | role_permissions 末条 | 进度行 32 字符 vs `31 tests collected in 0.10s`（本轮独立取证） | 随 FIX-INT-01 消除（session fixture 在错误 loop 上 dispose） | **复现**（形态与上一 run 逐位一致） |
| **F-M0005-05** | P2 | httpx per-request cookies DeprecationWarning（sqlite 口径 27 条；postgres 口径同类） | 三连多文件 | `DeprecationWarning: Setting per-request cookies=<…> is being deprecated`（httpx/_client.py:1559） | 测试改造时统一 client 实例级 cookies（勿在本任务动） | **复现**（27 条计数与上一 run 一致） |
| **F-M0005-06** | P2 | 上一 run docker.io 直连不可达、经 docker.m.daocloud.io 同源加速（渠道偏差） | 环境建立 | — | 后续任务遇同形态须同样留 digest 痕并核对内容一致 | **本轮未复现**：G-IMG-PULL docker.io 直连成功（§3.3），且 digest 与上一 run 加速源内容逐字相同——渠道偏差消除，镜像内容连续性确认 |
| **F-M0005-07** | P2 | SPEC 撰写时点 ↔ 执行时点环境漂移：Docker daemon 由不可用变为可用；aiear-m0004-pg-test 由占用 :55432 变为 Exited（他任务容器，非本任务操作） | 环境口径 | G-ENV-DOCKER exit 0；docker ps 快照（§10.1） | 无修复项；提示 Verify 抽查重跑时环境可能再次漂移，以当轮实测为准 | **新发现**（相对 SPEC 撰写时点假设；本轮按实测走 EXECUTED 路径而非 BLOCKED 路径） |
| **F-M0005-08** | **P1** | **新增红项（非三连、属全量基线）**：`tests/test_adaptive_engine.py::TestAdaptiveEngineIntegration::test_full_adaptive_session` **非确定性红**（flaky）。同一 HEAD（d2d7ddb，零代码改动）下全量套件 7 次运行：4 次 `1 failed, 231 passed`、3 次 `2 failed, 230 passed`；单文件 3 次：1 红 2 绿——该用例 10 次观测 4 红。失败签名：`assert total_reward > 0` 收到负值（本轮两次实测 `-4.219022672333346`、`-0.5293924919283375`），BKT 自适应模拟含未固定随机源 | test_full_adaptive_session | `E assert -0.5293924919283375 > 0`（test_adaptive_engine.py，20 轮 simulate/update/calculate_reward 累计） | FIX-BE-FLAKY-01：随机源固定（seed 注入）或将断言改为概率不敏感的确定性构造；在修复前，全量 pytest 基线计数应在门禁中按区间（1F~2F）理解，禁止以单次绿宣称稳定、禁止 skip/xfail 该用例 | **新发现**（上一 run/ M0-002 基线记录形态为稳定 `1 failed, 231 passed`——历史记录仅 1~2 次采样，本轮 7 次采样暴露间歇性；属既有代码测试可靠性债，非本任务引入） |

**sqlite 三连口径无失败项**（31 passed / exit 0）。**PROJECT_BASELINE_HEALTH = DEGRADED** 依据：存在 record 红项（G-INT-PG-RUN exit 1、G-BASE-PYTEST exit 1、G-BASE-RUFF exit 1，含 F-M0005-08 新增红）——按任务原文冻结语义，红项入 findings，不触发本任务修复循环。

---

## 8. TODO.md:40-42 三条未勾选项逐项结论（本轮证据；TODO.md 文件零改动）

> 原文行号经本轮 `grep -n` 核实：`TODO.md:40 - [ ] 集成测试通过`、`:41 - [ ] 安全审查通过`、`:42 - [ ] 性能测试通过`。

### TODO.md:40 `- [ ] 集成测试通过`

**当前结论：未完成。** 本轮证据：postgres（CI 同款命令口径）三连真实执行 **exitCode=1**（`4 failed, 8 passed, 20 errors in 17.34s`，§4），CI 的集成裁决口径即该 postgres job（ci.yml:61-103）→ 结论不成立，指向 F-M0005-01/02/03 与 FIX-INT-01/02（M1 清偿后复测再议）。sqlite 口径 exitCode=0（31 passed，§5）为对照真相，不改变裁决口径结论。

### TODO.md:41 `- [ ] 安全审查通过`

**当前结论：本任务不裁决（无法验证）。** 本轮证据仅覆盖三连内 RBAC/IDOR 回归面：postgres 口径 13 条安全用例未触达断言层（F-M0005-01，P0），4 条纯 401/公开面绿（§6）；sqlite 口径 17 条全绿（本轮 §5 实测）。**完整安全审查（认证/授权/IDOR 全面排查、Secret 管理、CORS、日志脱敏、依赖漏洞）属 M0-006/Release Gate 独立项，本任务无权也不越权裁决**；此处局部结论仅为：该回归面在裁决口径下验证不成立。

### TODO.md:42 `- [ ] 性能测试通过`

**当前结论：本任务未执行裁决（无法验证）。** `tests/test_performance.py` 不在三连清单（SPEC 明令，本轮未运行该文件）。历史记录 M0-002 C9 为 `7 passed`（sqlite 口径）——**历史记录、非本轮证据**，且性能阈值属工程指标（禁作临床指标表述）。该条维持未勾选，裁决留待 M0-007/Release Gate。

---

## 9. record 级基线健康度全留痕（全量 pytest / ruff）

### 9.1 G-BASE-PYTEST（record）— exitCode=1，基线形态 + flaky 漂移（F-M0005-08）

```
$ cd backend && venv312/Scripts/python.exe -m pytest -q
exitCode=1
1 failed, 231 passed, 33 warnings in 5.13s    ← 代表性完整捕获运行（7 次运行中 4 次为此形态）
唯一稳定红项：FAILED tests/test_middleware.py::test_metrics_endpoint_is_available - assert 401 == 200
```
- **既有红项复现**：`tests/test_middleware.py:34` `assert response.status_code == 200` → `assert 401 == 200`（M0-002 历史基线形态 `1 failed, 231 passed` 的固有红项；历史记录非本轮证据，本轮独立复现之）。
- **flaky 漂移如实记录**：同命令 7 次运行的分布 = 4 次 `1 failed, 231 passed`（5.13s/4.12s/3.70s 等）+ **3 次 `2 failed, 230 passed`**（第二次多出的红 = `test_adaptive_engine.py::TestAdaptiveEngineIntegration::test_full_adaptive_session`，`assert total_reward > 0` 负值 -4.219/-0.529 等）；单文件 3 次 = 1 红 2 绿。全部 7 次 exitCode=1。新增红项已立 F-M0005-08（P1）+ FIX-BE-FLAKY-01，本任务未修复、未 skip。
- 33 warnings = httpx DeprecationWarning（§5 F-M0005-05 同源）。

### 9.2 G-BASE-RUFF（record）— exitCode=1，存量 lint 债

```
$ cd backend && venv312/Scripts/python.exe -m ruff check app/
exitCode=1
Found 291 errors.
[*] 199 fixable with the --fix option (11 hidden fixes can be enabled with the --unsafe-fixes option).
```
违规分布（`--statistics` 辅助留痕，exitCode=0；按 `^[A-Z]+[0-9]+ ` 程序化计数 291，与 --statistics 自洽）：I001×65、B008×56、UP045×55、UP006×54、UP035×19、UP017×15、B904×9、UP042×9、N818×3、UP041×3、B007×2、N806×1；涉及 `app/` 下 **67 个文件**。属既有存量债（历史 F-* 已录形态，非本轮引入；上一 run 未采集此项、M0-002 历史口径同属存量——引用处历史记录非本轮证据）。本任务未修复（OUT_OF_SCOPE 明令"顺手修 unrelated warning" 禁止）；清偿属 ARCH/QUALITY FIX-* 任务。

---

## 10. 禁区零接触声明

### 10.1 他任务容器执行前后对比（docker ps -a 快照，两次均 exitCode=0）

| 容器（镜像） | 本任务开始前 | 本任务清理后 | 一致 |
|---|---|---|---|
| aiear-m0004-pg-test（pgvector/pgvector:pg15，:55432） | Exited (255) 3 minutes ago | Exited (255) 14 minutes ago（同一时钟推进，状态/ID `bb77631d286f` 不变） | ✓ 未触碰 |
| dresslens-redis（redis:7-alpine，:16379） | Up 3 minutes | Up 14 minutes（ID `6f7aa465baa8` 不变） | ✓ 未触碰 |
| dresslens-postgres（pgvector/pgvector:pg16，:15432） | Up 3 minutes | Up 14 minutes（ID `9220e1bc17bf` 不变） | ✓ 未触碰 |
| dresslens-minio（minio/minio，:9000-9001） | Up 3 minutes | Up 14 minutes（ID `bec1aeb925ab` 不变） | ✓ 未触碰 |
| opengauss-lab（opengauss-server，:5432 映射但非监听主体） | Exited (255) 3 months ago | Exited (255) 3 months ago（ID `ee13c4050309` 不变） | ✓ 未触碰 |
| aiear-m0005-pg-test / aiear-m0005-redis | 不存在 | **已销毁，不存在**（G-ENV-NO-RESIDUE exitCode=0） | 本任务自建自毁 |

### 10.2 零接触清单（全程无一条命令指向下列对象）

- **宿主 :5432**（PID 6740，postgres.exe，UNKNOWN_DATABASE_INSTANCE 绝对禁区）：零连接、零操作、零 alembic、零 drop/truncate/downgrade；四个 env 全程显式覆盖未回落其默认值（§3.11 schema 取证证明连接的是 :55433）。本报告不含任何指向 :5432 的可执行连接串（G-REPORT-NO-5432-URL 机器自检，§12 后执行）。
- **:55432**（aiear-m0004-pg-test）、**:15432/:16379**（dresslens-*）：仅作为端口/容器占用事实记录（§3.1/§10.1），未连接、未启停、未销毁。
- **未执行任何 alembic**（任何形式的 upgrade/downgrade/current 均未运行——alembic.ini:5 默认 URL 即指向 :5432 禁区且 F-15 已证 head 不可达）；**未执行任何 docker compose**（非 ASCII 仓库路径必失败 + .env 暴露面）；仅裸 `docker run`/`exec`/`port`/`inspect`/`rm -f`，且创建/销毁严格限 `aiear-m0005-*` 前缀。
- 未运行任何前端命令；未触达真实 dashscope/OSS/短信；未执行任何破坏性 git 命令。
- D3 守卫 BLOCKED_UNSAFE_DATABASE_TARGET：全程零触发。

### 10.3 工作区完整性

- 唯一仓库改动 = 覆写本文档 `deliverables/baseline/INTEGRATION_BASELINE.md`（RETRY_OWNED；覆写前字节 sha256=`56ad8639…` 与 Workflow manifest priorRunSha256 校验一致，见文首/§13）。
- `git status --porcelain` 恰 3 条未跟踪条目（本文档、SECURITY_BASELINE.md、docs/qgraphflow/dialogue-turn-sequence/）；`git diff --stat` 输出为空——**已跟踪文件（含 backend/tests/conftest.py 与一切测试代码）零修改**，机器证明无删测/skip/xfail/断言弱化（G-WORKTREE-PROTECTED 裁决对象）。
- pre-existing 未跟踪单元指纹任务开始实测（辅助留痕）：SECURITY_BASELINE.md `md5=f4720b6866089f36e06052577233b22f`（97758 字节）；graph.json `md5=2fe742d810f7cd0ce2f5eb401f0050a0`（34972 字节）、index.html `md5=c1bb9c9b90d92db933577e4056e3ba91`（794348 字节）——与上一 run 收尾记录逐字一致（graph/index 两项），本任务零触碰；收尾复测值见 §12 后工作区门禁执行记录（由 Workflow/Verify 裁决持续性）。
- TODO.md、兄弟基线文档（REPO_INVENTORY/BACKEND_TEST_BASELINE/DB_API_BASELINE/FRONTEND_BASELINE/SECURITY_BASELINE）、docker-compose.yml、.github/**、.qoder/**（含上一 run 小写 spec 文件，未重命名/覆盖/删除）、docs/**、AGENTS.md、.gitignore、deploy/** 全部零改动。
- 所有 pytest 均带 `-p no:cacheprovider`；辅助日志一律写 `/tmp/m0005_*`（仓库外），未向工作区落任何杂物。

---

## 11. 医疗安全边界声明与隐私/Secret 边界声明

**医疗安全边界声明**：本文档全部结果为**软件工程质量测量**（测试通过/失败计数、exitCode、耗时），不构成任何临床/健康/康复疗效结论，不得表述为医疗安全水平或患者安全性证明。三连中的对话 API 用例（场景列表/开始对话）通过与否不代表医疗安全回归结论；医疗安全评测（Risk Taxonomy/Query Classifier/Emergency Route 等）属 M0-006/SAFE-* 与 Release Gate 独立项。正确率/评分类输出（如有）均为工程指标，禁止与"听力恢复程度"或临床标准挂钩。本任务未产生任何医疗功能、文案或结论，未产生任何诊断/处方/调机内容。

**隐私/Secret 边界声明**：
- `backend/.env` 未被执行手读取或输出任何内容；报告不含该文件任何取值。sqlite 口径命令按 SPEC 设计经由框架 Settings 隐式加载路径运行（进程内部行为，输出零泄漏），本轮所有输出中未观测任何 Secret 值。
- 容器凭据 `postgres`/`postgres` 与 SECRET_KEY `ci-only-secret-key-with-at-least-32-characters` 均为 **ci.yml:66-68/99 仓库内公开 CI 值，非真实 Secret**（AC-06 允许 verbatim 并如此标注）；本轮未另行生成任何随机凭据。
- `docker logs/inspect/port/exec` 留痕写入前自查：无凭据值、无 token、无手机号形态数据。
- 全程无真实用户数据（D 类）触达：容器内数据 = conftest fixture 构造 + 2 条种子 ItemBank（§3.11 取证 users=0）；无健康信息、无语音、无真实手机号/验证码。测试数据未写入任何 A 类向量语料（纯净 postgres:16-alpine，无 pgvector 扩展、无向量表）。
- 外部依赖全 mock：`_MemoryRedis` + `mock_external_tts`（conftest.py:215-257），零真实外呼。

---

## 12. 机器证据块

（独立段落，行首无空白；数值与 Machine Gate commands[] 提交的 exitCode 逐字核对，不一致 = 虚报 blocker）

G-INT-PG-EXITCODE=1
G-INT-SQLITE-EXITCODE=0
G-BASE-PYTEST-EXITCODE=1
G-BASE-RUFF-EXITCODE=1
PROJECT_BASELINE_HEALTH=DEGRADED

- G-INT-PG-EXITCODE=1 ← §4：`4 failed, 8 passed, 20 errors in 17.34s`（EXECUTED_AND_RECORDED，recordStatus 见 §3.7）
- G-INT-SQLITE-EXITCODE=0 ← §5：`31 passed, 27 warnings in 1.14s`
- G-BASE-PYTEST-EXITCODE=1 ← §9.1：代表性 summary `1 failed, 231 passed, 33 warnings in 5.13s`；7 次运行全部 exit=1（含 3 次 `2 failed, 230 passed` flaky 漂移，F-M0005-08）
- G-BASE-RUFF-EXITCODE=1 ← §9.2：`Found 291 errors.`
- PROJECT_BASELINE_HEALTH=DEGRADED ← record 红项存在（§7/§9）；按任务原文冻结语义，红项入 findings，不触发本任务修复循环

---

## 13. 与上一 run（wf_bd5d9d4f-2c7）对照

> 上一 run 数据引用自其产物 INTEGRATION_BASELINE.md（覆写前留档，sha256=56ad8639…）——**历史记录，非本轮证据**；对照结论以本轮实测为基准。

| 维度 | 上一 run（2026-10-09 @ f73cb01） | 本轮（2026-10-10 @ d2d7ddb） | 对照结论 |
|---|---|---|---|
| Machine Gate 结果 | BLOCK（根因 F-20 治理缺陷，非质量问题） | 本 run = FIX-GOV-001-R1 修复后首次真实执行，16 条门禁全部按合同提交（裁决属 Workflow/Max） | 重跑动因达成 |
| Docker daemon | 不可用→执行手启动后成功（daemon 曾需人工/自动拉起） | 执行时点已可用（SPEC 撰写时点假设失效，按实测走 EXECUTED 路径；F-M0005-07） | 环境漂移已记录 |
| 镜像 pull | docker.io 直连失败×2 → daocloud 加速源 + tag（F-M0005-06） | docker.io 直连成功，digest 与上一 run 加速内容逐字一致 | F-M0005-06 未复现 |
| postgres 三连 | exit 1，`4 failed, 8 passed, 20 errors in 17.04s` | exit 1，`4 failed, 8 passed, 20 errors in 17.34s` | **逐位复现**（F-M0005-01/02/03/04 全复现，仅耗时 +0.30s 噪声级差异） |
| sqlite 三连 | exit 0，`31 passed, 27 warnings in 1.30s` | exit 0，`31 passed, 27 warnings in 1.14s` | 复现（零漂移） |
| 逐用例结果表 | §4 全表 | 本轮 §4 全表 | 31 条逐位一致（含 login_success FAILED、public call 过/teardown 错等） |
| login_success 失败签名 | `RuntimeError: got Future attached to a different loop` | ExceptionGroup 包装的同款 different-loop RuntimeError（starlette BaseHTTPMiddleware 任务） | 实质同一根因，展示形态随 pytest 9.1.1 traceback 组装略异 |
| 全量 pytest / ruff | 上一 run 未采集（门禁合同无此两项） | 本轮 record 采集：1F/231P 形态 + flaky 漂移 F-M0005-08；ruff 291 errors | 新增基线事实（M0-002 历史口径交叉印证既有红项） |
| 工作区 | 产物 351 行未跟踪 | 本文档覆写同路径（RETRY_OWNED，priorRunSha256 校验通过）；SECURITY_BASELINE/qgraphflow 指纹实测与上一 run 收尾记录逐字一致 | 指纹持续不变 |

**下游输入**：本文档为 M0-006（安全基线重跑）、M0-007（性能基线，TASK_CATALOG 显式依赖 M0-005）、M0 Milestone Gate 的当前输入；其中 postgres 口径的验证能力缺口（F-M0005-01/02）是 M1 FIX-INT-01/02 的清偿对象。任何引用不得把"本机 CI 同款命令口径"外推为"等同 CI 通过/失败"。
