# M0-007 性能基线（PERF_BASELINE）

> Task: `m0-007-perf-baseline`（CATALOG_ID `M0-007`）· Type: baseline/audit · Mode: **READ_ONLY_AUDIT / ZERO_FIX**（只体检不治疗：本任务不修改任何测试、业务代码、阈值、采样数或 CI）
> 唯一交付物 = 本文件。唯一授权写入路径 = `deliverables/baseline/PERF_BASELINE.md`（`ALLOWED_WRITE_PATHS`）。
> 审计口径：分支 `feature/m0-baseline`，HEAD=`ac3b0ae94303a5cdf962e9295b3dcd6978e5df64`（任务前后未前进，零 commit）；`git status --porcelain` 起始仅 1 条 pre-existing 未跟踪目录 `docs/qgraphflow/dialogue-turn-sequence/`，本任务全程只读未触碰；`git diff --exit-code HEAD` exitCode=0（已跟踪文件零改动）。
> 医疗边界声明（强制）：本文出现的**全部**延迟/阈值/准确率数字均为**待验证的工程目标 / 产品规则**，不是医学规律、不是临床标准、不是诊断依据、不是疗效保证，与"听力恢复程度"无任何等价关系。详见 §5。
> **免责声明：本工具不提供医疗诊断与建议，请咨询您的听力师或医生。**
> 权限声明：实施者（qfmodel/Flash）自报 IMPLEMENTED，**无验收权**；Task PASS 由 Machine Gate（真实 exitCode）+ 独立 Review + Verify 决定。

---

## 0. 结论摘要

| 维度 | 结论 |
|---|---|
| 目标性能测试 | `tests/test_performance.py` 在 `backend/venv312` 下真实运行：**exitCode=0，7 passed in 0.67s**（本次真实读数，非 M0-002 历史留痕）。7/7 用例的中位数延迟均低于其代码内阈值 → **端点级阈值断言全部达标（工程口径）** |
| 三条业务链路（PRD §4.3） | **对话响应**：mock 口径形式达标（直读中位数 0.81–0.86ms ≪ 3s 目标），但真实 LLM 生成路径未覆盖 → 不可外推；**发音评分**：离线 DTW 计算在 mock 口径形式达标（最慢用例 0.01s ≪ 2s 目标），但"录音上传→评分"端到端未覆盖；**ASR 流式首包**：**无法判定**——仓库中不存在任何首包计时测试，且真实 dashscope 调用被禁止 → `SAFELY_NOT_EXECUTED_AND_RECORDED` + `missing_evidence` |
| 最高价值发现 | **PF-01（P1）：`test_metrics_performance` 的读数测的是 401 错误路径延迟**。根因 `_measure`（`tests/test_performance.py:40-47`）丢弃响应对象、不校验状态码。本次以只读插桩实测三次采样 `http_status=[401,401,401]` 而用例仍 PASSED ⇒ `/api/metrics` 的真实指标查询延迟**从未被任何测试度量**，与存量红 F-01（`test_middleware.py::test_metrics_endpoint_is_available` 断言 200 实得 401）互为印证 |
| 测量口径 | **进程内**：httpx `ASGITransport`（`tests/conftest.py:135-136`）+ `sqlite+aiosqlite://` 内存库（`tests/conftest.py:24`）+ `_MemoryRedis` 内存替身（`tests/conftest.py:190-221`）。**零网络、零真实服务**，读数**系统性低估**生产端到端延迟，禁止当作生产 SLA 依据（§4） |
| 采样强度 | `SAMPLE_COUNT=3`（`tests/test_performance.py:25`）+ 中位数断言，对机器负载敏感；本任务对该组读数做 **3 次独立采样**（1 次门禁原样 + 2 次只读插桩复跑），全部 7/7 PASSED，未见 flaky |
| 双真相（D1） | `GATE_HEALTH`：required 门禁 6 条**全部 exitCode=0**（§9）。`PROJECT_BASELINE_HEALTH`：**DEGRADED**——record 门禁全量 pytest `1 failed / 231 passed`（F-01 签名逐字复现）、ruff 全量 `291 errors`；均为存量、非本任务引入、本任务不修复（§8） |
| 依赖与写面 | 零新增依赖（未执行任何 pip/npm install；`backend/pyproject.toml`、`frontend/package.json`、lock 文件零 diff）；零 schema 变更、零迁移、零 API 变更、零前端改动；未触达宿主 `:5432`/`:6379`；未读取 `.env` |
| 缺陷计数 | 本任务新增 Finding **PF-01…PF-06**（§7，全部只记录不修复）；下游任务编号仅为**报告内建议**，`docs/workflow/TASK_CATALOG.md` 零改动 |

