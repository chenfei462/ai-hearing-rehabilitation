# M0-004 数据库迁移 / API 端点 / pytest 基线审计（relaunch #3）

- 任务 ID：`m0-004-db-api-baseline`（SPEC relaunch attempt=3，spec：`.qoder/workflow-state/m0-004-db-api-baseline-c5546e199e14.spec.json`）
- 执行日期：2026-10-07
- 分支 / HEAD：`feature/m0-baseline` / `c5546e199e144512e7ed30caf7d6e8c872ff4e23`
- 任务性质：只读工程审计。零业务代码改动、零 Schema 变更、零 API 变更、零前端改动。
- 本文件是 M0 阶段的**事实记录**（真实 exitCode / 真实输出），不是结论性"通过"判定；Task Gate 判定权归 Machine Gate + Max Review/Verify。
- 本文档不含任何密码、token 或凭据形态的连接串（见 §4.2）。

---

## §1 迁移真相（隔离测试库上的 upgrade / downgrade / upgrade 三连取证）

### 1.1 隔离库标识（不含凭据）

| 项 | 值 |
|---|---|
| 容器名 | `aiear-m0004-pg-test` |
| 宿主端口映射 | `0.0.0.0:55432->5432/tcp`（容器内标准端口，宿主侧为 **55432**） |
| 目标库名 | `aiear_m0004_test` |
| 容器状态 | 任务前/任务后均 `Up`（本任务未创建、未删除、未重启任何容器或卷） |
| 凭据承载 | 仓库外临时配置 `C:/Users/hacjr/.aiear-m0004-temp-alembic.ini`（**仅按路径引用，全文未被读取/打印**） |

### 1.2 命令形式说明（强制口径）

```
cd backend && venv312/Scripts/python.exe -m alembic -c C:/Users/hacjr/.aiear-m0004-temp-alembic.ini <子命令>
```

禁用形式与原因：

| 禁用形式 | 原因 |
|---|---|
| `venv312/Scripts/alembic.exe` | 仓库路径含非 ASCII 字符（`听觉康复`），入口脚本在非 ASCII 基路径下静默 `exit 1`，不可用于取证 |
| 仓库内 `backend/alembic.ini` | 其 `sqlalchemy.url`（`backend/alembic.ini:5`）默认指向 `localhost:5432/cochlear_rehab` —— 外部 `opengauss-lab` 实例，身份不可证明（UNKNOWN_DATABASE_INSTANCE），属绝对禁区。故每条命令显式携带 `-c` 外部 ini |

环境事实：`backend/venv312` = Python 3.12.10 + alembic 1.13.1（`pytest 9.1.1`，见 §3/§4.1）。

### 1.3 revision token 事实（relaunch-2 冲突根因复核）

| 文件 | 行 | 事实 |
|---|---|---|
| `backend/alembic/versions/001_init_tables.py` | 11 | `revision = "001"`（`down_revision = None`） |
| `backend/alembic/versions/002_seed_items.py` | 11–12 | `revision = "002"`、`down_revision = "001"` |

结论：alembic 的 revision token 是 **`001` / `002`**，不是文件名 `001_init_tables` / `002_seed_items`（把文件名当 token 是 relaunch-2 的 SPEC_CONFLICT 根因，实测 `Can't locate revision` / exitCode=127）。`base` / `head` 为 alembic 关键字。本次三连全部使用修正后的 token，未出现 127。

### 1.4 三连逐步记录（命令 / current 原文 / 真实 exitCode）

> `current` 输出的判读规则：alembic 在库无版本行时只打印 INFO 头两行、**不打印 revision 行**（即 base）；有版本时末行为 revision 值。

**step0 — step1 前取证**

```
命令：venv312/Scripts/python.exe -m alembic -c C:/Users/hacjr/.aiear-m0004-temp-alembic.ini current
真实 exitCode：0
输出原文：
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
判读：无 revision 行 → 空 / base（与 expected「前=空/base」一致）
```

**step1 — `upgrade 001`**

