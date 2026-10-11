# M0-008 Deploy Baseline（部署/容器基线 · 只体检不治疗）

> Task: `m0-008-deploy-baseline` · Catalog: M0-008（`docs/workflow/TASK_CATALOG.md:29`）· Type: deployment/documentation/security 基线审计 · Risk: high（securitySensitive=true，发布/部署配置口径）
> 性质声明（spec `OBJECTIVE`）：**本任务是体检不是治疗**。只测量、只审计、只记录；对 `docker-compose.yml`、`backend/Dockerfile`、`frontend/Dockerfile`、`frontend/nginx.conf`、`deploy/**`、`.github/**`、`.env`、`.env.example`、业务代码、测试、迁移的写入次数为 **0**。所有"红色"（构建失败、配置失配）作为**合法存量发现**如实呈现并归属下游任务（SEC-003 / OPS-001 / OPS-002），本任务不修复。
> 执行手：`qfmodel`（Flash，机械执行手，**无 PASS 宣布权**）。裁判：Machine Gate 脚本（按真实 `exitCode`）+ 独立 Max Review + 独立 Max Verify。
> 语义纪律（spec AC-07）：本文件对任何**运行期行为**（healthcheck 实际失败、容器实际状态、冒烟实际响应）**不使用"已验证/已通过"表述**；未执行的运行期核验逐条标注 `SAFELY_NOT_EXECUTED_AND_RECORDED` 或 `missing_evidence`。文中出现的"配置级推断"字样均指从配置文本与代码文本静态读出的因果链，未经受运行。

---

## 0. Baseline Snapshot（本轮实测）

| 项 | 真实值（本轮采集） |
|---|---|
| 仓库根 | `D:/systemDir/Desktop/听觉康复`（目录名非 ASCII，见 §A.4 根因） |
| branch | `feature/m0-baseline`（`git branch --show-current` 本轮实测） |
| HEAD | `86ab318de0f561e84511c7399aee1e6793606a6f`（`git rev-parse HEAD` 本轮实测） |
| 实施前 working tree | `git status --porcelain` = 仅 `?? docs/qgraphflow/dialogue-turn-sequence/`（pre-existing 未跟踪树单元，本轮零触碰） |
| Docker 引擎 | Server `29.5.2`（`docker version --format '{{.Server.Version}}'` 实测 exit 0，守护进程运行中） |
| Compose CLI | `v5.1.4`（G-COMPOSE-CLI 实测 exit 0） |
| 采样窗口（UTC） | `2026-10-09T20:18:17Z` – `2026-10-09T20:22:30Z`（各命令时刻见 §A；本地 TZ=UTC+9） |
| 上游基线引用 | `deliverables/baseline/FRONTEND_BASELINE.md`（M0-003：五命令 exitCode 0）、`deliverables/baseline/DB_API_BASELINE.md`（M0-004：C-1/C-2、端点表、迁移三连实录）——直接引用，不重复验证 |
| 本文件角色 | 本任务唯一合法产物（写前实测不存在）；不被 gitignore 忽略，写入后以未跟踪新文件出现，不影响 `git diff --exit-code HEAD` |

---

## A. 构建/配置实测记录（gateId + 命令原文 + exitCode + 证据摘录）

### A.1 门禁对账表（声明集 10 条 = 提交集，gateId 逐条对应 spec `MACHINE_GATE_COMMANDS`）

| # | gateId | kind | 命令原文（cwd=仓库根，逐字） | 本轮实测 exitCode | 归类 |
|---|---|---|---|---|---|
| 1 | G-COMPOSE-CLI | record | `docker compose version` | 0 | 绿（CLI 可用 v5.1.4） |
| 2 | G-COMPOSE-CONFIG | record | `docker compose config --quiet` | **1** | 红=合法存量发现（项目名解析失败，§A.4） |
| 3 | G-BUILD | record | `docker compose build` | **1** | 红=合法存量发现（同上，未进入构建阶段，零镜像副作用，§A.3/A.5） |
| 4 | G-DOCKER-PS | record | `docker ps -a --format "{{.Names}}"` | 0 | 宿主容器全集 5 项，与 Max 预实测集合一致（§A.5） |
| 5 | G-DELIVERABLE | required | `test -s deliverables/baseline/DEPLOY_BASELINE.md` | 0（写入后执行手自检复跑） | 产物存在且非空 |
| 6 | G-SCOPE-DIFF | required | `git diff --exit-code HEAD` | 0（写入后执行手自检复跑） | 全部已跟踪文件零改动 |
| 7 | G-HEAD-FIXED | required | `test "$(git rev-parse HEAD)" = "86ab318de0f561e84511c7399aee1e6793606a6f"` | 0（写入后自检复跑） | HEAD 冻结、零 commit |
| 8 | G-GOVERNANCE-DIFF | required | `git diff --exit-code HEAD -- AGENTS.md .qoder .gitignore .github docs/workflow` | 0（写入后自检复跑） | 治理区已跟踪文件零改动 |
| 9 | G-TREE-UNIT | required | `printf "%s\n%s\n" "5f12d3d4503d2305f352b21b8d275bb5e2ea544a32f3d539ea6909951373f138 *docs/qgraphflow/dialogue-turn-sequence/graph.json" "2bd127b7c22c25b20e04804cc5c745f686f7f462cae96649aa9b47612d4bf600 *docs/qgraphflow/dialogue-turn-sequence/index.html" \| sha256sum -c -` | 0（写入前预跑与写入后复跑均两行 OK） | 树单元字节级不变 |
| 10 | G-SECRET-ZERO | required | `! grep -nE` 形态模式扫描本文件（阿里云 AccessKey 长 token 前缀、`sk-` 后接长字母数字串、PEM 私钥块头字面——完整逐字命令以 spec `MACHINE_GATE_COMMANDS` 为准，本行为避免自匹配不复写模式字面） | 0（写入后自检复跑=无匹配） | Secret 零输出 |

说明：
- required 第 5/6/7/8/9/10 条由执行手在产物定稿后自检复跑；最终判定以 Workflow Machine Gate 脚本按真实 `exitCode` 计算为准（执行手自检无验收权）。
- G-TREE-UNIT 为规避 shell 转义歧义，执行时以 spec 原文形态 `printf ... | sha256sum -c -` 逐字运行；上表竖线为 Markdown 表格内转义显示，不构成命令改写。
- record 层两条红色（#2/#3）**不阻断本任务**（spec MACHINE_GATE_COMMANDS.purpose 与 AC-02/AC-08 明确口径），如实入 findings。

