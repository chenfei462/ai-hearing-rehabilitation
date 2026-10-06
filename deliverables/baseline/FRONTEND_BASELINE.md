# M0-003 Frontend Build Baseline（前端构建基线 · 只体检不治疗）

> Task: `m0-003-frontend-build-baseline` · Type: baseline/audit · Mode: READ_ONLY_AUDIT（零前端源码改动）
> 目标：在 `frontend/`（React 18 + TS + Vite + MUI + Tailwind）全量真实执行五条命令（typecheck / lint / 单测 / 构建 / e2e），逐条如实记录 verbatim exitCode 与输出摘要，产出前端五维健康基线。
> Gate 语义（spec GATE_SEMANTICS D1）：五条命令均为 **RECORD 类**——非零退出只形成 Finding、计入 PROJECT_BASELINE_HEALTH，绝不导致本任务 MACHINE_FAIL、绝不触发删测/skip/放宽断言/改源码；REQUIRED 类（交付物/section/scope/git 纪律/指纹/Secret）才决定本任务门禁。
> 执行时间：2026-10-07（本地，Windows）。执行手：qfmodel(Flash，机械执行手，**无 PASS 宣布权**)。裁判权限：Machine Gate 脚本（按真实 exitCode）+ Max Review/Verify。
> 格式先例：`deliverables/baseline/BACKEND_TEST_BASELINE.md`（M0-002）、`deliverables/baseline/REPO_INVENTORY.md`（M0-001）。

---

## 结论摘要（GATE_HEALTH 与 PROJECT_BASELINE_HEALTH 分离）

- **GATE_HEALTH（M0-003 审计任务自身，见 §11）**：REQUIRED 自检项全部真实执行——五条 RECORD 命令全部 EXECUTED_AND_RECORDED、唯一交付物本文件非空、16/16 section 齐备、frontend/backend/治理文件零 diff、HEAD/branch 未漂移、pre-existing 未跟踪目录指纹未变。最终判定权在 Machine Gate 脚本与 Max，本节仅呈报自检证据。
- **PROJECT_BASELINE_HEALTH（被检前端项目，见 §12）**：**GREEN（本次采样，含 warning 级观察项）**——五条命令 exitCode 全部为 0；但绿不等于优质：存在 chunk 体积告警（F-01）与测试覆盖单薄（F-05）两个客观基线事实。
- **重要语义声明**：本报告中「Gate 自检合规」与「前端五维绿」是两个独立维度的结论。本次采样恰好同时处于通过/合规状态，是两个事实的并列记录，**不构成**「Gate PASS 即前端全绿」或反方向的任何推论。历史任何 `[x]` 均不作证据。

---

## 1. Execution Environment

| 项 | 真实值（本任务实测，2026-10-07） |
|---|---|
| OS | Windows (10.0.26200.9457)；Shell：Git Bash MINGW64_NT-10.0-26200 (msys 3.6.7 x86_64) |
| Node / npm | **v24.15.0 / 11.12.1** |
| 工作目录 | `frontend/`（package.json name=`cochlear-rehab-frontend`、version=0.1.0、type=module） |
| typescript | **5.9.3**（`npx tsc --version` 实测；package.json 声明 ^5.3.3） |
| vite | **5.4.21**（声明 ^5.2.8） |
| vitest | **1.6.0**（声明 ^1.6.0，RUN banner 实测） |
| eslint | **8.57.1**（声明 ^8.57.0；`.eslintrc.cjs` 传统格式） |
| @playwright/test | **1.63.0**（声明 ^1.52.0） |
| react / react-dom | 18.3.1 / 18.3.1（声明 ^18.2.0） |
| @mui/material | 5.18.0（声明 ^5.15.14） |
| tailwindcss | 3.4.19（声明 ^3.4.1） |
| Playwright 浏览器 | `playwright-core/browsers.json` 要求 chromium revision=**1243**、chromium-headless-shell=1243；本机 `%LOCALAPPDATA%\ms-playwright` 缓存实测含 chromium-1243 与 chromium_headless_shell-1243（另有历史 1217/1228）→ 匹配，无需安装 |
| 端口 4173 | 五条命令执行前与 e2e 后均空闲（`netstat -ano` 过滤 `:4173` + LISTENING 零命中，grep exit=1） |
| PostgreSQL / Redis / 后端进程 | **零依赖**：vitest 走 jsdom + mock；e2e 全部 `/api` 经 `page.route` mock（证据见 §7） |
| `frontend/.env*` | 不存在 → **SECRET_MISSING**（前端目录无环境文件，五条命令不读取任何 Secret） |
| 仓库根 `.env` | 存在 → **SECRET_PRESENT**（仅记录存在性；本任务未读取、未输出任何内容） |
| Git 基线 | branch=`feature/m0-baseline`、HEAD=`8cd2e16`（full: 8cd2e165def46b67540d89cb5fbfdd6cd0e35462）；实施前 porcelain 仅 `?? docs/qgraphflow/dialogue-turn-sequence/`；diff/cached/stash 全空 |
| 依赖安装方式 | node_modules 为**预装**状态（本任务未执行 npm install/npm ci，五条命令均成功运行证明其可用） |