```
命令：venv312/Scripts/python.exe -m alembic -c C:/Users/hacjr/.aiear-m0004-temp-alembic.ini upgrade 001
真实 exitCode：0
关键输出原文：
INFO  [alembic.runtime.migration] Running upgrade  -> 001, <中文 docstring，控制台代码页渲染为乱码>
current（step1 后）：
  命令：... -m alembic -c C:/Users/hacjr/.aiear-m0004-temp-alembic.ini current
  真实 exitCode：0
  输出原文（末行）：001
判读：与 expected「exit 0，后=revision 001」一致
```

**step2 — `downgrade base`（downgrade 可用性证据）**

```
命令：venv312/Scripts/python.exe -m alembic -c C:/Users/hacjr/.aiear-m0004-temp-alembic.ini downgrade base
真实 exitCode：0
关键输出原文：
INFO  [alembic.runtime.migration] Running downgrade 001 -> , <中文 docstring，乱码同上>
current（step2 后）：
  命令：... -m alembic -c C:/Users/hacjr/.aiear-m0004-temp-alembic.ini current
  真实 exitCode：0
  输出原文：仅两行 INFO，无 revision 行
判读：空 / base —— 与 expected「exit 0，current 为空/base」一致
事实意义：001 的 downgrade() 在真实 PostgreSQL 15 上可用（001 → base 成功执行，退出码 0）
```

**step3 — `upgrade head`（head=002）**

```
命令：venv312/Scripts/python.exe -m alembic -c C:/Users/hacjr/.aiear-m0004-temp-alembic.ini upgrade head
真实 exitCode：1        （与 expected 指引 1 一致）
关键输出原文（含完整 traceback，见 §1.5）：
INFO  [alembic.runtime.migration] Running upgrade  -> 001, ...
INFO  [alembic.runtime.migration] Running upgrade 001 -> 002, ...
TypeError: execute() takes 2 positional arguments but 3 were given
current（step3 后）：
  命令：... -m alembic -c C:/Users/hacjr/.aiear-m0004-temp-alembic.ini current
  真实 exitCode：0
  输出原文：仅两行 INFO，无 revision 行 → 空 / base
判读：exitCode 与 TypeError 均命中 expected；但 **current 实测为空（base），与 expected「回滚后停 001」不符**
      → 该不符之处不掩饰、不改代码迎合，登记为新 finding F-16（见 §1.6）
```

**heads 取证**

```
命令：venv312/Scripts/python.exe -m alembic -c C:/Users/hacjr/.aiear-m0004-temp-alembic.ini heads
真实 exitCode：0
输出原文：002 (head)
判读：head=002，与 expected 一致
```

### 1.5 step3 完整 traceback（真实捕获，逐字记录）

```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> 001, <初始化数据库：中文 docstring 乱码>
INFO  [alembic.runtime.migration] Running upgrade 001 -> 002, <种子数据：题库：中文 docstring 乱码>
Traceback (most recent call last):
  File "<frozen runpy>", line 198, in _run_module_as_main
  File "<frozen runpy>", line 88, in _run_code
  File "D:\systemDir\Desktop\<听觉康复>\backend\venv312\Lib\site-packages\alembic\__main__.py", line 4, in <module>
    main(prog="alembic")
  File "D:\systemDir\Desktop\<听觉康复>\backend\venv312\Lib\site-packages\alembic\config.py", line 641, in main
    CommandLine(prog=prog).main(argv=argv)
  File "D:\systemDir\Desktop\<听觉康复>\backend\venv312\Lib\site-packages\alembic\config.py", line 631, in main
    self.run_cmd(cfg, options)
  File "D:\systemDir\Desktop\<听觉康复>\backend\venv312\Lib\site-packages\alembic\config.py", line 608, in run_cmd
    fn(
  File "D:\systemDir\Desktop\<听觉康复>\backend\venv312\Lib\site-packages\alembic\command.py", line 403, in upgrade
    script.run_env()
  File "D:\systemDir\Desktop\<听觉康复>\backend\venv312\Lib\site-packages\alembic\script\base.py", line 583, in run_env
    util.load_python_file(self.dir, "env.py")
  File "D:\systemDir\Desktop\<听觉康复>\backend\venv312\Lib\site-packages\alembic\util\pyfiles.py", line 95, in load_python_file
    module = load_module_py(module_id, path)
  File "D:\systemDir\Desktop\<听觉康复>\backend\venv312\Lib\site-packages\alembic\util\pyfiles.py", line 113, in load_module_py
    spec.loader.exec_module(module)  # type: ignore
  File "<frozen importlib._bootstrap_external>", line 999, in exec_module
  File "<frozen importlib._bootstrap>", line 488, in _call_with_frames_removed
  File "D:\systemDir\Desktop\<听觉康复>\backend\alembic\env.py", line 34, in <module>
    run_migrations_online()
  File "D:\systemDir\Desktop\<听觉康复>\backend\alembic\env.py", line 29, in run_migrations_online
    context.run_migrations()
  File "<string>", line 8, in run_migrations
  File "D:\systemDir\Desktop\<听觉康复>\backend\venv312\Lib\site-packages\alembic\runtime\environment.py", line 948, in run_migrations
    self.get_context().run_migrations(**kw)
  File "D:\systemDir\Desktop\<听觉康复>\backend\venv312\Lib\site-packages\alembic\runtime\migration.py", line 627, in run_migrations
    step.migration_fn(**kw)
  File "D:\systemDir\Desktop\<听觉康复>\backend\alembic\versions\002_seed_items.py", line 55, in upgrade
    op.execute(
  File "<string>", line 8, in execute
TypeError: execute() takes 2 positional arguments but 3 were given
```