---

## 1. 环境事实（AC-08）

| 项 | 实测事实 | 取证方式 |
|---|---|---|
| 测试解释器 | `backend/venv312/Scripts/python.exe` → **Python 3.12.10** | G-INTERPRETER exitCode=0，输出 `Python 3.12.10` |
| pytest | **pytest 9.1.1**（`venv312/Scripts/python.exe -m pytest --version`） | 本次真实执行；插件 `anyio-4.15.1, asyncio-1.4.0, cov-7.1.0, timeout-2.4.0` |
| ruff | **ruff 0.16.8**（`venv312/Scripts/ruff.exe --version`） | 本次真实执行（与 M0-006 留痕同版本） |
| `backend/.venv` | **不存在**（`No such file or directory`） | 实测；与 M0-006 ENV-NOTES 一致，规则文档 `80-testing.md`/`AGENTS.md §9` 所称 `.venv` 为过期口径 |
| `backend/venv` | 存在但**无 pytest**（`ls venv/Scripts/` 仅 `pip/pip3.14/python/pythonw/activate*`，pytest 计数 = 0），误用即假失败 | 实测；引 M0-006 ENV-NOTES，本次复核仍成立 |
| 配置来源 | `rootdir: backend`，`configfile: pyproject.toml`，`asyncio: mode=Mode.AUTO`，`timeout: 30.0s` | pytest 头部输出原样 |
| 测试 DB | `sqlite+aiosqlite://`（`tests/conftest.py:24` `TEST_DATABASE_URL` 默认值，内存库） | 源码核对 + 运行实际生效 |
| Redis | `_MemoryRedis` 进程内替身，经 `sys.modules["redis"]/["redis.asyncio"]` 注入（`tests/conftest.py:190-230`） | 源码核对 |
| OS/时钟 | win32；`time.perf_counter`（`tests/test_performance.py:42,47`）单调计时 | 源码核对 |
| 安装动作 | **无**。本任务零 `pip/npm install`，`venv312` 站点包未新增（locust/k6 属 OPS-003） | AC-07；G-SCOPE exitCode=0 |

**Mock 形态与真实代码对齐（AC-11）**：外部 AI 依赖的 mock 形态是 `tests/conftest.py:235-249` 的 **autouse fixture `mock_external_tts(monkeypatch)`**（以 `unittest.mock.AsyncMock` 替换 `app.services.dialogue_orchestrator.tts_gateway.synthesize_to_url` 与 `app.ai.tts_gateway.QwenTTSGateway.synthesize_to_url`），叠加 `_MemoryRedis` 与 sqlite 内存库。**全仓 `grep MockGateway` = 0 命中**（无 `class MockGateway`），故仓库中不存在名为 `MockGateway` 的类；任务描述原文若出现该名称，与代码事实不符，本报告不采用该措辞。

---

## 2. 性能测试逐用例读数（AC-01）

### 2.1 门禁原样运行（G-PERF-TARGET，required，权威 exitCode）

命令：`cd backend && venv312/Scripts/python.exe -m pytest tests/test_performance.py -v -p no:cacheprovider`
结果：**exitCode=0，`7 passed in 0.67s`**，7 条 PASSED 逐行可见（`test_health_performance` / `test_root_performance` / `test_auth_login_performance` / `test_training_start_performance` / `test_dialogue_scenarios_performance` / `test_report_summary_performance` / `test_metrics_performance`）。

> **读数取得方法的如实说明**：`test_performance.py` 只把 `_measure` 的返回值喂给断言（`:59-60` 等），**本身不打印任何 ms 数值**，`-v` 输出亦不含逐用例延迟。为在不修改该文件（OUT_OF_SCOPE 明令禁止改 THRESHOLDS/SAMPLE_COUNT/断言强度）的前提下取得 AC-01 要求的 7 项中位数读数，本任务追加 **2 次只读插桩复跑**：以 pytest 插件（`pytest.main(..., plugins=[...])`，命令行进程序、**不写任何文件**）把模块级 `_measure` 包一层，**原值透传后返回**（断言语义与阈值判定完全不变），仅额外记录每次采样的 ms 与响应状态码。两次插桩运行结果均为 **exitCode=0 / 7 passed**（0.66s、0.63s），与 §2.1 同结论。该"测试自身不输出读数"的可观测性缺口本身记为 Finding **PF-02**。