## 2. Commands Executed

五条 `[RECORD|*]` 命令全部在 `frontend/` 真实执行，全部 **EXECUTED_AND_RECORDED**（无 SAFELY_NOT_EXECUTED 项）。

| # | 命令原文 | 状态 | exitCode（verbatim） | 耗时 | 关键输出摘要 |
|---|---|---|---|---|---|
| 1 | `npx tsc --noEmit` | EXECUTED_AND_RECORDED | **0** | 5.9s（wall，time 实测） | stdout/stderr 零输出 = 零类型错误 |
| 2 | `npm run lint` | EXECUTED_AND_RECORDED | **0** | 3.3s（wall，time 实测） | 仅 npm banner 4 行；零 error/warning，--max-warnings 0 满足 |
| 3 | `npm test -- --run` | EXECUTED_AND_RECORDED | **0** | 13.59s（vitest Duration） | Test Files **6 passed (6)**；Tests **10 passed (10)**；failed 0；skipped 0 |
| 4 | `npm run build` | EXECUTED_AND_RECORDED | **0** | 25.7s（wall；vite 内部 built in 21.01s） | 12289 modules transformed；7 个 dist 产物（§6）；1 条 chunk >1000kB 告警（warning 级） |
| 5 | `npm run test:e2e` | EXECUTED_AND_RECORDED | **0** | 6.0s（playwright 内部，含 webServer 启动） | Running 1 test using 1 worker；ok 1 [chromium] core-flow.spec.ts:3:1（1.7s）；**1 passed**，failed 0 |

采样纪律：tsc 共执行 3 次（其中 2 次为核实 exitCode 展示，输出均为 exit 0/零输出，一致）；lint 共 2 次（首次记录 + 补测耗时，均 exit 0）；vitest/build/e2e 各 **1 次首通过**。无 flaky 重跑、无删测/skip/改断言/改源码凑绿行为。

条件备用命令处置：`npm install` **未执行**（node_modules 实测可用，无需）；`npx playwright install chromium` **未执行**（e2e 未报浏览器缺失，chromium-1243 缓存命中）。两者均记 NOT_REQUIRED（非 SAFELY_NOT_EXECUTED，因本无执行必要）。

## 3. TypeScript Baseline (tsc --noEmit)

- 命令：`cd frontend && npx tsc --noEmit`。package.json **无独立 typecheck script**（scripts 实测清单 package.json:7-16），该命令与 CI「Type check」步骤（ci.yml:123-125）逐字同款。
- **exitCode=0**；stdout/stderr 为空（重定向文件 0 行实测）。
- 编译器：`tsc --version` = 5.9.3。
- 口径：`frontend/tsconfig.json` 实测 `"strict": true`（:14）、`"noUnusedLocals": true`（:15）、`"noUnusedParameters": true`（:16）。
- 判定：**GREEN**。spec CONTEXT 预期的「strict + noUnused* 红色源」**本次采样未观察到**（见 F-07）。

## 4. Lint Baseline (eslint)

- 命令：`cd frontend && npm run lint` → 实际执行 `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0`（package.json:10）。
- **exitCode=0**。stdout 仅 npm 回显 banner（`> cochlear-rehab-frontend@0.1.0 lint` + 命令行），零违规条目；stderr 无。
- 计数：errors **0**、warnings **0**、被 ignore 数 n/a（无违规即无分布）；`--max-warnings 0` 阈值恰好满足（0 ≤ 0）。`--report-unused-disable-directives` 亦未报任何失效 disable 注释。
- 预期「@typescript-eslint/no-explicit-any=error 红色源」**本次未观察到**（F-07）。
- 判定：**GREEN**。

## 5. Unit Test Baseline (vitest)