### A.2 G-COMPOSE-CLI / docker 环境证据

```
$ docker compose version
Docker Compose version v5.1.4
exitCode=0
```

`docker version --format '{{.Server.Version}}'` → `29.5.2`，exitCode=0（辅助只读命令，佐证守护进程可用；record 红色非"daemon 不可达"类，属确定性配置缺陷）。

### A.3 G-COMPOSE-CONFIG 与 G-BUILD 实测输出（stderr 原文摘录）

两条命令输出逐字相同（本地时刻 05:18:17+09:00 / 05:18:22+09:00，即 UTC 20:18:17Z / 20:18:22Z）：

```
time="2026-10-10T05:18:17+09:00" level=warning msg="D:\\systemDir\\Desktop\\听觉康复\\docker-compose.yml: the attribute `version` is obsolete, it will be ignored, please remove it to avoid potential confusion"
project name must not be empty
exitCode=1
```

```
$ docker compose build
（同上两行）
exitCode=1
```

与 Max 2026-10-10 预实测（exitCode=1、`project name must not be empty`）逐字一致。失败发生在**项目名解析阶段，先于任何构建动作**：未进入网络拉取/构建上下文传输，本轮零新镜像、零新缓存层产生（`docker images` 实测镜像全集与宿主既有资产一致，见 §A.5）。

### A.4 根因归类（配置缺陷，三重证据；spec AC-02 要求项）

Compose v5 项目名解析规则要求非空、匹配 `[a-z0-9][a-z0-9_-]*` 的项目名。解析优先级（本批 Compose 5.1.4 五档只读探针实测，见下行注记）：`COMPOSE_PROJECT_NAME`（进程环境变量 > 根 `.env` 文件）> compose 顶层 `name:` > 项目目录名规范化（非 ASCII 目录名规范化后为空）。本轮三条路径全部落空：
实测优先级链：COMPOSE_PROJECT_NAME > dotenv > name: > dirname（Compose 5.1.4，五档只读探针，本批实测）。

1. **目录名非 ASCII → 规范化后为空**：项目目录即仓库根 `听觉康复`（`docker compose` 将目录名小写化并剔除非法字符集后得到空串）。
2. **`docker-compose.yml` 无顶层 `name:` 键**：全文 81 行读取核实（`docker-compose.yml:1-81`，首键区仅 `version`（L6）与 `services`（L8）），grep 证实无 `name:`。
3. **`.env` / `.env.example` 均无 `COMPOSE_PROJECT_NAME`**：根 `.env` 键名集合实测 11 键（§C.4，零值读取）、`.env.example:1-21` 11 键（§C.1），均不含该键。

附带 warning（非致命）：`docker-compose.yml:6` `version: '3.8'` 为 obsolete 键，Compose v5 忽略并告警（A.3 输出第一行，实测在案）。

**下游修复建议（本任务不实施，spec OUT_OF_SCOPE L22）**：为 compose 增加顶层 `name: <ascii-slug>`（如 `ai-hearing-rehab`），或在 `.env` 设置 `COMPOSE_PROJECT_NAME`；归属 SEC-003/OPS-002 或独立 fix 任务。修复前 `docker compose build/config/up` 在本仓库路径下确定性不可用。

### A.5 G-DOCKER-PS 与宿主 Docker 资产只读记录（零处置）

```
$ docker ps -a --format "{{.Names}}"
aiear-m0004-pg-test
dresslens-redis
dresslens-postgres
dresslens-minio
opengauss-lab
exitCode=0
```

集合与 Max 预实测全集一致 → 佐证本任务**零容器创建/删除/重启**（他会话/前序任务资产零触碰，spec AC-10）。

`docker images`（辅助只读，exitCode=0）关键事实：
- 宿主**存在** base 镜像：`python:3.11-slim`、`node:20-alpine`、`nginx:alpine`、`redis:7-alpine`。
- 宿主**不存在** compose db 服务引用的 `postgres:15-alpine`（`docker-compose.yml:48`）——既有的是 `postgres:16-alpine` 与 `pgvector/pgvector:pg15/pg16`（M0-004 前序资产）。事实记录：修复项目名后 `compose up` 需拉取 15-alpine 或调整镜像引用（归属下游决策，本任务不改）。
- `backend-backend:latest`（ID `1497c4b2aed7`）为**历史既有镜像**：本轮 build 在项目名解析阶段失败、不具备产生镜像的能力，故该镜像必早于本轮产生（前序会话资产），只记录不处置。

---

## B. 部署配置完整性审计（8 对象 × file:line）

### B.1 `docker-compose.yml`（81 行，全文读取）

| 检查项 | 事实与结论 | 证据 |
|---|---|---|
| 服务拓扑 | 4 服务：frontend / backend / db(postgres) / redis；named volumes postgres_data、redis_data | `:8-81`、`:78-81` |
| 顶层 name | **缺失** → 项目名解析失败根因之一（§A.4） | 全文 `:1-81` 无 `name:` |
| version 键 | obsolete（warning 实测在案） | `:6` |
| 端口映射 | `3000:80`（frontend→容器 80，与 `frontend/nginx.conf:54` listen 80 匹配）；`8000:8000`（backend→8000，与 `backend/Dockerfile:32` EXPOSE、`:38` bind 0.0.0.0:8000 匹配） | `:15`、`:27` |
| backend 环境变量注入 | `env_file: .env`（`:28-29`，根 .env 存在，§C.4）；environment 显式覆盖 `DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}`（`:31`，服务名 db 与 `:47` 匹配）与 `REDIS_URL=redis://redis:6379/0`（`:32`，服务名 redis 与 `:66` 匹配）。注：environment 优先级高于 env_file → `.env` 中 DATABASE_URL/REDIS_URL 两键在 compose 路径下被覆盖（事实记录） | `:28-32` |
| backend healthcheck | `python -c urllib.request.urlopen('http://localhost:8000/api/health')`（`:39`）——**路径失配**：应用实际路由为 `/health`、`/health/detailed`，字面 `/api/health` 不存在（证据链：`backend/app/main.py:124` include_router 无 prefix；`backend/app/api/health.py:14`、`:30`；`deliverables/baseline/DB_API_BASELINE.md:212-213`、`:268-269`、`:275-276` C-1/C-2）。配置级推断（SAFELY_NOT_EXECUTED_AND_RECORDED）：404 使 urlopen 抛 HTTPError → 探针命令非零退出 → backend 判定 unhealthy | `:38-43` |
| frontend 依赖顺序 | `depends_on: backend: condition: service_healthy`（`:16-18`）——叠加上一行失配的配置级推断：backend 永不 healthy → frontend 在 `compose up` 路径永不启动。本轮未起服务，仅静态结论 | `:16-18` |
| backend 依赖顺序 | `db`/`redis` 均 `condition: service_healthy`（`:33-37`）；db 探针 `pg_isready`（`:57-62`，插值 `${POSTGRES_USER:-postgres}`/`${POSTGRES_DB:-cochlear_rehab}` 有默认兜底但 POSTGRES_PASSWORD 无默认必填 `:54`）、redis 探针 `redis-cli ping`（`:70-74`）——配置级自洽 | `:33-37`、`:48-75` |
| 镜像/构建定义 | frontend/backend 本地 build context（`:11-13`、`:23-25`）；db `postgres:15-alpine`（`:48`，宿主无此 tag，§A.5）；redis `redis:7-alpine`（`:67`，宿主有） | 如左 |
| frontend healthcheck | **未定义**（`frontend/nginx.conf:113-117` 存在 `/nginx-health` 本地端点但 compose 未消费；缺口记录，归属 OPS-002） | `:10-19` |
| restart 策略 | 全服务 `unless-stopped`（`:19`、`:44`、`:63`、`:75`） | 如左 |