乱码说明：原始 stdout/stderr 中的中文（仓库路径 `听觉康复`、迁移 docstring）在 Windows 控制台代码页下渲染为乱码；上文以 `<听觉康复>` / `<中文 docstring>` 标注其真实语义，**未对捕获内容做任何事实性修改**。

### 1.6 F-15 归因 + 新 finding F-16（如实记录 expected 不符）

**F-15（既有 OPEN/P1，本任务只取证不修复）**

- 现象：`upgrade head` 在 `001 -> 002` 处 `TypeError: execute() takes 2 positional arguments but 3 were given`，真实 exitCode=1。
- 代码级根因：`backend/alembic/versions/002_seed_items.py:54-58`（`op.execute(` 起始于 **line 55**，落在 expected 指引的 54–58 区间内）以**两个位置参数**调用 `op.execute(sa.text(...), item)`；alembic 1.13.1 的 `Operations.execute` 签名为 `(self, sqltext, *, execution_options=None)`，不接受第二个位置参数。
- 影响：迁移链无法到达 head，19 条 `item_bank` 种子数据无法经迁移落地；仓库内无 alembic 执行路径（CI/compose/deploy/scripts/runbook/Dockerfile 零命中），真实建表走 `Base.metadata.create_all`，故该缺陷长期潜伏。
- 登记与去向：`deliverables/overnight/TASK_LEDGER.json` → `findings["F-15"]`（OPEN / P1）；修复归 **FIX-M0-004-001**（M2 前）。本任务未修改任何迁移文件。

**F-16（本任务新采集，与 expected 指引不符之处的如实归因）**

- 现象：step3 失败后 `alembic current` 输出为**空（base）**，而 spec expected 指引为"事务回滚后停 001"。
- 代码级根因：`backend/alembic/env.py:26-29` 的在线模式把整串 `context.run_migrations()` 置于**单个** `context.begin_transaction()` 内，且 `context.configure(...)`（`env.py:27`）**未设置 `transaction_per_migration=True`**。alembic 默认在整条 upgrade 序列末尾一次性提交，因此 002 抛 TypeError 时回滚范围包含**同事务内已执行的 001 全部 DDL 与 `alembic_version` 写入**，库整体回到 base。
- 影响（口径级）：三连执行后，隔离库 `aiear_m0004_test` 内既无 001 表结构也无版本行（不是"停在 001"）。这使"失败仅回滚最新一步、前序版本保持"这一常见假设在本项目不成立，须由后续任务与运维口径明确。
- 严重性建议：P2（不影响产品运行时，但直接决定 Release Gate"迁移 up/down/up"证据链的解读方式与 FIX-M0-004-001 的验收设计）。**最终定级与处置去向归 Max / Goal Orchestrator 判定**；建议与 F-15 一并在 FIX-M0-004-001 评估（修 002 签名后，若仍需 `upgrade head` 达到 head，须同时决定 env.py 事务粒度口径）。
- 台账登记：`TASK_LEDGER.json` 不在本任务可写清单（非 EXPECTED_FILES），故本文件为 F-16 的**首个证据载体**，正式登记由 Goal Orchestrator 执行。F-16 编号经全仓检索无冲突（既有 F-01/F-02/F-08/F-11/F-13/F-15）。