- 命令：`cd frontend && npm test -- --run`。package.json test=`vitest run`（:12），故实际运行为 `vitest run --run`（追加的 `--run` 冗余但被 vitest 1.6.0 接受、无害；CI ci.yml:130-131 同款写法 → F-06 记录）。
- **exitCode=0**。banner：`RUN v1.6.0 D:/systemDir/Desktop/听觉康复/frontend`。
- 计数（与 vitest summary 逐字一致）：**Test Files 6 passed (6)** ／ **Tests 10 passed (10)** ／ failed 0 ／ skipped 0 ／ Duration 13.59s（transform 401ms、setup 3.42s、collect 36.56s、tests 595ms、environment 5.30s、prepare 895ms）。
- 预期 test files 数 6：**实测 6，命中**。
- 逐文件明细（vitest ✓ 清单）：

| 测试文件 | 用例数 | 耗时 | 结果 |
|---|---|---|---|
| src/utils/errors.test.ts | 3 | 2ms | passed |
| src/stores/authStore.test.ts | 2 | 4ms | passed |
| src/pages/LoginPage.test.tsx | 2 | 279ms | passed |
| src/pages/DialoguePage.test.tsx | 1 | 105ms | passed |
| src/pages/TrainingPage.test.tsx | 1 | 97ms | passed |
| src/pages/HomePage.test.tsx | 1 | 108ms | passed |

- 无任何 skip/xfail/注释；6 个测试文件本任务零触碰（git 证据见 §11）。
- 判定：**GREEN**（绝对覆盖量薄，是基线事实而非失败 → F-05）。

## 6. Build Baseline (vite build)

- 命令：`cd frontend && npm run build` → `tsc && vite build`（package.json:8，两段串联均通过）。
- **exitCode=0**；wall 25.7s；vite 内部 `✓ built in 21.01s`；`✓ 12289 modules transformed`。
- dist 产物概要（vite stdout 逐字）：

| 产物 | 体积 | gzip |
|---|---|---|
| dist/index.html | 3.66 kB | 1.95 kB |
| dist/assets/css/index-DS2Lh_M1.css | 7.04 kB | 2.15 kB |
| dist/assets/js/index-Fv-jpG8Q.js | 69.54 kB | 21.84 kB |
| dist/assets/js/vendor-utils-CbMFN6mC.js | 82.70 kB | 27.94 kB |
| dist/assets/js/vendor-react-C03jmXIY.js | 177.75 kB | 58.03 kB |
| dist/assets/js/vendor-mui-E7rxUrWI.js | 277.89 kB | 81.60 kB |
| dist/assets/js/vendor-charts-D0J8WDxw.js | **1,129.69 kB** | 372.31 kB |

- chunk 体积警告（原文）：`(!) Some chunks are larger than 1000 kB after minification.`——触发者为 vendor-charts（echarts 6.1.0 系，package.json:25）1,129.69 kB。exitCode 不受影响（rollup warning 级）→ **F-01**。
- 副作用：`frontend/dist/` 被本次构建覆写（产物 index.html mtime 2026-10-07 04:29 实测；gitignored，见 §10）。
- 判定：**GREEN**（含 1 条 warning 级观察项）。

## 7. E2E Baseline (playwright)

- 前置复查：`netstat -ano` 过滤 `:4173` + LISTENING 零命中（grep exit=1）→ 端口空闲，可安全启动 webServer。
- 命令：`cd frontend && npm run test:e2e` → `playwright test`（package.json:13）。
- **exitCode=0**。输出逐字要点：`Running 1 test using 1 worker`；`ok 1 [chromium] › e2e\core-flow.spec.ts:3:1 › logs in and starts an auditory training session (1.7s)`；`1 passed (6.0s)`。计数：**passed 1 / failed 0 / skipped 0**；spec 文件 1 个（e2e/ 实测仅 core-flow.spec.ts），用例 1 条。
- 执行合规证据（AC-10）：
  - **仅 chromium project**：`playwright.config.ts:13-18` projects 数组唯一项 `name:'chromium'`（Desktop Chrome）。
  - **webServer 本地 dev**：`playwright.config.ts:19-23` command=`npm run dev -- --host 127.0.0.1 --port 4173`、url=`http://127.0.0.1:4173`、`reuseExistingServer: !process.env.CI`；日志出现 `[WebServer]` 前缀行证实经 webServer 拉起。
  - **API 全 mock、零真实后端/dashscope**：`e2e/core-flow.spec.ts` 逐行核实三处拦截——`:4 page.route('**/api/auth/sms/send')`、`:11 page.route('**/api/auth/login')`、`:22 page.route('**/api/training/sessions?level=syllable')`；用例文案「登录→开始音节训练」属工程描述，非医疗表述。
  - **无进程残留**：e2e 结束后 `netstat -ano` 4173 LISTENING 零命中复核通过。
- 预期红色源（浏览器缺失/端口冲突/flaky）**本次均未发生**（F-07）；`npx playwright install chromium` 条件备用未触发。
- 判定：**GREEN**（覆盖面宽度见 F-05）。