### 2.2 逐用例中位数延迟（三次独立采样，SAMPLE_COUNT=3）

| # | 用例 | 端点 | 阈值（`:14-22`） | run#1 采样 raw_ms → 中位数 | run#2 采样 raw_ms → 中位数 | 阈值判定 | 状态码（run#2 插桩实测） |
|---|---|---|---|---|---|---|---|
| 1 | `test_health_performance` | `GET /health` | 50ms | `[2.82, 1.79, 1.61]` → **1.79ms** | `[3.00, 1.92, 1.70]` → **1.92ms** | 中位数 < 50ms → **达标** | `[200,200,200]` |
| 2 | `test_root_performance` | `GET /` | 50ms | `[1.99, 1.71, 1.60]` → **1.71ms** | `[1.93, 1.72, 1.66]` → **1.72ms** | 中位数 < 50ms → **达标** | `[200,200,200]` |
| 3 | `test_auth_login_performance` | `POST /api/auth/login` | 500ms | `[13.45, 4.09, 5.99]` → **5.99ms** | `[10.59, 4.04, 3.71]` → **4.04ms** | 中位数 < 500ms → **达标** | `[200,200,200]` |
| 4 | `test_training_start_performance` | `POST /api/training/sessions?level=syllable` | 500ms | `[9.79, 6.66, 5.95]` → **6.66ms** | `[9.60, 5.74, 7.07]` → **7.07ms** | 中位数 < 500ms → **达标** | `[200,200,200]` |
| 5 | `test_dialogue_scenarios_performance` | `GET /api/dialogue/scenarios` | 200ms | `[1.96, 0.81, 0.80]` → **0.81ms** | `[1.95, 0.85, 0.86]` → **0.86ms** | 中位数 < 200ms → **达标** | `[200,200,200]` |
| 6 | `test_report_summary_performance` | `GET /api/report/summary?days=30` | 500ms | `[18.72, 0.95, 0.84]` → **0.95ms** | `[17.86, 0.97, 0.83]` → **0.97ms** | 中位数 < 500ms → **达标** | `[200,200,200]` |
| 7 | `test_metrics_performance` | `GET /api/metrics` | 100ms | `[2.28, 1.86, 2.34]` → **2.28ms** | `[2.21, 1.76, 1.82]` → **1.82ms** | 中位数 < 100ms → **形式达标，但读数无效（见下）** | **`[401,401,401]`** |

汇总：required 门禁 **7 passed / exitCode=0 / 0.67s**；两次插桩复跑 **7 passed / exitCode=0 / 0.66s、0.63s**。首轮采样出现的 13.45ms / 18.72ms / 9.79ms 单点离群值均被中位数吸收（这正是 `SAMPLE_COUNT=3` + 中位数的设计意图，但同时意味着样本量偏小，见 PF-03）。

**用例 7 的读数无效（PF-01）**：`/api/metrics` 三次采样**全部返回 401**，而 `_measure`（`:40-47`）不消费响应对象、不校验状态码，故用例仍 PASSED。该 2.28/1.82ms 是"未认证被 FastAPI 依赖提前拒绝"的**错误路径**延迟，**不是**监控指标查询的真实延迟。401 根因链：`app/api/metrics.py:14-15` 的 `@router.get("/metrics")` 带 `Depends(get_current_user)`，而 `test_metrics_performance`（`:136-144`）传的是无认证 `client`。补充事实：即使带认证，`app/api/metrics.py:21-25` 还要求 `role == "therapist"`，而 `auth_token` fixture（`tests/conftest.py:148-154`）签发的是 `patient` 角色 → 该端点的真实数据路径在本测试体系内**从未被度量**。因此 `/api/metrics` 在 PRD/工程意义上属 **`missing_evidence`**，其"达标"不得被引用为性能结论。

---

## 3. 三条业务链路采样与工程目标对照（AC-02）

