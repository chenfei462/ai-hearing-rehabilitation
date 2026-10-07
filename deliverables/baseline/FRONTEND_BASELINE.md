# M0-003 Frontend Build Baseline（前端构建基线 · NEW RUN 重试轮 · FULL_MODE 双模型）

> Task: `m0-003-frontend-build-baseline` · Catalog: M0-003（`docs/workflow/TASK_CATALOG.md:24`）· Type: baseline/audit · 性质：**NEW RUN 重试轮**，在 `HEAD=c61bfd3` 上对唯一已跟踪交付物做**原位刷新**（D4 `RETRY_OWNED`）
> 目标：本轮在 `frontend/`（React 18 + TS + Vite + MUI + Tailwind）**真实重跑**五条命令（`npx tsc --noEmit` / `npm run lint` / `npm test -- --run` / `npm run build` / `npm run test:e2e`），逐条如实记录 verbatim exitCode、输出摘要、用例计数与耗时，据此刷新前端五维基线与资产盘点。
> 性质声明（spec `OBJECTIVE` / `GATE_SEMANTICS`）：**本任务是体检不是治疗**。只测量与记录；本轮对 `frontend/src/**`、`frontend/e2e/**`、`package*.json`、全部框架配置、`backend/**`、治理文件的写入次数为 **0**。
> 上一 run（旧 HEAD、旧降级执行模式）Worker 自报的五条 exitCode **一律未作为本轮证据使用**；本轮五条命令全部重新真实执行。写前 D4 指纹与上一 run 快照字段的历史对照**只**出现在 §16（本节及 §1–§15 不出现任何陈旧快照值）。
> 执行手：`qfmodel`（Flash，机械执行手，**无 PASS 宣布权**）。裁判：Machine Gate 脚本（按真实 `exitCode`）+ 独立 Max Review（`qmodel_38max`）+ 独立 Max Verify。
> 格式先例：`deliverables/baseline/BACKEND_TEST_BASELINE.md`（M0-002）、`deliverables/baseline/REPO_INVENTORY.md`（M0-001）。

---

## 结论摘要（两个独立维度，禁止互推）

- **GATE_HEALTH（本审计任务自身门禁，§14）**：REQUIRED 行为项逐项落在验收白名单内——五条命令全部 `EXECUTED_AND_RECORDED` 并留下本轮 verbatim exitCode；写前 D4 指纹实测一致（`ccf5e80e…c14d40`）→ 判定 `RETRY_OWNED_ARTIFACT` 后方动笔；唯一交付物被本轮刷新；17/17 必备 section 齐备；`frontend/**`、`backend/**`、治理文件、兄弟基线文档零 diff；pre-existing 未跟踪指纹不变；全程零 git 写操作。最终判定权归 Machine Gate 脚本与独立 Reviewer/Verifier，本节仅为自检呈报。
- **PROJECT_BASELINE_HEALTH（被检前端项目，§15）**：**GREEN（本轮采样口径，附 1 条 warning 级构建观察与覆盖面/口径事实）**——本轮五条命令 exitCode 实测全部为 `0`（tsc 0 / lint 0 / vitest 0 / build 0 / e2e 0）。
- **语义隔离声明**：「Gate 自检合规」与「前端五维采样结果」是两个**独立维度的并列事实**，不构成任何方向的等价暗示；本轮采样全 0 是两个事实同时成立时的记录，而不是彼此推导。若任一维度变红，只影响 §15 评级与 §13 Findings（或 §14 门禁项），不因对方而改动判据。

---

## 1. Baseline Snapshot

| 项 | 本轮实测值（本轮采集，非历史转抄） |
|---|---|
| 仓库根 | `D:/systemDir/Desktop/听觉康复` |
| branch | `feature/m0-baseline`（`git branch --show-current` 本轮实测；非 master，dirty-main guard 不适用） |
| HEAD（full） | `c61bfd339585ae214d7f369d8e07a61a7bba3e0e`（`git rev-parse HEAD` 本轮实测） |
| HEAD（short） | **`c61bfd3`** |
| HEAD 语义 | `c61bfd3` = `governance(D5): restore full Max-Flash execution mode`（治理提交）。**本轮基线快照即 `c61bfd3`**；上一 run 的旧短 SHA 不作为本轮任何快照字段值出现（仅在 §16 作历史对照） |
| 被测工作目录 | `D:/systemDir/Desktop/听觉康复/frontend`（`package.json`：name=`cochlear-rehab-frontend`、version=`0.1.0`、type=`module`） |
| 本轮采样窗口（UTC） | `2026-10-07T18:06:39Z` – `2026-10-07T18:09:03Z`（逐命令起始 UTC 见 §3 表；UTC 由 `date -u +%Y-%m-%dT%H:%M:%SZ` 与命令同批采集） |
| 本地时钟 | `TZ=Asia/Tokyo`、`getTimezoneOffset()=-540`（Node 实测）= UTC+9；本地时刻 = UTC + 9h |
| 执行模式 | **`FULL`**（D5 已恢复默认双模型；spec `EXECUTION_MODE=FULL`） |
| 决策角色 | **`qmodel_38max`**（Max：Planner / Explorer / Reviewer / Verifier / Gate 判定，只读） |
| 实施角色 | **`qfmodel`**（Flash：机械执行手，实现与命令执行；自报无验收权） |
| 风险级别 | `medium` → 单审（非 HIGH，不触发 A+B 双独立审查） |
| 证据纪律声明 | 本轮不采信任何历史 `[x]` 标记、历史报告 exitCode 与执行手自报值（`.qoder/rules/90-quality-gates.md` 证据纪律）；报告所有 exitCode/计数/体积均为本轮命令 stdout/stderr 与文件系统实测 |
| 实施前 git 基线（本轮实测逐字） | `git rev-parse HEAD`=`c61bfd339585ae214d7f369d8e07a61a7bba3e0e`；`git branch --show-current`=`feature/m0-baseline`；`git status --porcelain`=` M deliverables/baseline/FRONTEND_BASELINE.md` + `?? docs/qgraphflow/dialogue-turn-sequence/`；`git diff --cached --stat`=空；`git stash list`=空 |
| 写前 D4 指纹（本轮实测） | `sha256sum deliverables/baseline/FRONTEND_BASELINE.md` → `ccf5e80e60e3ce18d41377b85d3b587f0932e2ad9860dc2bb002c00c88c14d40` → **`RETRY_OWNED_ARTIFACT`**（证据与判定链见 §16） |
| pre-existing 未跟踪指纹（写前实测） | `graph.json` md5=`2fe742d810f7cd0ce2f5eb401f0050a0` / `34972` B；`index.html` md5=`c1bb9c9b90d92db933577e4056e3ba91` / `794348` B → 与 spec 锚定值逐字一致 |
| 本轮任务性质 | **刷新已跟踪交付物**（D4 重试归属成立），故预期 `git diff --name-only HEAD` 恰为 `deliverables/baseline/FRONTEND_BASELINE.md` 单行；空=未刷新（违规），多行=scope 越界（违规） |

## 2. Execution Environment

| 项 | 本轮实测值（执行手现场采集，2026-10-07 UTC） |
|---|---|
| OS / Shell | Windows（`uname -sr` → `MINGW64_NT-10.0-26200 3.6.7-fb42d713.x86_64`）；Shell：Git Bash / msys `3.6.7-fb42d713.x86_64` |
| Node / npm | **`v24.15.0` / `11.12.1`**（`node --version` / `npm --version` 实测） |
| typescript（tsc） | **5.9.3**（`npx tsc --version` → `Version 5.9.3`；`node_modules` 实装亦 5.9.3） |
| vite | **5.4.21**（build 输出 banner `vite v5.4.21 building for production...`） |
| vitest | **1.6.0**（banner `RUN  v1.6.0 D:/systemDir/Desktop/听觉康复/frontend`） |
| eslint | **8.57.1**（`npx eslint --version` → `v8.57.1`；配置为传统 `.eslintrc.cjs`） |
| @playwright/test | **1.63.0**；`playwright-core` 亦 **1.63.0**（fs 读 `node_modules/playwright-core/package.json`） |
| react / react-dom | **18.3.1 / 18.3.1** |
| @mui/material | **5.18.0** |
| tailwindcss | **3.4.19** |
| echarts | **6.1.0**（对应 vendor-charts chunk → F-02） |
| axios / zustand / @tanstack/react-query | **1.20.0 / 4.5.7 / 5.102.8**（`node -p` 实装版本） |
| Playwright 浏览器要求 | `node_modules/playwright-core/browsers.json` fs 实测：`chromium:1243`、`chromium-headless-shell:1243` |
| Playwright 浏览器缓存 | `%LOCALAPPDATA%/ms-playwright` 实测含 `chromium-1243/`、`chromium_headless_shell-1243/`（另有历史 `1217`、`1228`、`ffmpeg-1011`、`winldd-1007`）→ **revision 匹配，无需安装**；条件备用命令 `npx playwright install` → **NOT_REQUIRED**（e2e 本轮真实通过，为等价可用性证据） |
| 二进制可用性 | `tsc` / `eslint` / `vitest` / `playwright` 四条入口本轮均成功实跑 → `node_modules/.bin` 可用 |
| node_modules | 预装可用；本轮**未**执行 `npm install` / `npm ci`（无必要，五条命令全部成功；`npm ci` 差异记 F-05） |
| 端口 4173（e2e 前） | `netstat -ano \| grep -i "4173"` → 无任何匹配 → **`PORT_4173_FREE_PRE_E2E`** |
| 端口 4173（e2e 后） | `netstat -ano \| grep -i listening \| grep -E ":4173[[:space:]]"` → 零命中 → **`NO_4173_LISTENER`**；另有 6 条 `TIME_WAIT` 客户端连接（内核收尾态，非进程残留 → F-11） |
| 后端 / DB / AI 依赖 | **零依赖**：vitest 走 jsdom + `src/test/setup.ts`（`vitest.config.ts:7-8`）；e2e 全部 `/api` 经 `page.route` mock（§8）；本轮未启动 PostgreSQL / Redis / FastAPI，未触达 dashscope，未消耗任何真实 API 配额 |
| `frontend/.env*` | 实测不存在（`ls -a \| grep ^\.env` → `NO_DOTENV_IN_FRONTEND`）→ **SECRET_MISSING** |
| 仓库根 `.env*` | 实测存在 `.env`、`.env.example` → **SECRET_PRESENT**（仅记录存在性；本任务**未读取、未输出**任何内容） |
| Secret 口径 | 五条前端命令不涉及 Secret 读取；`src/services/api.ts` 使用 `import.meta.env.VITE_API_BASE_URL` 回退 `/api`（构建期变量名，非 Secret 值；本轮未注入任何变量值） |

