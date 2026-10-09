# M0-006 安全基线审查（SECURITY_BASELINE · 重跑）

> Task: `M0-006-security-baseline` · Type: baseline/audit · Mode: **READ_ONLY_REVIEW / ZERO_FIX**（只体检不治疗，本任务不修复任何缺陷）
> 唯一交付物 = 本文件。唯一授权写入路径 = `deliverables/baseline/SECURITY_BASELINE.md`（`ALLOWED_WRITE_PATHS`）。
> 审查口径：HEAD=`506f5ee`，分支 `feature/m0-baseline`（非 main/master，dirty-main guard 不触发）；`git status --porcelain` 起始与结束时均恰 2 条 pre-existing untracked（`deliverables/baseline/SECURITY_BASELINE.md` 本任务覆写对象、`docs/qgraphflow/dialogue-turn-sequence/`），本任务未触碰第二项；`git diff --quiet HEAD` 成立（tracked 零改动）。
> 代码基线不变性取证：`git diff --stat 1a62703..HEAD -- backend/app backend/tests backend/scripts` **空输出** ⇒ 自上一版报告（HEAD=`1a62703`）以来后端源码/测试零变更，故旧版全部 `文件:行号` 证据在本 HEAD 逐条复核成立；本次对 37 个装饰器、认证依赖、缓存中间件、conftest、CI、部署面逐一重跑核对（见 §10.2 命令留痕）。
> 环境口径：测试解释器 `backend/venv312/Scripts/python.exe`（Python 3.12.10 / pytest 9.1.1 / ruff 0.16.8）；规则文档所称 `backend/.venv` **不存在**（实测 `No such file`），`backend/venv` 存在但**无 pytest**，禁用。
> Secret 纪律：本文件**不含任何 Secret 真实值**，仅出现变量名与 `文件:行号` 位置；`backend/.env` 与根 `.env` 全程**未被读取**；`config.py:41` 内嵌口令、`ci.yml`/`conftest.py` 测试密钥字面量均**以行号引用、不摘录值**。
> 引用规范：下文 `文件:行号` 均为本任务实际读取/检索所得；`api/` = `backend/app/api/`，`core/` = `backend/app/core/`，`tests/` = `backend/tests/`。
> 权限声明：实施者（qfmodel/Flash）自报 IMPLEMENTED，**无验收权**；Task PASS 由 Machine Gate（真实 exitCode）+ 独立 Review（HIGH Risk = A+B 双审）+ Verify 决定。

---

## 0. 结论摘要

| 维度 | 结论 |
|---|---|
| 端点总量 | **37 个路由装饰器**（8 个路由模块，与 `grep -rhoE "@router\.(get\|post\|put\|delete\|patch)\b" backend/app/api \| wc -l` = 37 一致；auth=5/dialogue=4/hardware=9/health=2/metrics=3/pronunciation=4/report=4/training=6，见 §1.1）；矩阵 §1.2 = **37 行，全量非抽样** |
| 认证覆盖 | 37 端点中 **31 个**带认证依赖、**6 个无认证**（31+6=37，与 §1.2 矩阵逐行标注可对账）。拆分口径：`Depends(get_current_user)` 在**端点模块**内共 **30** 处（逐模块 `grep -c` 实测 auth=2 / dialogue=3 / hardware=9 / metrics=3 / pronunciation=4 / report=3 / training=6），另有 **1** 处 `Depends(get_current_therapist)`（`api/report.py:60`，定义 `api/deps.py:55-63`）= **31**；`deps.py` 内部对 `get_current_user` 的自引用（`:56`，属依赖定义而非端点）**不计入**。6 个无认证中 **4 个属设计意图**（#1/#2 登录前、#12 公开内容、#33 LB 探活），**2 个属需处置缺口**：`POST /api/auth/logout`（`api/auth.py:116`）、`GET /health/detailed`（`api/health.py:30`） |
| 归属校验 | 数据面（training/dialogue/pronunciation/report 自有数据）**逐条有归属校验或天然按 `current_user.id` 取数**（Services/API 层 `current_user.id` 取数比对共 **30 处**，见 §2.2）；**硬件面 9 个端点全部无归属/无角色校验**；`report/patients` 存在 therapist 横向越权（无医患绑定模型） |
| 最高危发现 | **跨用户响应缓存泄露（§1.2 行 20/21 + §9 SB-01，P0）**：`ResponseCacheMiddleware._make_cache_key`（`middleware/performance.py:111-131`）缓存 key = `path + query_params`，**仅当存在 `Authorization: Bearer` 头时**才追加 `user_id`；浏览器主用 httpOnly Cookie（无 Authorization 头，`deps.py:19-20`）→ 用户 A 的健康报告可被直接命中返回给用户 B |
| 安全测试真实性（双口径分层，见 §6） | **sqlite 本地口径本次真实运行 10 passed / exit 0（到达断言层）**；**postgres/CI 同款口径本次真实运行 4 failed / 8 passed / 20 errors / exit 1**，逐位复现 F-M0005-02（asyncpg `another operation is in progress`，根因 `tests/conftest.py:53-100` session-scoped engine）。**F-M0005-01（P0 验证缺口）：13 条依赖 DB 的 RBAC/IDOR 安全用例在 postgres 口径从未到达断言层 → 该口径下安全"验证不成立"**，清偿依赖 **FIX-INT-01**。RBAC/IDOR 结论**仅在 sqlite 口径成立**（§6.3 防混同声明） |
| CI 有效性 | `.github/workflows/ci.yml:5,7` 触发分支为 `main`/`develop`，而仓库实际主分支为 `master`（`git branch -a` 实测 `master`、`remotes/origin/master`，**无 `main`**；`10-project.md` 声明 master）→ CI（含 `ci.yml:103` 后端 postgres 集成安全 job）在主分支从未触发（§6.4、§9 SB-03，P0） |
| 医疗边界 | 违禁文案 grep（诊断/处方/剂量/调机/疗效保证类）**未发现面向用户的违规输出**（§8.1 附命令与命中判定）；但**急症/心理危机转诊路径、高危拒答模板、Risk Taxonomy/Query Classifier、安全事件审计缺失**属医疗安全能力缺口，按 70-medical-safety.md 记 P0（§8.2）；医疗安全回归仅 `tests/test_safety.py` **1 条**关键词用例（评测集缺失记 SB-20） |
| 数据库接触 | 安全回归三件套跑 sqlite+aiosqlite 默认口径（`conftest.py:24`），未触任何真实库；postgres 口径 record 三连仅连接**本任务一次性自建隔离实例** `postgres:16-alpine @127.0.0.1:55433`（容器 `aiear-m0006-pg`，用后 `docker rm -f` 已清理）；宿主 `:5432` **全程零连接、零探测**（§10.1） |
| Secret 扫描口径 | 三类口径分列（§3.2）：① 门禁（仅对交付物反向匹配）② 全仓已跟踪文件（含 YAML `${env.X}`、无引号形态）③ 被忽略/未跟踪文件。②③ 均未发现真实凭据字面量；`.env` 本体存在且被忽略、**内容未读取**（H-3 交人工）。`config.py:41` 默认串内嵌口令 → SB-19（P1） |
| 环境暴露面（NB-01 续证） | 本任务未重跑 `netstat`（依 DATABASE_IMPACT"零探测宿主 :5432"更严格口径，改以引用 M0-002 NB-01 既有留痕）；`:5432` 身份未知监听维持 `UNKNOWN_DATABASE_INSTANCE`，`core/config.py:41` 默认值正指向 `localhost:5432` → SB-28（P1） |
| 缺陷计数 | **P0 × 7（SB-01…SB-06 + SB-31）、P1 × 17（SB-07…SB-20 + SB-28/SB-32/SB-35）、P2 × 11（SB-21…SB-27 + SB-29/SB-30/SB-33/SB-34）= 35 条**（§9，全部只记录不修复；后续任务编号仅为**建议**，未写入 `docs/workflow/TASK_CATALOG.md`。AC-08 编号复核结论（本轮按 Review blocker 二次校正后）：建议编号与目录既有编号**无 ID 重复**，凡标"目录既有"者其建议 Scope 与目录条目原生语义一致，新工作项一律用目录确未占用编号并标"建议新增·待落库"；复核方式与两处改判见 §9 注 / §11.1 第 4 条） |
| 需人工/云外核验 | **14 项**列于 §12（本任务口径内不可判定，一律标 `missing_evidence`，不得计入"已验证通过"） |
| 双真相 | `GATE_HEALTH` = 由 required 门禁决定（本任务 required 全部 exitCode=0，见 §10.3）；`PROJECT_BASELINE_HEALTH` = **DEGRADED**（record 门禁：全量 pytest 1f/231p、ruff 全量 291 errors、postgres 三连 4f/8p/20e，均为既有存量红，非本任务引入，见 §10.4） |

---

## 1. 端点 × 认证 × 归属校验全量矩阵

### 1.1 计数核对（AC-02 硬判据）

命令（仓库根执行）与本任务实测输出：

```
$ grep -rhoE "@router\.(get|post|put|delete|patch)\b" backend/app/api | wc -l
37
$ 逐模块（grep -cE 同上，backend/app/api/<mod>.py）：
auth=5  dialogue=4  hardware=9  health=2  metrics=3  pronunciation=4  report=4  training=6
```

合计 **5+4+9+2+3+4+4+6 = 37**。
→ **§1.2 矩阵行数 = 37 = 装饰器总数**，逐装饰器入表，无抽样；与 SPEC 冻结值 37 一致（对应 required 门禁 G-API-DECORATOR-COUNT-37）。

路由前缀装配证据：`app/main.py:124-131`（health 无前缀、metrics 前缀 `/api`、其余 7 个模块分别 `/api/auth`、`/api/training`、`/api/dialogue`、`/api/pronunciation`、`/api/report`、`/api/hardware`）。
认证依赖定义：`app/api/deps.py:9`（`get_current_user`）、`deps.py:55-63`（`get_current_therapist`，role 判定取自 **DB 用户对象** `current_user.role`（`:58`）而非可伪造的 token 声明，正向事实）。
凭据来源：`deps.py:15-20` —— 先 `Authorization: Bearer <token>`，**回退 httpOnly Cookie `access_token`**（`:19-20`；决策依据 `20-architecture.md` 冻结决策 5）。此回退是 §9 SB-01 缓存型 IDOR 的成因之一。

### 1.2 全量矩阵（37 行）

图例：认证 = `有(依赖行号)` / `无`；归属 = `有(证据行号)` / `无` / `不适用(NA)`；IDOR 风险 = `否` / `是` / `间接是`。行号为文件内绝对行号。