工程目标出处：`PRD_技术规格.md` §4.3（`:114-123`）——`:118` 语音识别流式首包 <500ms、`:119` AI 对话回复 <3 秒、`:120` 录音完成后发音评分 <2 秒（另 `:121` 首屏 <3 秒 Lighthouse、`:122` 100+ 并发、`:123` SLA 99.9%）。
采样源（G-LINK-SAMPLE，required）：`cd backend && venv312/Scripts/python.exe -m pytest tests/test_dialogue_service.py tests/test_dialogue_api.py tests/test_pronunciation.py tests/test_ai_gateways.py -q --durations=25 -p no:cacheprovider` → **exitCode=0，74 passed, 6 warnings in 0.79s**。

| 链路 | 工程目标（待验证） | 采样方法 | 样本口径 | 本次读数 | 达标结论 |
|---|---|---|---|---|---|
| **ASR 流式识别首包** | <500ms（`PRD:118`） | **无可用采样源**：`grep -rln "首包\|first_packet\|streaming_latency\|first_chunk" backend/tests` = 0 命中（仅 `app/ai/asr_gateway.py` 有流式实现）；真实 dashscope 调用被 `80-testing.md` 规则 5 与本任务 OUT_OF_SCOPE 禁止 | — | **无读取得到** | **不可判定（`SAFELY_NOT_EXECUTED_AND_RECORDED` + `missing_evidence`）**；不得声称达标 |
| **对话响应（AI 回复）** | <3s（`PRD:119`） | ① `test_performance.py` 直读 `dialogue_scenarios` 端点值；② G-LINK-SAMPLE `--durations` 用例级墙钟代理（含 fixture setup） | 进程内 ASGITransport；TTS 经 `mock_external_tts` AsyncMock 置空；LLM 对话链路走 mock，**不含真实模型生成耗时** | ① 0.81ms / 0.86ms；② 最慢 call：`test_dialogue_service.py::TestStartSession::test_start_session_success` 0.01s、`test_dialogue_api.py::...::test_handle_turn_nonexistent_session` 0.01s；单文件墙钟：service 9 passed/0.29s、api 8 passed/0.60s（`0.51s setup` 为一次性 app+DB 初始化，非链路耗时） | **mock 口径形式达标（≪3s）**；**真实网络 + 真实 LLM 口径不成立 → `missing_evidence`**，禁止外推为生产对话延迟 |
| **发音评分（录音完成后）** | <2s（`PRD:120`） | ① `--durations` 代理：`test_pronunciation.py` 49 passed/0.41s，最慢 call `TestEdgeCases::test_very_long_sequence` 0.01s；② 单文件复核 `venv312 ... tests/test_pronunciation.py -q --durations=3` → exitCode=0/49 passed/0.41s | 纯离线 DTW/拼音计算（`app/services/pronunciation_scorer.py`），无音频上传、无 ASR 真实识别；`test_rejects_excessively_long_sequences`（`tests/test_pronunciation.py:86`）是**长度拒收**功能用例，**不是**大数据量计时用例 | 0.01s（测试级墙钟上限代理） | **mock/离线口径形式达标（<2s）**；**"录音上传→ASR→DTW 评分"端到端与大数据量 DTW 耗时未覆盖 → `missing_evidence`** |
| （附）ASR/LLM/TTS 网关 | 目标表无单项 | `test_ai_gateways.py` 8 passed/0.38s，全部用例 call < 0.005s（`--durations` 隐藏阈值以下） | 网关在 mock/无凭据环境下走**可用性兜底分支**（如 `test_tts_gateway_returns_available_voices_without_provider` 0.01s teardown） | <5ms/用例 | **不代表真实网关调用延迟**（真实调用禁止执行，§6）；仅作"无凭据降级路径不阻塞"证据 |

**采样局限的强制声明**：`--durations` 是**测试级墙钟代理**（包含 fixture setup/teardown 与解释器开销），不是端点级/首包级精确计时；`test_performance.py` 的 ms 值是**被减去 ASGITransport 开销后的进程内单请求耗时**。两类读数**均不可**表述为生产端到端延迟，也**均不可**与临床/听力效果建立任何联系。

---

## 4. 测量口径声明（AC-03）