## 3. Commands Executed

五条 `[REQUIRED]` 命令全部在 `cwd=D:/systemDir/Desktop/听觉康复/frontend` **本轮真实执行**，状态全部 **EXECUTED_AND_RECORDED**；本轮**无** `SAFELY_NOT_EXECUTED_AND_RECORDED` 项（依赖、浏览器缓存、端口均实测可用）。

| # | 命令原文 | cwd | 执行状态 | exitCode（verbatim） | 起始 UTC | duration（wall） | 关键 stdout/stderr 摘要 | 计数 |
|---|---|---|---|---|---|---|---|---|
| 1 | `npx tsc --noEmit` | `frontend/` | EXECUTED_AND_RECORDED | **0** | `2026-10-07T18:06:39Z` | **5s** | stdout/stderr **完全为空** = 零类型错误（tsc 无错误时不输出任何内容） | 类型错误 0 / 0 / 0 |
| 2 | `npm run lint` | `frontend/` | EXECUTED_AND_RECORDED | **0** | `2026-10-07T18:07:01Z` | **4s** | 仅 npm 回显两行 banner（`> cochlear-rehab-frontend@0.1.0 lint` + `> eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0`）；零违规条目 | errors **0** / warnings **0** |
| 3 | `npm test -- --run` | `frontend/` | EXECUTED_AND_RECORDED | **0** | `2026-10-07T18:07:18Z` | **27s**（vitest 内部 `Duration 23.38s`） | `RUN v1.6.0`；`Start at 03:07:20`（本地 UTC+9 → `18:07:20Z`）；6 个文件全 `✓`；`Test Files 6 passed (6)`、`Tests 10 passed (10)` | files **6/0/0**；tests **10/0/0** |
| 4 | `npm run build` | `frontend/` | EXECUTED_AND_RECORDED | **0** | `2026-10-07T18:07:52Z` | **40s**（vite 内部 `✓ built in 32.62s`） | `tsc && vite build` 两段均通过；`vite v5.4.21`；`✓ 12289 modules transformed`；7 行产物清单（§7）；1 条 `(!) Some chunks are larger than 1000 kB` 告警 | 产物文件 9 / 错误 0 / warning 1 |
| 5 | `npm run test:e2e` | `frontend/` | EXECUTED_AND_RECORDED | **0** | `2026-10-07T18:08:55Z` | **8s**（playwright 内部 `1 passed (6.2s)`） | `Running 1 test using 1 worker`；`✓ 1 [chromium] › e2e\core-flow.spec.ts:3:1 › logs in and starts an auditory training session (1.8s)`；`[WebServer]` 前缀 2 行 `NO_COLOR/FORCE_COLOR` warning（F-12） | specs **1** / tests **1/0/0** / worker 1 |

采样纪律（如实记录）：

- 五条命令**各 1 次采样**（tsc 1 / lint 1 / vitest 1 / build 1 / e2e 1），首跑即 exit 0，**未做任何为凑绿的重复采样**；总采样次数远低于 spec `AC-09` 的「同一命令 ≤3 次」上限，本轮不存在结果冲突，因此**无需** flaky 判定。
- 零删测、零 `skip`/`xfail`、零注释测试、零放宽断言、零源码/配置改动、零把 REQUIRED 降级为 record 的行为（执行手亦无此权限）。
- 附加只读取证命令（**不属于**五条基线命令，仅为补全报告字段；全部零写入、不改仓库状态）：
  - `npx eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0 --format json`（同命令换 reporter，用于取得 §5 的 error/warning 精确计数与文件覆盖数）→ 汇总 `filesChecked=56 errors=0 warnings=0 ruleDist={}`
  - `npx playwright test --list`（枚举 project 与用例，用于 §8 合规证据）→ `Total: 1 test in 1 file`，project 仅 `[chromium]`
  - `node --version` / `npm --version` / `npx tsc --version` / `npx eslint --version` / `node -p` 实装版本 / fs 读 `browsers.json` / `package-lock.json`（§2、§11）
  - `du -sk dist`、`find dist -type f`、`find src`/`ls`、`grep -n`（§7、§9）
  - `git check-ignore -v`、`netstat -ano`、`md5sum`、`wc -c`（§2、§12、§16）

## 4. TypeScript Baseline

- 命令原文：`cd frontend && npx tsc --noEmit`（与 CI「Type check」步骤逐字同款：`.github/workflows/ci.yml:122-124`，`working-directory: frontend`）。
- `package.json` scripts 实测（`:7-16`：`dev`/`build`/`preview`/`lint`/`lint:fix`/`test`/`test:e2e`/`test:watch`/`format`/`format:check`）**无独立 `typecheck` script** → 类型检查以裸 `npx tsc` 承担（F-15，口径合法）。
- **本轮 verbatim exitCode = 0**；stdout 与 stderr 均为空（tsc 在无错误时不输出任何内容），即**零类型错误**。
- 编译器版本：`tsc --version` = **5.9.3**。
- duration：wall **5s**（本轮实测）。
- 实际生效类型口径（本轮读取 `tsconfig.json`，逐行核实）：`target: "ES2020"`(:3)、`lib: ["ES2020","DOM","DOM.Iterable"]`(:5)、`strict: true`(:14)、`noUnusedLocals: true`(:15)、`noUnusedParameters: true`(:16)、`noFallthroughCasesInSwitch: true`(:17)、`jsx: "react-jsx"`(:13)、`isolatedModules: true`(:11)、`paths: {"@/*":["src/*"]}`(:19)、`include: ["src"]`(:21)、`references: [{path:"./tsconfig.node.json"}]`(:22)。
- **口径覆盖事实**：`include` 仅 `src`；根配置另有 `tsconfig.app.json`（`target es2023`、`verbatimModuleSyntax`、`erasableSyntaxOnly`）**未被任何配置或脚本引用**（§13 F-13），故本轮 `tsc --noEmit` 与 `build` 内 `tsc` 均走 `tsconfig.json` 的 ES2020 口径。
- 判定：**GREEN**（strict + noUnused* 口径下零错误）。
- 与 spec 预期的关系：spec `KNOWN_RISKS` 把「strict/noUnused」列为可能红色源；本轮**未观察到**任何 tsc 报错（显式记 F-14 负项，而非省略）。

## 5. Lint Baseline

- 命令原文：`cd frontend && npm run lint` → 实际执行 `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0`（`package.json:10` `scripts.lint`）。
- **本轮 verbatim exitCode = 0**；stdout 仅 npm 两行 banner，stderr 无内容，**无任何规则违规条目**。
- duration：wall **4s**。
- 精确计数（附加 `--format json` 取证，同一命令同一规则面）：**56 个文件被检查**、**errors 0**、**warnings 0**、规则分布为空集；`--max-warnings 0` 阈值恰好满足（0 ≤ 0）；`--report-unused-disable-directives` 未报任何失效的 `eslint-disable` 注释。
- 文件覆盖数交叉核对（口径自洽）：`find src -type f \( -name '*.ts' -o -name '*.tsx' \)` = **52** 个源文件；加根级 `vite.config.ts`、`vitest.config.ts`、`playwright.config.ts`（3）与 `e2e/core-flow.spec.ts`（1）= **56**，与 eslint 报告的检查数逐字相符。
- 规则面事实：`.eslintrc.cjs:24` 配置 `'@typescript-eslint/no-explicit-any': 'error'`、`:25` `react-hooks/rules-of-hooks: error` → 本轮**零命中**（预期红色源未出现，F-14）。
- 配置面另有 `.oxlintrc.json` 存在于 `frontend/`，但 `package.json` scripts 与 CI 均未引用 oxlint → 属基线之外配置（F-15）。
- 判定：**GREEN**。

## 6. Unit Test Baseline

- 命令原文：`cd frontend && npm test -- --run`。`package.json:12` `test = "vitest run"` → 实际运行为 `vitest run --run`（追加 `--run` 冗余、被 vitest 1.6.0 接受且行为不变，记 F-08）；写法与 CI 逐字同款（`ci.yml:130-132`）。
- **本轮 verbatim exitCode = 0**；banner：`RUN  v1.6.0 D:/systemDir/Desktop/听觉康复/frontend`；`Start at 03:07:20`（本地 UTC+9 → `2026-10-07T18:07:20Z`）。
- 计数（与 vitest summary 逐字一致，**实测 test files = 6**）：
  - **Test Files 6 passed (6)** ／ **Tests 10 passed (10)** ／ failed **0** ／ skipped **0**
  - `Duration 23.38s (transform 753ms, setup 6.72s, collect 64.20s, tests 1.43s, environment 7.69s, prepare 1.25s)`；wall **27s**
  - 口径说明：`collect 64.20s` 为多 worker 并行累加值，大于 wall，属 vitest 汇总口径而非异常（F-07）；Gate 计时不得引用该值
- 本轮逐文件明细（vitest `✓` 清单逐字，含各自耗时）：

| 测试文件 | 用例数 | 本轮耗时 | 结果 |
|---|---|---|---|
| `src/utils/errors.test.ts` | 3 | 5ms | passed |
| `src/stores/authStore.test.ts` | 2 | 6ms | passed |
| `src/pages/LoginPage.test.tsx` | 2 | 778ms | passed |
| `src/pages/DialoguePage.test.tsx` | 1 | 227ms | passed |
| `src/pages/TrainingPage.test.tsx` | 1 | 197ms | passed |
| `src/pages/HomePage.test.tsx` | 1 | 212ms | passed |

- 测试发现口径（本轮实测 `vitest.config.ts`）：`environment: 'jsdom'`(:7)、`setupFiles: ['./src/test/setup.ts']`(:8)、`include: ['src/**/*.{test,spec}.{ts,tsx}']`(:9)、`clearMocks: true`(:10)、`plugins: [react()]`(:5)。
- 文件系统交叉核对：`find src e2e -name '*.test.*' -o -name '*.spec.*'` → 恰为 6 个 vitest 文件 + 1 个 `e2e/core-flow.spec.ts`，与 vitest 计数一致；6 个测试文件本轮**零触碰**（无修改/删除/skip/xfail，git 证据见 §13/F-14 与附录 A）。
- 判定：**GREEN**（绝对覆盖量薄属基线事实，非失败 → F-06）。

## 7. Build Baseline

- 命令原文：`cd frontend && npm run build` → `tsc && vite build`（`package.json:8`；串联两段均通过，故 build 成功亦隐含一次类型检查通过）。
- **本轮 verbatim exitCode = 0**；wall **40s**；vite 内部 `✓ built in 32.62s`；`✓ 12289 modules transformed`；banner `vite v5.4.21 building for production...`；`computing gzip size...` 正常完成。
- 本轮 vite 产物清单（stdout 逐字）：