### 1.7 对 Release Gate「迁移 upgrade → downgrade → re-upgrade 通过」判据的 M0 口径结论

如实记录，不掩盖：

1. `upgrade 001` → `downgrade base` → （可再次 `upgrade 001`）：001 的 up/down **可用**（step1/step2 真实 exitCode 均为 0，current 输出见 §1.4）。
2. `upgrade head`（含 002）：当前**不成立** —— F-15 使其必然 exit 1。
3. re-upgrade 语义：因 F-16，002 失败会把整串回滚至 base，故三连在真实库上**无法**把库推进到 head，Release Gate 该判据在 002 修复前不可能成立。
4. 结论：M0 阶段该判据状态 = **已知不成立（F-15 + F-16）**，修复路径 = FIX-M0-004-001（002 签名）+ 事务粒度口径决定（env.py）。

---

## §2 API 端点盘点（只读；`docs/api-reference.md` 零改动）

### 2.1 router 注册事实（`backend/app/main.py:124-131`）

| 行 | 注册语句 | prefix |
|---|---|---|
| 124 | `app.include_router(health_router, tags=["健康检查"])` | **无 prefix** |
| 125 | `app.include_router(metrics_router, prefix="/api", ...)` | `/api` |
| 126 | `... auth.router, prefix="/api/auth"` | `/api/auth` |
| 127 | `... training.router, prefix="/api/training"` | `/api/training` |
| 128 | `... dialogue.router, prefix="/api/dialogue"` | `/api/dialogue` |
| 129 | `... pronunciation.router, prefix="/api/pronunciation"` | `/api/pronunciation` |
| 130 | `... report.router, prefix="/api/report"` | `/api/report` |
| 131 | `... hardware_router, prefix="/api/hardware"` | `/api/hardware` |

### 2.2 全量路由清单（8 router / **37 条**，方法+路径+源文件行号）

路径 = `include_router(prefix)` + `@router.<method>(<path>)`；行号为装饰器所在行。

| # | 方法 | 完整路径 | 源文件:行 | router |
|---|---|---|---|---|
| 1 | GET | `/health` | `api/health.py:14` | health |
| 2 | GET | `/health/detailed` | `api/health.py:30` | health |
| 3 | GET | `/api/metrics` | `api/metrics.py:14` | metrics |
| 4 | GET | `/api/metrics/ai-latency` | `api/metrics.py:30` | metrics |
| 5 | GET | `/api/metrics/errors` | `api/metrics.py:66` | metrics |
| 6 | POST | `/api/auth/sms/send` | `api/auth.py:76` | auth |
| 7 | POST | `/api/auth/login` | `api/auth.py:84` | auth |
| 8 | POST | `/api/auth/logout` | `api/auth.py:116` | auth |
| 9 | GET | `/api/auth/me` | `api/auth.py:129` | auth |
| 10 | PUT | `/api/auth/users/me/preferences` | `api/auth.py:147` | auth |
| 11 | POST | `/api/training/sessions` | `api/training.py:32` | training |
| 12 | GET | `/api/training/sessions/{session_id}/next` | `api/training.py:59` | training |
| 13 | POST | `/api/training/sessions/{session_id}/answer` | `api/training.py:83` | training |
| 14 | POST | `/api/training/sessions/{session_id}/finish` | `api/training.py:106` | training |
| 15 | GET | `/api/training/adaptive/recommendation` | `api/training.py:126` | training |
| 16 | POST | `/api/training/adaptive/submit` | `api/training.py:166` | training |
| 17 | GET | `/api/dialogue/scenarios` | `api/dialogue.py:36` | dialogue |
| 18 | POST | `/api/dialogue/sessions` | `api/dialogue.py:45` | dialogue |
| 19 | POST | `/api/dialogue/sessions/{session_id}/turn` | `api/dialogue.py:64` | dialogue |
| 20 | POST | `/api/dialogue/sessions/{session_id}/finish` | `api/dialogue.py:101` | dialogue |
| 21 | GET | `/api/pronunciation/tasks/next` | `api/pronunciation.py:24` | pronunciation |
| 22 | POST | `/api/pronunciation/attempts` | `api/pronunciation.py:35` | pronunciation |
| 23 | GET | `/api/pronunciation/attempts` | `api/pronunciation.py:72` | pronunciation |
| 24 | GET | `/api/pronunciation/stats` | `api/pronunciation.py:85` | pronunciation |
| 25 | GET | `/api/report/summary` | `api/report.py:19` | report |
| 26 | GET | `/api/report/levels` | `api/report.py:42` | report |
| 27 | GET | `/api/report/patients` | `api/report.py:57` | report |
| 28 | GET | `/api/report/weekly` | `api/report.py:82` | report |
| 29 | GET | `/api/hardware/devices` | `api/hardware.py:65` | hardware |
| 30 | GET | `/api/hardware/devices/{device_id}` | `api/hardware.py:82` | hardware |
| 31 | POST | `/api/hardware/devices/{device_id}/connect` | `api/hardware.py:103` | hardware |
| 32 | POST | `/api/hardware/devices/{device_id}/disconnect` | `api/hardware.py:124` | hardware |
| 33 | POST | `/api/hardware/devices/{device_id}/command` | `api/hardware.py:147` | hardware |
| 34 | POST | `/api/hardware/devices/{device_id}/led` | `api/hardware.py:198` | hardware |
| 35 | POST | `/api/hardware/devices/{device_id}/buzzer` | `api/hardware.py:219` | hardware |
| 36 | POST | `/api/hardware/training-event` | `api/hardware.py:241` | hardware |
| 37 | GET | `/api/hardware/ws-info` | `api/hardware.py:280` | hardware |