1. **进程内传输，非网络端到端**：`client` fixture（`tests/conftest.py:113-139`）以 `httpx.ASGITransport(app=app)` + `AsyncClient(base_url="http://test")` 直接在进程内调用 ASGI 应用。**零 TCP、零 TLS、零反序列化跨进程、零网关/负载均衡、零真实 DB 网络往返**（sqlite 为 `:memory:`，Redis 为 `_MemoryRedis` 字典）。因此 §2/§3 全部读数系统性**低于**真实生产端到端延迟，只能用于"同一代码库内部的相对回归"，不能用于 SLA/容量结论。
2. **`_measure` 不校验响应状态码**（`tests/test_performance.py:40-47`：`await client.get/post(...)` 的结果被直接丢弃，仅 `time.perf_counter()` 差值返回）。任何 4xx/5xx（含快速失败的 401/422）都会被计入"延迟"并参与中位数断言 → **错误路径延迟可伪装成性能达标**。本次实测坐实于 `/api/metrics`：`[401,401,401]` 且用例 PASSED（PF-01）。该盲区与存量红 **F-01**（`REPO_INVENTORY.md:184`，`test_middleware.py::test_metrics_endpoint_is_available` 断言 200 实得 401）指向**同一处鉴权口径疑点**，互为印证。
3. **阈值语义**：`THRESHOLDS`（`:14-22`）为端点级进程内阈值（health/root 50ms、auth_login/training_start/report_summary 500ms、dialogue_scenarios 200ms、metrics 100ms），与 PRD §4.3 的**业务链路目标**（首包 500ms / 对话 3s / 评分 2s）**不是同一套口径**，不可互相替代或换算。
4. **中位数 + SAMPLE_COUNT=3**（`:25`，`_median_ms :28-30`，`_assert_within_threshold :33-37` 用严格小于 `median < threshold`）：样本极小，对同机后台负载、杀毒/索引、Windows 调度抖动敏感；本任务静默机器下 3 次复跑一致通过，但历史 F-13 先例（`REPO_INVENTORY.md:196`）证明本项目存在运行级偶发，读数应视为**单次机器快照**。
5. **认证态差异**：`/health`、`/`、`/api/dialogue/scenarios`、`/api/metrics` 用例用无认证 `client`；`/api/auth/login` 用 `test_redis` 取内存验证码；`training_start`/`report_summary` 带 `auth_token`（patient 角色 JWT）。不同用例的**服务端工作深度不一致**（是否过依赖注入、是否落库、是否触发报告聚合），跨用例比较绝对值意义有限。
6. **插桩不改变判定**：§2.2 的 run#1/run#2 读数来自只读插桩（原值透传、断言不变、状态码仅旁路记录）；required 门禁的权威结论以 §2.1 原样命令 exitCode=0 为准。插桩 traceback 中曾出现由测试密钥签名的 fixture JWT，本报告**不摘录任何 token/Secret 值**（Secret 纪律）。

---

## 5. 工程指标与临床指标的分离声明（AC-05，不可协商）

- 本文所有延迟、阈值、采样数、通过/失败结论，**全部是软件工程意义上的性能读数**，属于"**待验证的工程目标 / 产品规则**"。
- 明确否认下列任何推论：
  - 本文的毫秒读数**不是**临床指标，**不是**医学规律，**不是**诊断依据，**不是**疗效证明；
  - 响应快慢、评分高低、`>85%` 识别准确率（`PRD_技术规格.md:21` 及 `TASK_CATALOG.md:154` 所载工程目标）与用户的**听力恢复程度无关**，禁止划等号；
  - 发音/训练得分偏低**不等于**医学异常，不构成任何病理化判断；
  - 性能达标**不保证**、也**不得表述为**任何康复效果。
- 措辞纪律：涉及训练建议时仅使用"建议练习 / 可能有助于"级别；禁止"治疗方案 / 临床处方 / 必然改善"类表述。
- **免责声明：本工具不提供医疗诊断与建议，请咨询您的听力师或医生。**

---

## 6. `SAFELY_NOT_EXECUTED_AND_RECORDED` 与缺失证据清单（AC-04）

以下项目**本任务未执行**，原因是安全/授权/规则禁止（非实现失败）。本文**不含**任何"已完成真实外部调用/已实测真实 API"的表述。