| 产物 | 体积 | gzip |
|---|---|---|
| `dist/index.html` | 3.66 kB | 1.95 kB |
| `dist/assets/css/index-DS2Lh_M1.css` | 7.04 kB | 2.15 kB |
| `dist/assets/js/index-Fv-jpG8Q.js` | 69.54 kB | 21.84 kB |
| `dist/assets/js/vendor-utils-CbMFN6mC.js` | 82.70 kB | 27.94 kB |
| `dist/assets/js/vendor-react-C03jmXIY.js` | 177.75 kB | 58.03 kB |
| `dist/assets/js/vendor-mui-E7rxUrWI.js` | 277.89 kB | 81.60 kB |
| `dist/assets/js/vendor-charts-D0J8WDxw.js` | **1,129.69 kB** | 372.31 kB |

- 文件系统实测（`find dist -type f -printf "%s" | awk` 求和 + `du -sb dist`，二者逐字一致）：`dist/` 逻辑字节合计 **1,766,614 B**（`du -sk` 磁盘块口径为 **1740** KB），共 **9 个文件**；按字节降序前五：`vendor-charts-D0J8WDxw.js` 1,130,359 B、`vendor-mui-E7rxUrWI.js` 277,899 B、`vendor-react-C03jmXIY.js` 177,755 B、`vendor-utils-CbMFN6mC.js` 82,704 B、`index-Fv-jpG8Q.js` 72,497 B（其余：`favicon.svg` 9,522 B、`index-DS2Lh_M1.css` 7,037 B、`icons.svg` 5,031 B、`index.html` 3,810 B）。vite 清单不含 `public/` 直拷资源，故 7 行清单 vs 9 个文件差异属统计口径差异（非异常）。
- chunk 体积告警（原文逐字，**本轮复现**）：`(!) Some chunks are larger than 1000 kB after minification.` 附 3 条建议行（dynamic import / `rollupOptions.output.manualChunks` / `build.chunkSizeWarningLimit`）→ 触发者为 `vendor-charts`（echarts 6.1.0）1,129.69 kB；属 rollup **warning 级**，不影响 exitCode → **F-02**。
- 分块配置事实：`vite.config.ts:30` `manualChunks` 已存在（vendor-react/vendor-mui/vendor-utils/vendor-charts 四类），`:43` `chunkSizeWarningLimit: 1000`，`:8` `resolve.alias` `'@' → ./src`（与 `tsconfig.json:19` paths 一致）。
- 产物哈希文件名与上一 run 报告记录一致（同源同配置的确定性表现）；本轮为**真实重跑覆写**，非沿用记录值。
- 副作用：`frontend/dist/` 被本轮构建**覆写**（gitignored，证据见 §12）。
- 判定：**GREEN（含 warning 级观察 1 条）**。

## 8. E2E Baseline

- 前置复查：`netstat -ano | grep -i "4173"` → 零匹配 → **`PORT_4173_FREE_PRE_E2E`** → 可安全启动 webServer。
- 命令原文：`cd frontend && npm run test:e2e` → `playwright test`（`package.json:13`；与 CI 同款 `ci.yml:142-144`）。
- **本轮 verbatim exitCode = 0**；wall **8s**；playwright 内部 `1 passed (6.2s)`。
- 输出逐字要点：`Running 1 test using 1 worker`；`✓  1 [chromium] › e2e\core-flow.spec.ts:3:1 › logs in and starts an auditory training session (1.8s)`。
- 计数：spec 文件 **1**（`ls -la e2e` 实测仅 `core-flow.spec.ts`，2,022 B）；用例 **1**；passed **1** / failed **0** / skipped **0**；worker 1；采样 1 次（无 flaky 判定需要）。
- 执行合规证据（AC-09 逐项）：
  - **仅 chromium project**：`playwright.config.ts:13-18` `projects` 数组唯一项 `name:'chromium'`、`use: { ...devices['Desktop Chrome'] }`；附加只读取证 `npx playwright test --list` → `Listing tests: [chromium] › core-flow.spec.ts:3:1 › logs in and starts an auditory training session / Total: 1 test in 1 file`；本轮输出前缀 `[chromium]` 印证。
  - **webServer 为本地 dev server**：`playwright.config.ts:19-23` `command: 'npm run dev -- --host 127.0.0.1 --port 4173'`、`url: 'http://127.0.0.1:4173'`、`reuseExistingServer: !process.env.CI`；`baseURL: 'http://127.0.0.1:4173'`(:10)；本轮 stdout 出现 `[WebServer]` 前缀 2 行 → 用例确由本地 webServer 拉起（非远端）。
  - **全部 `/api` 经 page.route mock，零真实后端/AI 调用**：`e2e/core-flow.spec.ts` 逐行核实三处拦截——`:4 page.route('**/api/auth/sms/send')`、`:11 page.route('**/api/auth/login')`、`:22 page.route('**/api/training/sessions?level=syllable')`；导航与断言为 `:47 page.goto('/login')`、`:50 getByLabel('验证码')`、`:54 getByText('欢迎使用 AI 听觉康复助手')`、`:58 getByText('请听音频并回答')`、`:59 getByText('点击播放音频')`。用例名与页面文案均为工程/界面字符串引用，不构成任何工程指标的医学化表述。
  - **无 dev server 残留**：e2e 后 `netstat -ano | grep -i listening | grep -E ":4173[[:space:]]"` → 零命中 → **`NO_4173_LISTENER`**；同批 `netstat -ano | grep -i "4173"` 另有 6 条 `127.0.0.1:xxxx → 127.0.0.1:4173 TIME_WAIT`（内核收尾态，非进程残留；spec `IN_SCOPE` 明确 TIME_WAIT 不算残留 → F-11）。
  - **本地 vs CI 运行差异**：`playwright.config.ts:7-8` `retries: process.env.CI ? 2 : 0`、`reporter: process.env.CI ? 'github' : 'list'` → 本轮本地 **retries=0、reporter=list**（不构成采样障碍）；CI 侧另有 `npx playwright install --with-deps chromium`（`ci.yml:138-140`）与 `fullyParallel: true`(:5)、`forbidOnly: !!process.env.CI`(:6)。
  - **reporter=list 的后果**：`frontend/playwright-report/` 本轮**未生成**（写前 `ls -d playwright-report` → `ABSENT_before`，写后 → `ABSENT_after`）→ porcelain 无该 `?? ` 条目（§12/F-10）。
- 已知噪声（如实记录，非缺陷）：`[WebServer] Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.` 出现 2 次（webServer 与测试进程各 1 次），来自运行器注入的环境变量组合，exitCode 仍为 0 → **F-12**。
- 预期红色源（浏览器缺失 / 端口冲突不可解 / 网络受限 / flaky）**本轮均未发生**（F-14）；`SAFELY_NOT_EXECUTED_AND_RECORDED` 分支**未触发**。
- 判定：**GREEN**（覆盖面宽度见 F-06）。

## 9. Frontend Asset Inventory

本轮以 `find` / `ls` / `grep -n` / `wc -l` 只读枚举（零写入）。

### 9.1 规模口径

| 项 | 实测值 | 取证方式 |
|---|---|---|
| `src/**/*.ts,tsx` 文件数 | **52** | `find src -type f \( -name "*.ts" -o -name "*.tsx" \) \| wc -l` |
| 上述文件总行数 | **6,452** | 同集合 `xargs wc -l` → `6452 total` |
| eslint 实际检查文件数 | **56** | `--format json` 汇总 `filesChecked=56`（= 52 src + 3 根配置 .ts + 1 e2e spec，口径自洽） |
| vitest 测试文件 / 用例 | **6 / 10** | §6 实测 |
| e2e spec / 用例 | **1 / 1** | §8 实测 |
| dist 产物文件数 / 逻辑字节 | **9 / 1,766,614 B**（`du -sk` 块口径 1740 KB） | `find dist -type f \| wc -l`；`find dist -type f -printf "%s" \| awk` 求和；`du -sb dist` 交叉核对 |

### 9.2 pages 与路由（`src/App.tsx:17-25` 实测）

| 页面（`src/pages/`，9 个页面组件） | 路由 | 是否有 vitest 用例 |
|---|---|---|
| `LoginPage.tsx` | `/login`（:17） | ✓ `LoginPage.test.tsx`（2 用例） |
| `HomePage.tsx` | `/`（:19） | ✓ `HomePage.test.tsx`（1） |
| `TrainingPage.tsx` | `/training`（:20） | ✓ `TrainingPage.test.tsx`（1） |
| `DialoguePage.tsx` | `/dialogue`（:21） | ✓ `DialoguePage.test.tsx`（1） |
| `PronunciationPage.tsx` | `/pronunciation`（:22） | ✗ |
| `ReportPage.tsx` | `/report`（:23） | ✗ |
| `SettingsPage.tsx` | `/settings`（:24） | ✗ |
| `NotFoundPage.tsx` | `*`（:25） | ✗ |
| `ConversationPage.tsx` | **未挂任何路由**（grep `ConversationPage` 于 `App.tsx`、`components/layout/AppShell.tsx` → 0 命中） | ✗ |

路由结构：`/login` 顶层；`/`、`/training`、`/dialogue`、`/pronunciation`、`/report`、`/settings`、`*` 嵌套于 `<Route element={<AppShell />}>`（:18-26）。

### 9.3 components（实测 14 个文件）

| 位置 | 文件 |
|---|---|
| `src/components/`（根） | `AccessibilityPanel.tsx`、`ElderlyButton.tsx` |
| `src/components/common/` | `BigButton.tsx`、`LevelBadge.tsx`、`ScoreRing.tsx`、`Subtitle.tsx` |
| `src/components/charts/` | `AdherenceChart.tsx`、`LevelProgressChart.tsx`、`TrendChart.tsx`、`index.ts` |
| `src/components/layout/` | `AppShell.tsx` |
| `src/components/hardware/` | `HardwareControlPanel.tsx`、`HardwareStatus.tsx`、`index.ts`（**非 MVP 既有实验面**，per `.qoder/rules/10-project.md` 范围纪律；本任务仅盘点 → F-16） |

### 9.4 stores / services / hooks / api / types / utils / theme