### B.2 `backend/Dockerfile`（45 行）

| 检查项 | 事实与结论 | 证据 |
|---|---|---|
| 基础镜像/阶段 | `python:3.11-slim AS base`（`:4`）+ 多阶段 `FROM base AS production`（`:20`）；系统依赖 ffmpeg/libsndfile1（`:9-12`） | `:4-20` |
| 依赖安装 | `COPY requirements.txt`（`:15`）+ `pip install -r requirements.txt`（`:16`）；**`gunicorn` 在 `:17` 裸装未锁版本**，且 `backend/requirements.txt` grep 无 gunicorn 条目（fastapi==0.110.0、uvicorn[standard]==0.29.0 均锁定）→ 构建可重现性风险，归属 OPS-001/SEC-003 建议 | `:16-17` |
| COPY 上下文 | `COPY . .`（`:22`）且**无 `backend/.dockerignore`**（实测不存在，根/backend/frontend 三级均无）→ 上下文将包含 `venv/`(14M)、`venv312/`(574M)、`tests/`(1.1M)、`test.db`、`.pytest_cache/`、`.ruff_cache/`、**`backend/.env`（存在，474B；被 `backend/.gitignore:3` 忽略但 Docker 构建上下文不看 .gitignore）**→ 秘密与巨量文件被 COPY 进镜像层/上传上下文的**静态风险**（本轮 build 未触及镜像层，SAFELY_NOT_EXECUTED_AND_RECORDED）；修复项目名后大概率立即遭遇。缺口归属 SEC-003（.dockerignore 建议，本任务禁创建，spec OUT_OF_SCOPE L23） | `:22`；du/wc/ls 实测 |
| 运行用户 | 非 root `appuser`（`:25-26`）✓ | `:25-26` |
| HEALTHCHECK | `urlopen('http://localhost:8000/api/health')`（`:29-30`）——与 compose `:39` 同一路径失配（实际 `/health`，`main.py:124`+`health.py:14`）；配置级推断同上，归属 OPS-002/SEC-003 | `:29-30` |
| 启动命令 | gunicorn UvicornWorker ×4、bind 0.0.0.0:8000、timeout 120s（`:35-44`）——与 EXPOSE/compose 端口一致 ✓ | `:32-44` |

### B.3 `frontend/Dockerfile`（14 行）

| 检查项 | 事实与结论 | 证据 |
|---|---|---|
| builder | `node:20-alpine`（`:1`）→ `COPY package*.json`（`:4`）→ `npm ci`（`:5`）→ `COPY . .`（`:6`）→ `npm run build`（`:7`）。源码可构建性由 M0-003 交叉证据支持（五命令 exitCode 0，含 `npm run build`，`deliverables/baseline/FRONTEND_BASELINE.md` 结论摘要）；镜像内实际执行本轮未发生（build 在项目名解析即失败）→ SAFELY_NOT_EXECUTED_AND_RECORDED | `:1-7` |
| 运行层 | `nginx:alpine`（`:9`）；`COPY --from=builder /app/dist`（`:10`）；`COPY nginx.conf → /etc/nginx/conf.d/default.conf`（`:11`）；EXPOSE 80（`:12`）——与 compose `3000:80` 匹配 ✓ | `:9-12` |
| COPY 上下文 | 同样无 `.dockerignore` → `frontend/node_modules`（宿主实测 **390M**，数万文件）、`dist/`(1.7M)、`test-results/` 进入 builder 上下文/镜像层风险（`COPY . .` `:6`）；node_modules 会被带入 builder 层再被 `npm run build` 重新生成（先 `COPY package*.json` 后 `COPY . .` 的顺序下宿主 node_modules 覆盖镜像内安装结果）→ 上下文膨胀+可重现性静态风险，归属 SEC-003/OPS-001 记录 | `:6` |
| HEALTHCHECK | 未定义（compose frontend 也未定义，见 B.1 末行）→ 缺口记录 | `:1-14` |

### B.4 `frontend/nginx.conf`（119 行）