分 router 计数：auth 5 / training 6 / dialogue 4 / pronunciation 4 / report 4 / hardware 9 / metrics 3 / health 2 = **37**，与 spec 探明基准逐项一致（脚本化枚举复核 TOTAL=37）。

额外非 router 路由（不在 37 基准内）：`GET /`（`app/main.py:135`，根路径服务信息）。
其他路由面核查：全仓 `app/api/*.py` 与 `main.py` 中**无 `@router.websocket` / WebSocket 路由注册**；`hardware.py:280` 的 `ws-info` 是返回 WebSocket 连接信息的 REST 端点，非 WS 端点本身。

### 2.3 差异类 A —— 已实现但文档缺失（明细）

| 实现条目 | 文档现状 | 文档行号 |
|---|---|---|
| hardware **8 条子路径**：`GET /api/hardware/devices/{device_id}`、`POST .../connect`、`.../disconnect`、`.../command`、`.../led`、`.../buzzer`、`POST /api/hardware/training-event`、`GET /api/hardware/ws-info` | 仅一句概述"硬件：`/api/hardware/devices` 及设备控制子路径"，无方法、无路径明细、无说明 | `docs/api-reference.md:32` |
| `GET /api/pronunciation/attempts`（`pronunciation.py:72`，与同路径 POST 为两个不同操作） | 文档只列 `/api/pronunciation/attempts` 一次且**未标方法**，无法区分 GET/POST 语义 | `:30` |
| dialogue 4 条（含方法/请求体契约）、report 4 条 GET | 以散文列出路径、**无方法列、无说明列**，未达到同文件 auth/training 表（`:8-14`、`:18-25`）的明细级别 | `:29`、`:31` |
| `GET /`（`main.py:135`） | 完全未出现于文档 | 无条目 |

### 2.4 差异类 B —— 文档存在但未实现（字面路径）

| 文档条目 | 文档行号 | 实现事实 |
|---|---|---|
| `GET /api/health`（存活检查） | `:36` | 实现为 `GET /health`（`health.py:14` + `main.py:124` **无 prefix**）；**字面路径 `/api/health` 在应用路由表中不存在** |
| `GET /api/health/detailed`（DB/Redis 就绪检查） | `:37` | 实现为 `GET /health/detailed`（`health.py:30`）；**字面路径 `/api/health/detailed` 不存在** |

### 2.5 差异类 C —— 契约不一致