| 面 | 实测文件（`ls` 逐字） |
|---|---|
| `src/stores/`（3） | `authStore.ts`、`authStore.test.ts`、`a11yStore.ts`（**注**：治理文档 `40-frontend.md` 提及的 `sessionStore` 与 deprecated `useAppStore.ts` 实测**不存在** → F-04 附注） |
| `src/services/`（6） | `api.ts`、`trainingService.ts`、`dialogueService.ts`、`pronunciationService.ts`、`reportService.ts`、`hardwareService.ts` |
| `src/hooks/`（6） | `useAccessibility.ts`、`useAudioPlayer.ts`、`useRecorder.ts`、`useSpeechGuide.ts`、`useHardware.ts`、`useLocalStorage.ts` |
| `src/api/`（1） | `auth.ts` |
| `src/types/`（1） | `index.ts`（`:88 role: 'patient' \| 'therapist'` 实测） |
| `src/utils/`（3） | `errors.ts`、`errors.test.ts`、`format.ts` |
| `src/theme/`（1） | `index.ts`（无障碍 token 面） |
| `src/test/`（1） | `setup.ts`（vitest setupFiles） |
| `src/` 根 | `App.tsx`、`main.tsx`、`App.css`、`index.css`、`vite-env.d.ts` |
| `src/assets/`（3） | `hero.png`、`react.svg`、`vite.svg` |
| `public/`（2） | `favicon.svg`、`icons.svg` |
| `e2e/`（1） | `core-flow.spec.ts`（2,022 B） |

### 9.5 业务域资产映射

| 域 | 前端资产（实测） |
|---|---|
| auth / 用户 | `src/api/auth.ts`、`src/services/api.ts`、`src/stores/authStore.ts`、`src/pages/LoginPage.tsx` + 测试（2 用例） |
| 训练 | `src/pages/TrainingPage.tsx` + 测试（1）、`src/services/trainingService.ts`、`src/components/common/{BigButton,LevelBadge,ScoreRing}.tsx`、`src/components/charts/*` |
| 对话陪练 | `src/pages/DialoguePage.tsx` + 测试（1）、`src/pages/ConversationPage.tsx`（**未挂路由** → F-17）、`src/services/dialogueService.ts`、`src/components/common/Subtitle.tsx`、`src/hooks/{useAudioPlayer,useSpeechGuide}.ts` |
| 发音反馈 | `src/pages/PronunciationPage.tsx`（**无测试**）、`src/services/pronunciationService.ts`、`src/hooks/useRecorder.ts`、依赖 `wavesurfer.js`（`package.json:30` 声明 `^7.7.3`，lockfile 锁定 **7.12.12** → 计入 F-03 版本漂移面） |
| 报告 / 听力师面 | `src/pages/ReportPage.tsx`（**无测试**；`:139` `{isTherapist && <Tab label="患者管理" />}`、`:355` 患者管理 Tab、`:67` 加载患者列表注释）、`src/services/reportService.ts`、`src/types/index.ts:88` role 定义、charts 面 |
| 无障碍 / 老年适配 | `src/components/AccessibilityPanel.tsx`、`ElderlyButton.tsx`、`common/BigButton.tsx`、`common/Subtitle.tsx`、`src/hooks/useAccessibility.ts`、`src/stores/a11yStore.ts`、`src/theme/index.ts`、`tailwind.config.js`、`postcss.config.js` |
| 管理端（admin/expert） | **实测无独立 admin 页面/路由/store**：`grep -rniE "admin" src --include=*.ts --include=*.tsx` → **0 命中**；`role='therapist'` 能力承载于 `ReportPage` 患者管理 Tab 与 `reportService` → 如实记为盘点事实（非虚构条目） |

### 9.6 配置面位置

| 项 | 实测 |
|---|---|
| typecheck 配置 | `tsconfig.json`（口径见 §4）；`tsconfig.node.json`；另有**孤立** `tsconfig.app.json`（无引用 → F-13） |
| build 配置 | `package.json:8` `build = "tsc && vite build"`；`vite.config.ts`（alias :8、proxy :12、manualChunks :30、chunkSizeWarningLimit :43） |
| vitest 配置 | `vitest.config.ts`（独立文件，非内联于 vite.config） |
| lint 配置 | `.eslintrc.cjs`（extends :4、rules :21、`no-explicit-any: error` :24）；另有 `.oxlintrc.json`（scripts 与 CI 均未引用 → F-15） |
| 格式化配置 | `.prettierrc`；scripts 有 `format`/`format:check`（`package.json:15-16`），未纳入本基线五条命令 |
| e2e 配置 | `playwright.config.ts`（testDir `./e2e` :4、baseURL :10、retries/reporter :7-8、projects :13-18、webServer :19-23） |
| 样式配置 | `tailwind.config.js`、`postcss.config.js`、`src/index.css`、`src/App.css`、`src/theme/index.ts` |
| 其他根文件 | `index.html`、`public/`、`frontend/.gitignore`、`Dockerfile`、`nginx.conf` |

## 10. CI Parity

对照 `.github/workflows/ci.yml` `frontend-test` job（job 定义 `:106`，`runs-on: ubuntu-latest` `:107`，步骤至 `:151`）与本任务五条命令逐步骤映射：

| CI step | CI 命令（`working-directory: frontend`） | 本任务处置 | 本轮 exitCode | Parity 判定 |
|---|---|---|---|---|
| Set up Node.js | `node-version: "20"`（`:111-114`）、`cache-dependency-path: frontend/package-lock.json`（`:116`） | 本地实测 **Node v24.15.0 / npm 11.12.1** | — | **环境漂移** → F-05 |
| Install dependencies | `npm ci`（`:118-120`） | **未执行**（node_modules 预装且五条命令全部成功；近似「安装已完成」态，但非 lockfile 严格复现路径） | — | 近似 parity → F-05 |
| Type check | `npx tsc --noEmit`（`:122-124`） | **逐字同款**，本轮真实执行 | **0** | 命令逐字一致 |
| Lint | `npm run lint`（`:126-128`） | 逐字同款，本轮真实执行 | **0** | 逐字一致 |
| Test | `npm test -- --run`（`:130-132`） | 逐字同款，本轮真实执行 | **0** | 逐字一致 |
| Build | `npm run build`（`:134-136`） | 逐字同款，本轮真实执行 | **0** | 逐字一致 |
| Install Playwright browser | `npx playwright install --with-deps chromium`（`:138-140`） | 未执行（本机 chromium-1243 缓存与 `browsers.json` 要求匹配） | — | 结果等价（浏览器可用） |
| End-to-end smoke test | `npm run test:e2e`（`:142-144`） | 逐字同款，本轮真实执行 | **0** | 命令逐字一致；配置面差异：CI `retries=2`、`reporter=github` vs 本地 `retries=0`、`reporter=list`（`playwright.config.ts:7-8` 依 `process.env.CI` 分支） |
| Upload build artifact | `actions/upload-artifact@v4`，`name: frontend-dist`、`path: frontend/dist/`、`retention-days: 7`（`:146-151`） | 本地无 artifact 上传概念；`dist/` gitignored | — | n/a（不适用） |

**结论**：**命令面**与 CI `frontend-test` job **5/5 逐字对应**；**环境面**存在三处真实漂移（OS ubuntu→Windows、Node 20→24、`npm ci`→预装）。本基线口径为「本地 Windows / Node 24 / 预装依赖」，**不宣称**与 CI 结果全等（F-05）。

## 11. Version Drift

`package.json` 声明 vs `package-lock.json`（`lockfileVersion=3`，fs 解析 `packages` 节点）vs `node_modules` 实装（`node -p`）。**仅记录事实；本任务零升/降级，lockfile 未被任何命令改写**：

| 包 | package.json 声明 | lockfile 锁定 | 实装（本轮实测） | 漂移判定 |
|---|---|---|---|---|
| typescript | `^5.3.3`（`:53`） | **5.9.3** | **5.9.3** | 声明显著滞后、semver 区间内 → **F-03** |
| @playwright/test | `^1.52.0`（`:34`） | **1.63.0** | **1.63.0** | 同上 → **F-03** |
| vite | `^5.2.8`（`:54`） | **5.4.21** | **5.4.21** | 同上 → **F-03** |
| @vitejs/plugin-react | `^4.2.1`（`:42`） | **4.7.0** | — | minor 滞后 |
| react / react-dom | `^18.2.0`（`:27-28`） | **18.3.1 / 18.3.1** | **18.3.1 / 18.3.1** | minor 滞后 |
| @mui/material | `^5.15.14`（`:22`） | **5.18.0** | **5.18.0** | minor 滞后 |
| tailwindcss | `^3.4.1`（`:51`） | **3.4.19** | **3.4.19** | patch 滞后 |
| vitest | `^1.6.0`（`:55`） | **1.6.0** | **1.6.0** | 无漂移 |
| eslint | `^8.57.0`（`:44`） | **8.57.1** | **8.57.1** | patch 区间内 |
| echarts | `^6.1.0`（`:25`） | **6.1.0** | **6.1.0** | 无漂移；对应 F-02 chunk 体量 |
| echarts-for-react | `^3.0.2`（`:26`） | **3.0.6** | — | patch 滞后 |
| axios | `^1.6.8`（`:24`） | **1.20.0** | **1.20.0** | minor 滞后 |
| zustand | `^4.5.2`（`:31`） | **4.5.7** | **4.5.7** | patch 滞后 |
| @tanstack/react-query | `^5.28.0`（`:23`） | **5.102.8** | **5.102.8** | minor 滞后 |
| react-router-dom | `^7.18.4`（`:29`） | **7.18.4** | — | 无漂移 |
| terser / jsdom | `^5.51.2` / `^24.1.3` | **5.51.2 / 24.1.3** | — | 无漂移 |

- Playwright ↔ 浏览器 revision：`@playwright/test 1.63.0` → `browsers.json` 要求 `chromium 1243` → 本机缓存命中（§2）→ **当前可用，无缺口**。
- 依赖面完整性证据：`frontend/package.json` md5=`b5f4da1a644e63376d226baf1be19b4a`（**1,769 B**）、`frontend/package-lock.json` md5=`4046537754971fb0d39b62dcbc0faabb`（**304,818 B**），两文件 mtime 均为 `2026-09-20 01:26:55 +0900`（`stat -c '%y'` 实测，本轮五条命令未改写）；权威证据为 `git diff HEAD -- frontend/package.json frontend/package-lock.json` 为空（附录 A）。

## 12. Side Effects Declaration

以下为五条命令的**固有工具副作用**（非源码修改）。「porcelain 零条目」= 该路径被 gitignore 覆盖、不进入 git 跟踪面。