| 检查项 | 事实与结论 | 证据 |
|---|---|---|
| 监听 | `listen 80`（`:54`）、`server_name _`（`:55`）→ compose `3000:80` 冒烟可达路径成立（配置级） | `:54-55` |
| API 反代 | `location /api/ { proxy_pass http://backend:8000; }`（`:75-76`）——服务名 `backend` 与 compose `:22` 一致 ✓；`proxy_pass` 无 URI 段 → 请求路径原样透传（`/api/xxx → backend:8000/api/xxx`），与后端业务路由 `/api/*` 前缀（`main.py:125-131`）**匹配** ✓ | `:75-76` |
| WebSocket/流式 | `proxy_http_version 1.1` + Upgrade/Connection 头（`:92-94`）、`proxy_buffering off`（`:97`）——流式 ASR/TTS 链路配置存在（运行表现属 M0-007 口径，本任务不判） | `:92-98` |
| SPA 回退 | `location / { try_files $uri $uri/ /index.html; }`（`:102-103`）——注意其副作用：非 /api/ 前缀的未知路径（如 `/health`）返回 **index.html 200**，经 3000 端口的健康探测会拿到 HTML 而非 JSON（配置级推断；由此"经前端端口探测 health"路径**失配且结果误导**，见 §D.1） | `:102-110` |
| 本地健康端点 | `/nginx-health` return 200（`:113-117`）——存在但无消费方（compose 未给 frontend 定义 healthcheck 用它）→ 缺口记录 | `:113-117` |
| 安全头 | X-Frame-Options/X-Content-Type-Options/X-XSS-Protection/Referrer-Policy（`:62-65`）——无 HSTS/CSP（对照生产版 §B.6；HTTP 容器场景下 HSTS 无意义，CSP 缺失记录给 SEC-003） | `:62-65` |

### B.5 `deploy/serverless.yml`（117 行，阿里云 FC）

| 检查项 | 事实与结论 | 证据 |
|---|---|---|
| 运行时 | FC `custom-container`（`:32`）、内存 1024M/超时 60s/并发 100（`:34-38`） | `:26-44` |
| 镜像引用 | `registry.cn-hangzhou.aliyuncs.com/cochlear-rehab/backend:latest`（`:49`）、端口 8000（`:50`）——与 ci.yml 推送 tag（`.github/workflows/ci.yml:173-175` `.../backend:latest`）及 `docs/deployment-guide.md:89` 一致 ✓（三处交叉一致） | `:48-52` |
| 环境变量引用 | `${env.DATABASE_URL}`、`${env.REDIS_URL}`、`${env.SECRET_KEY}`、`${env.DASHSCOPE_API_KEY}`（`:60-63`）——四键在 `.env.example` 已定义 ✓（§C）；`${env.VPC_ID}`、`${env.VSWITCH_ID}`、`${env.SECURITY_GROUP_ID}`（`:67-70`）——**三键不在 `.env.example`**（且本文件自身指引注释 `:7-8` 已要求准备它们，模板未覆盖 → 内部不一致），缺口归属 SEC-003/OPS-001 | `:60-70` |
| HTTP 触发器 | `authType: anonymous`（`:77`）+ `disableURLInternet: false`（`:84`）+ 全方法放行（`:79-83`）→ **匿名公网 HTTP 入口**（应用认证仍在 API 层 Depends，但暴露面与限流缺失属安全缺口，归属 SEC-003；仅记录） | `:73-84` |
| 前端 OSS | bucket `cochlear-rehab-web`（`:99`）、`acl: public-read`（`:100`）、SPA error/index（`:101-103`）、CORS `allowedOrigin "*"` 只读方法（`:104-108`）——与 ci.yml `ossutil cp oss://cochlear-rehab-web/`（`:211`）一致 ✓ | `:95-109` |
| 注释路径 | `:12` "发布后访问 /api/health/detailed"——同 C-1 前缀失配（实际 `/health/detailed`），文档级缺口（该文件为禁改对象，归属下游） | `:12` |

### B.6 `deploy/nginx-production.conf`（115 行，独立部署形态）

| 检查项 | 事实与结论 | 证据 |
|---|---|---|
| 限流 | `api` zone 30r/s、`login` zone 5r/m（`:41-42`）；`/api/` 应用 api zone（`:85`）、`/api/auth/sms/send` 精确匹配应用 login zone（`:103-104`）——路径与实现端点一致（`main.py:126` + `api/auth.py:76`，交叉 `DB_API_BASELINE.md:217`）✓ | `:41-42`、`:84-108` |
| 上游 | `upstream backend { server backend:8000; }`（`:45-48`）→ 需要部署环境提供 `backend` 主机名解析（compose 网络内成立；FC/OSS 形态下本文件不参与——本文件未被 compose 或 ci.yml 引用，属独立部署资产，事实记录） | `:45-48` |
| 域名/SSL | `server_name your-domain.com` 占位（`:52`、`:60`）+ 证书路径 `/etc/nginx/ssl/cert.pem|key.pem`（`:63-64`）+ 80→443 301（`:55`）→ **未替换占位即投产不可用**；TLS1.2/1.3 + HSTS（`:65-66`、`:74`）✓ | 如左 |
| 代理路径 | `location /api/ { proxy_pass http://backend; }`（`:84-87`）——无 URI 段透传，与后端 `/api/*` 前缀匹配 ✓（与 B.4 同构） | `:84-100` |
| SPA | `try_files ... /index.html`（`:111-113`）——同 B.4 的 health 探测误导副作用 | `:111-113` |

### B.7 `.env.example`（21 行，11 键）

键清单（名+值形态为占位符模板，非 Secret）：`POSTGRES_DB`(`:5`)、`POSTGRES_USER`(`:6`)、`POSTGRES_PASSWORD`(`:7`)、`DATABASE_URL`(`:10`)、`REDIS_URL`(`:11`)、`SECRET_KEY`(`:12`)、`DASHSCOPE_API_KEY`(`:15`)、`APP_NAME`(`:18`)、`APP_VERSION`(`:19`)、`DEBUG`(`:20`)、`CORS_ORIGINS`(`:21`)。
- 缺口：不含 OSS 五键、COOKIE_SECURE、COOKIE_SAMESITE、VPC_ID/VSWITCH_ID/SECURITY_GROUP_ID、COMPOSE_PROJECT_NAME（§C.2）。
- 附注：`:10` DATABASE_URL 指向 `localhost:5432`（宿主直连形态）；`:11` REDIS_URL=`redis://redis:6379/0`（容器 hostname，宿主直连时不可解析——config.py 默认值为 localhost，模板与默认口径不一，事实记录不判定）。compose 的 `DATABASE_URL`/`REDIS_URL` 由 `docker-compose.yml:31-32` environment 注入覆盖，模板值不参与容器路径（B.1）。
- SECRET_KEY 强度由应用启动校验器强制（≥32 字符、拒绝示例值：`backend/app/core/config.py:158-172`）✓（代码级防线存在，模板占位值会被启动拒绝——正向事实）。

### B.8 `.github/workflows/ci.yml`（213 行）部署步骤