| # | 模块 | 完整路径 | 方法 | 装饰器行 | 认证依赖 | Service/路由层归属校验 | IDOR | 备注 |
|---|---|---|---|---|---|---|---|---|
| 1 | auth | /api/auth/sms/send | POST | `api/auth.py:76` | 无（`:77` 仅 phone+db） | NA（登录前） | 否 | 匿名可触发短信；限流按 IP `middleware/performance.py:139`（5/60s） |
| 2 | auth | /api/auth/login | POST | `:84` | 无（`:85`） | NA | 否 | 失败锁定 `_check_login_rate_limit` `:23`（5 次/15 分钟） |
| 3 | auth | /api/auth/logout | POST | `:116` | **无（`:117`）** | 无（仅清 Cookie） | 否 | 登出不需身份、无服务端吊销 → SB-09 |
| 4 | auth | /api/auth/me | GET | `:129` | 有 `:130` | NA（自身数据 `:131-144`） | 否 | 返回全量 `phone` `:136`、`birth_year` `:139`、`cochlear_info` `:140`、`consent_flags` `:141` → SB-16 |
| 5 | auth | /api/auth/users/me/preferences | PUT | `:147` | 有 `:150` | 有 `services/auth_service.py:97-105`（写 current_user 对象） | 否 | 路径含双层 me（`/api/auth` + `/users/me/...`） |
| 6 | training | /api/training/sessions | POST | `:32`（路径 `:33`） | 有 `:41` | 有 `:45` `start_session(current_user.id, level)` | 否 | 业务参数走 Query（`:37` level）→ SB-18 |
| 7 | training | /api/training/sessions/{id}/next | GET | `:59`（`:60`） | 有 `:68` | 有 `:73`（`_check_session_ownership` 定义 `:15-17`） | 否 | — |
| 8 | training | /api/training/sessions/{id}/answer | POST | `:83`（`:84`） | 有 `:95` | 有 `:100` | 否 | `item_id/answer/response_ms` 走 Query → SB-18 |
| 9 | training | /api/training/sessions/{id}/finish | POST | `:106`（`:107`） | 有 `:115` | 有 `:120` | 否 | — |
| 10 | training | /api/training/adaptive/recommendation | GET | `:126`（`:127`） | 有 `:136` | 有 `:154`（`user_id=current_user.id`） | 否 | BKT 推荐天然按用户 |
| 11 | training | /api/training/adaptive/submit | POST | `:166`（`:167`） | 有 `:175` | 有 `:192` | 否 | Body 传参（正例） |
| 12 | dialogue | /api/dialogue/scenarios | GET | `:36` | 无（`:37`，**公开**） | NA | 否 | 回归断言公开性 `tests/test_role_permissions.py:82`；B 类场景内容 |
| 13 | dialogue | /api/dialogue/sessions | POST | `:45` | 有 `:49` | 有 `:55` | 否 | — |
| 14 | dialogue | /api/dialogue/sessions/{id}/turn | POST | `:64` | 有 `:69` | 有 `:89`（`session.user_id != current_user.id` → 403） | 否 | 音频上限 10MB |
| 15 | dialogue | /api/dialogue/sessions/{id}/finish | POST | `:101` | 有 `:105` | 有 `:112` | 否 | — |
| 16 | pronunciation | /api/pronunciation/tasks/next | GET | `:24` | 有 `:27` | 有 `:31`（`current_user.id`） | 否 | — |
| 17 | pronunciation | /api/pronunciation/attempts | POST | `:35` | 有 `:41` | 有 `:63-68`（`user_id=current_user.id`） | 否 | 录音**无体积/类型上限**；限流规则路径失配（§4 G-12）→ SB-13/SB-27 |
| 18 | pronunciation | /api/pronunciation/attempts | GET | `:72` | 有 `:77` | 有 `:81` | 否 | limit 有界（`Query(20, ge=1, le=100)`） |
| 19 | pronunciation | /api/pronunciation/stats | GET | `:85` | 有 `:88` | 有 `:92` | 否 | — |
| 20 | report | /api/report/summary | GET | `api/report.py:19` | 有 `:23` | 有 `:38`（`current_user.id`） | **间接是** | 响应被跨用户缓存：`middleware/performance.py:47` + `:111-131` → **SB-01 P0** |
| 21 | report | /api/report/levels | GET | `:42` | 有 `:45` | 有 `:49` | **间接是** | 同上，`performance.py:48` |
| 22 | report | /api/report/patients | GET | `:57` | 有（therapist）`:60` → `deps.py:55-63` | **无**：`services/patient_service.py:21-25` 取**全部** role=patient 用户，`therapist_id` 未参与过滤 | **是** | therapist 横向越权 + 返回 phone `:150` → SB-07 |
| 23 | report | /api/report/weekly | GET | `:82` | 有 `:85` | 有 `:99` | 否 | 周报文案为训练统计（§8 已抽查） |
| 24 | hardware | /api/hardware/devices | GET | `api/hardware.py:65` | 有 `:67` | **无**（全局 `device_manager` 单例） | **是** | 设备与用户无绑定模型 → SB-06 |
| 25 | hardware | /api/hardware/devices/{device_id} | GET | `:82` | 有 `:85` | **无**（仅存在性判断） | **是** | SB-06 |
| 26 | hardware | /api/hardware/devices/{device_id}/connect | POST | `:103` | 有 `:106` | **无** | **是** | 可连接他人设备 |
| 27 | hardware | /api/hardware/devices/{device_id}/disconnect | POST | `:124` | 有 `:127` | **无** | **是** | 可断连他人设备（可用性影响） |
| 28 | hardware | /api/hardware/devices/{device_id}/command | POST | `:147` | 有 `:151` | **无** | **是** | 执行器任意控制；`params: dict[str,Any]` 无约束 |
| 29 | hardware | /api/hardware/devices/{device_id}/led | POST | `:198` | 有 `:202` | **无** | **是** | `duration_ms` 无 range 校验（`:54`） |
| 30 | hardware | /api/hardware/devices/{device_id}/buzzer | POST | `:219` | 有 `:223` | **无** | **是** | `frequency_hz/duration_ms` 无 range 校验（`:59-60`）→ SB-06 |
| 31 | hardware | /api/hardware/training-event | POST | `:241` | 有 `:244` | **无**（`device_id` 空=广播所有设备） | **是** | 任意用户可广播反馈事件 |
| 32 | hardware | /api/hardware/ws-info | GET | `:280` | 有 `:281` | NA | 否 | 返回内部 host/port/path → SB-17 |
| 33 | health | /health | GET | `api/health.py:14` | 无（`:15`，LB/Docker 探活设计） | NA | 否 | 仅版本/服务名 |
| 34 | health | /health/detailed | GET | `:30` | **无（`:31`）** | NA | 否 | **未认证回显异常原文** `:58`、`:66`、`:81`（`f"...{str(e)}"`）→ SB-12 |
| 35 | metrics | /api/metrics | GET | `api/metrics.py:14` | 有 `:15` + 角色内联 `:21-25` | NA（全局指标） | 否 | 唯一回归断言为红（F-01）→ SB-20 |
| 36 | metrics | /api/metrics/ai-latency | GET | `:30` | 有 `:31` + `:37-41` | NA | 否 | 角色检查重复实现（未复用 `deps.py:55`）→ SB-11 |
| 37 | metrics | /api/metrics/errors | GET | `:66` | 有 `:69` + `:74-78` | NA | 否 | `limit: int = 20` 无上限校验（`:68`）→ SB-17 |

### 1.3 缺失者与 IDOR 风险小结

- **认证缺失（6）**：#1、#2（登录前，合理）、#3（**缺陷 SB-09**）、#12（公开内容，回归已固化）、#33（探活，合理）、#34（**缺陷 SB-12**）；即 4 个设计意图 + 2 个需处置缺口，与 §0「认证覆盖」行同口径。
- **归属/授权缺失（11）**：#22（therapist 无绑定过滤，**SB-07**）、#24–#31（硬件 8 个可操作/查询端点，**SB-06**）、#20/#21（代码层归属正确但被中间件缓存旁路，**SB-01**）；#32（ws-info）归属记 NA，不计入。
- **正向事实（须保留，不得回归）**：#7/#8/#9/#14/#15 显式归属校验（`training.py:15-17`、`dialogue.py:89/:112`）；#6/#10/#11/#13/#16–#19/#23 天然按 `current_user.id` 取数；`role` 一律取 DB 对象（`deps.py:58`）。
- 硬件面属既有实验代码（`10-project.md` 硬件非 MVP），但 **9 个端点已在 `main.py:131` 实际挂载对外可用**，故仍按可达攻击面记录，不因"非 MVP"豁免。

---

## 2. RBAC 测试覆盖面对照（`backend/tests/test_role_permissions.py`，87 行 7 例）

### 2.1 用例矩阵（实测 7 例：`:17`、`:22`、`:34`、`:52`、`:63`、`:74`、`:82`；角色仅 patient/therapist）

| 用例 | 断言面 | 覆盖端点（矩阵行号） | 口径备注 |
|---|---|---|---|
| `test_patients_requires_auth`（`:17`） | 401 未认证 | #22 | 两口径均到断言层（不触 DB） |
| `test_patients_rejects_normal_user`（`:22`） | 403 + `detail.code==40301` | #22 | **postgres 口径未达断言层**（§6.2） |
| `test_patients_allows_therapist`（`:34`） | 200 therapist | #22 | postgres 口径未达断言层 |
| `test_report_summary_allows_user`（`:52`） | 200 自有报告 | #20 | postgres 口径未达断言层 |
| `test_report_summary_allows_therapist`（`:63`） | 200 | #20 | 同上 |
| `test_training_requires_auth`（`:74`） | 401 | #6 | 两口径到断言层 |
| `test_dialogue_scenarios_public`（`:82`） | 公开端点 200 | #12 | call PASSED / **teardown ERROR**（postgres） |

角色夹具来源：`conftest.py` 用户 fixture（sub=1 role=patient、sub=2 role=therapist）；注意 `api/deps.py:58` 角色取 DB 对象而非 token（正向），`models/user.py:11` 默认 role=`patient`。

### 2.2 归属校验断言分布盘点

Services/API 层按用户取数/比对（`current_user.id` 或 `user_id=`）实测 **30 处**（`grep -rn "current_user.id" backend/app/api` + Services 层 `user_id` 比对去噪计数）。散布于 `api/training.py:45/:73/:100/:120/:154/:192`、`api/dialogue.py:55/:89/:112`、`api/report.py:38/:49/:99`、`api/pronunciation.py:31/:64/:81/:92` 等。

### 2.3 未被任何 RBAC 测试覆盖的端点（按模块）

| 模块 | 未覆盖端点 | 交叉证据 |
|---|---|---|
| hardware（9/9 缺失） | #24–#32 全部 | `grep -rl "/api/hardware" backend/tests` → 零命中 → **SB-20** |
| metrics（3/3 缺失） | #35–#37 | 仅 `test_middleware.py`、`test_performance.py` 触 `/api/metrics`；`test_middleware.py:34` 断言 200 实得 401 = F-01 红；therapist 正向无用例 |
| auth（3） | #3 logout、#4 me、#5 preferences | logout 会话失效语义、preferences 归属无 RBAC 用例；注意认证**服务层**另有 `test_auth_service.py`（12 例：验证码生成/校验、登录、用户获取或创建、偏好更新），但它不覆盖端点级 401/403/越权三态，其断言层裁决状态见 §6.3 该行 |
| training（2） | #10 recommendation、#11 submit | 无 RBAC 用例 |
| pronunciation（4） | #16–#19 | #17（提交录音，D 类语音入口）**无认证/归属用例** |
| dialogue | #13 部分；#14/#15 IDOR | `test_dialogue_api.py`（193 行）含 IDOR 用例，**但不在 `ci.yml:103` postgres job 清单** → SB-20 |
| report（1） | #23 weekly | 无 401/403 用例 |

**结论**：RBAC/IDOR 回归只覆盖训练面 + 对话面 + report/patients 单点；硬件面与指标面零覆盖，且对话面 IDOR 用例未纳入 CI 集成 job → 覆盖面不足（P1，SB-20）。

---

## 3. Secret 管理

### 3.1 `.gitignore` 对 `.env` 的覆盖（结论：现有文件全部被覆盖，但模式有缺口 → SB-29）

**3.1.1 `.gitignore` 中 env 相关规则原文（本任务实测，exit 0）**

| 行号 | 规则 | 匹配语义 |
|---|---|---|
| `25` | `venv/` | 虚拟环境目录 |
| `26` / `27` | `env/`、`ENV/` | 目录名 env（非 `.env` 文件） |
| `28` | `.env` | **无斜杠前缀 → 任意层级匹配**（实测 `deploy/.env`、`backend/.env` 均命中） |
| `29` | `.env.local` | 任意层级 |
| `30`–`32` | `.env.development.local`、`.env.test.local`、`.env.production.local` | 仅 `.local` 阶段变体 |
| `68` / `69` | `.worktrees/`、`worktrees/` | 工作树副本目录整体忽略 |
| `106` | `.qoder/workflow-state/*.spec.json` | 任务 spec 落盘被忽略（本 SPEC 文件不计入 porcelain） |
| 无 | **通用 `.env*` / `*.env` 兜底规则** | ← 缺口来源（见 3.1.3） |

**3.1.2 仓库内 env 文件全量清单 + 忽略状态实测**

`find . -path ./.git -prune -o -path '*/node_modules' -prune -o -path '*/venv*' -prune -o -path '*/__pycache__' -prune -o -type f \( -name '.env*' -o -name '*.env' \) -print`（exit 0）实测 **7 个**（只记路径，**未读取任何值**）：

| 文件 | 跟踪状态 | 证据 |
|---|---|---|
| `.env`（根，存在） | **IGNORED** | `git check-ignore -v .env` → `.gitignore:28:.env` |
| `backend/.env`（存在） | **IGNORED** | `git check-ignore -v backend/.env` → `backend/.gitignore:3:.env` |
| `.env.example` | TRACKED（模板，应跟踪） | `git ls-files` 命中 |
| `backend/.env.example` | TRACKED（模板，应跟踪） | `git ls-files` 命中 |
| `.worktrees/auditory-rehab-optimization/.env.example` | IGNORED | `git check-ignore -v` → `.gitignore:68:.worktrees/` |
| `.worktrees/…/backend/.env.example` | IGNORED | 同上（目录级规则覆盖） |
| `.worktrees/…/backend/.env`（存在） | IGNORED | 同上 |

补充核查：`git ls-files | grep -iE "\.env"` → 已跟踪的 env 类文件**只有两份 `.env.example` 模板**，**无任何 `.env` 本体被跟踪**。

**3.1.3 模式缺口（用假想文件名验证，未创建任何文件）**

`git check-ignore -q <假想路径>` 实测：

| 假想路径 | 结果 | 含义 |
|---|---|---|
| `.env.staging`/`.env.production`/`backend/.env.production`/`backend/.env.prod`/`secrets.env`/`config.env` | **全部 NOT_IGNORED（exit 1）** | 一旦按 `production/staging/prod` 命名放真实口令，会被 git 跟踪并可能提交 → **SB-29（P2）** |
| `deploy/.env`/`frontend/.env.local` | IGNORED（exit 0） | 印证 `.env`、`.env.local` 任意层级匹配 |

### 3.2 全仓硬编码密钥扫描（三类口径分列，结论：已跟踪文件内无真实凭据）

> 口径澄清：Workflow required 门禁 `G-SECRET-LEAK-NEGATIVE`（`! grep -nE "sk-[A-Za-z0-9]{16,}|LTAI[A-Za-z0-9]{12,}|ghp_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----" <交付物>`）**只作用于本交付物文件**（防"把密钥写进报告"），它**不能**代替"全仓无硬编码密钥"的证据。后者由口径 ② 独立成立。

| 口径 | 命令（可复制执行） | 覆盖范围 | 实测结果 |
|---|---|---|---|
| ① 门禁（交付物自身不含密钥形态） | `G-SECRET-LEAK-NEGATIVE`（见上） | 仅本文件 | **通过（exit 0）**，见 §10.3 |
| ② 全仓已跟踪文件（含无引号 YAML） | `git ls-files > /tmp/trk.txt` ; `grep -rnIE "[A-Za-z0-9_]*(SECRET_KEY\|API_KEY\|ACCESS_KEY\|PASSWORD\|PASSWD\|TOKEN)[A-Za-z0-9_]*[[:space:]]*[:=][[:space:]]*[\"']?[^[:space:]\"']+" $(tr '\n' ' ' < /tmp/trk.txt)` | 已跟踪全集（含 `deploy/`、`hardware/`、`.github/`、根目录散落工件） | 逐条按值形态分类（§3.2.1），**无一为真实凭据** |
| ③ 供应商密钥指纹正则 | `grep -rnEI "sk-[A-Za-z0-9]{16,}\|AKIA[0-9A-Z]{16}\|ghp_[A-Za-z0-9]{20,}\|xox[baprs]-[A-Za-z0-9]{10,}\|LTAI[A-Za-z0-9]{12,}" --exclude-dir={.git,node_modules,venv312,venv,.worktrees} .` | 全仓（排除第三方/忽略目录） | **零命中** |
| ④ 被忽略/未跟踪文件 | `git status --porcelain --ignored=matching`；`git check-ignore -v`（§3.1.2） | `.env`、`backend/.env`、`.worktrees/**` | 存在且被忽略；**内容全程未读取** |

**3.2.1 口径 ② 命中分类与逐条处置**（分类只输出 `文件:行号` 与类别，不回显值）