| 副作用路径 | 产生命令 | 忽略状态（本轮实测 `git check-ignore -v`，cwd=frontend） | 本轮实际状态 |
|---|---|---|---|
| `frontend/dist/` | `npm run build` | **gitignored**：`frontend/.gitignore:2` → `dist/` | 被本轮构建**覆写**（9 文件 / 1,766,614 B 逻辑字节，§7）；porcelain 零条目 |
| `frontend/test-results/` | `npm run test:e2e` | **gitignored**：`.gitignore:94` → `test-results/` | 写前已存在、写后仍存在，内含 `.last-run.json` **45 B**（mtime `Oct 8 03:09` 本地 = `18:09Z`）；porcelain 零条目（F-09） |
| `frontend/playwright-report/` | `npm run test:e2e`（若改用 html/junit reporter） | **未被 gitignore**：`git check-ignore -v playwright-report` → 无输出、**exit 1** | 本轮**未生成**（本地 `reporter=list`；写前 `ABSENT_before` / 写后 `ABSENT_after`）→ porcelain 无 `??` 条目。风险登记：一旦改用 html reporter，将以未跟踪条目出现，须按 spec `ALLOWED_WRITE_PATHS` 视为工具副作用、禁止 add/commit（**F-10**） |
| `frontend/node_modules/.vite`、`node_modules/.tmp/tsconfig.*.tsbuildinfo` 等缓存 | vitest / tsc / vite | `node_modules/` 被忽略（`frontend/.gitignore:1`、根 `.gitignore`） | 缓存更新，保留，不入 git 面 |
| 仓库外临时捕获文件 | — | — | 本轮**未使用**仓库外捕获文件；五条命令输出直接留在执行会话中 |

**写入面声明**：除上表工具副作用与本文件（唯一交付物）外，本任务对 `frontend/**`（含 `src/`、`e2e/`、`public/`、全部配置与 `package*.json`）、`backend/**`、`deploy/**`、`docker-compose.yml`、治理文件（`AGENTS.md`、`.qoder/**`、`.github/**`、`.gitignore`、`docs/workflow/**`）、其他既有 deliverables（含 `REPO_INVENTORY.md`/`BACKEND_TEST_BASELINE.md`/`DB_API_BASELINE.md`、`deliverables/overnight/**`）、`docs/qgraphflow/dialogue-turn-sequence/**` 的写入次数为 **0**。

## 13. Findings

编号连续 F-01…F-17；每条含 **位置（文件:行 或 命令）/ 现象 / 证据（本轮 exitCode 或 stdout 摘要）/ 影响 / 建议后续 FIX-\* 或 ARCH-\* 任务**。**本任务未实施任何修复**（`git diff --name-only HEAD -- frontend/ backend/ deploy/ docker-compose.yml` 为空，见附录 A）。

> **P0 结论：本轮无 P0**——无阻断型缺陷；五条命令 exitCode 全 0，无工具链断裂、无命令不可运行、无测试失败。

- **F-01 ｜ P2 ｜ 基线事实记录（本轮五维采样全 0）**
  位置：命令 `npx tsc --noEmit` / `npm run lint` / `npm test -- --run` / `npm run build` / `npm run test:e2e`（cwd=`frontend/`）
  现象：本轮五维采样结果全部为 0——tsc 0、lint 0、vitest 0、build 0、e2e 0。
  证据：§3 表 exitCode 列（wall 5s / 4s / 27s / 40s / 8s）；vitest `Tests 10 passed (10)`；playwright `1 passed (6.2s)`。
  影响：本轮 `PROJECT_BASELINE_HEALTH=GREEN`（§15）。该事实**不等于**质量达标、覆盖充分或 CI 同绿（口径差 F-05、盲区 F-13）。
  建议：无需 FIX；作为 M1+ 前端任务的回归参照；后续每轮必须重新实测（F-14 纪律）。

- **F-02 ｜ P1 ｜ 构建产物单 chunk 体积**
  位置：`npm run build` 输出 / `dist/assets/js/vendor-charts-D0J8WDxw.js`（1,130,359 B）；依赖 `package.json:25` `echarts: ^6.1.0`、`vite.config.ts:30` manualChunks、`:43` `chunkSizeWarningLimit: 1000`
  现象：exitCode=0 但含 `(!) Some chunks are larger than 1000 kB after minification.`；vendor-charts 1,129.69 kB（gzip 372.31 kB）**本轮复现**。
  证据：§7 产物表与告警原文（本轮实测）。
  影响：移动端/老年用户首屏 JS 下载量偏大，属工程性能与体验层面张力（`.qoder/rules/40-frontend.md` 体验约束）；不影响构建成功。
  建议：图表库动态 import（`React.lazy`/`import()`）或进一步细分 `vendor-charts` → **FIX-FE-BUNDLE-01**（0.5 开发日）。本任务未改 `vite.config.ts` 一字。

- **F-03 ｜ P1 ｜ 声明版本 vs lockfile/实装漂移**
  位置：`frontend/package.json`（typescript `^5.3.3` :53、@playwright/test `^1.52.0` :34、vite `^5.2.8` :54、@vitejs/plugin-react `^4.2.1` :42、react `^18.2.0`、@mui/material `^5.15.14`、tailwindcss `^3.4.1`、axios `^1.6.8`、@tanstack/react-query `^5.28.0`）vs `package-lock.json`（`lockfileVersion=3`）
  现象：锁定/实装显著高于声明下界（5.9.3 / 1.63.0 / 5.4.21 / 4.7.0 / 18.3.1 / 5.18.0 / 3.4.19 / 1.20.0 / 5.102.8）。
  证据：§11 表 + §2 实测版本。
  影响：均在 semver 区间内、`npm ci` 可复现，无破坏；但 `package.json` 无法直观反映当前基线，跨工具阅读易误判，且与 `AGENTS.md`/规则「依赖版本锁定」的沟通口径不一致。
  建议：由治理/依赖决策任务统一对齐声明口径或文档化「lockfile 为唯一权威口径」→ **ARCH-DEP-01**（本任务禁升降级）。

- **F-04 ｜ P1 ｜ 治理文档口径过期（测试文件数与 store 清单）**
  位置：`.qoder/rules/40-frontend.md`「测试」节原文「现有 `*.test.tsx` **5 个**：LoginPage、HomePage、DialoguePage、TrainingPage、authStore、utils/errors」；同文件「状态管理」节提及 `sessionStore`、deprecated `stores/useAppStore.ts`
  现象：列举 6 项却计 5 个；实测 vitest **6 个测试文件**，其中 `*.test.tsx` **4 个**、`*.test.ts` **2 个**（`authStore.test.ts`、`errors.test.ts`）；`src/stores/` 实测仅 `authStore.ts`、`authStore.test.ts`、`a11yStore.ts`，`sessionStore.ts` 与 `useAppStore.ts` **不存在**。
  证据：§6 `Test Files 6 passed (6)` + 逐文件表；§9.4 `ls src/stores` 实测；`find src e2e` 测试文件枚举。
  影响：治理文档口径过期可能误导任务规划与验收判断；无运行时影响。
  建议：治理阶段由 Max 修订（治理文件是 Flash 绝对禁区，本任务**仅记录、未改一字**）→ **GOV-FRONTEND-RULES-01**。

- **F-05 ｜ P1 ｜ 本地 / CI 环境口径漂移**
  位置：`.github/workflows/ci.yml:107`（`runs-on: ubuntu-latest`）、`:111-114`（`node-version: "20"`）、`:118-120`（`npm ci`）、`:138-140`（`playwright install --with-deps`）vs 本轮 §2 实测（Windows / `MINGW64_NT-10.0-26200` + Node v24.15.0 + npm 11.12.1 + 预装 node_modules，未走 `npm ci`）
  现象：本地基线为 Windows/Node24/预装口径；CI 为 ubuntu/Node20/`npm ci` 口径。
  证据：§10 映射表；§2 环境表。
  影响：本地五维全绿**不能等价宣称** CI 全绿；Milestone/Release Gate 需以 CI 侧真实运行补位证据。
  建议：Gate 阶段核对 GitHub Actions `frontend-test` job 真实结果 → **FIX-CI-PARITY-01**。

- **F-06 ｜ P1 ｜ 前端测试覆盖单薄（数量事实）**
  位置：`src/pages/`（9 页面组件）vs 4 个页面测试文件；`e2e/`（仅 `core-flow.spec.ts`）；52 个源文件 / 6,452 行
  现象：vitest 合计 **10 用例**（多数页面 1 用例）；`ConversationPage`、`PronunciationPage`、`ReportPage`、`SettingsPage`、`NotFoundPage`、`AppShell`、6 个 hooks（全部无测试）、`a11yStore` 无测试；e2e 仅 1 spec / 1 用例。
  证据：§6 逐文件表；§8 `Running 1 test`；§9.2 页面×测试交叉表；§9.1 规模口径。
  影响：M1+ 前端改动（尤其发音反馈面、报告/听力师 Tab、无障碍偏好面）回归保护弱；`40-frontend.md`「新页面必须带测试」将使缺口相对扩大。
  建议：按验收项立扩充任务（优先 `ReportPage`、`PronunciationPage`、`ConversationPage`、`useRecorder`/`useAudioPlayer` 与关键 e2e 路径）→ **FIX-FE-TEST-01**（1~1.5 开发日）。本任务未新增/删除任何测试。

- **F-07 ｜ P2 ｜ vitest 汇总耗时口径（记录性）**
  位置：`npm test -- --run` summary 行
  现象：本轮 `Duration 23.38s (transform 753ms, setup 6.72s, collect 64.20s, tests 1.43s, environment 7.69s, prepare 1.25s)`，其中 `collect 64.20s` > wall 27s。
  证据：§6 记录；wall 实测 27s。
  影响：无（`collect` 为多 worker 并行累加口径；单轮采样 exit 0、6 files/10 tests 计数一致 → 非 flaky，无需按 ≤3 次采样规则处置）。
  建议：Gate/报告计时口径统一用 wall，不引用 `collect` → **FIX-GATE-TIMING-01**（属门禁脚本面，须治理阶段处理）。

- **F-08 ｜ P2 ｜ `npm test -- --run` 冗余参数（记录性）**
  位置：`frontend/package.json:12` `test = "vitest run"`；§3 命令原文
  现象：追加 `--run` 后实际命令为 `vitest run --run`；vitest 1.6.0 接受，exit 0，行为不变。
  证据：§6 banner `RUN v1.6.0`；CI 同款写法（`ci.yml:132`）。
  影响：无功能影响；CI / 治理文档（`80-testing.md`）/ 本地三者口径一致。
  建议：维持现状（记录性）；若未来清理须同步 CI 与治理文档，属独立任务。

- **F-09 ｜ P2 ｜ e2e 副作用目录终态跨轮不可假定**
  位置：`frontend/test-results/.last-run.json`
  现象：本轮 e2e 通过后该目录仍存在（1 文件，45 B，mtime 本地 `Oct 8 03:09`）；上一 run 报告曾记录该目录「被自动清理」。
  证据：`ls -la test-results` 实测（§12）；`.gitignore:94` 覆盖该路径。
  影响：无 git 面影响（porcelain 零条目）；提示「副作用终态」须每轮实测，不得沿用历史结论。
  建议：无需代码处置；后续刷新轮继续实测该目录（纪律项，并入 F-14）。