| 检查项 | 事实与结论 | 证据 |
|---|---|---|
| 触发分支 | `push: [main, develop]`、`pr: [main]`（`:3-7`）；`docker-build`/`deploy` 再限定 `github.ref == 'refs/heads/main'`（`:156`、`:189`）——**仓库实测分支为 master（+ origin/master）与 feature/**（`git branch -a`：master、origin/master、feature/m0-baseline、auditory-rehab-optimization；项目规则 `10-project.md` 亦载"主分支 master"）→ 配置级推断：GitHub Actions 上全部 job（含部署两 job）**在当前分支模型下永不触发**，部署管线事实未激活。归属 OPS-001（CI/CD 提案） | `:3-7`、`:156`、`:189` |
| CR 登录 | docker/login-action 至 `registry.cn-hangzhou.aliyuncs.com`（`:10`），secret 引用**仅名**：`ALIYUN_CR_USER`（`:165`）、`ALIYUN_CR_PASSWORD`（`:166`）——零值 | `:161-166` |
| 镜像构建推送 | backend/frontend 分别 build-push（context `./backend`/`./frontend`），tag `latest` + `github.sha`（`:168-184`）——与 serverless.yml `:49` latest 引用一致 ✓；同样受"无 .dockerignore"静态风险影响（B.2/B.3） | `:168-184` |
| FC 部署 | `s config add` secret 引用**仅名**：`ALIYUN_ACCESS_KEY_ID`/`ALIYUN_ACCESS_KEY_SECRET`（`:197`）；`s backend deploy --use-local`（`:202`，working-directory deploy `:200`） | `:194-202` |
| OSS 发布 | setup-ossutil（`:204-209`，同两 secret 名引用）+ `ossutil cp -r frontend/dist/ oss://cochlear-rehab-web/`（`:211`）——**配置级缺陷**：deploy job 仅 checkout（`:192`），既未构建前端也未 `download-artifact` 拉取 `frontend-dist`（`:146-150` 仅 upload）→ 该 job 工作区不存在 `frontend/dist`，cp 步骤确定性失败。归属 OPS-001。未执行，SAFELY_NOT_EXECUTED_AND_RECORDED | `:186-212` |
| 测试 jobs 与部署衔接 | backend-test（sqlite，`:43-51`）/ postgres 集成（`:60-103`）/ frontend 五命令（`:106-151`）——与 M0-002~M0-005 基线口径一致（交叉引用，非本任务重跑项） | 如左 |

### B.9 交叉一致性小结（服务名/端口/路径三环）

- compose 服务名 ↔ nginx：`backend`（compose `:22` ↔ nginx.conf `:76` ↔ production.conf `:46`）✓；`db`/`redis`（compose `:47`/`:66` ↔ `:31`/`:32` 注入串）✓。
- 端口链：3000(宿主)→80(nginx)→`/api/` 透传→8000(gunicorn)→`/api/*` 路由 ✓；`/health` 与 `/health/detailed` 仅存在于 :8000 直连，**无** nginx 侧暴露位（B.4 SPA 回退副作用）。
- 镜像 tag 链：ci.yml 推送 ↔ serverless.yml 引用 ↔ deployment-guide.md `:89` 文档 ✓。
- 失配环：healthcheck/文档 health 路径 ×4 处（compose `:39`、backend/Dockerfile `:30`、serverless.yml `:12`、runbook.md `:9`/`:41-42`）指向不存在的 `/api/health*`——同一根因（C-1），修复归一（OPS-002/SEC-003）。

---

## C. 环境变量缺口清单（引用 vs 定义交叉核对）

### C.1 引用未定义（缺口方向；消费方存在、模板缺键）

| 变量 | 引用方（file:line） | 默认值状态 | 缺口后果（配置级） | 归属 |
|---|---|---|---|---|
| `OSS_ACCESS_KEY_ID` | `backend/app/core/config.py:119`（Pydantic env 绑定） | 默认空串 | 未配置则 TTS 缓存/OSS 上传不可用；无启动校验 | SEC-003 |
| `OSS_ACCESS_KEY_SECRET` | `config.py:122` | 默认空串 | 同上 | SEC-003 |
| `OSS_BUCKET_NAME` | `config.py:125` | 有默认 `cochlear-rehab-audio` | 模板缺键（默认可用，但注意与 serverless.yml `:99` 前端 bucket `cochlear-rehab-web` 为两个 bucket，命名相近易混） | SEC-003 记录 |
| `OSS_ENDPOINT` | `config.py:128` | 有默认 `oss-cn-hangzhou.aliyuncs.com` | 模板缺键 | SEC-003 |
| `OSS_REGION` | `config.py:132` | 有默认 `cn-hangzhou` | 模板缺键 | SEC-003 |
| `COOKIE_SECURE` | `config.py:152` | 默认 **False** | `docs/runbook.md:5` 投产要求 `COOKIE_SECURE=true`，但模板无此键 → 按模板复制 .env 的部署默认以非 Secure Cookie 运行（httpOnly JWT 承载会话，安全缺口） | SEC-003 |
| `COOKIE_SAMESITE` | `config.py:155` | 默认 `lax` | 模板缺键 | SEC-003 |
| `VPC_ID` | `deploy/serverless.yml:67`（`${env.VPC_ID}`） | 无（FC 部署 shell 环境解析） | 部署时缺值 → s deploy 配置不完整（serverless.yml `:8` 自身要求准备，模板未覆盖） | OPS-001/SEC-003 |
| `VSWITCH_ID` | `deploy/serverless.yml:69` | 无 | 同上 | OPS-001/SEC-003 |
| `SECURITY_GROUP_ID` | `deploy/serverless.yml:70` | 无 | 同上 | OPS-001/SEC-003 |
| `COMPOSE_PROJECT_NAME` | Compose v5 项目名解析机制（§A.4；实测报错原文在案） | 无 | 当前形态下 compose 全命令不可用 | OPS-002/SEC-003 或独立 fix |

（以上全部为"模板缺键"性质；config.py 消费侧对未列出键均带代码默认值，属"引用但未定义（模板层）"缺口的共同形态。）

### C.2 定义未引用（死键方向）

`.env.example` 11 键逐一核对消费方：`POSTGRES_DB`/`POSTGRES_USER`/`POSTGRES_PASSWORD` → `docker-compose.yml:31`/`:52-54`/`:58`；`DATABASE_URL` → `config.py:41` + compose `:31`；`REDIS_URL` → `config.py:45` + compose `:32`；`SECRET_KEY` → `config.py:49` + `serverless.yml:62`；`DASHSCOPE_API_KEY` → `config.py:63` + `serverless.yml:63`；`APP_NAME`/`APP_VERSION` → `config.py:31`/`:34`；`DEBUG` → `config.py:37`；`CORS_ORIGINS` → `config.py:135`。
**结论：模板 11 键全部有引用方，无死键。**（附注两则：compose `:30-32` 使 DATABASE_URL/REDIS_URL 的 `.env` 值在容器路径被 environment 覆盖；REDIS_URL 模板值 hostname 形态仅容器内可解析——均已在 B.1/B.7 记录。）

### C.3 消费侧全量参考（config.py Settings 字段 → 模板覆盖状态）

config.py 定义 30 个可 env 覆盖字段（`:27-156`）；`.env.example` 覆盖其中 8 个（DATABASE_URL/REDIS_URL/SECRET_KEY/DASHSCOPE_API_KEY/APP_NAME/APP_VERSION/DEBUG/CORS_ORIGINS）；OSS 五键、COOKIE 两键、SAFETY_KEYWORDS（`:143`）与 ASR/TTS/LLM 调参键未入模板——其中 **SAFETY_KEYWORDS 属 C 类内部规则**（`60-knowledge-base.md` C 级），默认值在代码中即为合规形态，不入模板不判缺口；ASR/TTS/LLM 调参键有可用默认，同样仅记录不判缺口（判断纪律：仅 C.1 列出的、下游投产清单点名要求的计为缺口）。

### C.4 根 `.env`（存在性与键名集合，零值读取）

- 存在：`wc -c .env` = **559 B**；`git check-ignore -v` 证实被 `.gitignore:28` 忽略（未跟踪）。
- 键名集合（`grep -E '^[A-Z][A-Z0-9_]*=' .env | cut -d= -f1` 实测 11 键）：POSTGRES_DB、POSTGRES_USER、POSTGRES_PASSWORD、DATABASE_URL、REDIS_URL、SECRET_KEY、DASHSCOPE_API_KEY、APP_NAME、APP_VERSION、DEBUG、CORS_ORIGINS。
- 与 `.env.example` 键名集合**完全一致**（11=11，spec DEPENDENCIES 描述核实成立）。
- **值零读取、零输出**；本任务未修改该文件。
- 相邻事实：`backend/.env` 存在（474 B，被 `backend/.gitignore:3` 忽略）——键名与值均**未读取**（数据最小化：spec 仅授权对根 `.env` 做键名集合判断）。其存在使 B.2 的 `COPY . .` 秘密入层风险具体化（记录，归属 SEC-003）。

---

## D. 冒烟四路径配置级核验（docs/runbook.md · 不起服务）

方法：对每条路径核对「文档引用路径 ↔ 应用路由挂载 ↔ nginx 反代 ↔ compose 端口映射」四段配置链；运行期行为一律不执行、不宣称验证。

### D.1 路径 1：health / detailed

- 文档引用：`docs/runbook.md:9`（`/api/health` 返回 200、`/api/health/detailed` 状态 ok）、`:41-42`（监控口径同）；compose `:39` 与 backend/Dockerfile `:30` 探针同用 `/api/health`。
- 实现路由：`backend/app/main.py:124` include health_router **无 prefix** + `api/health.py:14`（`/health`）、`:30`（`/health/detailed`）；`/api/health`、`/api/health/detailed` 字面路径在路由表中不存在（交叉证据：`DB_API_BASELINE.md:268-269`、`:275-276` C-1/C-2，M0-004 实测端点表 `:212-213`）。
- 配置级结论：**失配**。文档口径路径经 :8000 直连为 404；经前端 :3000 时 `/health*` 不匹配 `location /api/`，落入 SPA 回退返回 index.html（200 text/html，非 JSON 健康语义）——探测结果误导性缺口；compose/Dockerfile 健康链后果（backend 永不 healthy → frontend `service_healthy` 永不满足）为配置级推断，运行期 **SAFELY_NOT_EXECUTED_AND_RECORDED**。
- 归属：OPS-002（起服务后冒烟以实际路由为准）/ SEC-003（探针配置修正）；文档修正（runbook 为禁改对象）另行归属。

### D.2 路径 2：登录（短信验证码 + 登录）

- 端点：`POST /api/auth/sms/send`、`POST /api/auth/login`（`main.py:126` prefix + `api/auth.py:76`/`:84`；交叉 `DB_API_BASELINE.md:217-218`）。
- 配置链：宿主 :3000 → `3000:80`（compose `:15`）→ nginx `location /api/` 透传（`frontend/nginx.conf:75-76`）→ backend:8000 `/api/auth/*` 存在 ✓；Redis 依赖经 compose 注入 `redis://redis:6379/0`（`:32`）+ redis 服务健康探针自洽（`:66-75`）✓。
- 配置级结论：**支持**（四段链路径/服务名/端口匹配）。运行期（验证码发送、JWT Cookie 落位）——**SAFELY_NOT_EXECUTED_AND_RECORDED**：不起服务、不触短信通道（外部依赖属 mock 纪律，80-testing §5）；`missing_evidence`：真实 Cookie/HTTPS 行为需 OPS-002 演练取证。

### D.3 路径 3：训练开始

- 端点：`POST /api/training/sessions`（`main.py:127` + `api/training.py:32`；交叉 `DB_API_BASELINE.md:222`；后续答题/finish 端点同前缀 `:222-226`）。
- 配置链：同 D.2 反代链 ✓；鉴权为 JWT httpOnly Cookie 同源携带（:3000 同源，无 CORS 阻碍；后端 CORS_ORIGINS 亦含 localhost:3000，`config.py:135-139`、`.env.example:21`）；会话写库依赖 `DATABASE_URL → db:5432`（compose `:31`）+ db 健康链（`:47-63`）✓（配置级自洽；迁移可用性事实引用 M0-004：`001` up/down exit 0，`002`/head 因 F-15 不可达——`DB_API_BASELINE.md:56-105`、`:167-170`，容器化建表路径属 OPS-002 演练范围）。
- 配置级结论：**支持**（网络/路由/依赖顺序层面）。运行期 **SAFELY_NOT_EXECUTED_AND_RECORDED**；`missing_evidence`：训练会话端到端（含 item_bank 种子落地，F-15 未修前容器内建表走 `create_all` 而非迁移）需 OPS-002 实测。

### D.4 路径 4：报告查询

- 端点：`GET /api/report/summary`（`api/report.py:19`）、`/levels`（`:42`）、`/weekly`（`:82`）等（`main.py:130`；交叉 `DB_API_BASELINE.md:236-239`）。
- 配置链：同 D.2 ✓。
- 配置级结论：**支持**。运行期 **SAFELY_NOT_EXECUTED_AND_RECORDED**；`missing_evidence`：真实数据下的报告聚合响应需 OPS-002 演练（本周报任务 ARQ worker 不在 compose 拓扑内——`docker-compose.yml` 无 worker 服务，事实记录，归属 OPS 缺口清单）。

### D.5 缺失证据清单（汇总）

| 项 | 状态 |
|---|---|
| backend 容器运行期 healthcheck 实际失败（404→非零退出） | SAFELY_NOT_EXECUTED_AND_RECORDED（配置级推断在案，运行事实需 OPS-002） |
| `compose up` 全栈启动与 `frontend 永不启动`后果 | SAFELY_NOT_EXECUTED_AND_RECORDED（本轮无容器创建；G-DOCKER-PS 佐证零触碰） |
| 登录/训练/报告端到端冒烟四路径运行响应 | SAFELY_NOT_EXECUTED_AND_RECORDED（spec：不起服务） |
| `docker compose build` 成功后镜像内容（COPY 是否含 .env/venv） | missing_evidence（项目名解析先失败，构建阶段未触及；静态风险已在 B.2/B.3 记录） |
| CI 部署 jobs 实际运行 | missing_evidence（分支触发失配，配置级判定；GitHub Actions 侧运行记录不属本地可取证面，且触云属 HUMAN_REQUIRED） |
| 真实云部署（s deploy / 镜像推送 / OSS 发布） | 不执行——HUMAN_REQUIRED（spec OUT_OF_SCOPE L26）；仅配置审计 |
| `postgres:15-alpine` 拉取 | 未发生（零网络拉取，§A.3） |

---

## E. 双列结论（spec AC-08）

### E.1 ENGINEERING_DEPLOY_READINESS：**NO**（当前不可宣布工程部署就绪）

按真实门禁事实（非运行期判断）：
1. **G-BUILD exitCode=1**（`docker compose build` 确定性失败于项目名解析，§A.3/A.4）→ 本任务口径的构建基线事实 = **容器构建当前不可用**；这是首要 blocker 证据，不粉饰。
2. healthcheck 路径失配（B.1/B.2/D.1）：即使修复项目名，`compose up` 配置级推断仍将因 backend 永不 healthy 而卡死 frontend 启动——第二道结构性缺陷。
3. CI 部署管线在当前分支模型（master vs 期望 main）下不触发（B.8），且 deploy job OSS 步骤存在确定性缺件缺陷（frontend/dist 不产出即 cp）——发布通道未激活/不可靠。
4. 静态安全缺口面未硬化：`.dockerignore` 三级缺失 + `COPY . .` 上下文含既有 `backend/.env`（C.4）、venv 巨量目录；serverless 匿名公网触发器；COOKIE_SECURE 模板缺失；gunicorn 未锁版本。
5. 交叉证据（不构成本项 blocker 的反证）：源码层面前端五命令 exitCode 0（M0-003 FRONTEND_BASELINE 结论摘要）——问题定位在**部署配置层**而非应用源码层。

### E.2 REAL_PRODUCTION_APPROVED：**NO**

无真实人工/授权主体批准；正式生产部署属 HUMAN_REQUIRED（spec 与 `90-quality-gates.md` D3 终态拆分口径）。本任务未执行、也无权执行任何云端操作；E.1 的工程事实绝不等同于生产批准。

---

## F. Secret 零输出合规声明与禁项遵守声明

### F.1 Secret 纪律（spec AC-06）

- 本报告全文**不含任何真实 Secret 值**：`.env`（根与 backend）零值读取（根仅键名集合 + 字节数元数据，C.4；backend 仅存在性）；`POSTGRES_PASSWORD`/`SECRET_KEY`/`DASHSCOPE_API_KEY` 等仅以**变量名**出现；CI/云侧凭证仅记引用名与来源（`ALIYUN_CR_USER`、`ALIYUN_CR_PASSWORD`、`ALIYUN_ACCESS_KEY_ID`、`ALIYUN_ACCESS_KEY_SECRET`，B.8 行号）。
- 机器自查：G-SECRET-ZERO（形态模式：阿里云长 token 前缀、sk- 长 token 前缀、私钥块头形态；本段不复写完整字面模式以免自匹配）执行后自检 exitCode=0。
- 全程输出/日志无凭证、无完整语音 URL、无用户可识别信息。

### F.2 禁项遵守清单（本轮实际执行命令全集）

- 门禁集 10 条逐字执行（§A.1；cwd=仓库根；未改写任何冻结命令形态，未使用 `-p` 等绕过参数）。
- 必要只读辅助命令（EXECUTION_NOTES 许可范围）：`git rev-parse/branch/status/ls-files/check-ignore/branch -a`、`ls`、`wc -c`、`du -sh`、`find | wc -l`、`grep`（配置文本与既有基线文档）、`head`、`date -u`、`docker version`、`docker images`（只读查询）。全部 exitCode 如实，失败项均标注（见 F.3）。
- **未执行**（spec OUT_OF_SCOPE 全集遵守）：`compose up/down/start/stop/restart/rm/logs`、`docker system prune/rmi/builder prune`、任何容器创建/删除/重启、对 aiear-m0004-pg-test/dresslens-*/opengauss-lab 的任何操作、任何 `:5432`/`:6379` 触达、任何服务监听/启动、`s deploy`/镜像推送/控制台操作、任何 `git commit/push/branch/checkout/reset`、治理文件与全部禁改文件的写入（G-SCOPE-DIFF/G-GOVERNANCE-DIFF 自检 exitCode=0 佐证）、树单元零字节触碰（G-TREE-UNIT 两文件 OK 佐证）、`.env` 值读取。
- 唯一写操作：创建本文件 `deliverables/baseline/DEPLOY_BASELINE.md`（EXPECTED_FILES/ALLOWED_WRITE_PATHS 唯一条目）。