| 类别 | 命中（文件:行号） | 处置判定 |
|---|---|---|
| INDIRECTION（`${env.X}`/`${{ secrets.X }}` 间接引用） | `deploy/serverless.yml:60`、`:62`、`:63`（`DATABASE_URL`/`SECRET_KEY`/`DASHSCOPE_API_KEY`）；`.github/workflows/ci.yml:165-166`、`:197`、`:207-208` | **OK**，凭据不入库；`serverless.yml:14` 注释"不能提交到仓库或写入此文件" |
| PLACEHOLDER（占位前缀） | `.env.example`、`backend/.env.example`（键名引用，值不摘录） | **OK**（模板） |
| DEV_OR_CI_LITERAL（CI/测试夹具） | `ci.yml:48`、`:101`（`SECRET_KEY: ci 测试专用明文`，值不摘录）、`:68`（`POSTGRES_PASSWORD: postgres` service 容器）、`:98-99`（`DATABASE_URL`/`TEST_DATABASE_URL` 指向 CI 一次性库）；`tests/conftest.py:46/:48`（测试 `Settings(SECRET_KEY=…)`，值不摘录） | **非生产凭据**，属 `80-testing.md` 规则 6 允许范围；不记 Secret 泄露缺陷（仅 §3.4 记 SB-24 传参风险） |
| 配置默认值（非字面量密钥） | `core/config.py:17`（`_INSECURE_SECRET_KEYS` 弱密钥黑名单，正向）、`:41`（`DATABASE_URL` 默认值内嵌口令，本文件脱敏为 `postgresql+asyncpg://postgres:<masked>@localhost:5432/cochlear_rehab`，**不摘录口令**）、`:49`（`SECRET_KEY=""`，正向） | `:41` → **SB-19（P1）** + 与 SB-28/SB-31 联动；`:17`/`:49` 为正向 |
| 固件常量 | `hardware/esp32-rehab-station/esp32-rehab-station.ino:39` `WIFI_SSID`、`:40` `WIFI_PASSWORD`（当前 `YOUR_*` 占位） | 见 §3.2.2 SB-30 |

**3.2.2 硬件固件凭据结构性风险（SB-30，P2）**：`esp32-rehab-station.ino:39-40` 以源码常量承载 WiFi 凭据、`:43 WS_HOST`、`:48 DEVICE_ID` 固定设备标识；全包检索证明零鉴权材料：`grep -rnEI "authorization\|token\|api_key\|bearer\|secret" hardware/` → **exit 1（零命中）**。当前因全为占位而侥幸通过扫描，但真实部署必然表现为"把真实口令写进被跟踪的 `.ino` 并提交"，与 `C2` 冲突。

**3.2.3 "扫描命中但不是缺陷"的事实（须区分，不得混同）**

- `frontend/src/services/api.ts` 仅 `import.meta.env.VITE_API_BASE_URL` → **前端不持有密钥**。
- 根目录被跟踪散落工件（`test_output*.txt`、`code_quality_review.txt` 等）经逐文件 `grep -cEI "1[3-9][0-9]{9}|sk-[A-Za-z0-9]{16,}|Expires=|Signature=|OSSAccessKeyId"` → **命中数全为 0**（无手机号/签名 URL/密钥）。属仓库卫生问题（SB-27 关联），非安全泄露。
- `docker-compose.yml` env 全为 `${...}` 插值。

### 3.3 `app/core/config.py` 默认值风险逐条

| 配置 | 证据 | 默认值 | 风险判定 |
|---|---|---|---|
| `DEBUG` | `config.py:37` | `False` | 方向 OK（docs 禁用 `main.py:103-104`、`:142`）；无 ENVIRONMENT 分层守卫 → SB-21（P2） |
| `SECRET_KEY` | `config.py:49`（默认空）+ 校验器 `:158-172` | 空串，启动强制校验 | **正向**：长度 <32 或命中 `_INSECURE_SECRET_KEYS`（`:17`）→ 拒绝启动（`C2` OK） |
| `ALGORITHM` | `config.py:53` | `HS256` | `core/security.py` 对称签名，无 kid/轮换 → SB-09 关联 |
| `ACCESS_TOKEN_EXPIRE_HOURS` | `config.py:56` | `2` | 短有效期 OK；无 refresh 端点（`config.py:59` `REFRESH_TOKEN_EXPIRE_DAYS` 定义但全仓无使用点）→ SB-22（P2） |
| `CORS_ORIGINS` | `config.py:135-139` | localhost 三来源 | 生产白名单缺真实域名 → §4 GAP（SB-13a） |
| `COOKIE_SECURE` | `config.py:152` | `False` | 生产 GAP（SB-13b） |
| `COOKIE_SAMESITE` | `config.py:155` | `lax` | 基本 OK；`none` 未与 `COOKIE_SECURE` 联动校验 → SB-23（P2） |
| `DASHSCOPE_API_KEY`/`OSS_ACCESS_KEY_*` | `config.py:63`、`:119`、`:122` | 空串 | OK（无默认密文；空值走降级） |
| `SAFETY_KEYWORDS` | `config.py:143-148` | 内置词表 | C 类内部规则存于配置（合规）；但 `ai/llm_gateway.py:224` 另有硬编码词表 → SB-08 |

`grep -nE "^    [A-Z][A-Z0-9_]*:" backend/app/core/config.py` 实测配置键 **35 个**（上一版报告误记 36，本次以逐行清单校正，见 §11.1）。

### 3.4 CI Secret 引用形式（`.github/workflows/ci.yml`，仅记变量名 + 行号）

| 形式 | 行号 | 判定 |
|---|---|---|
| `${{ secrets.ALIYUN_CR_* }}`、`${{ secrets.ALIYUN_ACCESS_KEY_* }}` | `ci.yml:165-166`、`:197`、`:207-208` | OK（仓库 Secret 间接引用，未输出值）；**风险**：`s` CLI 以命令行传 AK → 可能落入 runner 进程列表/日志 → SB-24（P2） |
| `SECRET_KEY: ci 测试专用明文`（值不摘录） | `ci.yml:48`、`:101` | 属 `80-testing.md` 规则 6 允许，**非生产 Secret**，不记缺陷 |
| `POSTGRES_PASSWORD: postgres`（service 容器一次性库） | `ci.yml:68` | CI 服务容器口令，非生产；不记缺陷 |
| **触发分支与主分支不符** | `ci.yml:5`、`:7`（`main`/`develop`） | **P0 → SB-03**（§6.4） |

---

## 4. CORS / Cookie / DEBUG 与 RELEASE_CRITERIA 逐条差距清单

对照基准：`docs/workflow/RELEASE_CRITERIA.md` §C（`C1` 认证/授权矩阵、`C2` Secret、`C3` DEBUG/CORS/COOKIE_SECURE/docs/安全响应头、`C4` 日志脱敏、`C5` 依赖漏洞、`C6` 限流）。

| # | 项 | 当前实际值（文件:行号） | 要求 | 结论 |
|---|---|---|---|---|
| G-1 | DEBUG | `config.py:37 False`；`main.py:103-104` docs/redoc 仅 DEBUG 开；`main.py:142`；`deploy/serverless.yml:58 DEBUG:"false"` | C3 DEBUG=False | **OK**（无 ENVIRONMENT 守卫为 P2 SB-21） |
| G-2 | Swagger/ReDoc | `main.py:103-104`（DEBUG 关即关） | C3 docs 受限 | **OK** |
| G-3 | CORS 装配 | `main.py:111-118`：`allow_origins=settings.CORS_ORIGINS`、`allow_credentials=True`、`allow_methods=["*"]`、`allow_headers=["*"]` | C3 白名单 | **GAP**：白名单+凭据下 `allow_methods/headers` 通配（`:115-116`），建议收敛 |
| G-4 | CORS 白名单内容 | `config.py:135-139` 三条 localhost；`deploy/serverless.yml:55-63` 环境变量块**未设 CORS_ORIGINS** | C3 生产域名 | **GAP（P1 SB-13a）**：生产回落 localhost |
| G-5 | COOKIE_SECURE | `config.py:152 False`；使用点 `api/auth.py:106`（set_cookie）；`serverless.yml:55-63` **未覆盖** | C3（生产 True） | **GAP（P1 SB-13b）**：httpOnly Cookie 未加 `Secure` |
| G-6 | COOKIE_SAMESITE | `config.py:155 lax`；使用点 `api/auth.py:107` | C3（未强制具体值） | **OK（附条件）**：改 `none` 须同时 `COOKIE_SECURE=True`，无联动校验 → SB-23 |
| G-7 | Cookie httponly | `api/auth.py:105 httponly=True` | 冻结决策 5 | **OK** |
| G-8 | 安全响应头 | `deploy/nginx-production.conf:72-74`（X-Frame-Options/X-Content-Type-Options/HSTS）；**无 CSP**；后端自身未设安全头 | C3 | **GAP（P2 SB-26）** |
| G-9 | 认证/归属矩阵 | §1、§2 | C1 无 IDOR | **GAP（P0 SB-01/SB-06/SB-07 + SB-02）**：跨用户缓存 IDOR、硬件零授权，postgres 口径安全用例验证不成立 |
| G-10 | 日志脱敏 | §5 | C4 脱敏测试与抽查 | **GAP（P1 SB-14）**：无任何脱敏测试（`grep -rn "脱敏\|mask" backend/tests` 零命中） |
| G-11 | 依赖漏洞 | 未执行 pip-audit/npm audit（需出网，本任务未授权） | C5 | **missing_evidence（记录不裁决，§12 H-1）** |
| G-12 | 限流 | `middleware/performance.py:139-141`：`/api/auth/sms/send` 5/60s、`/api/dialogue/sessions` 10/60s、`/api/pronunciation/evaluate` 30/60s | C6 | **GAP（P1 SB-13）**：`/api/pronunciation/evaluate` 在本仓库**无对应路由**（`api/pronunciation.py` 仅 `/attempts`、`/tasks/next`、`/stats`）→ 发音评估实际**未被限流**；登录限流在 `api/auth.py:23`，无 429 用例测试 |

### 4.1 逐条复核命令（G-1…G-12 可证伪；本任务只读取证，exitCode 见 §10.3）

> 目的：让 Review/Verify **不需要相信本文结论**，直接复制即可复算。所有命令均为只读（`grep`/`sed -n`/`git ls-files`/`git check-ignore`），无写操作、无生产 DB 连接。

| G# | 复核命令（仓库根执行） | 预期输出 |
|---|---|---|
| G-1 | `grep -n "^    DEBUG" backend/app/core/config.py` | `37:    DEBUG: bool = False` |
| G-3 | `sed -n '111,118p' backend/app/main.py` | `allow_origins=settings.CORS_ORIGINS`/`allow_credentials=True`/`allow_methods=["*"]`/`allow_headers=["*"]` |
| G-4 | `sed -n '135,139p' backend/app/core/config.py`；`grep -n "CORS_ORIGINS" deploy/serverless.yml` | 三条 localhost；第二条零命中（exit 1） |
| G-5 | `grep -n "COOKIE_SECURE" backend/app/core/config.py backend/app/api/auth.py deploy/serverless.yml` | `config.py:152 False`、`auth.py:106`；`serverless.yml` 无命中 |
| G-8 | `grep -n "add_header" deploy/nginx-production.conf`；`grep -rn "Content-Security-Policy" backend/app deploy/` | 三条头（`:72-74`）；第二条零命中（无 CSP） |
| G-9 | `grep -rhoE "@router\.(get\|post\|put\|delete\|patch)\b" backend/app/api \| wc -l`（=37）＋ `sed -n '44,50p;111,131p' backend/app/middleware/performance.py` | §1.1、§9 SB-01 证据 |
| G-10 | `grep -rn "脱敏\|mask" backend/tests` | 零命中 |
| G-12 | `grep -n "RATE_LIMITS" -A4 backend/app/middleware/performance.py`；`grep -nE "@router\.(get\|post)" backend/app/api/pronunciation.py` | 规则含 `/evaluate`，端点无该路径 → 路径失配 |

### 4.2 生产环境变量覆盖清单（`deploy/serverless.yml environmentVariables` vs `config.py` 全量键）

`grep -nE "^    [A-Z][A-Z0-9_]*:" backend/app/core/config.py` 实测 **35** 键；部署侧覆盖：

| 键（定义行） | serverless.yml | docker-compose.yml | 判定 |
|---|---|---|---|
| `DEBUG:37` | 是（`:58 "false"`） | `env_file: .env` | OK |
| `DATABASE_URL:41` | 是（`:60 ${env.DATABASE_URL}`） | 是（`${POSTGRES_*}`） | OK（默认值缺陷另记 SB-19/SB-28/SB-31） |
| `SECRET_KEY:49` | 是（`:62 ${env.SECRET_KEY}`） | `env_file` | OK |
| `DASHSCOPE_API_KEY:63` | 是（`:63`） | `env_file` | OK |
| `COOKIE_SECURE:152` | **否** | 未强制 | **GAP → SB-13b** |
| `COOKIE_SAMESITE:155` | **否** | 未强制 | **GAP → SB-23** |
| `CORS_ORIGINS:135-139` | **否** | 未强制 | **GAP → SB-13a** |
| `OSS_ACCESS_KEY_*`/`OSS_BUCKET/ENDPOINT/REGION:119-131` | **未设置** | 未强制 | 音频落盘生产必缺配 → SB-15 一并处置 |
| `SAFETY_KEYWORDS:143-148` | 否 | 未强制 | 无法按环境调整词表（且 `llm_gateway.py:224` 硬编码 → SB-08） |

---

## 5. 日志脱敏抽查（手机号 / 验证码 / token / 语音 URL 四类）

loguru 配置事实：
- 唯一配置点 `app/utils/logger.py:8-45`（`setup_logger`）。**关键事实**：`grep -rn "setup_logger" backend/app --include="*.py"` → 仅 `app/utils/__init__.py:4`（导出）与定义处命中，**应用启动路径从未调用 `setup_logger()`**；`main.py`、`middleware/*`、`db/init_db.py` 只 `from app.utils.logger import logger`（裸 loguru）。stdlib 轨 `grep basicConfig backend/app` 零命中 → 双轨 logger（AI/硬件用 loguru、认证/对话/配置用 `logging.getLogger`），**无脱敏 sink、无 `logger.patch`、无 filter**。
- 调用点规模：`grep -rn "logger\.(info|warning|error|debug|critical|exception)" backend/app --include="*.py" | wc -l` = **135**（与 SPEC"约 140"量级相符）。