| # | 不一致点 | 实现证据 | 文档证据 |
|---|---|---|---|
| C-1 | **health 路径前缀**（spec 必查线索，核实成立）：文档写 `/api/health`、`/api/health/detailed`，实现挂载时**无 prefix**，实际路径为 `/health`、`/health/detailed` | `main.py:124`（`include_router(health_router, tags=[...])`，无 `prefix`）；`health.py:14,30` | `api-reference.md:36-37` |
| C-2 | **"所有接口使用 `/api` 前缀"总述与实现矛盾**（即 C-1 的全局表述根源） | `health.py` 两条路由无 `/api` 前缀；另有 `GET /`（`main.py:135`） | `api-reference.md:3` |
| C-3 | **监控读取端点的认证豁免表述与实现不符**：文档称"除场景列表、健康检查和**监控读取接口**外，接口需要认证"，但 `GET /api/metrics` 依赖 `get_current_user`，未认证请求返回 **401** | `metrics.py:14-15`（`async def get_metrics(current_user: User = Depends(get_current_user))`，docstring 注明"仅 therapist 可访问"） | `api-reference.md:4` |
| — | 与既有 finding 关系 | C-3 正是 **F-01**（`test_middleware.py:34` `assert 401 == 200`，`TASK_LEDGER` OPEN/P1）的文档侧表现：测试沿用"监控读取豁免"文档口径，实现已加认证守卫。本任务不修复、不改测试 | `BACKEND_TEST_BASELINE.md` §5 |

> 说明：`api-reference.md:20` 的 `POST /api/training/sessions?level=...` 与实现**匹配**（`training.py:39` `level: str = Query(...)`），故不列为文档差异。附注（仅记录，不属差异分类、不在本任务修复范围）：该端点以 Query 传业务参数，与 `.qoder/rules/30-backend.md`"POST 业务参数用 Request Body（历史 A3）"存在既有张力。

盘点为纯读操作，`git diff` 确认 `docs/api-reference.md` 零改动（见 §4.3）。

---

## §3 pytest 基线对齐（M0-002 权威基线比对）

### 3.1 真实执行结果

权威命令：`cd backend && venv312/Scripts/python.exe -m pytest -q`

| Run | 用途 | 真实 exitCode | 统计行原文 | 失败用例 |
|---|---|---|---|---|
| Run-1 | 门禁证据（首次全量） | **1** | `1 failed, 231 passed, 33 warnings in 2.68s` | `tests/test_middleware.py::test_metrics_endpoint_is_available` |
| Run-2 | 为逐字留存统计行与退出码的重复执行（非"重跑刷绿"） | **1** | `1 failed, 231 passed, 33 warnings in 2.24s` | 同上 |

两次运行结果**完全一致**（1 failed / 231 passed / 33 warnings / exit 1）。Run-2 的必要性说明：Run-1 的终端截取未包含末行统计与退出码，为留存逐字证据而重复执行；两次均为同一命令、同一口径，**未做任何代码或测试修改**，不存在"挑一次绿的冒充基线"。

Run-1/Run-2 唯一失败的断言原文：

```
tests\test_middleware.py:34: AssertionError
E   assert 401 == 200
E    +  where 401 = <Response [401 Unauthorized]>.status_code
```

### 3.2 与 M0-002 权威基线逐条比对

基线来源：`deliverables/baseline/BACKEND_TEST_BASELINE.md`（§3 C4 行、§4 原文统计行、§5 确定性失败表）。

| 比对项 | M0-002 基线 | 本任务实测（Run-1 / Run-2） | 一致性 |
|---|---|---|---|
| failed 数 | 1 | 1 / 1 | 一致 |
| passed 数 | 231 | 231 / 231 | 一致 |
| warnings 数 | 33 | 33 / 33 | 一致 |
| skipped / xfailed / xpassed | 0 / 0 / 0 | 无（统计行未出现 skip/xfail 项） | 一致 |
| 真实 exitCode | 1 | 1 / 1 | 一致 |
| 唯一确定性失败 | F-01 `tests/test_middleware.py::test_metrics_endpoint_is_available`（`test_middleware.py:34`，`assert 401 == 200`） | 同一用例、同一断言、同一行号 | 一致 |
| warnings 构成 | 33 条主要为 httpx per-request cookies Deprecation（dialogue_api 6 / integration 15 / training_api 12） | 同分布（6 + 15 + 12 = 33） | 一致 |
| 测试文件数 / 收集数 | 20 个测试文件 / 232 collected | 未单独执行 `--collect-only`（见 §3.4 记录项）；failed+passed = 232，与基线收集数吻合 | 间接一致 |