### F.3 辅助命令失败记录（非门禁，AC-11/F-47 口径）

| 命令 | exitCode | 归类与复跑证据 |
|---|---|---|
| `du -sh backend/.venv backend/__pycache__ frontend/node_modules frontend/dist backend/tests`（首次批） | 1 | **审计工具缺陷/非项目红**：`backend/.venv`、`backend/__pycache__` 不存在（目录名与 spec KNOWN_RISKS 表述差异，见 G.2）。拆分复跑：`du -sh backend/venv backend/venv312` → exit 0（14M/574M）；node_modules 390M、dist 1.7M、tests 1.1M 在同批输出为 0 |
| `ls -la .dockerignore backend/.dockerignore frontend/.dockerignore` | 2 | **预期内非门禁失败**：三处均不存在——该 exitCode 本身即"缺 .dockerignore"缺口的取证（No such file 输出在案），非项目红、非工具缺陷 |

skippedGates：**无**（声明 10 条全部执行）。

---

## G. Findings 汇总与下游归属（record 红 + 静态缺口 → 不阻断本任务，输入下游）

| ID | 发现 | 关键证据 | 严重性建议 | 归属 |
|---|---|---|---|---|
| F-M0008-01 | compose 项目名解析失败 → `docker compose build/config` 确定性 exit 1（目录名非 ASCII + 无顶层 name: + 无 COMPOSE_PROJECT_NAME）；本仓库路径下容器构建不可用 | §A.3/A.4 实测输出与三重证据 | **P0**（阻塞一切 compose 路径） | OPS-002/SEC-003 或独立 fix（本任务不实施） |
| F-M0008-02 | healthcheck/文档路径 `/api/health*` 失配（实际 `/health*`）：compose `:39`、Dockerfile `:30`、serverless.yml `:12`、runbook `:9`/`:41-42` 四处同源 | B.1/B.2/B.5、D.1、`DB_API_BASELINE.md:268-276` | **P1**（配置级推断 backend 永不 healthy → frontend 启动卡死；探测误导） | OPS-002 + SEC-003 |
| F-M0008-03 | `.dockerignore` 三级缺失 + 两 Dockerfile `COPY . .`：既有 `backend/.env`（存在，未读）、`venv312` 574M、`venv` 14M、`node_modules` 390M 等入上下文/镜像层的静态风险 | B.2/B.3、C.4、F.3 du 实测 | **P1**（秘密入层 + 上下文膨胀；修复 F-01 后即触发） | SEC-003（建议项；本任务禁新增该文件） |
| F-M0008-04 | `.env.example` 模板缺口：OSS 五键、COOKIE_SECURE/COOKIE_SAMESITE、VPC_ID/VSWITCH_ID/SECURITY_GROUP_ID 未覆盖（runbook:5 要求 COOKIE_SECURE=true 无模板承载） | C.1 | P2（生产硬化清单输入） | SEC-003 |
| F-M0008-05 | serverless.yml 匿名公网 HTTP 触发器（authType anonymous + disableURLInternet false） | B.5（`:77`、`:84`） | P2（暴露面记录；应用层认证仍在） | SEC-003 |
| F-M0008-06 | gunicorn 未锁版本（Dockerfile `:17` 裸装；requirements.txt 无该条目，其余核心依赖均锁定） | B.2 | P3（可重现性） | OPS-001/SEC-003 |
| F-M0008-07 | ci.yml 部署通道未激活/不可靠：触发分支 main/develop 与仓库实测 master/feature 不符（`:3-7`、`:156`、`:189`）；deploy job 无前端构建且未 download-artifact 即 `ossutil cp frontend/dist/`（`:192`、`:211`）确定性缺件 | B.8 | **P1**（发布通道事实断裂） | OPS-001 |
| F-M0008-08 | compose 无 worker/ARQ 服务、无前端 healthcheck 消费 `/nginx-health`；db 引用 `postgres:15-alpine` 宿主无该 tag（既有 16-alpine/pgvector） | B.1/B.3、§A.5 | P3（拓扑完整性记录） | OPS-002 |
| F-M0008-09 | `version: '3.8'` obsolete 键（warning 实测在案） | A.3/A.4、`:6` | P4 | OPS-002/SEC-003 顺手项（归属他任务，本任务不改） |