## 8. CI Parity

对照 `.github/workflows/ci.yml` `frontend-test` job（job 定义 ci.yml:106 起，步骤至 :150），与本任务五条命令逐步骤映射：

| CI step | CI 命令（working-directory: frontend） | 本任务 | exitCode | Parity 判定 |
|---|---|---|---|---|
| Set up Node.js | node-version: "20"（ci.yml:114-115） | 本地 Node **v24.15.0** / npm 11.12.1 | — | **环境漂移** → F-04 |
| Install dependencies | `npm ci`（ci.yml:118-120） | 未执行（node_modules 预装且五条命令全部成功，等价「安装已完成」态） | — | 近似 parity → F-04 |
| Type check | `npx tsc --noEmit`（ci.yml:123-125） | 逐字同款，真实执行 | 0 | **逐字一致** |
| Lint | `npm run lint`（ci.yml:126-128） | 逐字同款 | 0 | **逐字一致** |
| Test | `npm test -- --run`（ci.yml:129-131） | 逐字同款 | 0 | **逐字一致** |
| Build | `npm run build`（ci.yml:132-134） | 逐字同款 | 0 | **逐字一致** |
| Install Playwright browser | `npx playwright install --with-deps chromium`（ci.yml:135-137） | 未执行（本机缓存 chromium-1243 已匹配 browsers.json） | — | 结果等价（浏览器可用） |
| End-to-end smoke test | `npm run test:e2e`（ci.yml:138-140） | 逐字同款 | 0 | **逐字一致**（CI 下 retries=2、reporter=github；本地 retries=0、reporter=list——playwright.config.ts:7-8 `process.env.CI` 分支，不构成本地采样障碍） |
| Upload build artifact | upload-artifact `frontend/dist/`（ci.yml:141-150） | 本地无 artifact 上传概念；dist gitignored | — | n/a |

结论：**命令面**与 CI frontend-test job 逐字对应（5/5）；**环境面**存在 OS（ubuntu vs Windows）、Node 大版本（20 vs 24）、安装方式（npm ci vs 预装）三处真实漂移。本基线为「本地 Windows / Node 24 口径」，与 CI 结果不宣称全等（F-04）。

## 9. Version Drift

package.json 声明 vs package-lock.json 锁定 vs node_modules 实装（**仅记录事实，本任务零升降级**）：

| 包 | package.json 声明 | lockfile 锁定 | 实装（node_modules 实测） | 漂移判定 |
|---|---|---|---|---|
| typescript | ^5.3.3（:53） | **5.9.3**（package-lock.json:8176-8177） | 5.9.3 | 声明滞后、semver 区间内 → F-02 |
| @playwright/test | ^1.52.0（:34） | **1.63.0**（package-lock.json:1533-1534） | 1.63.0 | 声明滞后、minor 区间内 → F-02 |
| vite | ^5.2.8（:54） | **5.4.21**（package-lock.json:8294-8295） | 5.4.21 | 同上 |
| vitest | ^1.6.0（:55） | 1.6.0 | 1.6.0 | 无漂移 |
| eslint | ^8.57.0（:44） | — | 8.57.1 | patch 区间内，无实质漂移 |
| react | ^18.2.0（:27） | — | 18.3.1 | minor 滞后 |
| @mui/material | ^5.15.14（:21） | — | 5.18.0 | minor 滞后 |
| tailwindcss | ^3.4.1（:51） | — | 3.4.19 | patch/minor 滞后 |
| echarts | ^6.1.0（:25） | — | 6.x（随 vendor-charts chunk 打进产物） | F-01 关联 |

完整性证据：`frontend/package.json` md5=`b5f4da1a644e63376d226baf1be19b4a`、`frontend/package-lock.json` md5=`4046537754971fb0d39b62dcbc0faabb`，两文件 mtime 均 2026-09-20（本任务未改写；权威证据为 §11 git diff 零 frontend/ 条目）。Playwright 版本与浏览器 revision 匹配关系见 §1（1.63.0 ↔ chromium 1243）。

## 10. Side Effects Declaration

以下为五条命令的**固有副作用**（非源码修改、全部 gitignored、一律不提交、不加入 git 跟踪）：