| 类别 | 结论 | 证据行（逐点） |
|---|---|---|
| **手机号** | 日志侧**未见完整手机号** | 唯一含 phone 的日志点：`services/auth_service.py:37` `logger.info(f"[SMS] 向 {phone[-4:]}**** 发送验证码成功")` —— 仅后 4 位（符合 `30-backend.md`；拼接先输出后 4 位再补 `****`，可读性可改进，非泄露）。反向复核 `grep -rniE "logger\..*(phone|tel)" backend/app` → 仅此一条 |
| **验证码** | 日志侧不命中 / **存储侧命中** | 日志：SMS/登录相关日志只含异常串与固定文案，不含 code；`grep -rnE "logger\..*\bcode\b"` 对验证码语义零命中。存储：`auth_service.py:28` `redis.setex(f"sms:{phone}", 300, code)` **明文存储**（`30-backend.md` A2 要求 hash）→ **SB-10（P1）**；比对 `auth_service.py:45` `stored == code` 非恒定时间 |
| **token / JWT** | 日志侧不命中 / 凭据面命中 | 日志：`grep -rniE "logger\..*token" backend/app` 零命中；`deps.py:15-20` 取 token 后仅验证不打日志；`middleware/performance.py:118-127` 解码 token 取 sub 作缓存 key，未记录 token 原文（正向）。风险面：Cookie `secure=False`（`auth.py:106` + `config.py:152`）→ SB-13b；登出无吊销（`auth.py:116`、`core/security.py` 无 jti/黑名单）→ SB-09 |
| **语音 URL / 音频路径** | 日志侧不命中 / 隔离约定缺失 | 日志：含 "URL" 的日志点 `ai/tts_gateway.py`（缓存命中/上传 object_key）—— `cache_key = tts:{voice}:{text_hash}`（`:96`）、`object_key = tts/{voice}/{text_hash}.wav`（`:261`），**均不含用户标识、不含用户录音 URL**；用户录音实际**未落对象存储**（`services/pronunciation_service.py:202 audio_url=""`）。隔离事实：`grep -rn 'audio/{user_id}' backend/app` **零命中**，`50-database.md` 规定的 `audio/{user_id}/...` 前缀隔离**未实现** → SB-15（P1，当前因未持久化实际暴露面有限） |

补充（同类抽查）：
- **异常原文回显**：`api/health.py:58/:66/:81` 将 `str(e)` 写入未认证响应 → SB-12；`auth_service.py`、`dialogue_service.py`、`ai/tts_gateway.py` 若干点将 Redis/OSS 异常 `{e}` 写入日志（可能含连接地址信息，取决于驱动），建议统一收敛为错误码 → SB-14。
- **LLM 安全日志**：`ai/llm_gateway.py:214` 输入侧 reason 为 `f"检测到敏感内容: {keyword}"` → **把命中的敏感关键词原文写入日志**（如心理危机词）；建议记录规则 ID 而非原文 → SB-14 附带项。

---

## 6. 安全测试真实性双口径分层矩阵（F-19）

### 6.1 sqlite 本地口径（本任务真实运行，到达断言层）

命令（`backend/` 下，required 门禁 G-SECURITY-REGRESSION 逐字）与实测输出：

```
$ venv312/Scripts/python.exe -m pytest tests/test_safety.py tests/test_security.py tests/test_role_permissions.py -q
..........                                                               [100%]
10 passed in 0.70s
EXITCODE=0
```

| 文件 | 用例数 | sqlite 口径 | 是否到达断言层 |
|---|---|---|---|
| `tests/test_safety.py` | 1（`:4`） | PASSED | **到达断言层**（医疗安全关键词回归，项目现有唯一医疗安全测试） |
| `tests/test_security.py` | 2（`:7`、`:14`） | PASSED ×2 | **到达断言层**（SECRET_KEY 校验 + JWT 往返） |
| `tests/test_role_permissions.py` | 7 | PASSED ×7 | **到达断言层** |
| 小计 | **10** | **10 passed，exit 0** | 全部到达 |

### 6.2 postgres / CI 同款口径（本任务真实运行 → 验证不成立）

本任务用**一次性自建隔离实例**（`postgres:16-alpine @127.0.0.1:55433`，容器 `aiear-m0006-pg`，`pg_isready` 直调确认就绪；**未触碰宿主 `:5432`**；用后 `docker rm -f` 已清理）逐字运行 record 门禁 G-BASE-POSTGRES-TRIPLE：

```
$ TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:55433/aiear_m0006 \
  venv312/Scripts/python.exe -m pytest tests/test_integration.py tests/test_training_api.py tests/test_role_permissions.py -q
4 failed, 8 passed, 20 errors in 12.85s      （exitCode=1）
E  asyncpg.exceptions._base.InterfaceError: cannot perform operation: another operation is in progress
```

- **F-M0005-02（根因，本任务逐位复现）**：`backend/tests/conftest.py:53-100` 定义 **session-scoped `test_engine`**（`:53 @pytest_asyncio.fixture(scope="session")`、`:60-64` sqlite 分支用 `StaticPool` 掩盖问题、`:65` 创建 asyncpg engine），pytest-asyncio 每测试独立 loop → asyncpg 连接跨 loop 复用非法（aiosqlite 线程化容忍）。`INTEGRATION_BASELINE.md:300` 已登记 F-M0005-02，本次实测签名与既有留痕逐字一致（`another operation is in progress`）。**结论：该 fixture 至今未修复，本任务依 OUT_OF_SCOPE 未动 conftest.py。**
- **F-M0005-01（P0 验证缺口，本任务实测）**：postgres 口径下 **13 条依赖 DB 归属数据的安全用例**（`training_api` 8 + `role_permissions` 4 + `integration::get_me_with_token` 1）**死于 fixture setup，从未到达断言层** → 既非"安全通过"也非"安全失败"，而是"该口径下安全回归**验证不成立**"（`INTEGRATION_BASELINE.md:299`）。纯 401/公开面（不触 DB）4 条在该口径 call 绿。
- **FIX-INT-01（清偿依赖）**：F-M0005-01 的验证能力恢复以 **FIX-INT-01**（engine/连接与事件循环同生命周期，候选 `NullPool`/per-test engine/`loop_scope="session"`，须 Max 出 SPEC 并补双口径回归）为前置（`INTEGRATION_BASELINE.md:299/:300/:318`）。**本任务结论不宣称 postgres/CI 同款口径的安全裁决成立，直至 FIX-INT-01 清偿并复跑。**

分层结论（**两口径不得混同**）：

| 面 | sqlite 口径 | postgres/CI 同款口径（本次实测） |
|---|---|---|
| 纯 401 面（不触 DB） | 到达断言层 PASSED | 到达断言层 PASSED（4 条） |
| 403 / 40301 / therapist 正向 / 双角色 / IDOR 全集（触 DB） | 到达断言层 PASSED | **ERROR at setup / FAILED —— 未到达断言层 → 该口径下"验证不成立"**（13 条） |
| 公开端点不泄露 | PASSED | call PASSED + **teardown ERROR** |

### 6.3 关键防混同声明（对应 F-19 / R4）

本次 `10 passed` 仅证明 **sqlite/内存库口径** 下医疗安全回归、密钥校验、JWT 往返与 7 条 RBAC 用例**到达断言层并通过**；**绝不**等价于"安全测试全部有效"或"postgres 口径 IDOR 防护已被验证"。F-M0005-01 所指的 13 条安全用例在 CI 同款口径下**从未到达断言层**，其"通过"标记属**验证不成立**。历史文档中的 `[x]` 与 M0-002/M0-005 之外的旧记录均不作证据（`90-quality-gates.md` 证据纪律）。逐测试文件"断言层真实裁决 vs 仅未报错"分层见下表。

| 测试文件 | 与安全相关性 | sqlite 断言层 | postgres/CI 断言层 |
|---|---|---|---|
| `test_role_permissions.py`（7） | RBAC/IDOR 基线 | 7 到达 | 3 到达（401+公开）；**4 未到达 → 验证不成立** |
| `test_training_api.py`（9） | 401/403 归属 | 9 到达 | **8 未到达 → 验证不成立** |
| `test_integration.py`（15） | 端到端 + get_me | 15 到达 | get_me_with_token、TestUserFlow 等**未到达断言层** |
| `test_dialogue_api.py`（IDOR） | 对话 IDOR | 本任务未单独运行（不属 MANDATORY/REGRESSION 清单，随全量 run 绿） | **未运行**（且不在 `ci.yml:103` job）→ 覆盖缺口 SB-20 |
| `test_security.py`（2）、`test_safety.py`（1） | 密钥/JWT/安全关键词 | 3 全部到达 | 无 DB 依赖，口径差异不适用 |
| `test_auth_service.py`（12：`:42`/`:55`、`:71`/`:88`/`:100`/`:112`、`:127`/`:141`、`:157`/`:173`、`:185`/`:195`） | 认证服务层安全面：验证码生成/校验、登录、用户获取或创建、偏好更新；被测对象 `services/auth_service.py` 正是本报告 **SB-10**（验证码 Redis 明文存储 + 非恒定时间比较，§5/§9）与 **SB-35**（consent 无执行路径，§7）的缺陷载体 | **12 全部到达断言层**（每条均对返回值/异常码/mock 交互作具体 assert，属"真实裁决"而非"仅未报错"）：不属本任务 MANDATORY/REGRESSION 清单，未纳入 §6.1 的 G-SECURITY-REGRESSION 三连命令，随 G-BASE-PYTEST-FULL 全量 run 计入 §10.4 的 `231 passed`（该 run 唯一红为 `test_middleware.py:34`）；按本轮 Review 复核单独取证：`venv312/Scripts/python.exe -m pytest tests/test_auth_service.py -q` → **12 passed / exitCode=0** | 无真实 DB/Redis 依赖：夹具 `:22-29` 自建 `AsyncMock(spec=AsyncSession)`，Redis 经 `patch("app.services.auth_service.get_redis")` + `conftest.py:229-230`/`:256` 内存替身；未请求 `conftest.py` 的 `test_engine`/`db_session`/`client`/`auth_token` 任一夹具 → session-scoped asyncpg engine（F-M0005-02 根因 `conftest.py:53-100`）不被触发，**口径差异不适用**（不属 F-M0005-01 的 13 条未达断言层集合）。事实登记：`ci.yml:51` 全量 job（`pytest tests/`）含本文件、`ci.yml:103` postgres job 不含 → 覆盖面交叉引用 SB-20；且 12 例均为**服务层单元**口径，不证明真实 Redis/DB 行为，端点级 401/403/越权三态仍无用例（§2.3 auth 行） |
| `test_middleware.py`（metrics F-01） | 认证契约 | **确定性 FAILED**（`:34` assert 401==200） | 未运行 | 既有基线红，非本任务引入 |

### 6.4 CI 层真实性

`ci.yml:5` `push.branches [main, develop]`、`ci.yml:7` `pull_request.branches [main]`；`ci.yml:103` postgres job 运行 `test_integration.py + test_training_api.py + test_role_permissions.py`（与本任务 G-BASE-POSTGRES-TRIPLE 同款）。`git branch -a` 实测存在 `master`、`remotes/origin/master`，**无 `main`**。→ 后端全测/postgres 集成/前端/Docker job 在主分支均不触发，CI 层安全回归从未被强制执行 → **SB-03（P0）**，RELEASE_CRITERIA `G5`（CI 绿）无成立基础。

---

## 7. 隐私八项现状（D 类数据 = 健康信息 / 语音 / 训练 / 对话 / 耳蜗信息）

| # | 项 | 现状结论 | 证据（文件:行号） | 缺陷 |
|---|---|---|---|---|
| 1 | **数据最小化** | 部分不满足 | `/api/auth/me` 返回完整 `phone`（`api/auth.py:136`）及 `birth_year`、`cochlear_info`（`:139-140`）；`/api/report/patients` 返回每位患者 `phone`（`services/patient_service.py:150`）；`services/auth_service.py:82-89` 登录响应仅 id/phone/role/nickname（相对收敛） | SB-16（P1） |
| 2 | **授权（consent）** | 仅有数据结构，无任何授权检查 | 字段定义 `models/user.py:15`（`consent_flags JSON`）；仅回显 `api/auth.py:141`；仅播种 `db/init_db.py:167`（`data_usage/model_training` 形态）；`update_preferences`（`auth_service.py:97-105`）**不校验、不记录、不改动同意**；`grep -rn "consent_flags" backend/app --include=*.py` 全为定义/回显/播种/docstring，`grep -rnE "if .*consent\|consent.*==" backend/app` **零命中**（无"未同意即拒绝"路径） | **SB-35（P1）** |
| 3 | **访问控制（核心交付）** | 数据面基本到位，硬件面/缓存面失守 | 见 §1.2：30/37 有认证；归属校验 `api/training.py:15-17`、`api/dialogue.py:89/:112`；角色 `api/deps.py:55-63`、`api/metrics.py:21-25`；**旁路** `middleware/performance.py:47-48 + :111-131` | SB-01（P0）、SB-06（P0）、SB-07（P1） |
| 4 | **日志脱敏** | 抽查未见手机号/token/验证码/用户语音 URL 直接进日志，但无脱敏机制、无测试、配置未生效 | 见 §5；`utils/logger.py:8` 定义但从未被调用；`grep -rn "脱敏\|mask" backend/tests` 零命中 | SB-14（P1） |
| 5 | **数据隔离（D 类）** | 业务表按 user_id 隔离成立；对象存储隔离约定未实现 | 正向：`api/report.py:38`、`api/pronunciation.py:64`、`api/training.py:45` 全部按 `current_user.id`；对象存储 `grep -rn 'audio/{user_id}' backend/app` 零命中，用户录音未持久化（`services/pronunciation_service.py:202 audio_url=""`）；A/D 隔离：当前无 pgvector、无向量表（`50-database.md` 现状），**无 D 类入库风险点** | SB-15（P1，约定缺失）；A 类向量库隔离 **不适用（KB-001 起）** |
| 6 | **删除路径（PRIV-002）** | 完全缺失 | `grep -rniE "delete_account\|deactivate" backend/app` 仅硬件语义命中（设备注销），**无用户账号删除/数据级联删除端点或 Service**；`models/user.py:18-22` 关系未声明 `cascade` | SB-11（P1） |
| 7 | **导出路径（PRIV-003）** | 完全缺失 | `grep -rniE "export\|导出" backend/app/api/*.py` 零命中端点（§1.2 矩阵 37 行内无导出项） | SB-11 同族（P1） |
| 8 | **审计（安全事件/访问日志）** | 完全缺失 | `grep -rniE "audit\|safety_event\|SafetyEvent" backend/app --include=*.py` → **零命中**；LLM 拦截仅落日志（`ai/llm_gateway.py:254/:294/:351`），无安全事件表、无处置记录、不可统计（70-medical-safety "Safety Event + Audit"） | SB-04 关联（P0 医疗）/ PRIV 审计（P1） |