### 3.3 声明

**no NEW failures**：本任务两次全量运行的失败集合与 M0-002 权威基线**逐条相同**（仅 F-01），未出现任何新增确定性失败，未出现 F-13 偶发形态。本任务零代码/零测试改动（§4.3 tracked diff 为空），故不存在由本任务引入回归的可能。

同时声明：既有 F-01 仍为 OPEN/P1（处置归 Max，见 `api-reference.md` 契约不一致 C-3 与 TASK_LEDGER），本任务**不修复、不改测试、不跳过测试**。

### 3.4 如实记录的取证缺口

- 本任务未按基线 §3 额外执行 `--collect-only`，故"20 files / 232 collected"取自 M0-002 既有证据 + 本次 failed+passed 计数吻合的间接印证，非本次直接采集。
- F-13（`tests/test_adaptive_engine.py::TestAdaptiveEngineIntegration::test_full_adaptive_session`，`app/ai/adaptive_engine.py:228` 未播种全局 RNG 导致的结构性偶发，见基线 §6）在本次 2 次采样中**未出现**；这是概率事实，不代表已修复，后续 run 仍可能出现 `2 failed`，届时须按基线 §6 归因，禁止重跑到绿冒充。

---

## §4 口径与安全声明

### 4.1 环境漂移口径（结论仅代表本地）

| 维度 | 本地取证环境 | CI 口径 | 漂移影响 |
|---|---|---|---|
| Python | 3.12.10（`backend/venv312`） | 3.11（`.github/workflows/ci.yml`） | 本地统计/失败清单仅代表本地口径，不可直接引用为 CI 结论 |
| pytest | 9.1.1 | CI 8.x | 同上；warning 计数与统计行格式随版本可能漂移 |
| alembic | 1.13.1 | — | F-15 的签名不兼容与版本相关；F-16 的事务粒度是 alembic 默认行为，跨版本需复核 |
| 数据库 | 隔离容器 PostgreSQL 15（宿主 `:55432`，库 `aiear_m0004_test`） | CI postgres 服务容器 | 本审计结论不外推至任何共享/生产实例 |

### 4.2 DB 安全自检结论

| 检查项 | 结论 | 证据 |
|---|---|---|
| 全部 alembic 命令是否显式携带外部 ini | **是**，`-c C:/Users/hacjr/.aiear-m0004-temp-alembic.ini` 出现在 §1.4/§1.5 记录的每一条命令（current×5、upgrade 001、downgrade base、upgrade head、heads） | 本文 §1.4 命令原文 |
| 是否使用 `alembic.exe` | **否**（0 次） | 命令清单 |
| 是否使用仓库内 `backend/alembic.ini` | **否**（0 次；仓库文件未被读取或修改，`git diff` 为空） | §4.3 |
| 是否接触 `localhost:5432` 禁区实例 | **零接触**：无任何命令指向 :5432 端口；所有连接经外部 ini 落到宿主 **55432** | 命令清单 + 容器映射 `0.0.0.0:55432->5432/tcp` |
| 是否读取/打印凭据内容 | **否**：`C:/Users/hacjr/.aiear-m0004-testdb.env`、`C:/Users/hacjr/.aiear-m0004-temp-alembic.ini`、`backend/.env` 三者内容全程未被 cat/type/Get-Content；仅用 `ls -la` 确认外部 ini **存在**（未取内容） | 本任务命令记录 |
| 交付物是否含口令/凭据/内嵌凭据的连接串 | **否**：全文零凭据值、零内嵌口令的 URL 形态（对 Review 侧口令类与含凭据连接串类模式的检索命中数为 0）；仅出现不含凭据的库名 / 宿主端口 / 容器名 / ini 文件路径 | 本文全文 |
| 容器/卷增删与 prune | **零操作**：未 create/up/down/restart/rm/prune；`docker ps` 前后均显示 `aiear-m0004-pg-test Up` | §4.3 前后证据 |
| 是否触及生产库/既有业务库 | **否**，仅隔离审计库 `aiear_m0004_test`（专为此审计建立，不含任何用户/D 类数据） | §1.1 |