| 副作用路径 | 产生命令 | gitignore 覆盖证据 | 本次实际状态 |
|---|---|---|---|
| `frontend/dist/` | npm run build | 根 `.gitignore:9` `dist/` + `frontend/.gitignore:2` `dist/` | 被覆写（index.html mtime 2026-10-07 04:29）；porcelain 零条目证实被忽略 |
| `frontend/test-results/` | playwright | 根 `.gitignore:94` `test-results/` | **运行后目录不存在**——Playwright 1.63 对通过用例自动清理产物（F-08）；运行期间写入属瞬态 |
| `frontend/playwright-report/` | playwright | 根 `.gitignore:95` `playwright-report/` | 未生成（本地 reporter=list，playwright.config.ts:8） |
| `frontend/node_modules/.vite` 等缓存 | vitest/vite | `node_modules/`（.gitignore:42、frontend/.gitignore:1） | 缓存更新，保留 |
| 会话临时文件 /tmp/m003-*.txt | Flash 捕获命令输出 | 仓库外 | 与 git 无关 |

声明：除上述 gitignored 项外，本任务对 `frontend/`、`backend/`、治理文件、既有 deliverables、`docs/qgraphflow/dialogue-turn-sequence/` 的写入次数为 **0**。

## 11. GATE_HEALTH

> 语义（spec GATE_SEMANTICS）：GATE_HEALTH 只评 REQUIRED 项；本节是 Flash 的**逐项自检证据**，判定权归 Machine Gate 脚本（真实 exitCode）与 Max Review/Verify，Flash 无权宣布 PASS。

| REQUIRED 项 | 命令（MANDATORY_TESTS 原文口径） | 真实结果 | 合规 |
|---|---|---|---|
| scope-pre | `git rev-parse HEAD` / `git branch --show-current` / `git status --porcelain` / `git diff --stat` / `git diff --cached --stat`（实施前） | HEAD=8cd2e16、branch=feature/m0-baseline、porcelain 仅 `?? docs/qgraphflow/dialogue-turn-sequence/`、diff/cached 空；另 `git stash list` 空 | ✓ 与 spec BASELINE_GIT 一致 |
| 五条 RECORD | tsc / lint / vitest / build / e2e | 全部 EXECUTED_AND_RECORDED、exitCode verbatim 见 §2（本采样全 0） | ✓ RECORD 语义满足「真实执行+如实记录」；无 SAFELY_NOT_EXECUTED 项 |
| scope-post / forbidden-files / regression-git | `git diff --name-only HEAD`（应空）+ `git status --porcelain`（白名单：`?? deliverables/baseline/FRONTEND_BASELINE.md` + `?? docs/qgraphflow/dialogue-turn-sequence/`） | 五条命令跑完后中途复核：diff 空、porcelain 仅既有未跟踪目录；本报告写入后终态：porcelain 恰为白名单两项、diff 仍空（附录 A verbatim） | ✓ 无已跟踪文件 M/D/A、无治理文件条目 |
| deliverable | `test -s deliverables/baseline/FRONTEND_BASELINE.md` | 本文件非空（实测字节数见附录 A，>2KB） | ✓ |
| sections | AC-02 所列 16 个 section 标题 grep | 16/16 命中（逐项命中记录见附录 A） | ✓ |
| untracked-fingerprint | `ls -la docs/qgraphflow/dialogue-turn-sequence` | graph.json=34,972B、index.html=794,348B、mtime 2026-10-06 16:05（实施前复核）；实施后终态复核不变（附录 A） | ✓ |
| regression-deliverables | `ls -la deliverables/baseline` | REPO_INVENTORY.md、BACKEND_TEST_BASELINE.md 原样存在且 git diff 对二者为空；新增 FRONTEND_BASELINE.md | ✓ |
| Git 纪律（AC-07） | branch/HEAD/cached/stash 前后各一次 | 全程无 git 写操作；branch 仍 feature/m0-baseline、HEAD 仍 8cd2e16、无新 commit、无 staged、无 stash | ✓ |
| Secret（AC-09） | 报告全文 | 无任何 Secret 值/API Key/连接串；环境文件仅 SECRET_PRESENT/SECRET_MISSING 表述（§1）；前端命令本身不读取 Secret | ✓ |

**GATE_HEALTH 小结**：REQUIRED 项逐项自检均落在验收白名单内；五条 RECORD 命令全绿属**额外巧合事实**，不参与 Gate 判定逻辑，也不被用于暗示项目质量（见 §12 独立性声明）。

## 12. PROJECT_BASELINE_HEALTH

> 语义：本节独立评级**前端项目**五维健康，与 §11 的审计任务门禁完全分离。口径：本地 Windows / Node 24 / 单次采样。

| 维度 | 命令 | exitCode | 评级 | 附注 |
|---|---|---|---|---|
| Typecheck | npx tsc --noEmit | 0 | **GREEN** | strict+noUnused 口径下零错误 |
| Lint | npm run lint | 0 | **GREEN** | --max-warnings 0 恰好满足（0 警告） |
| 单测 | npm test -- --run | 0 | **GREEN** | 6 files / 10 tests；绝对量薄 → F-05 |
| 构建 | npm run build | 0 | **GREEN（warning）** | vendor-charts 1.13MB chunk 告警 → F-01 |
| E2E | npm run test:e2e | 0 | **GREEN** | 1 spec / 1 用例；覆盖面 → F-05 |