---

## 8. 医疗边界发现

### 8.1 违禁文案扫描结论：**未发现**（只读抽查，未做任何修改）

抽查范围与命令（本任务真实执行，取证留痕见 §10.3）：

```
$ grep -rnE "诊断|处方|用药|剂量|调机|治愈|疗效|保证.*恢复|必然" backend/app --include="*.py"
（命中仅为安全关键词表条目本身 core/config.py SAFETY_KEYWORDS，非面向用户文案）

$ grep -rnE "治疗方案|恢复听力|坚持训练|一定会|肯定会|治愈率|康复效果" backend/app --include="*.py"
（命中为训练统计建议 "建议每天坚持训练…" 类措辞，符合 70-medical-safety.md "使用建议练习/可能有助于"，非疗效保证）

$ grep -n "不提供任何医疗建议" backend/app/ai/llm_gateway.py
52 / 74 / 95 / 115 / 135 / 197 —— 共 6 处 system_prompt 内含该约束（C 类内部规则存于代码，合规）
```

逐点抽查的用户可见文案面：LLM 预设话术（`ai/llm_gateway.py:256`、`:320` 拒答话术）、发音反馈建议、报告建议（训练统计措辞）、错误提示（`core/errors.py`）、日志（§5）。
→ **结论：未发现诊断/处方/设备调机参数/疗效保证类面向用户输出**；未发现把 ASR/音素评分表述为临床指标的后端文案。**依 OUT_OF_SCOPE 未修改任何文件。**（上一版报告将免责行号记为 `:36/:59/:80/:101/:121` 5 处，与本次逐字复核不符，实为 `:52/:74/:95/:115/:135/:197` 6 处，本次以实测为准，见 §11.1。）

### 8.2 医疗安全能力缺口（结构性，按 70-medical-safety.md 记 P0/P1，只记录）

| 缺口 | 证据 | 判据 |
|---|---|---|
| **无急症/心理危机应急路径（Emergency Route）** | `SAFETY_KEYWORDS` 含"自杀/自残"等（`core/config.py:143-148`），命中后响应为通用拒答 `ai/llm_gateway.py:256` "抱歉，我无法回答这个问题。让我们聊点别的吧。"（流式同 `:320`）；全仓无应急话术/急救渠道 | 70-medical-safety：心理危机 → 固定应急话术 + 建议立即联系医生/急救，不走 LLM 生成 → **SB-04（P0）** |
| **无高风险转诊模板（High-risk Referral）** | 无"建议咨询听力师/耳鼻喉科"类响应（后端侧 `grep 免责声明\|听力师或医生 backend/app` 零命中） | 同上 → SB-04 同族 |
| **输入安全仅检查最后一条消息** | `ai/llm_gateway.py:251`（非流式）、`:317`（流式）均 `messages[-1]`；上下文由 Redis 多轮历史构成 | 违反 `30-backend.md` "输入检查覆盖最近多条消息（历史 S5）" → **SB-05（P0）** |
| **输出拦截词表与 core/safety.py 分裂** | `ai/llm_gateway.py:224` 硬编码 `medical_patterns` 仅 4 项，未复用 `app/core/safety.py:6-17`；无剂量/调机/programming 检测 | 违反 `20-architecture.md` 冻结决策 6 与 ARCH-04 → **SB-08（P1）** |
| **流式缓冲窗口有限** | `ai/llm_gateway.py:345-348`：`buffer += delta` 后仅回看最后 `N=200` 字符（`:347`），判定通过即 `yield delta`（`:354`）——"先检后发"对当前块成立（S4 正向），但跨 200 字界的长句无法拦截 | 记 **SB-P1** 项（并入 SB-08 处置族） |
| **无 Risk Taxonomy / Query Classifier** | `grep -rnE "risk_taxonomy\|classifier" backend/app` 零命中；关键词命中即拒答，无分类路由、无版本化清单 | 70-medical-safety 架构要求 → SB-04 族 |
| **无医疗安全评测集** | 医疗安全回归仅 `tests/test_safety.py` 的 **1 条**关键词用例（`:4`） | `90-quality-gates.md`：不得以"没有测试"视为通过 → SB-20 关联（P1，须补评测集） |
| **硬件声学参数无校验（患者可达）** | `api/hardware.py:54 duration_ms`、`:59-60 frequency_hz/duration_ms` 无 `ge/le`，任意认证用户可对任意设备下发 | 老年/耳蜗用户安全边界 → SB-06 关联（P0 授权缺失一部分） |

---

## 9. P0 / P1 缺陷分级清单（全部只记录，本任务零修复；旧 SB-* 编号承接，不断代）

> 编号纪律（AC-08）：**缺陷账本沿用 SB-01…SB-35，旧编号一律保留、不消失**（后端源码自 `1a62703` 至 `506f5ee` 零变更，故全部仍有效）；"后续任务编号建议"列的纪律是：**目录既有编号只能在其原生语义范围内使用**——`TASK_CATALOG.md` 实测占用：SEC-001=依赖漏洞扫描与修复（`:167`）、SEC-002=渗透复测与修复（`:168`）、**SEC-003=生产配置硬化**（`:169`，scope 为 CORS 白名单 / COOKIE_SECURE / docs 关闭 / 安全响应头 / DEBUG=False 强制）、OPS-001=CI/CD 完善（`:170`）、**OPS-002=部署冒烟与回滚演练**（`:171`）、**OPS-003=容量与性能压测**（`:172`）、**OPS-004=Release Gate 证据包**（`:173`）、SAFE-001…007、PRIV-001…007、ADMIN-001…004。凡不在上述条目语义范围内的新工作项，一律使用**目录确未占用**的编号并显式标注"建议新增·待治理任务落库"，本表使用的未占用新增集合为 **SEC-004…SEC-014、OPS-005…OPS-007、PRIV-008…PRIV-010、FIX-INT-02、FIX-API-01、FIX-CI-01**。
> 本轮按 Review blocker 改判三处（**`SB-*` 缺陷编号与级别一律不动**，仅改"建议编号"列）：① SB-01（缓存型 IDOR）的建议编号由本版初稿的 "SEC-003（建议新增）" 改为 **SEC-014**——`TASK_CATALOG.md:169` 已把 SEC-003 用于"生产配置硬化"，同一 ID 挂两个不同 Scope 会造成任务账本身份冲突；② 原 "SEC-007（生产配置矩阵+部署期强制覆盖）" 与既有 SEC-003 实质重叠，生产配置族（SB-13/SB-21/SB-23/SB-26）改为**复用 SEC-003**，SEC-007 仅保留 SEC-003 未覆盖的**限流规则路径失配**子项（`middleware/performance.py:141` 属限流配置而非生产开关）；③ SB-13/SB-25 原标注的 "OPS-002（配置校验清单）"、SB-31 原标注的 "OPS-003（部署前置必填）"、SB-29 原标注的 "OPS-004" 均为**错误的"目录既有"语义标注**（目录内这三个编号分别是冒烟回滚演练、压测、Release 证据包），已改用未占用新编号 **OPS-006**（部署前置配置校验清单）与 **OPS-007**（`.gitignore` env 兜底规则）并标"建议新增·待落库"。上一版另曾把缓存 IDOR 记 "SEC-001"、设备归属记 "SEC-002"（与目录 SEC-001/SEC-002 语义冲突），本版保持设备归属为 SEC-004（见 §11.1 第 4 条）。