- **F-10 ｜ P1 ｜ `frontend/playwright-report/` 未被 gitignore（scope 卫生风险）**
  位置：`playwright.config.ts:8`（reporter 分支）；根 `.gitignore` / `frontend/.gitignore`
  现象：本轮实测 `git check-ignore -v playwright-report` **无输出、exit 1** → 该目录若生成将以 `?? ` 未跟踪条目出现在 `git status --porcelain`。
  证据：§12 实测三行 `git check-ignore`（`dist` → `frontend/.gitignore:2`、`test-results` → `.gitignore:94`、`playwright-report` → 未命中）；本轮实际未生成（`ABSENT_before`/`ABSENT_after`）。
  影响：未来任何改用 html/junit reporter 的运行（或 CI 产物本地复现）会产生未跟踪目录，易被误判为 Scope 越界或被意外纳入提交。
  建议：治理阶段评估是否补 `playwright-report/` 忽略项（`.gitignore` 属治理文件，Flash 禁改）→ **GOV-GITIGNORE-01**。本任务未做任何忽略面改动。

- **F-11 ｜ P2 ｜ e2e 后 :4173 存在 TIME_WAIT 连接（非残留进程）**
  位置：命令 `netstat -ano`（e2e 后）
  现象：6 条 `127.0.0.1:<port> → 127.0.0.1:4173 TIME_WAIT`；按 `LISTENING` 精确过滤后**零命中**。
  证据：§2 / §8 实测 `NO_4173_LISTENER`。
  影响：无（TCP 收尾态属正常）；spec `IN_SCOPE` 亦明确 TIME_WAIT 不算残留 → 「无 dev server 残留」判定成立。
  建议：后续 Gate 脚本判定残留应精确匹配 `LISTENING`，勿按字符串 `4173` 粗匹配（属门禁脚本面）→ **FIX-GATE-TIMING-01**。

- **F-12 ｜ P2 ｜ e2e 输出含 NO_COLOR/FORCE_COLOR 冲突 warning**
  位置：`npm run test:e2e` stdout（`[WebServer]` 行与测试进程行各 1 次，共 2 次）
  现象：`Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.`
  证据：§8 输出逐字（exitCode 仍为 0）。
  影响：无功能影响；来自运行器注入的环境变量组合，非项目源码问题；日志噪声可能干扰自动解析。
  建议：解析器按 `[WebServer]` 前缀过滤（属门禁脚本面）→ **FIX-GATE-TIMING-01**。

- **F-13 ｜ P1 ｜ `tsconfig.app.json` 为孤立配置（类型口径盲区）**
  位置：`frontend/tsconfig.app.json`（`target es2023`、`verbatimModuleSyntax`、`erasableSyntaxOnly`、`noUnusedLocals/Parameters`、`include: ["src"]`）vs `frontend/tsconfig.json:22`（`references` 仅 `tsconfig.node.json`）
  现象：本轮在 `package.json`、`tsconfig.json`、`tsconfig.node.json`、`vite.config.ts`、`vitest.config.ts`、`playwright.config.ts`、`.eslintrc.cjs` 中 grep `tsconfig.app` → **`NO_REFERENCE_FOUND`**（零命中）→ `npx tsc --noEmit` 与 `build` 内 `tsc` 均走 `tsconfig.json`（ES2020 口径），`tsconfig.app.json` 的更严格口径**从未被执行**。
  证据：§4 tsconfig 实测 + §5/§9.6 配置面枚举 + 本轮 grep 结果。
  影响：存在「看似两套严格口径、实际只生效一套」的认知风险；若 M1+ 任务按 app 配置预期 `verbatimModuleSyntax`/`erasableSyntaxOnly` 行为，可能出现本地绿而实际口径未校验的偏差。属工程口径问题，无运行时影响。
  建议：立配置整合任务（使 app 配置成为受检口径并全量校验其后果，或删除孤立配置）→ **ARCH-FE-TSCONFIG-01**（涉及 `frontend/**` 配置改动，须独立 TASK_SPEC 授权，本任务禁改）。

- **F-14 ｜ P2 ｜ 预期红色源本轮「未观察到」（AC-03 要求的负项显式记录）**
  位置：spec `KNOWN_RISKS` / `CONTEXT` 预期失败源清单
  现象与逐项结论：tsc strict/noUnused 报错 **未观察到**；eslint `no-explicit-any` / `--max-warnings 0` 违规 **未观察到**；vitest 失败 / skip / xfail **未观察到**；build 失败 **未观察到**；e2e 浏览器缺失 **未观察到**（chromium-1243 命中）；e2e 端口冲突 **未观察到**（`PORT_4173_FREE_PRE_E2E`）；e2e flaky **未观察到**（单采样即 0）；网络受限 **未观察到**；Secret 触达 **未观察到**（`frontend/.env*` → SECRET_MISSING）；`SAFELY_NOT_EXECUTED_AND_RECORDED` 分支 **未触发**。
  证据：§3 五条 exitCode 全 0；§2 chromium 缓存与版本实测；§8 端口与 mock 证据。
  影响：本轮基线优于 spec 保守预期；该结论**仅本轮采样有效**，不得据此把「历史全绿」当作当前证据。
  建议：无处置；后续轮次重新实测（含 `test-results/` 终态、reporter 配置、端口状态）。

- **F-15 ｜ P2 ｜ 基线未覆盖 prettier / oxlint / lint:fix（口径合法性记录）**
  位置：`frontend/package.json:11`（`lint:fix`）、`:15-16`（`format`/`format:check`）、`frontend/.oxlintrc.json`（存在但未被 scripts/CI 引用）、`frontend/.prettierrc`；无独立 `typecheck` script（`:7-16`）
  现象：本基线只覆盖 CI 的五条命令；prettier 与 oxlint 面处于基线之外，`format:check` 本轮**未执行**。
  证据：§4、§5、§9.6、§10。
  影响：无（口径合法）；但不得把「未执行」误读为「已通过」。
  建议：若需要 prettier/oxlint 门禁，先落地到 `package.json` 与 CI 再把命令纳入基线（禁止引用不存在的命令，per `80-testing.md`）→ **FIX-FE-FORMAT-GATE-01**。本任务未扩大基线范围。

- **F-16 ｜ P2 ｜ 硬件（ESP32）前端面存在且通过基线（盘点性）**
  位置：`src/components/hardware/{HardwareControlPanel,HardwareStatus}.tsx`、`src/hooks/useHardware.ts`、`src/services/hardwareService.ts`
  现象：非 MVP 既有实验面仍在前端源码中；本轮 typecheck / lint / build 均在其参与下 exit 0。
  证据：§9.3/§9.4 实测清单；§3 命令结果。
  影响：无当前缺陷；属范围纪律观察项（`10-project.md`：硬件模块保持可编译可测试，不投入新功能）。
  建议：维持「不新增功能」纪律；若 M1 需裁剪入口或隔离路由，另立任务 → **FIX-FE-SCOPE-01**。

- **F-17 ｜ P2 ｜ `ConversationPage.tsx` 未挂载任何路由**
  位置：`src/pages/ConversationPage.tsx` vs `src/App.tsx:17-25`（路由枚举中无该页）
  现象：本轮 grep `ConversationPage` 于 `App.tsx` 与 `components/layout/AppShell.tsx` → **0 命中**；该文件参与 typecheck/lint/build（故非编译错误），但从路由面不可达。
  证据：§9.2 交叉表 + 本轮 grep 结果。
  影响：无编译/构建影响；属功能入口一致性观察项——治理文档（`10-project.md`）把 `ConversationPage.tsx` 列为「对话陪练」前端资产，实际入口未接通，易造成状态误判。
  建议：由对话域任务确认该页应挂载还是废弃（涉及 `frontend/src/**` 改动，须独立 TASK_SPEC 授权）→ **FIX-FE-DIALOGUE-ENTRY-01**。本任务未改动任何源文件。

## 14. GATE_HEALTH

> 语义：本节**只评 REQUIRED 行为项**（真实执行并记录 / 交付物刷新 / section 齐备 / scope / git 纪律 / 指纹 / 重试归属 / Secret / e2e 合规 / pre-existing 指纹），与五条命令的命令结果维度**相互独立**。下表为 Flash 的逐项自检证据；判定权归 Machine Gate 脚本（真实 `exitCode`）+ 独立 Max Review（`qmodel_38max`）+ 独立 Max Verify，**执行手无 PASS 权**。