| 编号 | 未执行项 | 状态 | 原因 |
|---|---|---|---|
| NF-01 | 真实 dashscope / 阿里云 ASR·TTS·LLM 调用延迟组 | `SAFELY_NOT_EXECUTED_AND_RECORDED` | `80-testing.md` 规则 5（禁止测试消耗真实 API 配额）+ 本任务 OUT_OF_SCOPE；未获人工授权 |
| NF-02 | 真实网络端到端延迟（客户端→网关→服务→DB/Redis） | `SAFELY_NOT_EXECUTED_AND_RECORDED` | 需部署环境；本任务禁 docker/部署操作；进程内 ASGITransport 不可替代（§4.1） |
| NF-03 | ASR **流式首包**专项计时（PRD `:118` 的 <500ms 验证） | `missing_evidence` | 仓库无该测试（§3 grep 0 命中）；真实调用禁止 → 目标**完全未验证** |
| NF-04 | 发音评分 **DTW 大数据量**耗时（真实音频时长/词表规模） | `missing_evidence` | 无计时用例；`test_rejects_excessively_long_sequences` 为功能拒收用例，非性能用例 |
| NF-05 | 100+ 并发压测（PRD `:122`） | `SAFELY_NOT_EXECUTED_AND_RECORDED` | 属 **OPS-003**（`TASK_CATALOG.md:172`，依赖 M0-007）；locust/k6 属该任务引入，本任务禁止安装依赖 |
| NF-06 | 首屏加载 <3 秒 / Lighthouse（PRD `:121`） | `SAFELY_NOT_EXECUTED_AND_RECORDED` | 前端范畴，M0-007 不做前端改动与浏览器性能测试 |
| NF-07 | SLA 99.9% / 可用性监控告警验证（PRD `:123`） | `missing_evidence` | 需生产/长周期观测与看板；关联 **OBS-002**（`TASK_CATALOG.md:160`） |
| NF-08 | `/api/metrics` 真实数据路径延迟 | `missing_evidence` | 唯一相关用例的读数落在 401 错误路径（PF-01）；therapist 角色 + 真实指标聚合路径未被任何计时测试覆盖 |
| NF-09 | postgres / redis 真实后端的延迟对照 | `SAFELY_NOT_EXECUTED_AND_RECORDED` | 宿主 `:5432` 身份不可证明安全（`UNKNOWN_DATABASE_INSTANCE`，M0-002 NB-01 / M0-006 口径），`BLOCKED_UNSAFE_DATABASE_TARGET` 纪律禁触达；本任务全程 sqlite 内存 + `_MemoryRedis` |

---

## 7. Findings、根因归类与下游任务建议（AC-10；仅建议，不实施）

| 编号 | 级别 | 现象 | 根因归类 | 处置建议（**仅报告内建议，未写入治理文件**） |
|---|---|---|---|---|
| **PF-01** | **P1** | `test_metrics_performance` 以 `[401,401,401]` 的错误路径延迟通过 100ms 阈值断言；`/api/metrics` 真实延迟从未被度量 | **测量口径缺陷**：`_measure:40-47` 不校验状态码 + **端点鉴权/角色口径疑点**（`app/api/metrics.py:14-15,21-25`；测试 fixture 仅 patient 角色） | 与 **F-01/CT-1** 合并清偿（鉴权口径决策 → 建议归 **M0-002 系 FIX-\*/SEC 后续任务**，即 `TASK_CATALOG.md:184` F-01 既有处置路径 + **OBS-002** 指标面）；性能面新增计时用例（therapist 认证 + 200 响应校验）。本任务**未实施** |
| **PF-02** | P2 | 性能测试自身不输出任何读数，`-v` 仅给 PASSED，审计必须靠外部插桩才能取证 | **可观测性缺口**：无 print/JSON/报告器，读数只进断言即丢弃 | 建议 **OBS-002** 或新 `FIX-PERF-01`（建议新增·待落库）：让性能用例导出逐用例 raw/median ms（**不得降低断言强度**），使 required 门禁一条命令即可取证 |
| **PF-03** | P2 | `SAMPLE_COUNT=3` + 中位数：首轮出现 18.72ms/13.45ms/9.79ms 单点离群；样本量不足以支撑 P95/P99 判断 | **采样强度不足**（噪声敏感，历史 F-13 先例证明确有偶发） | 建议 **OPS-003**（`TASK_CATALOG.md:172`）以压测工具产出分位数；本任务**禁止**改 SAMPLE_COUNT（阈值/采样数篡改 = TASK_FAIL） |
| **PF-04** | P1 | 进程内口径读数被误读为生产延迟的风险（本报告已加声明，但读数本身易被下游文档摘走） | **口径混用**：ASGITransport + sqlite 内存 + `_MemoryRedis`，零网络 | 建议下游文档一律带"进程内口径"限定；真实端到端属 **OPS-003 / NF-02** |
| **PF-05** | P1 | ASR 流式首包（PRD `:118`）**零验证**，`>85%` 准确率目标亦无计时/评测脚本 | **专项测试缺失** + 真实调用需人工授权与配额 | 建议 **EVAL-001**（`TASK_CATALOG.md:154`，依赖 M0-007）承接；真实外呼需人工授权后再排期 |
| **PF-06** | P2 | 发音评分端到端（录音上传→ASR→DTW）与大数据量 DTW 无耗时覆盖（PRD `:120`） | **链路覆盖缺失**：现有用例为离线纯计算功能测试 | 建议 **EVAL-002**（`TASK_CATALOG.md:155`）+ 新 `FIX-PERF-02`（建议新增·待落库：端到端评分耗时用例） |