| ID | 级别 | 标题 | 证据（文件:行号） | 影响 | 后续任务编号建议（仅建议；与目录既有编号无 ID 重复，"目录既有"标注均经 `TASK_CATALOG.md` 逐条核对语义） |
|---|---|---|---|---|---|
| **SB-01** | **P0** | 跨用户响应缓存泄露用户健康报告（缓存型 IDOR） | `middleware/performance.py:44-50`（CACHEABLE_PATHS 含 `/api/report/summary`、`/api/report/levels`）；`:61` 前缀匹配；`:111-131` key=path+query，**仅当有 Bearer 头时才加 user_id**；`:64-75` 命中直接返回；成因链 `deps.py:19-20`（浏览器走 httpOnly Cookie，无 Authorization 头）；`config.py:45` 共享 Redis | 浏览器主认证路径下所有用户共享缓存键（TTL 60s `:52`）：用户 B 可拿到用户 A 的正确率/依从率/级别（D 类健康数据）。属 B4/S1 类 IDOR | **SEC-014（建议新增·待落库）**：缓存键必须含用户标识或对 D 类端点禁用缓存 + IDOR 专项回归；验证并入既有 **SEC-002**（目录既有：渗透复测与修复）。编号说明：本项初稿曾记 "SEC-003"，因 `TASK_CATALOG.md:169` 已占用 SEC-003=生产配置硬化（语义与缓存 IDOR 无关），故顺延至目录确未占用的 SEC-014 |
| **SB-02** | **P0** | RBAC/IDOR 安全用例在 postgres/CI 口径 13 条未达断言层 → 验证不成立 | `INTEGRATION_BASELINE.md:299`（F-M0005-01）；本任务 postgres 三连实测 `4 failed/8 passed/20 errors`（§6.2）；根因 `tests/conftest.py:53-100` | C1/D4/D5 门禁在真实 DB 口径无有效安全证据 | **FIX-INT-01**（engine/loop 生命周期）→ **FIX-INT-02**（安全用例真实 DB 口径复跑逐条核对 §6）；属 HUMAN 排期 |
| **SB-03** | **P0** | CI 触发分支与主分支不符，安全/权限回归从未被 CI 执行 | `ci.yml:5,7`（main/develop）vs `git branch -a` 实测 master、origin/master（无 main）；`10-project.md` master | 后端全测/postgres 集成/前端/Docker 全部不触发；RELEASE `G5` 无法成立 | **FIX-CI-01（建议新增·待落库）**：分支/环境矩阵修正 |
| **SB-04** | **P0** | 医疗安全架构缺失：无急症/心理危机应急路径、无高危转诊模板、无 Risk Taxonomy/Query Classifier、无安全事件审计 | `core/config.py:143-148`（含"自杀"等）但命中响应为通用拒答 `ai/llm_gateway.py:256/:320`；`grep -rniE "audit\|safety_event\|应急\|咨询听力师" backend/app` 零命中 | 违反 70-medical-safety Emergency Route/High-risk Referral/Safety Event+Audit/Risk Taxonomy；心理危机无兜底 | **SAFE-001～SAFE-006**（目录内既有：风险分类→分类器→统一策略→拦截→应急路由→事件审计）+ **SAFE-007**（评测集）；医疗专家审查属 **HUMAN_REQUIRED** |
| **SB-05** | **P0** | 输入安全仅检查最后一条消息（历史 S5 教训未修） | `ai/llm_gateway.py:251`、`:317`；多轮上下文来源 dialogue service | 前序轮次高危/注入内容可绕过输入侧护栏；70-medical "多轮绕过"无防护基础 | **SAFE-002 / SAFE-003**（目录既有）+ 多轮绕过回归 |
| **SB-06** | **P0** | 硬件 9 端点无归属校验、无角色区分，可越权控制他人设备（含声学执行器参数无校验） | `api/hardware.py:65/82/103/124/147/198/219/241/280` 全部仅 `Depends(get_current_user)`（`:67/:85/:106/:127/:151/:202/:223/:244/:281`）；无设备-用户绑定模型；参数无界 `:54/:59-60`；已在 `main.py:131` 挂载 | 任意登录用户可查询/连接/断连/驱动任意设备（LED/蜂鸣器/OLED 文本）；可用性 + 患者安全边界；测试零覆盖（§2） | **ADMIN-001**（目录既有 RBAC 角色扩展/统一权限依赖）+ **SEC-004（建议新增·待落库）**：设备归属/RBAC 模型；硬件是否纳入 MVP 暴露范围属 **HUMAN** |
| **SB-07** | **P1** | therapist 横向越权：任一听力师可见全部患者列表（无医患绑定） | `services/patient_service.py:21-25`（`therapist_id` 未参与过滤，直接 `select(User).where(role=="patient")`）、`:150`（phone 输出）；`api/report.py:60` 仅角色校验；无绑定表 | D 类健康数据在 therapist 群体内无最小化隔离 | **PRIV-008（建议新增·待落库）**（医患绑定 + 归属校验 + 审计）；并入 ADMIN-001 角色模型 |
| **SB-08** | **P1** | 输出安全词表网关内硬编码，未复用 `core/safety.py`（ARCH-04 重犯） | `ai/llm_gateway.py:224`（4 项 medical_patterns）vs `core/safety.py:6-17`、`config.py:143-148` | 多处独立维护关键词表，规则演进漂移；无法检测剂量/调机/programming 输出 | **SAFE-003**（目录既有：统一 Safety Policy 入口）/ ARCH-04 收口 |
| **SB-09** | **P1** | 登出无认证且无服务端会话吊销；refresh 配置项无实现 | `api/auth.py:116-125`（无 get_current_user，仅删 Cookie）；`core/security.py` 无 jti/黑名单/撤销；`config.py:59 REFRESH_TOKEN_EXPIRE_DAYS` 全仓无使用点 | 共享终端登出后 token 有效期内（`config.py:56`=2h）仍可经 Bearer 复用（`deps.py:16-18`） | **SEC-005（建议新增·待落库）**（服务端吊销/登出鉴权 + token 生命周期） |
| **SB-10** | **P1** | 短信验证码 Redis 明文存储、以完整手机号为 key、比对非恒定时间 | `services/auth_service.py:25`（生成）、`:28`（`setex("sms:{phone}",300,code)` 明文）、`:45`（`stored == code`） | 违反 `30-backend.md` A2（应 hash）；Redis 读权限者=D 类泄露；时序侧信道 | **PRIV-005**（目录既有：验证码 hash 存储 + 日志脱敏）+ 恒定时间比较 |
| **SB-11** | **P1** | 无任何用户数据删除/注销与导出路径（PRIV-002/003 前置事实缺失） | `grep -rniE "delete_account\|deactivate" backend/app` 仅硬件语义命中；`api/*.py` 无 export/删除端点（§1.2 全 37 行）；`models/user.py:18-22` 关系无 cascade | 用户无法行使删除权/可携权 | **PRIV-002**（级联删除）、**PRIV-003**（本人导出）、**PRIV-004**（保留期清理）（目录既有） |
| **SB-12** | **P1** | `/health/detailed` 未认证且原样回显异常字符串 | `api/health.py:30-31`（无认证）；`:58/:66/:81`（`f"...{str(e)}"`） | 未认证用户可获取 DB/Redis 故障原文（主机/端口/驱动细节）；RELEASE `G3` 冒烟入口需限定暴露面 | **SEC-006（建议新增·待落库）**（detailed 健康检查加认证/角色，异常收敛为错误码） |
| **SB-13** | **P1** | 生产安全配置 GAP：COOKIE_SECURE/CORS 未覆盖、发音端点限流路径失效 | `config.py:152`（COOKIE_SECURE=False）与 `deploy/serverless.yml:55-63`（未含 COOKIE_SECURE/CORS_ORIGINS）；`config.py:135-139`（仅 localhost）；`middleware/performance.py:141`（`/api/pronunciation/evaluate` 路由不存在，实为 `api/pronunciation.py:35 /attempts`） | 会话 Cookie 可在非 HTTPS 传输；生产域名不在 CORS 白名单；录音上传端点无速率限制（C6 不成立） | **SEC-003**（目录既有：生产配置硬化 — CORS 白名单、COOKIE_SECURE、docs 关闭、安全响应头、DEBUG=False 强制；本项 Cookie/CORS 缺口语义精确匹配）、**SEC-007（建议新增·待落库，范围限定）**（仅承接 SEC-003 未覆盖的**限流规则路径失配**子项：`middleware/performance.py:141` 规则路径与实际路由不符，属限流配置而非生产开关）、**OPS-006（建议新增·待落库）**（部署前置配置校验清单：ENVIRONMENT/DATABASE_URL 必填 + env 模板键集与 `config.py` 一致性） |
| **SB-14** | **P1** | 日志脱敏机制缺失：`setup_logger()` 从未被调用、双轨 logger、无脱敏 sink/测试；敏感关键词原文进日志 | `utils/logger.py:8-45` 定义 + `grep -rn "setup_logger" backend/app` 仅 `utils/__init__.py:4`；stdlib 轨 auth_service/dialogue/config/auth；`grep basicConfig` 零命中；`ai/llm_gateway.py:214→:254/:294/:351` 记录命中关键词原文；`grep "脱敏\|mask" backend/tests` 零命中 | RELEASE C4 无"脱敏测试"证据；日志留存内含心理危机类别信息 | **PRIV-005**（目录既有：日志脱敏） |
| **SB-15** | **P1** | 对象存储用户音频隔离约定（`audio/{user_id}/`）未实现；当前用户录音不落存储 | `grep -rn 'audio/{user_id}' backend/app` 零命中；TTS 对象键 `ai/tts_gateway.py:261`；用户录音未持久化 `services/pronunciation_service.py:202`（`audio_url=""`） | 一旦接入录音留存/回放即无隔离基线；`50-database.md`/`AGENTS.md §7` 未落地 | **PRIV-001**（目录既有：Consent/数据分级）、**PRIV-007**（目录既有：健康语音隔离审计）、**SEC-008（建议新增·待落库）**（OSS 前缀隔离 + 越权访问拒绝测试） |
| **SB-16** | **P1** | 数据最小化不足：响应返回完整手机号 | `api/auth.py:136`（/me phone）、`:139-140`（birth_year/cochlear_info）；`services/patient_service.py:150`（患者列表 phone 全量） | 敏感标识符在非必要读路径重复暴露 | **PRIV-001**（掩码/字段裁剪/按用途分离 DTO） |
| **SB-17** | **P1** | 信息暴露与参数无界：`ws-info` 返回内部 host/port/path；`metrics/errors` 的 `limit` 无上限 | `api/hardware.py:280-293`；`api/metrics.py:68`（`limit:int=20` 无 `Query(le=…)`） | 认证用户可获取内部 WebSocket 监听地址；可请求超大错误列表放大响应体 | **SEC-009（建议新增·待落库）**（参数上界校验 + 内部拓扑不对外） |
| **SB-18** | **P1** | POST 业务参数走 Query（历史 A3 教训未修） | `api/training.py:37`（level）、answer 端点 item_id/answer/response_ms 走 Query vs 正例 adaptive/submit 用 Body；`api/dialogue.py` 用 Body | 业务数据进 URL/访问日志/缓存键（与 SB-01 叠加：`performance.py:114` 把 query_params 拼进缓存 key）；违反 `30-backend.md` | **FIX-API-01（建议新增·待落库）**（迁移 Pydantic Body；属破坏性 API 变更须 ADR——`20-architecture.md` 禁止事项） |
| **SB-19** | **P1** | `DATABASE_URL` 默认值内嵌口令（禁止硬编码数据库密码） | `core/config.py:41`（`postgresql+asyncpg://postgres:<masked>@localhost:5432/cochlear_rehab`，本文件不摘录口令） | 默认值可被误用于非本地环境；口令进代码库；与 `50-database.md`/`30-backend.md` 冲突 | **SEC-010（建议新增·待落库）**（默认值去口令化 + 启动期环境校验），与 SB-28/SB-31 合并处置 |
| **SB-20** | **P1** | 安全测试覆盖与清单缺口：硬件 9 端点零用例、metrics 正向角色零用例（唯一断言 F-01 红）、对话 IDOR 用例不在 CI job、医疗安全评测集缺失 | `grep -rl "/api/hardware" backend/tests` NONE；`tests/test_middleware.py:34`（F-01）；`ci.yml:103`（job 不含 test_dialogue_api.py）；`tests/test_safety.py:4`（仅 1 条） | C1/D1 无证据；修复 SB-01/SB-06 后无回归网 | **SEC-011（建议新增·待落库）**（认证/IDOR 矩阵化测试 401/403/越权三态 × 全端点）、**SAFE-007**（医疗评测集）、**FIX-CI-01** |
| **SB-21** | P2 | `DEBUG` 无 ENVIRONMENT 分层守卫 | `config.py:37`、`main.py:103-104/:142` | 误开即对外暴露 Swagger | SEC-003 合并（目录既有：DEBUG=False 强制、docs 关闭） |
| **SB-22** | P2 | `REFRESH_TOKEN_EXPIRE_DAYS` 定义无实现（配置漂移） | `config.py:59` | 文档与实现不一致，易误判已有刷新能力 | SEC-005 合并 |
| **SB-23** | P2 | `COOKIE_SAMESITE=none` 与 `COOKIE_SECURE` 无联动校验 | `config.py:152/:155`、`api/auth.py:106-107` | 误配 `none`+`secure=False` | SEC-003 合并（目录既有：COOKIE_SECURE 及其联动校验） |
| **SB-24** | P2 | CI 以命令行传 AK（可能进进程列表/日志） | `ci.yml:197`、`:207-208` | Secret 侧漏风险 | FIX-CI-01 合并 |
| **SB-25** | P2 | `.env.example` 与 `backend/.env.example` 键集不一致（Cookie 键 vs POSTGRES 键） | 见 §3.1.2 | 部署期漏配安全相关键 | OPS-006（建议新增·待落库）合并（部署前置配置校验清单）；其中安全相关键（COOKIE_SECURE/CORS_ORIGINS）亦属 SEC-003（目录既有：生产配置硬化）的 checklist 范围 |
| **SB-26** | P2 | 无 CSP；后端自身不设安全响应头 | `deploy/nginx-production.conf:72-74`（三项，无 CSP） | C3 安全响应头不完整 | SEC-003 合并（目录既有：安全响应头（nginx）、docs 关闭） |
| **SB-27** | P2 | 发音上传无体积/类型上限（对话端有）；`except Exception: pass` 静默吞异常 | `services/pronunciation_service.py:119-120/:185-186`；见 §1.2 #17 | 资源型 DoS 面 + 违反 `80-testing.md` "禁止 catch 后静默吞异常" | SEC-006（异常收敛为错误码）/SEC-009（参数上界校验）合并；本项上传端点的**限流失效**部分归 SEC-007（建议新增·限流路径失配子项） |
| **SB-28** | **P1** | `:5432` 存在身份未知且绑全网卡的 PostgreSQL 监听（NB-01 续证），默认 `DATABASE_URL` 正指向它 | 引用 M0-002 NB-01（`BACKEND_TEST_BASELINE.md`）既有 `netstat` 只读观测；目标库指向 `core/config.py:41`。**本任务未重跑 netstat、未连接/探测 :5432**（依 DATABASE_IMPACT"宿主 :5432 零接触"更严格口径） | 非 loopback 绑定 → 局域网攻击面；与"专用一次性库"要求不符；与 SB-31 叠加构成"默认配置即向未知实例写入" | 依 NB-01 既有方向：一次性容器测试库（本任务口径 `:55433`）+ 默认连接串去指向化（与 SB-19 合并 **SEC-010**）。交叉引用只能是 NB-01，不写 F-18 |
| **SB-29** | **P2** | `.gitignore` 缺通用 env 兜底规则：`.env.production`/`.env.staging`/`*.env` 不被忽略 | `.gitignore` 仅 `:28-.env`、`:29-.env.local`、`:30-.env.development.local`、`:31-.env.test.local`、`:32-.env.production.local`，无 `.env*`/`*.env` 通配；假想路径 `git check-ignore -q` 全 exit 1（§3.1.3） | 现状安全（7 个 env 全被忽略或仅模板），但一次命名变更即可让真实口令进入提交历史 | **OPS-007（建议新增·待落库）**：补 `.env*`、`!.env.example` 兜底规则。不复用 OPS-004——目录内 OPS-004=Release Gate 证据包（`TASK_CATALOG.md:173`），与本项语义不符；`.gitignore` 属治理文件，须后续有权 Task 修改，**本任务未改 `.gitignore`** |
| **SB-30** | **P2** | 硬件固件凭据只能以源码常量存在（无密钥置备通道），诱导"把真实口令提交进仓库" | `esp32-rehab-station.ino:39/:40`（WIFI_SSID/PASSWORD 占位常量）、`:43 WS_HOST`、`:229 WiFi.begin`；`grep -rnEI "authorization\|token\|api_key\|bearer\|secret" hardware/` exit 1（零鉴权材料） | 与 C2"无硬编码密码"在硬件面无法成立（当前因全占位侥幸通过扫描）；凭据轮换无路径 | **SEC-012（建议新增·待落库）**（设备配网凭据独立置备通道 + 设备 Token 后端签发，配合 SB-32）；`README.md` 示范写法同批修正 |
| **SB-31** | **P0** | 应用启动无条件建表 + 写种子数据（无环境守卫），叠加默认指向未知实例 → 非预期写入真实/未知数据库 | `main.py:46 await init_database()`、`:49 await seed_data()`（**均无 `if settings.DEBUG`/ENVIRONMENT 判定**）；`db/init_db.py:15 Base.metadata.create_all`、`:19 seed_data`、幂等守卫只看 ItemBank 是否为空、`:162/:199` 写演示账号 `13800000001`(patient)/`13800000002`(therapist)、`:205 commit`；默认串 `config.py:41` | 在未显式设 DATABASE_URL 的机器上 `uvicorn` 即对身份未知实例执行 DDL+写入：① 污染真实库（违反"禁止改生产库"精神）② 绕过 alembic 口径（`50-database.md`）③ 产生可登录演示账号（验证码登录链 SB-33） | **SEC-013（建议新增·待落库）**（启动禁 create_all，改 alembic 单一入口 + 环境守卫）+ **OPS-006（建议新增·待落库）**（部署前置 ENVIRONMENT/DATABASE_URL 必填校验）。不复用 OPS-003——目录内 OPS-003=容量与性能压测（`TASK_CATALOG.md:172`），与本项语义不符。属 HUMAN 排期 |
| **SB-32** | **P1** | 设备 WebSocket 通道零鉴权，设备身份由设备自报；默认在所有网卡 `:8001` 启用 | `hardware/config.py:23 HARDWARE_ENABLED=True`、`:33 HW_WS_HOST="0.0.0.0"`、`:36 HW_WS_PORT=8001`；`hardware/protocols/websocket_protocol.py`（`device_id=payload.get(...)` 无凭据/白名单校验）；固件 `esp32-rehab-station.ino` `webSocket.begin(WS_HOST,WS_PORT,...)`；`grep -rncE "token\|Depends\|verify\|api_key\|Authorization" backend/app/hardware/ --include=*.py` 无有效命中 | 局域网内任意主机可伪装设备注册劫持指令流 / 向真实设备投递执行器指令（LED/蜂鸣/振动=患者侧物理刺激），与 SB-06 构成硬件面两面失控；启动失败仅 `logger.warning` 静默降级 | **ADMIN-001** + **SEC-004（建议新增）**（设备双向凭据置备 + 注册白名单 + 非 loopback 默认关闭）；`HARDWARE_ENABLED=True` 默认值属 HUMAN |
| **SB-33** | **P2** | 手机号形态数据散布代码/种子/测试，无"保留号段"约定（登录方式使该形态具账号劫持语义） | `grep -rnE "1[3-9][0-9]{9}" --include=*.py backend/app backend/tests backend/scripts` 命中分布于 init_db/conftest/多测试文件；账号标识=手机号（`auth_service.py:25-28`）；`80-testing.md` 规则 6 未约束测试手机号形态（治理缺口） | 种子落入非本地库 → 演示账号可被"向该号发验证码"路径登录（号码真实即触达陌生人）；测试与真实号段同形，核对时难分辨合成数据 | **PRIV-009（建议新增·待落库）**（约定保留号段，种子/测试统一改用；配 PRIV-005）；是否入 `80-testing.md` 由 HUMAN 讨论（本任务无权改规则） |
| **SB-34** | **P2** | `docker compose` 在本仓库当前目录不可用（非 ASCII 目录名致 project name 为空），团队回落"直接 uvicorn 跑"，绕开 compose 端口隔离 | `docker compose config --quiet` exit 1（`project name must not be empty`）；`docker compose -p <name> config --quiet` exit 0；compose 侧 db/redis 未发布端口、backend 仅 `:8000`、`8001` 在 compose/deploy 全文无映射（`grep -rnE "8001" docker-compose.yml deploy/` exit 1） | 部署口径不一致：compose 路径不暴露设备 WS，直跑路径暴露（SB-32 风险变现实）；`version` 键已废弃 | **OPS-005（建议新增·待落库）**（固化 COMPOSE_PROJECT_NAME/-p 用法、移除废弃 version）；与 SB-32 同批 |
| **SB-35** | **P1** | 同意（consent）只有数据结构，无任何"未同意即拒绝"执行路径，无同意记录/撤回入口 | `models/user.py:15 consent_flags JSON`；`api/auth.py:141` 仅回显；`db/init_db.py:167` 播种；`auth_service.py:97-105 update_preferences` 只写 `cochlear_info["accessibility"]`，**不校验/不记录/不改动同意**；`grep -rn "consent_flags" backend/app --include=*.py` 全为定义/回显/播种/docstring；`grep -rnE "if .*consent\|consent.*==" backend/app` 零命中 | D 类健康/语音数据处理缺同意前置（违反隐私宪章）；`model_training:false` 形同虚设（无代码读取）；用户无法撤回同意 | **PRIV-001**（目录既有：Consents 表 + 版本化协议 + 缺失受限拒绝测试）+ **PRIV-010（建议新增）**（同意变更审计 + 撤回入口 + 真实生效路径）；与 SB-07 同批 |