检索歧义提示（供 Review grep 时判读）：隔离库宿主端口 `55432` 含子串 `5432`；本文件所有 `5432` 命中要么是 `55432` 的一部分，要么是"零接触 :5432 禁区"的否定式表述，无任何命令以 :5432 为目标。

### 4.3 git 状态守护前后证据

| 项 | 执行前 | 执行后 | 判定 |
|---|---|---|---|
| `git rev-parse HEAD` | `c5546e199e144512e7ed30caf7d6e8c872ff4e23` | `c5546e199e144512e7ed30caf7d6e8c872ff4e23` | 不变 |
| `git branch --show-current` | `feature/m0-baseline` | `feature/m0-baseline` | 不变 |
| `git status --porcelain` | `?? docs/qgraphflow/dialogue-turn-sequence/` | `?? docs/qgraphflow/dialogue-turn-sequence/` | tracked 零改动；untracked 仅 pre-existing 目录（本文件写入后新增 `?? deliverables/baseline/DB_API_BASELINE.md`，属白名单产物；relaunch-3 spec 由 Workflow 写入，亦属白名单，非 Flash 产物） |
| `git diff --stat`（tracked） | 空 | 空 | 零改动 |
| untracked 指纹（`git hash-object`，禁 sha1sum） | `graph.json` = `e88c0295861951c58b55028eae611218e1f15089`；`index.html` = `cde38f82a5404a2dab46dbda86aa5e070545a676` | `graph.json` = `e88c0295861951c58b55028eae611218e1f15089`；`index.html` = `cde38f82a5404a2dab46dbda86aa5e070545a676` | 前后一致 |
| 既有两份 m0-004 spec（未改动，仅取指纹留痕） | `m0-004-db-api-baseline.spec.json` = `b2286e8467a395edafec8fbc5fa7fb85a1988530`；`...-c5546e1.spec.json` = `5e8bcb0879ede84c5fdecd552a8a311ac86b3b69` | 同上（本任务全程未写入这两个文件） | 未被覆盖/编辑 |
| `docker ps` 容器面 | `aiear-m0004-pg-test Up 5 hours`（:55432） | `aiear-m0004-pg-test Up 5 hours` | 无增删 |

### 4.4 命令形式合规自检（AC-08）

- 指纹：全部使用 `git hash-object`（0 次 `sha1sum`）。
- alembic：全部 `venv312/Scripts/python.exe -m alembic -c C:/Users/hacjr/.aiear-m0004-temp-alembic.ini <子命令>`（10 处命令记录均携带该外部 ini；0 次 `alembic.exe`、0 次仓库 ini）。
- pytest：`venv312/Scripts/python.exe -m pytest -q`（0 次系统 python、0 次 `-p no:cacheprovider` 之外的口径偏移；未使用 `--cov`，避免与基线 C5 覆盖率 run 混淆）。

### 4.5 Scope 自检

| 维度 | 声明 |
|---|---|
| 仓库写入 | 仅新建 `deliverables/baseline/DB_API_BASELINE.md`（EXPECTED_FILES 唯一项） |
| 禁区 | `backend/alembic/versions/*.py`、`backend/alembic.ini`、`backend/alembic/env.py`、`backend/app/**`、`backend/tests/**`、`frontend/**`、`docs/**`（含 `docs/api-reference.md`、`docs/qgraphflow/dialogue-turn-sequence/**`）、全部治理文件（`AGENTS.md`、`.qoder/rules/**`、`.qoder/workflows/**`、`.qoder/workflow-state/**`、`docs/workflow/**`、`.gitignore`、`.github/**`）**零改动** |
| 修复冲动回避 | F-15（002 签名）与 F-16（事务粒度）**只取证归因，未改任何代码**；F-01/C-3 文档差异只记录 |
| git 写操作 | 零（未 commit / 未 push）；封板由 Goal Orchestrator 按 §118 在 PASS 后执行 |
| 前端 / npm | 零触碰、零执行 |
| 医疗安全口径 | 本文件全部为工程事实描述，无诊断/处方/调机/疗效类表述；`item_bank` 种子文本仅为 B 类题库样例数据（且其迁移执行失败） |