> 说明：上述编号凡标注"目录既有"者仅指认归属，本任务**未**修改 `docs/workflow/TASK_CATALOG.md`（治理文件，写入需人工 HD-N-04）；凡标"建议新增·待落库"者为目录未占用编号，仅为建议。

---

## 8. 存量红分列（AC-12，双真相之 `PROJECT_BASELINE_HEALTH`）

以下红色为**存量、非本任务引入、本任务不修复**（OUT_OF_SCOPE 明令"仅如实分列记录"）。

| 项 | 命令（record 门禁，本次真实执行） | exitCode | 本次读数 | 存量对照 | 签名一致性 |
|---|---|---|---|---|---|
| 全量后端 pytest | `cd backend && venv312/Scripts/python.exe -m pytest -q -p no:cacheprovider` | **1** | **`1 failed, 231 passed, 33 warnings in 2.14s`** | `REPO_INVENTORY.md:113` / `BACKEND_TEST_BASELINE.md:78`(C4) = 1 failed / 231 passed / 33 warnings（2.11s） | **完全一致**：`tests/test_middleware.py::test_metrics_endpoint_is_available`，`assert 401 == 200`（`tests/test_middleware.py:34`）= **F-01**（`REPO_INVENTORY.md:184`）。本次**无** F-01 之外的新失败签名；F-13（`test_adaptive_engine.py::test_full_adaptive_session` 偶发）本次**未复现**（属偶发，`REPO_INVENTORY.md:196`） |
| ruff 全量 | `cd backend && venv312/Scripts/ruff.exe check app/` | **1** | **`Found 291 errors.`（199 fixable，11 hidden unsafe-fixes）** | `BACKEND_TEST_BASELINE.md:81`(C7) = 291 errors（199 fixable） | 逐字一致，零增量（对照 `ruff check app/ --select E,F,W --ignore E501` = All checks passed!，即 CI 基线口径仍绿，全量口径为存量债） |
| 前端测试/构建/类型 | 未重跑 | — | — | M0-003 `FRONTEND_BASELINE.md` | 见 §10 skippedGates |

---

## 9. Machine Gate 结果汇总（本任务执行记录）

| gateId | kind | 命令 | exitCode | 真实输出要点 |
|---|---|---|---|---|
| G-INTERPRETER | required | `cd backend && venv312/Scripts/python.exe --version` | **0** | `Python 3.12.10` |
| G-PERF-TARGET | required | `cd backend && venv312/Scripts/python.exe -m pytest tests/test_performance.py -v -p no:cacheprovider` | **0** | `7 passed in 0.67s`（7 条 PASSED 逐用例可见） |
| G-LINK-SAMPLE | required | `cd backend && venv312/Scripts/python.exe -m pytest tests/test_dialogue_service.py tests/test_dialogue_api.py tests/test_pronunciation.py tests/test_ai_gateways.py -q --durations=25 -p no:cacheprovider` | **0** | `74 passed, 6 warnings in 0.79s` + `slowest 25 durations` 表（§3 引用） |
| G-MEDICAL-SAFETY | required | `cd backend && venv312/Scripts/python.exe -m pytest tests/test_safety.py -q -p no:cacheprovider` | **0** | **`1 passed`**（0.23s；`-v` 复核：`test_safety_matching_is_case_insensitive_and_returns_the_matched_keyword` PASSED，0.27s）——`app/core/safety.py` 关键词拦截既有回归通过。覆盖度警示：该"回归"仅 **1 条**关键词用例，医疗安全评测集缺失已由 M0-006 **SB-20** 记账，本任务不新增测试（OUT_OF_SCOPE） |
| G-DELIVERABLE | required | `test -f deliverables/baseline/PERF_BASELINE.md` | **0** | 本文件存在（唯一新增产物） |
| G-SCOPE | required | `git diff --exit-code HEAD` | **0** | 全部已跟踪文件零改动（backend/frontend/.github/docs/workflow/治理文件/pyproject/既有 6 份基线文档均未触碰） |
| G-BASE-PYTEST | record | `cd backend && venv312/Scripts/python.exe -m pytest -q -p no:cacheprovider` | **1** | `1 failed, 231 passed, 33 warnings in 2.14s`（F-01 存量，§8） |
| G-BASE-RUFF | record | `cd backend && venv312/Scripts/ruff.exe check app/` | **1** | `Found 291 errors.`（存量，§8） |