**计数**：P0 = SB-01…SB-06 + **SB-31**（**7 条**）；P1 = SB-07…SB-20 + **SB-28** + **SB-32** + **SB-35**（**17 条**）；P2 = SB-21…SB-27 + **SB-29** + **SB-30** + **SB-33** + **SB-34**（**11 条**，SB-27 含两项）→ **合计 35 条**。
编号说明：SB-28…SB-35 为口径复核阶段追加，按发现顺序顺延、不按严重度重排，以保持前文（§0/§3/§4/§5）所有 `SB-xx` 交叉引用稳定；旧编号（含上一版）全部保留，无断代。
`docs/workflow/TASK_CATALOG.md` **未被改动**（见 §11）。

---

## 10. 数据库接触声明 + 命令留痕

### 10.1 数据库接触（口径写死，避免"零命令"式误解）

| 类别 | 是否执行 | 说明 |
|---|---|---|
| 安全回归三件套（required G-SECURITY-REGRESSION） | **是（sqlite）** | `conftest.py:24` 默认 `TEST_DATABASE_URL=sqlite+aiosqlite://` 内存库，Redis/外部 AI 全 mock；未触任何真实库 |
| postgres 口径三连（record G-BASE-POSTGRES-TRIPLE） | **是（隔离一次性实例）** | 仅连接 `postgres:16-alpine @127.0.0.1:55433`（容器 `aiear-m0006-pg`，库 `aiear_m0006`），`pg_isready` 直调确认就绪，跑完 `docker rm -f aiear-m0006-pg` **已清理**；无残留（§10.3 E30） |
| 连接/探测宿主 `:5432` | **否** | 全程未对 `:5432` 发起连接、`nc`、`pg_isready`、驱动连接；本任务连 netstat 观测亦**未重跑**（比上一版更严格），SB-28 以引用 M0-002 NB-01 既有只读留痕交付 |
| `alembic` / `psql` / 生产删除 | **否** | 依 OUT_OF_SCOPE（F-15 head 不可达属 M0-004 record）未运行任何迁移门禁 |
| `docker run`（一次性 postgres） | **是** | 仅限 `aiear-m0006-*` 前缀、端口 55433，用后即删；未 `up`/`compose` 生产编排、未建共享卷/网络 |
| grep/find/git ls-files/git check-ignore/sed -n/test -f | **是** | 只读文件系统与索引取证 |

### 10.2 本任务已执行命令（全量留痕，真实 exitCode）

| # | 命令（执行目录） | kind | exitCode | 输出摘要 |
|---|---|---|---|---|
| E1 | `git rev-parse --short HEAD` / `git status --porcelain`（仓库根） | 取证 | 0 / 0 | `506f5ee`；仅 2 条 pre-existing untracked |
| E2 | `git diff --quiet HEAD` | 取证 | 0 | tracked 零改动 |
| E3 | `git diff --stat 1a62703..HEAD -- backend/app backend/tests backend/scripts` | 取证 | 0 | **空输出**（后端源码/测试自上一版以来零变更） |
| E4 | `grep -rhoE "@router\.(get\|post\|put\|delete\|patch)\b" backend/app/api \| wc -l` + 逐模块 `-cE` | 取证 | 0 | **37**（auth5/dialogue4/hardware9/health2/metrics3/pronunciation4/report4/training6） |
| E5 | `sed -n '9,63p' backend/app/api/deps.py` | 取证 | 0 | `get_current_user:9`、Bearer→Cookie `:15-20`、`get_current_therapist:55-63`（role 取 DB `:58`） |
| E6 | `sed -n '44,52p;61p;111,131p' backend/app/middleware/performance.py` | 取证 | 0 | CACHEABLE_PATHS 含 report/summary、report/levels；key=path+query，仅 Bearer 时加 user_id → SB-01 |
| E7 | `grep -nE "COOKIE_SECURE\|COOKIE_SAMESITE\|CORS_ORIGINS\|DEBUG\|DATABASE_URL\|SECRET_KEY"` config.py | 取证 | 0 | `:37 False`、`:41`（口令脱敏）、`:49 ""`、`:135`、`:152 False`、`:155 lax`、校验器 `:158-172` |
| E8 | `grep -nE "^    [A-Z][A-Z0-9_]*:" config.py \| wc -l` | 取证 | 0 | **35 个配置键**（校正上一版 36，见 §11.1） |
| E9 | `grep -nE "@router\|add_header\|Content-Security" deploy/nginx-production.conf` | 取证 | 0 | `:72-74` 三头、无 CSP → SB-26 |
| E10 | `sed -n '55,63p' deploy/serverless.yml` + `grep -nE "COOKIE_SECURE\|CORS_ORIGINS" serverless.yml` | 取证 | 0/1 | `:58 DEBUG:"false"`、`:60/:62/:63 ${env.*}`；Cookie/CORS 键**零命中（exit 1）** → SB-13a/b |
| E11 | `find . -name '.env*' -o -name '*.env'`（排除 .git/node_modules/venv*/__pycache__） | 取证 | 0 | **7 个**（§3.1.2）；**均未读取值** |
| E12 | `git check-ignore -v .env backend/.env …` + 假想路径 `git check-ignore -q` | 取证 | 0 / 1 | 现存 7 个 IGNORED/TRACKED(模板)；`.env.staging/.env.production/*.env` **NOT_IGNORED** → SB-29 |
| E13 | `grep -nE "workflow-state/\*.spec.json" .gitignore` | 取证 | 0 | `:106`（spec 落盘被忽略，不计入 porcelain） |
| E14 | 供应商密钥指纹正则（口径③）扫全仓（排除忽略目录） | 取证 | 1 | **零命中**（无 sk-/AKIA/ghp_/xox/LTAI 真实凭据） |
| E15 | `grep -rn "logger\.(info\|…)" backend/app --include=*.py \| wc -l` | 取证 | 0 | **135**（§5） |
| E16 | `grep -rn "setup_logger" backend/app` + `grep basicConfig backend/app` | 取证 | 0 / 1 | 仅导出未调用；stdlib 轨无 handler 配置 → SB-14 |
| E17 | `grep -n "phone\[-4:\]\|setex\|stored == code" auth_service.py` | 取证 | 0 | `:37` 手机号后 4 位、`:28` 明文存储、`:45` 非恒定时间 → SB-10 |
| E18 | `grep -rn "audio/{user_id}" backend/app` + `grep -rniE "audit\|safety_event" backend/app` | 取证 | 1 / 1 | **均零命中** → SB-15、隐私审计缺失 |
| E19 | `grep -n "consent_flags\|cochlear_info\|role\|cascade" backend/app/models/user.py` | 取证 | 0 | `:11 role default patient`、`:15 consent_flags JSON`、`:18-22` 无 cascade |
| E20 | `grep -nE "create_all\|13800000001\|13800000002\|commit" db/init_db.py` + `grep -nE "init_database\|seed_data\|DEBUG" main.py` | 取证 | 0 | init `:15 create_all`、`:162/:199` 演示账号、`:205 commit`；main `:46/:49` 无环境守卫 → SB-31 |
| E21 | `grep -nE "medical_patterns\|messages\[-1\]\|buffer\[-\|不提供任何医疗建议" ai/llm_gateway.py` | 取证 | 0 | `:224` 硬编码 4 项、`:251/:317` 末条消息、`:347 N=200`；免责 6 处 `:52/:74/:95/:115/:135/:197`（§8.1） |
| E22 | `grep -rnE "诊断\|处方\|用药\|剂量\|调机\|治愈\|疗效\|必然" backend/app --include=*.py`（§8.1） | 取证 | 0 | 仅安全关键词表本身命中，非面向用户文案 → **未发现** |
| E23 | `sed -n '1,10p;103p' .github/workflows/ci.yml` + `git branch -a` | 取证 | 0 | 触发 main/develop（`:5/:7`），job postgres `:103`；实测**无 main 分支** → SB-03 |
| E24 | `sed -n '21,25p;150p' services/patient_service.py` + `sed -n '60,68p' api/report.py` | 取证 | 0 | `:25 select(User).where(role=='patient')` therapist_id 未过滤、`:150` phone → SB-07 |
| E25 | `grep -nE "limit\|Query(" api/metrics.py api/pronunciation.py` + `sed -n '50,62p' api/hardware.py` | 取证 | 0 | metrics `:68 limit=20` 无上界；发音 `Query(20,ge=1,le=100)` 有界；硬件 `:54/:59-60` 无界 → SB-17/SB-06 |
| E26 | `grep -n "RATE_LIMITS" -A4 middleware/performance.py` + `grep -nE "@router" api/pronunciation.py` | 取证 | 0 | 限流含 `/evaluate`，端点无该路径 → 路径失配 SB-13 |
| E27 | `grep -rncE "…鉴权词" backend/app/hardware/ --include=*.py` + `grep -rnEI "authorization\|token…" hardware/` | 取证 | 1 / 1 | 零命中 → SB-30/SB-32 固件与后端硬件面均零鉴权材料 |
| E28 | `grep -nE "HARDWARE_ENABLED\|HW_WS_HOST\|HW_WS_PORT" backend/app/hardware/config.py` | 取证 | 0 | `:23 True`、`:33 0.0.0.0`、`:36 8001` → SB-32 |
| E29 | `grep -nE "cache_key =\|object_key =" ai/tts_gateway.py` | 取证 | 0 | `:96 tts:{voice}:{text_hash}`、`:261 tts/{voice}/{text_hash}.wav`（无用户标识，内容为 AI 示范音） |
| E30 | `docker run -d --name aiear-m0006-pg … -p 127.0.0.1:55433:5432 postgres:16-alpine`；`docker exec … pg_isready`；三连；`docker rm -f aiear-m0006-pg` | 取证 + **RECORD** | 0 / 0 / **1** / 0 | 隔离实例就绪；三连 `4 failed, 8 passed, 20 errors`（F-M0005-02 复现，§6.2）；容器已删除，无残留；宿主 `:5432` 零接触 |
| E31 | `git status --porcelain`（写入交付物后） | Scope 守卫 | 0 | 恰 `?? deliverables/baseline/SECURITY_BASELINE.md` + `?? docs/qgraphflow/dialogue-turn-sequence/`（覆写不改未跟踪性质）；无任何 M/D 条目 |

### 10.3 required 门禁执行结果（本任务口径，脚本按真实 exitCode 裁决）

| gateId | kind | 本任务实测 exitCode | 摘要 |
|---|---|---|---|
| G-DELIVERABLE-EXISTS | required | 0 | 交付物存在且非空 |
| G-DELIVERABLE-CHAPTERS | required | 0 | 章节关键词全命中（端点/归属校验/test_role_permissions/Secret/CORS/日志脱敏/真实性/隐私/P0/F-M0005-01/F-M0005-02/FIX-INT-01/missing_evidence） |
| G-MEDICAL-SECTION | required | 0 | §8 含"医疗边界"章节 |
| G-API-DECORATOR-COUNT-37 | required | 0 | 装饰器计数 = 37（§1.1） |
| G-SECRET-LEAK-NEGATIVE | required | 0 | 交付物零真实 Secret 值（无 sk-/LTAI/ghp_/PRIVATE KEY 命中） |
| G-SECURITY-REGRESSION | required | 0 | 安全三件套 sqlite 口径 **10 passed / exit 0**（§6.1，解释器 venv312） |
| G-WORKTREE-GUARD | required | 0 | tracked 零改动、HEAD=506f5ee、porcelain 恰 2 条 |
| G-QGRAPHFLOW-INTACT | required | 0 | qgraphflow 两文件 sha256 与封存值逐字节相等 |

> GATE_HEALTH = **PASS 口径待脚本裁决**（上列为本任务自测预期，最终以 Workflow 按真实 exitCode 计算为准；实施者无 PASS 权）。