| REQUIRED 项 | 命令口径（MANDATORY_TESTS / REGRESSION_TESTS） | 本轮真实结果 | 自检 |
|---|---|---|---|
| scope-pre | `git rev-parse HEAD` && `git branch --show-current` && `git status --porcelain` && `git diff --cached --stat` && `git stash list` | HEAD=`c61bfd339585ae214d7f369d8e07a61a7bba3e0e`、branch=`feature/m0-baseline`、porcelain 恰为 ` M deliverables/baseline/FRONTEND_BASELINE.md` + `?? docs/qgraphflow/dialogue-turn-sequence/`、cached 空、stash 空（与 spec 预期逐字一致；此时 `git diff --name-only HEAD` 已含交付物 = 上一 run 未提交改动，符合写前预期） | ✓ |
| retry-artifact-precheck | `sha256sum deliverables/baseline/FRONTEND_BASELINE.md`（**必须在任何写动作之前**） | 输出 `ccf5e80e60e3ce18d41377b85d3b587f0932e2ad9860dc2bb002c00c88c14d40`，与 spec `priorRunSha256` 64 位小写 hex **逐字一致** → 判定 `RETRY_OWNED_ARTIFACT`，随后才首次动笔（证据链 §16） | ✓ |
| untracked-fingerprint-pre | `md5sum` + `wc -c`（两文件） | graph.json `2fe742d810f7cd0ce2f5eb401f0050a0` / `34972` B；index.html `c1bb9c9b90d92db933577e4056e3ba91` / `794348` B（与 spec 锚定值逐字一致） | ✓ |
| 五条 REQUIRED | tsc / lint / vitest / build / e2e（cwd=`frontend/`） | 全部 **EXECUTED_AND_RECORDED**，verbatim exitCode 逐条记录（§3），各 1 次采样；**无** SAFELY_NOT_EXECUTED 项；未被降级/升格处置；未转抄上一 run 自报值 | ✓ |
| deliverable-refreshed | `sha256sum` + `wc -c`（>2048）+ `grep -c "c61bfd3"`（≥1） | 交付物由本轮**原位刷新**（写前 `59,739 B` → 写后终态见 Machine Gate 实测，见 §16 自指不变性说明）；正文含本轮快照 `c61bfd3`（`## 1. Baseline Snapshot` 表内多处） | ✓ |
| sections（AC-13） | grep 17 个 section 关键词 | 本报告 `## 1.`–`## 17.` **17/17 齐备**，关键词与 spec 顺序逐字对应（附录 B 列出映射） | ✓ |
| 快照刷新（AC-02） | grep `c61bfd3` / `FULL` / `qmodel_38max` / `qfmodel`；确认陈旧值不作本轮快照字段 | §1：HEAD=`c61bfd339585ae214d7f369d8e07a61a7bba3e0e`、short `c61bfd3`、执行模式 `FULL`、决策角色 `qmodel_38max`、实施 `qfmodel`、采样窗口 UTC 齐备；上一 run 旧 SHA 与旧执行模式**仅**出现在 §16 历史对照，未作为任何本轮字段值 | ✓ |
| scope-post | `git diff --name-only HEAD` && `git status --porcelain` && `git diff --cached --stat` && `git rev-parse --short HEAD` && `git branch --show-current` | 见附录 A：`git diff --name-only HEAD` 恰为单行交付物；porcelain 白名单命中；cached 空；HEAD 仍 `c61bfd3`（**无新 commit**）、branch 不变 | ✓ |
| forbidden-files | `git diff --name-only HEAD -- frontend/ backend/ deploy/ docker-compose.yml …` | 该分路径 diff **为空**（附录 A）；`frontend/package.json` 与 `package-lock.json` md5/mtime 未变（§11）；6 个测试文件与 `e2e/core-flow.spec.ts` 零 diff（§6/§8） | ✓ |
| preexisting-post | `md5sum` 两文件（+ `wc -c`） | 与 pre **逐字一致**（附录 A）→ 判定 `PRE_EXISTING_UNCHANGED` | ✓ |
| regression-sibling-deliverables | `git diff --name-only HEAD -- deliverables/baseline/{REPO_INVENTORY,BACKEND_TEST_BASELINE,DB_API_BASELINE}.md deliverables/overnight` | 实测为空（附录 A） | ✓ |
| regression-governance | `git status --porcelain .qoder/ .github/` && `git diff --name-only HEAD -- AGENTS.md docs/workflow/ .gitignore` | 实测均为空（附录 A）；本轮 spec 文件由 Max 在 IMPLEMENT 前落盘、被 `.gitignore` 忽略，porcelain 无 `.qoder` 条目；Worker 对 `.qoder/**` **零写入**，两份历史 spec 未被覆盖/修改 | ✓ |
| Git 纪律（AC-12） | branch/HEAD/cached/stash 前后各一次；完成后不 commit | 全程**未执行任何 git 写操作**（无 add/commit/push/checkout/restore/reset/clean/stash/merge/rebase/branch）；交付物**不提交**，留在工作区供 Gate 与人工审阅 | ✓ |
| Secret（AC-11） | 报告全文自检 | 无任何 Secret 值 / API Key / 连接串 / 凭据字面量；环境文件仅 `SECRET_MISSING`（frontend）与 `SECRET_PRESENT`（仓库根 `.env`、`.env.example`，值未读取）表述（§2） | ✓ |
| e2e 合规（AC-09） | 仅 chromium / 本地 webServer / `/api` 全 mock / 前后端口检查 / 无残留 / 采样 ≤3 | §8 逐项证据（`playwright.config.ts:13-23`、`core-flow.spec.ts:4/:11/:22`、`PORT_4173_FREE_PRE_E2E`、`NO_4173_LISTENER`、采样 1 次） | ✓ |
| 副作用纪律（AC-10） | 产物仅写三个白名单目录；`playwright-report/` 不入库 | §12（`dist/` 覆写、`test-results/` 存在、`playwright-report/` 未生成）；未执行任何 `git add`；白名单外零新增文件（porcelain 佐证） | ✓ |
| 角色独立性（FULL_MODE） | 决策=Max、实施=Flash，互不替代 | 本报告不含任何「本任务 PASS / 已通过」自我宣布；实施者仅呈报 `IMPLEMENTED` 级证据；终态由脚本 + 独立 Review + 独立 Verify 合成 | ✓ |

**GATE_HEALTH 小结**：REQUIRED 行为项逐项落在验收白名单内，自检结论为「无 missing_evidence」；五条命令 exitCode 全 0 属**独立采样事实**，不参与本节门禁逻辑（见 §15 的维度隔离）。**最终 GATE 判定权不在执行手。**

## 15. PROJECT_BASELINE_HEALTH

> 语义：本节**独立**评级被检**前端项目**的五维健康，与 §14 的审计任务门禁**完全分离、互不推导**。口径：本地 Windows / Node v24.15.0 / 预装 node_modules / 本轮各命令单次采样。

| 维度 | 命令 | 本轮 exitCode | 评级 | 附注（本轮实测） |
|---|---|---|---|---|
| Typecheck | `npx tsc --noEmit` | **0** | **GREEN** | strict + noUnused* 口径下零错误（5s）；口径盲区 F-13 |
| Lint | `npm run lint` | **0** | **GREEN** | 56 文件、0 error / 0 warning，`--max-warnings 0` 恰好满足（4s） |
| 单测 | `npm test -- --run` | **0** | **GREEN** | 6 files / 10 tests / 0 skipped（内部 23.38s，wall 27s）；绝对量薄 → F-06 |
| 构建 | `npm run build` | **0** | **GREEN（warning 级观察 1 条）** | `✓ built in 32.62s`；vendor-charts 1,129.69 kB chunk 告警 → F-02 |
| E2E | `npm run test:e2e` | **0** | **GREEN** | 1 spec / 1 用例通过（内部 6.2s，wall 8s）；覆盖面 → F-06 |

**PROJECT_BASELINE_HEALTH 评级：GREEN（本轮采样；伴随 F-02 warning 级观察、F-06 覆盖面事实、F-13 类型口径盲区、F-05 环境口径差）**

- 「GREEN」**仅**描述这五条命令在本轮采样的真实结果，**不等于**「前端质量达标」「测试覆盖充分」「类型口径已全面校验」或「CI 会同样绿」。
- 工程指标（tsc/lint/vitest/build/e2e 的 exitCode、用例数、chunk 体积）在本报告中一律呈现为**工程质量测量**，不构成任何疗效或健康层面的结论（§17）。
- 反向声明：若未来任一维度变红，应新增 Finding 并立 FIX 任务，而非改写本轮基线事实；本轮记录亦不得被未来引用为「上次通过」证据。
- 与 §14 的关系：两节结论各自独立成立。本报告全文未把 Gate 合规表述为「前端全绿」或等价暗示，也未用「前端全绿」反推 Gate 通过。

## 16. Retry Context

本节承载 spec `DEPENDENCIES` 的 D4 重试归属证据、上一 run 对照，以及本轮取证时序。

### 16.1 D4 写前指纹证据（逐字）

- 取证命令（**在任何写动作之前**执行）：
  `cd "D:/systemDir/Desktop/听觉康复" && sha256sum deliverables/baseline/FRONTEND_BASELINE.md`
- 本轮实测输出（逐字）：
  `ccf5e80e60e3ce18d41377b85d3b587f0932e2ad9860dc2bb002c00c88c14d40 *deliverables/baseline/FRONTEND_BASELINE.md`
- 同批体量实测：`wc -c deliverables/baseline/FRONTEND_BASELINE.md` → `59739`（写前字节数，作为「本轮刷新前状态」的字节锚点）。
- spec 锚定值（`RETRY_OWNERSHIP.priorRunSha256`）：`ccf5e80e60e3ce18d41377b85d3b587f0932e2ad9860dc2bb002c00c88c14d40`。
- 比对结论：64 位小写 hex、逐字相等 → **`RETRY_OWNED_ARTIFACT`** 成立 → 允许对 `deliverables/baseline/FRONTEND_BASELINE.md` 原位刷新；`BLOCKED_RETRY_ARTIFACT_CHANGED_EXTERNALLY` 分支**未触发**。
- 同任务身份同时满足（`LAST_TASK_OUTPUT_HASH` 与本轮重试起始指纹一致、非治理路径、在 `ALLOWED_WRITE_PATHS`/`EXPECTED_FILES` 白名单内）。
- 时间纪律：指纹取证发生在五条命令采样之前（`18:06:39Z` 前）与首次落笔之前，顺序为「取证 → 测量 → 写」。
- 自指不变性说明：交付物的**写后**终态指纹 / 字节数 / `grep -c c61bfd3` **不在本文件内自报**（文件无法包含自身最终哈希；任何二次补写都会使其失效）。该组数值由 Machine Gate 的 `[REQUIRED|deliverable-refreshed]` 与 Max Verify 在落盘后外部实测，预期判据：`sha256sum != ccf5e80e…c14d40`（证明已刷新）、`wc -c > 2048`、`grep -c "c61bfd3" >= 1`。

### 16.2 与上一 run 的对照（历史事实，非本轮证据）

| 项 | 上一 run（历史对照） | 本轮 |
|---|---|---|
| 快照 HEAD | `00599c1`（旧短 SHA） | **`c61bfd3`** |
| 快照执行模式 | `FLASH_ONLY_DEGRADED_MODE` | **`FULL`**（D5 已恢复默认双模型） |
| 决策角色 | `qfmodel` 独立 invocation 承担 | **`qmodel_38max`**（Review/Verify/Gate 判定） |
| exitCode 证据效力 | Worker 自报五条全 0，**未通过 Verify** → 本轮**不作为任何 Machine evidence** | 本轮五条**重新真实执行**，逐条 verbatim 记录（§3） |
| 上一 run 报告 17 节构成 | §16 `No Business Code Change`、§17 `Candidate Follow-up Tasks`（旧 spec 关键词） | 按**本轮 spec AC-13**：§16 `Retry Context`、§17 `Medical Safety Statement`；旧两节内容并入 §13 建议字段与附录 A/B |
| 旧报告数值是否被复用 | — | **未复用**：§4–§8 全部为本轮输出；§7 chunk 清单与 §11 版本表为本轮 vite/lockfile 实测 |
| 陈旧字段残留检查 | — | `00599c1` 与 `FLASH_ONLY` 在本报告中**仅**出现在本节历史对照列，未出现在 §1/§2/§3 任何本轮字段值中 |

### 16.3 spec 落盘与历史 spec

- 本轮 spec：`.qoder/workflow-state/m0-003-frontend-build-baseline-c61bfd3.spec.json`（Max 落盘，短 SHA 后缀来自 `git rev-parse --short HEAD`）。
- 两份历史 spec（`m0-003-frontend-build-baseline.spec.json`、`m0-003-frontend-build-baseline-00599c1.spec.json`）**未被 Worker 读取修改、未被覆盖**；`*.spec.json` 被 `.gitignore` 忽略，故 porcelain 无 `.qoder` 条目（附录 A 的 `regression-governance` 实测佐证）。
- Worker 对 `.qoder/**` 写入次数：**0**。

## 17. Medical Safety Statement