**PROJECT_BASELINE_HEALTH 评级：GREEN（本次采样；含 F-01 warning 级观察与 F-05 覆盖面事实）**。
- 「GREEN」仅描述这五条命令在本次采样中的真实结果，**不等于**「前端质量达标」「覆盖充分」或「CI 会同样绿」（环境口径差见 F-04）。
- 反向声明：若未来某维度变红，应记 Finding 并立 FIX 任务，而非修改本基线事实。
- 与 §11 关系：两节结论各自独立成立；本报告全文无任何位置把 Gate 合规表述为「前端全绿」或等价暗示。

## 13. Confirmed M0-001 Findings

对照 `deliverables/baseline/REPO_INVENTORY.md`（M0-001）中前端相关条目，逐条复核（非重复执行后端项）：

| M0-001 条目 | 本任务复核方式 | 复核结果 |
|---|---|---|
| AUDIT-EXEC-4~7：前端 tsc/lint/vitest/build 均 exit 0（REPO_INVENTORY.md:116-119） | 本任务重跑四条命令 | **CONSISTENT**（全部 exit 0，计数一致：6 files/10 tests） |
| COND-EXEC-11：e2e exit 0，1 passed；当时记录 chromium-1217/1228/1243 均在（:123） | 本任务重跑 e2e + 读取 playwright-core/browsers.json | **CONSISTENT**，且口径更精确：当前 @playwright/test 1.63.0 要求 revision=**1243**，缓存命中 |
| F-06 / H9（:175、:189）：40-frontend.md「*.test.tsx 5 个」vs 实测 6 个 vitest 文件 | vitest 实测 Test Files 6 + 文件清单枚举 | **CONFIRMED**（文档漂移；并补充精确口径：`*.test.tsx` 字面实测仅 4 个，另 2 个为 `*.test.ts`，合计 6）→ 本任务 F-03 |
| F-06 附带观察（REPO_INVENTORY.md:51）：40-frontend.md 提及 sessionStore/deprecated useAppStore.ts，仓库无此文件 | `ls frontend/src/stores/` 实测 | **CONFIRMED**：仅 authStore.ts（+authStore.test.ts）、a11yStore.ts |
| REPO_INVENTORY.md:102「前端单测实测 6 文件/10 用例」、:105 e2e core-flow.spec.ts 全 mock | 本任务 §5/§7 独立测量 | **CONSISTENT** |
| ci.yml frontend-test 步骤清单（:147） | §8 逐步骤原文核对 | **CONSISTENT** |

M0-001 后端类 Findings（F-01/F-02/F-07/F-08/F-12 等）不属本任务范围，已由 M0-002 专项基线承接，本任务未重复执行。

## 14. New Findings

本任务自有编号 F-01 ~ F-08，连续无断号；每条含 现象 / 证据 / 影响 / 建议处置（**仅建议，本任务未实施任何修复**）：

- **F-01 构建 chunk 体积告警（warning 级，真实存在）**
  现象：`npm run build` exitCode=0 但 stdout 含 `(!) Some chunks are larger than 1000 kB after minification.`；vendor-charts chunk 1,129.69 kB（gzip 372.31 kB）。
  证据：build 命令输出 §6；exitCode=0（2026-10-07 实测）。
  影响：老年/移动端优先场景首屏下载 JS 偏大，与 40-frontend.md 体验约束存在张力（工程层面，非医疗问题）。
  建议：图表库动态 import / manualChunks 细分 → T-01。
- **F-02 lockfile 版本漂移（声明滞后）**
  现象：@playwright/test 声明 ^1.52.0 锁定/实装 1.63.0；typescript ^5.3.3 → 5.9.3；vite ^5.2.8 → 5.4.21。
  证据：package.json:34/:53/:54 vs package-lock.json:1533-1534/:8176-8177/:8294-8295（§9）。
  影响：均在 semver 区间内、`npm ci` 可复现，无破坏；但 package.json 声明不能直观反映实际基线。
  建议：由 Max 决定是否对齐声明（本任务禁升降级）→ T-02。