### 10.4 record 门禁执行结果（存量红记 Findings，不 MACHINE_FAIL）

| gateId | kind | exitCode | 摘要 | 双真相 |
|---|---|---|---|---|
| G-BASE-PYTEST-FULL | record | 1 | `1 failed, 231 passed`；唯一红 = `test_middleware.py:34`（assert 401==200，F-01）——与 M0-002 基线一致，无新增失败 | PROJECT_BASELINE_HEALTH=DEGRADED |
| G-BASE-RUFF-FULL | record | 1 | **Found 291 errors**（I001=65/B008=56/UP045=55…）——M0-005 存量债 | DEGRADED |
| G-BASE-RUFF-CI | record | 0 | `All checks passed!`（`--select E,F,W --ignore E501`，ci.yml:41 同款窄口径绿） | — |
| G-BASE-POSTGRES-TRIPLE | record | 1 | **4 failed, 8 passed, 20 errors**（`asyncpg InterfaceError: another operation is in progress`）——F-M0005-02 逐位复现，待 FIX-INT-01 | DEGRADED |

> PROJECT_BASELINE_HEALTH = **DEGRADED**（判据来源：G-BASE-PYTEST-FULL exit1 + G-BASE-RUFF-FULL exit1 + G-BASE-POSTGRES-TRIPLE exit1，均为既有存量红，`recordStatus=EXECUTED_AND_RECORDED`，不使本 Task MACHINE_FAIL、不触发修复循环）；GATE_HEALTH 由 required 项决定（§10.3）。**双真相分列，不以 record 红冒充 required 红，也不以 required 绿掩盖 record 红。**

---

## 11. Scope 与治理合规自检（供 Machine Gate / Review / Verify 核对）

- **唯一写入文件** = `deliverables/baseline/SECURITY_BASELINE.md`（= `EXPECTED_FILES` / `ALLOWED_WRITE_PATHS` 全集，RETRY_OWNED 覆写，旧身份 sha256=`72fd898f…`/97758 B）。
- **零代码/零治理改动**：`backend/**`、`frontend/**`、`docs/**`（含 `docs/workflow/**`、`docs/qgraphflow/dialogue-turn-sequence/**`）、`AGENTS.md`/`agents.md`、`.qoder/**`、`.gitignore`、`.github/**`、`docker-compose.yml`、`deploy/**` —— 全部无 diff（E2/E31）。
- **pre-existing untracked 未触碰第二项**：`docs/qgraphflow/dialogue-turn-sequence/`（只读、sha256 逐字节不变，G-QGRAPHFLOW-INTACT）。
- **未修复任何缺陷**：§9 全部为 finding 记录（含医疗文案缺口，依 OUT_OF_SCOPE 未做任何"顺手改"，未动 conftest/测试代码）。
- **零 Secret 输出**：本文只出现变量名与 `文件:行号`；`.env` 未读取；`config.py:41` 口令、`ci.yml`/`conftest.py` 测试密钥均**行号引用、不摘录值**；供应商密钥指纹正则口径③ 零命中。
- **Git 安全**：无 push/merge/rebase/reset/clean/checkout/restore/stash/tag；无 commit；HEAD 保持 506f5ee；无 `git add -A/.`。
- **数据库安全**：postgres 三连仅连一次性隔离实例 `:55433`（容器 `aiear-m0006-pg`），用后 `docker rm -f` 清理；宿主 `:5432` 全程零连接、零探测、未 netstat；无 `drop/truncate/downgrade`；未运行 alembic。
- **本任务不宣布 PASS**：Task PASS = Machine Gate PASS（真实 exitCode）∧ 独立 Review（HIGH Risk A+B 均 PASS）∧ Verify TASK_PASS ∧ Task Delta ∧ Governance Guard。

### 11.1 与 SPEC / 上一版报告的偏差与校正（如实记录，不改设计）

1. **审查 HEAD**：SPEC/本次上下文为 `506f5ee`；上一版报告头写 `1a62703`。已在本版全部证据按 `506f5ee` 复核，且 E3 证明后端源码自 `1a62703` 起零变更，故上一版 `文件:行号` 结论在本 HEAD 仍成立。
2. **配置键计数**：上一版记 `config.py` 为 36 键，本任务逐行 `grep -cE "^    [A-Z][A-Z0-9_]*:"` 实测 **35** 键，本版以 35 为准（§3.3/§4.2），未据此改动任何代码。
3. **免责声明命中**：上一版记 `llm_gateway.py` "不提供任何医疗建议" 为 `:36/:59/:80/:101/:121` 5 处；本任务逐字复核为 `:52/:74/:95/:115/:135/:197` **6 处**，本版以实测为准（§8.1）。
4. **§9 任务编号建议重映射与本轮二次校正（AC-08）**：上一版把缓存 IDOR 记 "SEC-001"、设备归属记 "SEC-002"、therapist 越权记 "PRIV-006"、号段记 "PRIV-007" —— 与 `TASK_CATALOG.md` 内 **SEC-001=依赖漏洞扫描、SEC-002=渗透复测、PRIV-006/007=既有语义** 冲突。本版初稿虽做了重映射，但**仍有三处失实**（Review blocker 指认，经复核成立）：把缓存 IDOR 记为 "SEC-003（建议新增）"（目录 `:169` 已占用 SEC-003=生产配置硬化）、新提 "SEC-007（生产配置矩阵+部署期强制覆盖）"（与既有 SEC-003 语义重叠）、把 OPS-002/OPS-003/OPS-004 当作"目录既有：配置校验清单/部署前置必填/gitignore 兜底"（目录实际 `:171` OPS-002=部署冒烟与回滚演练、`:172` OPS-003=容量与性能压测、`:173` OPS-004=Release Gate 证据包）。本轮改判（仅改"建议编号"列，**SB-\* 缺陷编号与级别原样保留**，缺陷账本不断代）：SB-01 → **SEC-014**；生产配置族 SB-13/SB-21/SB-23/SB-26 → 复用既有 **SEC-003**，SEC-007 限定为 SEC-003 未覆盖的限流路径失配子项（SB-13/SB-27）；SB-13/SB-25/SB-31 的配置校验与部署前置 → **OPS-006**；SB-29 的 `.gitignore` 兜底 → **OPS-007**；设备归属保持 SEC-004。**复核方式**（可复跑）：`grep -oE "(SEC|OPS|PRIV|SAFE|ADMIN)-[0-9]+" docs/workflow/TASK_CATALOG.md | LC_ALL=C sort -u` 取目录占用集，与本表建议集比对——凡标"建议新增·待落库"的 ID（SEC-004…SEC-014、OPS-005…OPS-007、PRIV-008…PRIV-010、FIX-INT-02、FIX-API-01、FIX-CI-01）在目录中**零命中**；凡标"目录既有"的 ID（SEC-001/002/003、OPS-001…004、SAFE-001…007、PRIV-001…007、ADMIN-001）在目录中命中且报告所述 Scope 与目录条目语义一致。`docs/workflow/TASK_CATALOG.md` **未被改动**（治理文件，Flash 禁区）。
5. **postgres 三连由"引用"升级为"实测"**：上一版 §6.2 仅引用 INTEGRATION_BASELINE 留痕；本版在授权隔离实例 `:55433` 真实复跑，逐位复现 F-M0005-02（4f/8p/20e），并据此在 §6 显式引用 **F-M0005-01 / F-M0005-02 / FIX-INT-01**（AC-04）。
6. **`netstat` 观测**：上一版对宿主 `:5432` 做过只读 `netstat` 观测（NB-01 续证）；本版遵 DATABASE_IMPACT"宿主 :5432 零接触"更严格口径**未重跑 netstat**，SB-28 以引用 M0-002 既有留痕交付并显式声明取证方式。
7. **工具层陷阱规避（F-37）**：所有自证命令均为无外层单引号包裹的直接命令；postgres 就绪用 `pg_isready` 直调（未用 `sh -c 'for…'` 形态）。解释器全程 `backend/venv312/Scripts/python.exe`（未误用无 pytest 的 `backend/venv`）。

### 11.2 已知局限（不夸大结论）

- 硬件面、AI 网关真实 SDK 行为、OSS 隔离与越权拒绝、依赖漏洞（C5）、性能与 ASR 延迟均属 Release Gate 独立项，本任务**未裁决**（§12）。
- postgres 口径安全结论依本次实测：13 条安全用例未达断言层 → 验证不成立（F-M0005-01），修复依赖 FIX-INT-01。
- 前端凭据存储/401 处理面未审查（OUT_OF_SCOPE，前端零改动）。
- §3.2 "已跟踪文件无真实凭据"依赖口径②③（含 deploy/hardware/.github）；被忽略的 `.env` 本体**内容未知**（未读取），故"本机 `.env` 是否含真实生产凭据"本任务不作结论（§12 H-3）。

---

## 12. 需要人工 / 云外权限才能验证的项（本任务口径内**不可判定**，一律 `missing_evidence`）

> 设立本节原因：安全基线最易出的事故是"把'本地看不到问题'当成'生产没问题'"。以下项在只读、离线、无云账号、无生产库、无真机设备口径下无法取证，任何后续 PASS 裁决须先补证据或由 HUMAN 明确豁免。

| # | 待验证项 | 为何本任务验不了 | 需要权限/动作 | 责任人（建议） | 可接受证据形态 | 关联发现 |
|---|---|---|---|---|---|---|
| H-1 | 依赖漏洞（C5：pip-audit/npm audit） | 需出网访问 PyPI/npm 漏洞库，本任务未获出网授权 | CI 或本地一次性联网扫描 | 实施者（后续 Task） | `pip-audit`+`npm audit --json`+exitCode | G-11 |
| H-2 | 云端生产环境变量实际取值（COOKIE_SECURE/CORS_ORIGINS/DEBUG/OSS_*） | 值在云函数控制台/生产 `.env`，仓库仅 `${env.*}` 间接引用（serverless.yml:60-63） | 云账号只读 | **HUMAN** | 控制台变量清单（脱敏）比对 §4.2 | SB-13a/b、SB-31 |
| H-3 | 本机 `.env`/`backend/.env` 内是否为真实凭据 | 用户明令禁止读取；文件存在且被忽略（E11/E12） | 仓库所有者自行核对 | **HUMAN（本机所有者）** | `grep -c` 计数 + 人工确认未复用生产密钥，不回传原文 | §3.1.2 |
| H-4 | GitHub Secrets 是否真配置、是否与 CI 分支匹配 | 需仓库管理员令牌；`gh secret list` 需鉴权 | `gh auth` + 仓库 admin | **HUMAN** | `gh secret list`+`gh run list` 证明 CI 曾触发 | SB-03 |
| H-5 | `:5432` 监听者身份与所托管数据库 | 本版遵零接触口径未观测；确认需本机管理员权限与服务枚举 | 机器所有者核对（不连接） | **HUMAN（本机所有者）** | 服务/进程归属说明 + 改端口/改默认串或停用 | SB-28、NB-01 |
| H-6 | OSS 桶策略、前缀隔离、签名 URL 有效期与生命周期 | 需云存储权限；仓库仅桶名/Endpoint 默认值（config.py:125-131） | 云存储只读 | **HUMAN** | 桶 Policy、`audio/{user_id}/` 读写拒绝实测 | SB-15、D4 |
| H-7 | 真机设备在局域网/现场可达性与鉴权缺失后果 | 无 ESP32 真机、无现场网络；本任务仅静态取证 | 硬件+现场网络访问权 | **HUMAN（硬件负责人）** | 现场抓包/未授权设备伪装尝试 | SB-06、SB-32、SB-30 |
| H-8 | AI 网关真实 SDK 行为（关键词命中后上游模型是否仍产出医疗建议） | 需 DASHSCOPE_API_KEY 出网调用，测试全 mock | 云 AI 凭据+出网+评测预算 | **HUMAN 批准后由评测 Task 执行** | 医疗安全评测集（SAFE-007）通过率+原始响应留痕 | SB-05、SB-08 |
| H-9 | 急症/心理危机转诊文案的医学正确性 | 医疗判断不属工程裁决；70-medical-safety 要求专家审查 | 医学/听力学专家评审 | **HUMAN（医疗顾问）** | 评审签署记录 + 文案冻结版本号 | SB-04 |
| H-10 | postgres 口径安全用例的当前真实结果（13 条是否仍未达断言层） | 需一次性容器跑 DB（本任务已实测确认仍红，但修复与复跑属后续 FIX） | 授权一次性容器 + 清理 | 实施者（FIX-INT-01 Task） | 同口径复跑日志 + 逐条"到达断言层"清单 | **F-M0005-01 / SB-02** |
| H-11 | 真实 HTTPS 链路下 Cookie 行为（Secure/SameSite 落地） | 本地无 TLS 终结与真实域名 | 线上/预发域名访问权 | **HUMAN** | 浏览器 DevTools Cookie 属性 + `curl -I` 头 | SB-13b、G-5/G-6 |
| H-12 | 日志实际落盘面（云日志/容器 stdout 是否含 §5 四类敏感值、保留期） | 本任务只看代码内 logger；云日志聚合与留存策略在平台侧 | 云日志只读 | **HUMAN** | 日志样本抽查（脱敏）+ 留存策略配置 | SB-14、C4 |
| H-13 | 缓存后端（Redis）实例是否共享/是否有 ACL/是否暴露 | config.py:45 默认 `redis://localhost:6379/0`，真实实例配置在平台侧 | 云 Redis 只读 | **HUMAN** | 实例访问控制与网络暴露说明 | SB-01（缓存 IDOR 放大面） |
| H-14 | 备份/恢复与删除权实际可执行性 | 需接触生产数据与备份系统；本任务零生产 DB 接触 | 数据责任人授权 | **HUMAN + 后续 PRIV Task** | 演练记录（沙箱库）+ 删除链路验证 | SB-11、PRIV-002 |

**裁决规则（写给后续 Review/Verify）**：以上任一项未取证据时，相关门禁条目（C3/C4/C5/C6/D4/G3/G5）只能记 `missing_evidence`，不得记 OK，也不得因"本地扫描零命中"推定通过。