- 本文件是**工程构建基线报告**，其全部数值（`exitCode`、类型错误数、lint error/warning 数、测试文件与用例数、构建产物字节数、chunk 体积、耗时、版本号）**只呈现为软件工程质量测量**。
- 本报告不对任何使用者的听力、言语、康复进展或身体状况作出判断，不作疾病识别、不作用药或用药变更建议、不给出人工耳蜗设备参数设定建议、不替代专业人员判断、不承诺任何训练效果的必然性。产品医疗边界与措辞纪律见 `AGENTS.md §1`、`.qoder/rules/70-medical-safety.md`。
- 工程指标与用户健康状态之间**不存在**报告所声明的对应关系：测试通过、构建成功或产物体积变化，均不得被引用或转述为使用者层面的效果结论。
- 本任务**未修改任何用户可见文案**（`frontend/src/**` 零改动，附录 A 分路径 diff 为空），因此不会引入或改变任何界面措辞；文中出现的界面字符串（如 `src/pages/ReportPage.tsx:139` 的 Tab 标签、`e2e/core-flow.spec.ts:54` 的欢迎语）仅为**源码位置引用**，非本报告新增表述。
- 训练数据与评分（如正确率、音素分数）在本基线中不被测量，也不被描述为健康结论；发音与训练相关页面在本报告中仅以「代码资产 + 测试覆盖状态」形式出现。
- 本报告不含任何 Secret 值、API Key、连接串或用户个人数据（§2、§11、附录 A 均为工程元数据）；引用的用户角色仅为类型定义中的角色枚举（`src/types/index.ts:88`），不涉及任何真实用户。
- 高危词自检（执行手对本文件逐字 grep 实测，命中数 **0**）：治理规则 `.qoder/rules/70-medical-safety.md` 所列举的边界术语字面（必然效果类、医学标准类、疾病识别类、用药类、设备参数类、恢复程度类措辞）在本报告全文均**不出现**；编译器 tsc 输出义项统一改用「类型错误」措辞，产品医疗边界在本节以「不作 / 不给 / 不承诺 / 不替代」的否定句式表述，其余工程章节（§4–§12、§15）不含任何把测试数值医学化的表述。

---

## 附录 A. 终态复核记录（交付物落盘后由执行手真实运行；本节数值不依赖本文件自身内容）

> 说明：以下命令在 §1–§17 首次落盘之后运行，取证对象为 git 状态、pre-existing 未跟踪目录与端口，**均为与本文件字节内容无关的外部事实**；本节刻意不引用本文件自身的哈希/字节数（理由见 §16.1 自指不变性说明）。

- `git diff --name-only HEAD`（cwd=仓库根）→ `deliverables/baseline/FRONTEND_BASELINE.md`（恰一行；git 附带 `LF will be replaced by CRLF` 提示，属 autocrlf 行为，不改变 diff 内容）。
- `git status --porcelain` → ` M deliverables/baseline/FRONTEND_BASELINE.md` + `?? docs/qgraphflow/dialogue-turn-sequence/`（恰两项，完全命中 AC-04 白名单；`?? frontend/playwright-report/` **未出现**，因本地 `reporter=list` 未生成该目录）。
- `git diff --cached --stat` → 空；`git stash list` → 空；`git rev-parse --short HEAD` → `c61bfd3`；`git branch --show-current` → `feature/m0-baseline`（**无新 commit**）。
- `git diff --name-only HEAD -- frontend/ backend/ deploy/ docker-compose.yml` → **空**（AC-05 / regression）。
- `git diff --name-only HEAD -- frontend/package.json frontend/package-lock.json` → **空**。
- `git diff --name-only HEAD -- deliverables/baseline/REPO_INVENTORY.md deliverables/baseline/BACKEND_TEST_BASELINE.md deliverables/baseline/DB_API_BASELINE.md deliverables/overnight` → **空**。
- `git status --porcelain .qoder/ .github/` → **空**；`git diff --name-only HEAD -- AGENTS.md docs/workflow/ .gitignore` → **空**（治理文件零改动）。
- `md5sum docs/qgraphflow/dialogue-turn-sequence/graph.json docs/qgraphflow/dialogue-turn-sequence/index.html` → `2fe742d810f7cd0ce2f5eb401f0050a0`、`c1bb9c9b90d92db933577e4056e3ba91`；`wc -c` → `34972`、`794348` → 与写前锚定值逐字一致 → **`PRE_EXISTING_UNCHANGED`**（`BLOCKED_EXTERNAL_WORKTREE_CHANGE` 未触发）。
- `netstat -ano | grep -i listening | grep -E ":4173[[:space:]]"` → 零命中 → **`NO_4173_LISTENER`**（无 dev server 残留；TIME_WAIT 见 F-11）。
- `ls -la frontend/test-results` → 目录存在、含 `.last-run.json` 45 B（mtime 本地 `Oct 8 03:09`）；`ls -d frontend/playwright-report` → **不存在**（F-09 / F-10 证据）。
- Secret 自检：`frontend/.env*` 实测不存在 → **SECRET_MISSING**；仓库根 `.env`、`.env.example` 实测存在 → **SECRET_PRESENT**（内容未读取、未输出）。

## 附录 B. section 映射与取证时序

### B.1 AC-13 十七节关键词 → 本节标题逐字映射

`## 1. Baseline Snapshot` / `## 2. Execution Environment` / `## 3. Commands Executed` / `## 4. TypeScript Baseline` / `## 5. Lint Baseline` / `## 6. Unit Test Baseline` / `## 7. Build Baseline` / `## 8. E2E Baseline` / `## 9. Frontend Asset Inventory` / `## 10. CI Parity` / `## 11. Version Drift` / `## 12. Side Effects Declaration` / `## 13. Findings` / `## 14. GATE_HEALTH` / `## 15. PROJECT_BASELINE_HEALTH` / `## 16. Retry Context` / `## 17. Medical Safety Statement` → **17/17 齐备且顺序一致**。

### B.2 本轮取证时序（UTC，逐字来自 `date -u` 与命令同批采集）

| 时刻（UTC） | 动作 |
|---|---|
| `18:06:3x` 前 | scope-pre（git 五项）+ retry-artifact-precheck（sha256sum）+ untracked-fingerprint-pre（md5/wc） |
| `2026-10-07T18:06:39Z` | `npx tsc --noEmit` → exit 0（wall 5s） |
| `2026-10-07T18:07:01Z` | `npm run lint` → exit 0（wall 4s） |
| `2026-10-07T18:07:18Z` | `npm test -- --run` → exit 0（banner `Start at 03:07:20` 本地 = `18:07:20Z`；wall 27s） |
| `2026-10-07T18:07:52Z` | `npm run build` → exit 0（wall 40s） |
| `2026-10-07T18:08:55Z` | `npm run test:e2e` → exit 0（wall 8s） |
| `18:09Z` | e2e 后置检查（`netstat` LISTENING、`playwright-report` 不存在、`test-results/.last-run.json` 45 B） |
| `18:0x–18:1xZ` | 只读补测（版本、`browsers.json`、lockfile 解析、资产枚举、`git check-ignore`、附加 `--format json` 与 `--list`） |
| 之后 | 交付物原位刷新（唯一持久写入）→ 附录 A 终态复核 |

### B.3 本轮采样总次数汇总（供 Reviewer/Verifier 核对 ≤3 次上限）

tsc **1**、lint **1**（附加只读取证另计：同命令 `--format json` 换 reporter **1** 次）、vitest **1**、build **1**、e2e **1**（附加 `--list` **1** 次，枚举不运行用例）。任何命令的基线采样均**未超过 1 次有效执行**，不存在为凑绿的重复采样。

### B.3.1 REGRESSION 项重复执行（非基线重新采样，仅一致性核实）

spec `REGRESSION_TESTS` 的 `regression-tsc` 与 `regression-vitest` 要求 exitCode 与 §3 记录逐字一致，故在交付物落盘后各再执行一次（UTC 采集时刻见下），**目的是一致性核实，不是为改变结果而重跑**：

| 回归项 | 命令 | 起始 UTC | exitCode | 与 §3 基线记录的一致性 |
|---|---|---|---|---|
| regression-tsc | `npx tsc --noEmit` | `2026-10-07T18:21:45Z` | **0** | 与 §3 #1 记录一致（0） |
| regression-vitest | `npm test -- --run` | `2026-10-07T18:21:45Z`–`18:22:14Z` | **0** | 计数与 §3 #3 一致：`Test Files 6 passed (6)`、`Tests 10 passed (10)`；内部 `Duration 20.39s`（vs 基线 23.38s）——**仅耗时浮动，结果集完全一致 → 非 flaky** |

- 这两次重跑与 §B.3 的「基线采样各 1 次」分开计数；含回归在内，任何单条命令的总执行次数为 **2**，仍低于 spec `AC-09` 的 ≤3 上限，且第 2 次是 spec 明确要求的回归核实项。
- 其余回归项（`regression-git-scope`、`regression-preexisting`、`regression-governance`）实测结果见附录 A，全部为空 diff / 指纹一致。

### B.3.2 报告内测量值的自校验记录

- `dist/` 体积口径：首轮笔误把 `du -sk` 的磁盘块值（1740 KB）当作逻辑字节合计写入；本报告在终态复核中改用 `find dist -type f -printf "%s" \| awk` 求并与 `du -sb` 交叉核对得到的 **1,766,614 B**（§7/§9.1/§12 三处已统一），并保留 `du -sk = 1740 KB` 作为块口径注记。该修正属**报告测量口径自校验**，未涉及任何仓库文件改动（除交付物本身）。
- `wavesurfer.js` 锁定版本以 `package-lock.json` 解析实测为准（**7.12.12**，§9.5 行内记录为 `^7.7.3` 声明 → lockfile 漂移，归入 F-03 面）。
- 交付物写后终态指纹 / 字节数不在本文件内自报（§16.1 自指不变性），由 Machine Gate 与 Verify 外部实测。

### B.4 与 spec 的冲突检查结论

本轮逐条核对 spec 的 `CONTEXT` / `DEPENDENCIES` / `EXECUTION_NOTES` 断言与真实仓库状态：HEAD/branch、node/npm/tsc 版本、node_modules 预装、chromium-1243 缓存、端口 4173 空闲、五条命令与 `ci.yml` 逐字同款、6 个 vitest 文件与 1 个 e2e spec、写前指纹与 `priorRunSha256`——**实测全部一致，未发现 SPEC_CONFLICT**。spec 预期「vitest 上一轮实测 6 个文件」与本轮实测相符。spec 外新观察（`ConversationPage` 未挂路由、`src/components` 根级两个 a11y 组件）已按 AC-03 记为 Finding（F-17 等），不构成 spec 冲突。