### G.1 门禁口径对账说明（catalog vs spec）

`docs/workflow/TASK_CATALOG.md:29` 对 M0-008 的原始验收预期为"docker build exitCode=0"；本 TASK_SPEC（Max 于设计阶段基于 2026-10-10 实测确定性失败）将 G-BUILD 重新定义为 **record** 层（失败=合法存量发现，AC-02/AC-08 要求如实引用 exitCode=1 并归因）。执行按 TASK_SPEC 合同口径；catalog 属治理文件，本任务零触碰，差异提请 Review/Verify 知悉。

### G.2 SPEC 上下文描述与实测差异（如实呈报，不构成实施阻断；提请 Review 核对）

1. spec DEPENDENCIES/CONTEXT 称 M0-004 结论为"alembic 001→002 up/down/up 三连 exitCode=0"；`DB_API_BASELINE.md` 实录为：`upgrade 001`/`downgrade base` exit 0（`:56-89`），**`upgrade head`（含 002）exit 1（TypeError，F-15，`:95-105`、`:167-170`，修复归 FIX-M0-004-001）**。本文件引用按源文档真实口径。
2. spec KNOWN_RISKS 称 backend 上下文含 `.venv/__pycache__/tests`；实测 `backend/.venv` 与顶层 `__pycache__` 不存在，实际为 `venv/`（14M）、`venv312/`（574M）、`tests/`（1.1M）等——风险方向成立且量级大于描述（M0-002 亦记录 runbook:7 的 `backend/.venv` 引用失效 F-03）。
3. 上述两条均不影响任何门禁命令可执行性与 AC 条款成立，故按差异记录处理而非 SPEC_CONFLICT 停止；最终定性归 Max Review。

---

## H. ROLLBACK（spec ROLLBACK_PLAN 承接）

唯一产物 = 本文件（未跟踪新文件）。回滚 = 删除本文件后 `git status --porcelain` 恢复为仅 `?? docs/qgraphflow/dialogue-turn-sequence/`。零已跟踪文件改动、零 commit、零迁移、零容器、零镜像（G-BUILD 未达构建阶段）、零 `.env` 修改（值亦未读取）。

---

*生成：`m0-008-deploy-baseline` · 执行手 qfmodel（Flash）· 本文件为事实记录非 PASS 判定；Task Gate = Machine Gate（真实 exitCode）+ 独立 Max Review + 独立 Max Verify。*