- **F-03 文档漂移（M0-001 F-06/H9 复核确认）**
  现象：`.qoder/rules/40-frontend.md:36` 称「现有 `*.test.tsx` 5 个」，但同句列举 6 项；实测 vitest 文件 6 个，其中 `*.test.tsx` 仅 4 个、`*.test.ts` 2 个。
  证据：vitest §5「Test Files 6 passed (6)」+ §13 文件清单；40-frontend.md:36 原文。
  影响：治理文档口径过期，可能误导任务规划；无运行时影响。
  建议：治理阶段由 Max 修订（治理文件是 Flash 绝对禁区，本任务仅记录）→ T-03。
- **F-04 本地/CI 环境口径漂移**
  现象：CI frontend-test 用 ubuntu + Node 20 + npm ci；本基线为 Windows 10.0.26200 + Node 24.15.0 + 预装 node_modules（未走 npm ci）。
  证据：ci.yml:110-120 与 §1/§8。
  影响：本地五维全绿不能等价宣称 CI 全绿；Milestone/Release Gate 需 CI 侧证据补位。
  建议：Gate 时以 CI frontend-test job 真实运行为准 → T-04。
- **F-05 单测与 e2e 覆盖单薄（基线数量事实）**
  现象：vitest 全部 10 用例（6 文件，多数页面 1-2 用例，ReportPage/PronunciationPage/ConversationPage 等无测试文件）；e2e 仅 1 spec 1 用例（登录→音节训练冒烟）。
  证据：§5 逐文件明细；§7「Running 1 test」；e2e/ 目录实测仅 core-flow.spec.ts；前端页面清单对照 REPO_INVENTORY.md S3。
  影响：M1+ 前端重构/新页面回归保护弱（40-frontend.md 要求「新页面必须带测试」将增大数据面）。
  建议：按验收项立测试扩充任务 → T-05。
- **F-06 `npm test -- --run` 冗余参数（记录性）**
  现象：package.json test=`vitest run`，追加 `--run` 后实际命令 `vitest run --run`；vitest 1.6.0 接受，exit 0，行为不变。
  证据：package.json:12 + §5 vitest banner。
  影响：无。CI（ci.yml:131）与本任务写法逐字一致，口径统一。
  建议：维持 CI/文档/本地三者同款写法即可，无需改动（记录性条目）。
- **F-07 预期红色基线均未观察到（显式「未观察到」记录）**
  现象：spec CONTEXT/KNOWN_RISKS 列举的预期失败源——tsc strict/noUnused* 报错、eslint no-explicit-any+--max-warnings 0、vitest 失败、build 失败、e2e 端口冲突/浏览器缺失/flaky——**本次采样一项都没有发生**（五条命令 exitCode 全 0）。
  证据：§2 表 exitCode 列。
  影响：基线好于 M0-001 时期的保守预期；红→绿转变仅 1 处（M0-001 无前端红项，实际全部一致）。
  建议：保持为回归参照；禁止未来把「曾经全绿」当当前证据（80-testing.md 证据纪律）。
- **F-08 e2e 副作用足迹小于声明预期（记录性）**
  现象：spec 声明 test-results/ 会被 e2e 写入，实测 Playwright 1.63 用例全部通过时自动清理该目录，终态不存在；playwright-report/ 未生成（reporter=list）。
  证据：e2e 后 `ls frontend/test-results` 零输出（§10 表）。
  影响：无；§10 声明仍按「允许写入 + 瞬态」口径如实覆盖。
  建议：无需处置。

## 15. Risk Classification

| Finding | 风险级别 | 类别 | 一句话理由 |
|---|---|---|---|
| F-01 | LOW-MED | 性能/体验 | chunk >1MB 与老年移动场景张力，warning 级非阻断 |
| F-02 | LOW | 依赖治理 | semver 区间内、lockfile 可复现，仅声明口径滞后 |
| F-03 | LOW | 文档/治理 | 治理文档过期，无运行时影响，修订权在 Max |
| F-04 | MED | 门禁证据口径 | 本地绿 ≠ CI 绿；影响 Milestone/Release Gate 证据选取 |
| F-05 | MED | 质量防线 | 10 单测 + 1 e2e 用例回归保护面窄，影响后续任务安全 |
| F-06 | INFO | 记录 | 冗余参数，无风险 |
| F-07 | INFO | 记录 | 「未观察到」负项显式声明 |
| F-08 | INFO | 记录 | 副作用足迹说明 |

安全/隐私/医疗维度：本次采样**未发现**任何相关风险项（任务为只读审计，无新增攻击面；e2e 全 mock 不产生真实认证/数据流；报告无用户数据、无 Secret 值、无医疗文案）。无 HIGH 级 finding。

## 16. Candidate Follow-up Tasks

以下均为**建议**（仅立项参考，本任务与 Flash 均不实施；优先级与立项权属 Max/项目计划）：