`GATE_HEALTH` = 由 required 门禁决定 → 6/6 exitCode=0；`PROJECT_BASELINE_HEALTH` = **DEGRADED**（两条 record 门禁为存量红）。二者分列，互不掩盖（D1 双真相）。

**辅助取证运行（非门禁，只读，exitCode 均为 0）**：`tests/test_performance.py` 插桩复跑 ×2（0.66s / 0.63s，均 7 passed）；四链路单文件复跑（dialogue_service 9p/0.29s、dialogue_api 8p/0.60s、pronunciation 49p/0.41s、ai_gateways 8p/0.38s）；`test_safety.py -v`。一次性踩坑留痕：首次插桩因**我方**闭包晚绑定（同模块被逐 item 重复打补丁）触发 `RecursionError` 致 7 failed——该红色属审计工具缺陷，**未触碰仓库任何文件**，修正后复跑 7 passed；同 traceback 中的 fixture JWT 未被本文摘录。全程零真实外呼、零宿主 `:5432`/`:6379` 连接、零安装动作、零破坏性 git 操作。

---

## 10. skippedGates（90-quality-gates 口径，附正当性）

| 跳过项 | 理由 |
|---|---|
| 集成测试三连（`test_integration.py`/`test_training_api.py`/`test_role_permissions.py`） | 本任务**代码零改动**（G-SCOPE exitCode=0），M0-005 集成基线（`INTEGRATION_BASELINE.md`）与 M0-006 双口径留痕仍为当前有效证据；重跑不产生新事实，且 postgres 口径受 `:5432` 禁触达约束 |
| 前端 `npx tsc --noEmit` / `npm test -- --run` / `npm run build` / `npm run test:e2e` | `frontend/**` 零改动；M0-003 前端基线为当前证据；Lighthouse 首屏属前端性能专项（NF-06，PRD `:121`） |
| Alembic `upgrade head → downgrade -1 → upgrade head` | `MIGRATION_REQUIREMENTS` = 零 schema 变更；且无安全目标库（宿主 `:5432` 身份不可证明安全 → `BLOCKED_UNSAFE_DATABASE_TARGET` 纪律） |
| `docker compose build` | 属 M0-008 部署基线；本任务 OUT_OF_SCOPE 禁 docker 操作 |
| 100 并发压测 / locust、k6 | 属 OPS-003；本任务禁止新增依赖（AC-07） |
| 真实 dashscope/阿里云延迟组 | NF-01（`80-testing.md` 规则 5 + 未获人工授权） |

---

## 11. 数据与安全口径

- **数据库**：零连接、零写入、零迁移。全部采样在 `sqlite+aiosqlite://` 内存库（`tests/conftest.py:24`）与 `_MemoryRedis`（`:190-221`）内进行。宿主 `:5432`/`:6379` 全程零探测。
- **Secret**：未读取 `backend/.env` 与根 `.env`；未输出任何凭据、token、密钥值；插桩 traceback 中的测试 fixture JWT 已主动排除于本文。
- **隐私（D 类）**：零真实用户数据。文中出现的 `13800138000` / `13900139000` 为 conftest 既有合成测试号码（公开测试数据，`tests/conftest.py:153,162`）。
- **医疗边界**：见 §5；本文不产生任何诊断、处方、调机参数、疗效保证类输出。
- **Git**：零 commit、零 push、零破坏性操作；HEAD 保持 `ac3b0ae`；`docs/qgraphflow/dialogue-turn-sequence/` 未跟踪树单元**未被读取或写入**，身份由 Workflow D4 取证比对。

## 12. 回滚

本任务唯一文件系统副作用 = 新增本文件（未跟踪）。回滚 = 删除 `deliverables/baseline/PERF_BASELINE.md` 即可 100% 恢复任务前状态；`git diff --exit-code HEAD` 前后均为 exitCode=0 可证，无任何不可逆操作。