- **T-01（←F-01，CT/FIX 候选）**：前端 bundle 优化——echarts 动态 import 或 manualChunks 细分 vendor-charts；验收证据 = `npm run build` 输出无 >1000kB 告警 + 体积对比表。预估 0.5 开发日。
- **T-02（←F-02，治理/依赖决策）**：由 Max 决定 package.json 声明区间与 lockfile 现实对齐方式（改声明或文档注明「lockfile 为唯一权威口径」）；任何升降级不得由审计任务顺手执行。
- **T-03（←F-03，治理阶段 Max 专属）**：修订 `.qoder/rules/40-frontend.md:36` 测试清单口径（文件数与扩展名），同步 sessionStore/useAppStore 观察项。
- **T-04（←F-04，Gate 证据）**：Milestone Gate 前触发/核对 GitHub Actions frontend-test job 真实运行结果，使本地口径与 CI 口径互为印证。
- **T-05（←F-05，TRN/CT 候选）**：按 40-frontend.md 验收项扩充 vitest（缺测页面优先 ReportPage/PronunciationPage/ConversationPage）与 e2e 关键路径（发音反馈、报告查询、对话多轮）；遵守 mock 与采样纪律。
- **T-06（←KNOWN_RISKS，通用纪律）**：后续任何前端任务若遇 flaky，按 80-testing.md 与 spec 纪律 ≤3 次采样、如实记录、禁止改码凑绿。

---

## 附录 A. 终态复核记录（本报告主体落盘后由 Flash 真实执行的命令与逐字输出，2026-10-07）

- `git diff --name-only HEAD` → **空输出**（已跟踪文件零改动；含 frontend/、backend/、治理文件、既有 deliverables 全部零 diff）。
- `git status --porcelain` → 恰为两行：`?? deliverables/baseline/FRONTEND_BASELINE.md` 与 `?? docs/qgraphflow/dialogue-turn-sequence/`——AC-01 白名单完全命中，无其他新文件、无 M/D/A 条目。
- `git rev-parse HEAD` → `8cd2e165def46b67540d89cb5fbfdd6cd0e35462`（short `8cd2e16`，与实施前一致，无新 commit）；`git branch --show-current` → `feature/m0-baseline`；`git diff --stat` 空；`git diff --cached --stat` 空；`git stash list` 空（AC-07：全程零 git 写操作）。
- `test -s deliverables/baseline/FRONTEND_BASELINE.md && echo DELIVERABLE_OK` → `DELIVERABLE_OK`；`wc -c` 终态实测约 **30.8KB**（>2KB 门槛一个数量级）。
- `ls -la docs/qgraphflow/dialogue-turn-sequence`（终态）→ `graph.json 34,972B`、`index.html 794,348B`、mtime `Oct 6 16:05`——与实施前逐字节/逐时间戳一致（AC-06）。
- `ls -la deliverables/baseline`（终态）→ REPO_INVENTORY.md 27,457B（mtime Oct 7 00:59）、BACKEND_TEST_BASELINE.md 23,890B（mtime Oct 7 03:36）原样在位且 git diff 对二者为空；FRONTEND_BASELINE.md 为本目录唯一新增（REGRESSION|regression-deliverables ✓）。
- `netstat -ano` 过滤 `:4173` + LISTENING → 零命中（grep exit=1）：e2e 后**无 dev server 残留**（AC-10）。
- frontend/.env 不存在（SECRET_MISSING）；仓库根 .env 存在（SECRET_PRESENT，值未读取、未输出）；报告全文经自检不含任何 Secret 值、API Key、连接串或凭据字面量（AC-09）。

### A.2 sections grep 16/16（逐字命中计数）
对 AC-02 的 16 个关键词 grep 本文件，命中数（2026-10-07 实测）：Execution Environment=2、Commands Executed=2、TypeScript Baseline=2、Lint Baseline=2、Unit Test Baseline=2、Build Baseline=3、E2E Baseline=2、CI Parity=2、Version Drift=2、Side Effects Declaration=2、GATE_HEALTH=6、PROJECT_BASELINE_HEALTH=6、Confirmed M0-001 Findings=2、New Findings=2、Risk Classification=2、Candidate Follow-up Tasks=2 —— **16/16 全部命中**（各含对应 `## N. 标题` 行）。

### A.3 五条 RECORD 命令终态汇总（verbatim）
tsc exit 0（零输出）；lint exit 0；vitest exit 0（6 files / 10 tests passed，0 failed，0 skipped，13.59s）；build exit 0（built in 21.01s，1 chunk >1000kB 告警）；e2e exit 0（1 passed，6.0s，[chromium] core-flow.spec.ts）。详见 §2/§3~§7。


