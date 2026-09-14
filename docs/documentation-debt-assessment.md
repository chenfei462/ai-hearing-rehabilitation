# 文档债评估报告 — AI 听觉康复助手

> 评估人：多库（Docu）· 技术文档师
> 评估日期：2025-07-14
> 评估范围：项目级文档、代码内文档、API 文档、运维文档

---

## 评估总览

| 维度 | 评分 | 说明 |
|------|------|------|
| 项目级文档 | ★★★☆☆ | README 过于简单；system_design / PRD 质量优秀 |
| 代码内文档（后端） | ★★★☆☆ | AI 网关层文档优秀，业务服务层文档缺失严重 |
| 代码内文档（前端） | ★☆☆☆☆ | 几乎无组件文档、无 props 说明 |
| API 文档 | ★★★☆☆ | 依赖 FastAPI 自动生成，部分路由缺 summary/description |
| 运维文档 | ★★★☆☆ | deployment-guide 质量不错，缺 Runbook 和故障处理手册 |

**总发现：18 项文档债（P0×3 / P1×6 / P2×6 / P3×3）**
**预估总修复工作量：约 8-10 人天**

---

## P0 — 高优先级（影响新人上手和系统可维护性）

### D-01：`training_service.py` — 服务层完全无文档

- **问题位置**：`backend/app/services/training_service.py` 全文
- **问题描述**：该文件无模块级 docstring、无类 docstring、5 个公开方法（`start_session`、`get_user_ability`、`select_next_item`、`submit_answer`、`finish_session`）均无 docstring。作为核心业务模块（听觉训练 + IRT 自适应），这是项目中最复杂的业务逻辑之一。
- **产生的影响**：
  - 新人无法快速理解 IRT 选题/升降级的业务逻辑
  - `submit_answer` 方法混杂了判定正误、记录作答、能力估计、升降级决策四个步骤，无文档说明调用链
  - 与 `irt_engine.py` 的协作关系不明确
- **修复建议**：
  1. 添加模块级 docstring，说明训练服务的整体职责和 IRT 集成方式
  2. 为每个公开方法添加 docstring，包含：功能说明、参数含义、返回值结构、与 IRT 引擎的交互
  3. 特别说明 `submit_answer` 中"简单字符串匹配"判定逻辑与 PRD 中"ASR 识别"验收标准的差异
- **预估工作量**：0.5 人天
- **定级理由**：P0 — 核心业务模块，直接影响团队理解和维护

### D-02：`training.py`（API 路由层）— 端点无 docstring

- **问题位置**：`backend/app/api/training.py` 全文（第 1-63 行）
- **问题描述**：4 个 API 端点（`/sessions`、`/sessions/{id}/next`、`/sessions/{id}/answer`、`/sessions/{id}/finish`）均无 docstring。FastAPI 使用函数 docstring 作为 OpenAPI 的 `summary`/`description`，缺失导致自动生成的 API 文档（`/docs`）中这些端点没有说明。
- **产生的影响**：
  - 前端开发人员无法通过 Swagger UI 理解接口用途
  - `/sessions/{id}/answer` 的参数 `response_ms` 含义不明确
  - 与 `dialogue.py`（有 docstring）和 `pronunciation.py`（有详细 docstring）形成不一致
- **修复建议**：
  1. 为每个端点函数添加 docstring，格式与 `pronunciation.py` 保持一致
  2. 添加 `summary` 和 `description` 参数到路由装饰器
  3. 为 `response_ms` 参数添加 `Query(description=...)` 说明
- **预估工作量**：0.25 人天
- **定级理由**：P0 — 直接影响 API 文档质量和前后端联调效率

### D-03：缺少独立的 Runbook / 故障处理手册

- **问题位置**：项目根目录（缺失文件）
- **问题描述**：项目没有任何故障处理手册。`deployment-guide.md` 的"常见问题"部分仅 3 个 Q&A，不覆盖：
  - AI 服务（ASR/TTS/LLM）不可用时的降级操作
  - 数据库连接池耗尽的处理
  - Redis 连接失败的影响范围和恢复步骤
  - Serverless 冷启动导致的超时问题
  - 语音识别准确率异常下降的排查
- **产生的影响**：
  - 值班人员无法快速响应线上故障
  - AI 服务降级策略虽然代码中已实现，但运维人员不知道降级行为
- **修复建议**：
  1. 创建 `docs/runbook.md`，覆盖上述场景
  2. 每个场景包含：症状描述、排查步骤、修复操作、回滚步骤、升级路径
  3. 参考 `deployment-guide.md` 中的监控端点作为排查入口
- **预估工作量**：1.5 人天
- **定级理由**：P0 — 线上故障无操作手册，影响 MTTR

---

## P1 — 中高优先级（影响开发效率和代码质量）

### D-04：README.md 内容过于简单

- **问题位置**：`README.md`（第 1-71 行）
- **问题描述**：README 仅包含技术栈表、快速开始、项目结构和功能模块列表。缺失：
  - 项目背景和目标（为什么做这个项目）
  - 环境变量配置说明（`.env.example` 未提及）
  - 贡献指南（分支策略、commit 规范、PR 流程）
  - API 概览或链接
  - 许可证信息
  - 前端 README 是 Vite 模板默认内容（`frontend/README.md`），与项目无关
- **产生的影响**：
  - 新成员加入项目时需要阅读多个文档才能开始开发
  - `frontend/README.md` 会误导开发者
- **修复建议**：
  1. 扩充 README，添加：项目背景、环境变量配置、API 概览链接、贡献指南
  2. 替换 `frontend/README.md` 为项目相关内容
  3. 添加 `CONTRIBUTING.md` 或在 README 中内联贡献指南
- **预估工作量**：0.5 人天
- **定级理由**：P1 — 项目入口文档，影响第一印象和新人效率

### D-05：`frontend/README.md` — 残留模板默认内容

- **问题位置**：`frontend/README.md`（第 1-33 行）
- **问题描述**：内容完全是 Vite + React 模板的默认 README，讨论 Oxlint 配置和 React Compiler，与听觉康复项目毫无关系。
- **产生的影响**：
  - 严重误导开发者
  - 项目专业度下降
- **修复建议**：替换为前端项目说明，包含：本地开发指南、组件架构、状态管理说明、音频录制使用指南
- **预估工作量**：0.25 人天
- **定级理由**：P1 — 误导性内容比没有更糟

### D-06：前端组件无 props 说明和文档

- **问题位置**：`frontend/src/` 全部 `.tsx` 文件
- **问题描述**：扫描所有前端组件文件，发现：
  - `LevelBadge.tsx`、`ScoreRing.tsx`、`BigButton.tsx`、`Subtitle.tsx` — 无 JSDoc 说明 props
  - `AppShell.tsx`（布局组件）— 无说明
  - `TrendChart.tsx`、`AdherenceChart.tsx`、`LevelProgressChart.tsx` — 图表组件无 props 说明
  - `AccessibilityPanel.tsx` — 无障碍面板无文档
  - 页面组件（`TrainingPage.tsx`、`DialoguePage.tsx` 等）— 无组件级注释
- **产生的影响**：
  - 组件复用困难，其他开发者不知道如何传参
  - 图表组件的数据格式不明确
- **修复建议**：
  1. 为每个组件添加 JSDoc，说明组件用途和 props 类型
  2. 使用 TypeScript interface 注解 props（部分已有，但缺注释）
  3. 复杂组件（如 `TrainingPage`）添加状态机说明注释
- **预估工作量**：1 人天
- **定级理由**：P1 — 前端团队协作的基础

### D-07：`auth.py`（API 路由）缺模块级 docstring

- **问题位置**：`backend/app/api/auth.py`（第 1 行）
- **问题描述**：文件无模块级 docstring。虽然各端点函数有简短 docstring，但缺少整体说明（认证模块支持哪些认证方式、token 有效期、错误码等）。
- **产生的影响**：认证模块的全局行为不明确
- **修复建议**：添加模块级 docstring，说明认证方式、token 策略、与 `AuthService` 的关系
- **预估工作量**：0.1 人天
- **定级理由**：P1 — 认证是安全关键模块

### D-08：`irt_engine.py` — 核心算法文档不足

- **问题位置**：`backend/app/services/irt_engine.py`
- **问题描述**：
  - 无模块级 docstring
  - `IRTEstimate` dataclass 字段缺注释（`theta`、`se`、`action` 的含义和取值范围）
  - `estimate_ability` 方法的 EAP 算法无数学公式说明
  - `select_next_item` 的"最大信息量选题"策略无理论背景
  - `decide_next_action` 的阈值逻辑（0.8/0.6/3 次）缺说明来源
  - 注释中提到 `c = 0.25`（猜测参数），但未说明为什么选择此值
- **产生的影响**：
  - 算法可解释性差，难以调参
  - 与 PRD 中"IRT 自适应难度调整"的验收标准对接困难
- **修复建议**：
  1. 添加模块级 docstring，引用 IRT 2PL 模型的数学公式
  2. 为 EAP 估计添加公式说明：$E[\theta|X] = \frac{\int \theta \cdot L(\theta) \cdot p(\theta) d\theta}{\int L(\theta) \cdot p(\theta) d\theta}$
  3. 说明阈值参数与 PRD 的对应关系
  4. 添加参数调优指南
- **预估工作量**：0.5 人天
- **定级理由**：P1 — 核心算法是产品差异化所在，文档不足影响迭代

### D-09：ORM 模型文件缺字段级文档

- **问题位置**：`backend/app/models/user.py`、`training.py`、`dialogue.py`、`pronunciation.py`、`ability.py`、`item_bank.py`
- **问题描述**：
  - 模型类有简短 docstring（如"一次训练会话"），但 JSONB 字段（`cochlear_info`、`consent_flags`、`phonemes`、`tags`、`suggestions` 等）无文档说明其内部结构
  - `ItemBank` 模型的 `difficulty_b` 字段无说明（IRT 难度参数 b）
  - `UserAbility` 模型的 `theta` 和 `se` 字段无说明
  - 与 `system_design.md` §4.2 ER 图的字段描述不一致（如 ER 图中 `bigint` 实际代码中为 `Integer`）
- **产生的影响**：
  - JSONB 字段结构不明确，前端和后端联调困难
  - 与设计文档不一致增加维护成本
- **修复建议**：
  1. 为每个 JSONB 字段添加 docstring，说明预期的 JSON 结构
  2. 统一设计文档和代码中的字段类型
  3. 考虑使用 Pydantic 模型约束 JSONB 结构
- **预估工作量**：0.5 人天
- **定级理由**：P1 — 数据模型是全栈开发的基础

---

## P2 — 中优先级（影响文档一致性和长期维护）

### D-10：`docker-compose.yml` 缺注释说明

- **问题位置**：`docker-compose.yml`
- **问题描述**：文件无注释说明各服务的用途、端口映射原因、环境变量含义。与 `deployment-guide.md` 中提到的 `docker-compose up -d db redis`（仅启动基础设施）不一致——实际配置启动了 4 个服务（frontend、backend、db、redis）。
- **产生的影响**：
  - 开发者不清楚是否需要启动全部服务
  - 环境变量 `POSTGRES_PASSWORD=postgres` 是硬编码，未说明仅限开发环境
- **修复建议**：
  1. 添加注释说明各服务用途
  2. 添加 `.env.example` 说明环境变量
  3. 修正 `deployment-guide.md` 中的命令说明
- **预估工作量**：0.25 人天
- **定级理由**：P2 — 开发环境配置

### D-11：`config.py` — 配置项缺说明

- **问题位置**：`backend/app/core/config.py`
- **问题描述**：
  - 模块级 docstring 仅"应用配置"两字
  - 大量配置项无说明：`ASR_MODEL`、`ASR_TIMEOUT`、`TTS_DEFAULT_VOICE`、`LLM_TEMPERATURE` 等
  - 缺少 `.env.example` 文件（`deployment-guide.md` 提到 `cp .env.example .env` 但文件不存在）
  - `SECRET_KEY` 默认值 `"your-secret-key-change-in-production"` 无安全警告注释
- **产生的影响**：
  - 新开发者不知道各配置项的含义和推荐值
  - `.env.example` 缺失导致环境搭建困难
- **修复建议**：
  1. 为每个配置项添加行内注释
  2. 创建 `.env.example` 文件
  3. 为敏感配置添加安全警告
- **预估工作量**：0.25 人天
- **定级理由**：P2 — 配置管理

### D-12：设计文档与代码的目录结构不一致

- **问题位置**：`system_design.md` §3 vs 实际代码
- **问题描述**：
  - 设计文档中 `app/core/deps.py` → 实际为 `app/api/deps.py`
  - 设计文档中 `app/ai/pronunciation_scorer.py` → 实际为 `app/services/pronunciation_scorer.py`
  - 设计文档中 `app/models/ability.py` 存在但 `app/schemas/training.py` 不存在
  - 设计文档中 `app/schemas/auth.py` 存在 ✓
  - 设计文档中 `frontend/src/api/training.ts` → 实际为 `frontend/src/services/trainingService.ts`
  - 设计文档中 `frontend/src/store/` → 实际为 `frontend/src/stores/`
  - 设计文档中 `frontend/src/hooks/useSpeechGuide.ts` 存在 ✓
  - 设计文档中 `frontend/src/pages/Training/` → 实际为 `frontend/src/pages/TrainingPage.tsx`（非目录）
  - 设计文档中 `frontend/src/components/common/RecordOrb.tsx` 不存在
- **产生的影响**：
  - 设计文档作为导航参考时会误导开发者
  - 增加新成员的认知负担
- **修复建议**：
  1. 更新 `system_design.md` §3 的目录结构，与实际代码对齐
  2. 或在文档中标注"以实际代码为准"
- **预估工作量**：0.5 人天
- **定级理由**：P2 — 设计文档作为架构参考的可信度

### D-13：`useRecorder.ts` — 返回值接口与实际使用不一致

- **问题位置**：`frontend/src/hooks/useRecorder.ts` vs `frontend/src/pages/TrainingPage.tsx`
- **问题描述**：
  - `useRecorder` 的返回类型 `UseRecorderReturn` 定义了 `status` 字段（类型为 `RecorderStatus`）
  - 但 `TrainingPage.tsx` 第 396 行使用 `recorder.isRecording`（布尔属性），而 hook 并未返回 `isRecording`
  - 同样，第 240 行调用 `recorder.clearRecording()`，而 hook 返回的是 `resetRecording()`
  - 这表明 hook 的接口文档/类型定义与实际使用存在不一致
- **产生的影响**：
  - TypeScript 编译可能报错
  - 接口文档不可信
- **修复建议**：
  1. 统一 hook 的返回接口，添加 `isRecording` 计算属性或修改页面代码
  2. 确保类型定义与实际使用一致
- **预估工作量**：0.25 人天
- **定级理由**：P2 — 接口不一致会导致运行时错误

### D-14：FastAPI 自动生成的 OpenAPI 文档不完整

- **问题位置**：`backend/app/api/training.py`、`backend/app/api/auth.py`
- **问题描述**：
  - FastAPI 依赖函数 docstring 生成 OpenAPI 文档
  - `training.py` 的 4 个端点无 docstring → Swagger UI 中显示为空
  - `auth.py` 的端点有简短 docstring，但缺少请求/响应示例
  - 对比：`dialogue.py` 和 `pronunciation.py` 的端点有良好 docstring
  - 没有独立的 API 文档文件（如 `docs/api-reference.md`）
- **产生的影响**：
  - Swagger UI 文档不一致
  - 前端开发依赖不完整的 API 文档
- **修复建议**：
  1. 统一所有路由的 docstring 格式
  2. 添加请求/响应示例到 OpenAPI schema
  3. 考虑生成独立的 API 参考文档
- **预估工作量**：0.5 人天
- **定级理由**：P2 — API 文档质量

### D-15：`system_design.md` 中 API 路径与实际代码不一致

- **问题位置**：`system_design.md` §5 vs 实际路由
- **问题描述**：
  - 设计文档 API 前缀为 `/api/v1`，但实际代码路由前缀为 `/api`（无版本号）
  - 设计文档中 `/auth/sms/send` → 实际 `/api/auth/sms/send`（路径一致但缺少 v1）
  - 设计文档中 `/users/me` 和 `/users/me/preferences` → 实际为 `/api/auth/me` 和 `/api/auth/users/me/preferences`（挂在 auth router 下）
  - 设计文档中 `/training/items/{id}/audio` 端点在代码中不存在
  - 设计文档中 `/dialogue/sessions/{id}/turns` → 实际为 `/dialogue/sessions/{id}/turn`（单数）
- **产生的影响**：
  - 前端按设计文档开发会调错接口
  - API 文档与实现不一致
- **修复建议**：
  1. 以实际代码为准更新设计文档
  2. 或在代码中实现版本化路由（`/api/v1`）
- **预估工作量**：0.5 人天
- **定级理由**：P2 — 前后端联调的关键参考

---

## P3 — 低优先级（改善性建议）

### D-16：`api.ts`（前端 HTTP 客户端）缺模块文档

- **问题位置**：`frontend/src/services/api.ts`
- **问题描述**：axios 拦截器有简短注释，但缺少整体说明（baseURL 策略、错误码处理规则、token 刷新机制）。与 `system_design.md` §10 中描述的"token 有效期 7 天，静默刷新"不一致——代码中无静默刷新逻辑。
- **产生的影响**：前端鉴权行为不明确
- **修复建议**：添加模块级 JSDoc，说明鉴权策略和错误处理
- **预估工作量**：0.1 人天
- **定级理由**：P3 — 改善性

### D-17：`deploy/serverless.yml` — 缺少部署流程说明

- **问题位置**：`deploy/serverless.yml`
- **问题描述**：配置文件有基本注释，但缺少：
  - 环境变量如何设置（`${env.DATABASE_URL}` 来源）
  - VPC 配置的获取方式
  - 首次部署的完整步骤
  - 与 `deployment-guide.md` 中的部署步骤存在重复但不一致
- **产生的影响**：部署时可能遗漏配置步骤
- **修复建议**：在文件头部添加完整部署步骤或链接到 deployment-guide
- **预估工作量**：0.25 人天
- **定级理由**：P3 — 改善性

### D-18：`.env.example` 文件缺失

- **问题位置**：`backend/.env.example`（不存在）
- **问题描述**：`deployment-guide.md` 第 49-52 行提到 `cp .env.example .env`，但该文件不存在。`config.py` 中定义了大量环境变量（DATABASE_URL、REDIS_URL、SECRET_KEY、DASHSCOPE_API_KEY 等），但没有 `.env.example` 列出所有变量和默认值。
- **产生的影响**：新开发者需要阅读 `config.py` 源码才能知道需要配置哪些环境变量
- **修复建议**：基于 `config.py` 创建 `.env.example`，包含所有变量和注释说明
- **预估工作量**：0.1 人天
- **定级理由**：P3 — 开发体验改善

---

## 文档债分布热力图

```
文件/模块                        文档质量    发现项
─────────────────────────────────────────────────
backend/app/ai/asr_gateway.py      ██████     无（优秀）
backend/app/ai/tts_gateway.py      ██████     无（优秀）
backend/app/ai/llm_gateway.py      ██████     无（优秀）
backend/app/services/pronunciation_scorer.py  ██████  无（优秀）
backend/app/core/errors.py         █████░     无（良好）
backend/app/api/dialogue.py        █████░     无（良好）
backend/app/api/pronunciation.py   █████░     无（良好）
backend/app/services/dialogue_service.py  ████░░  无（良好）
backend/app/main.py                ████░░     无（良好）
backend/app/api/training.py        ██░░░░     D-02
backend/app/api/auth.py            ███░░░     D-07
backend/app/services/training_service.py  █░░░░░  D-01
backend/app/services/irt_engine.py █░░░░░     D-08
backend/app/models/*.py            ██░░░░     D-09
backend/app/core/config.py         ██░░░░     D-11
frontend/src/**.tsx                █░░░░░     D-06
frontend/src/services/api.ts       ██░░░░     D-16
frontend/README.md                 ░░░░░░     D-05
README.md                          ██░░░░     D-04
system_design.md                   ████░░     D-12, D-15
docker-compose.yml                 ██░░░░     D-10
deploy/serverless.yml              ███░░░     D-17
（缺失）runbook.md                 ░░░░░░     D-03
（缺失）.env.example               ░░░░░░     D-18
```

---

## 文档质量标杆（可参考的优秀示例）

以下文件的文档质量值得作为其他模块的参考标准：

1. **`backend/app/ai/asr_gateway.py`** — 模块级 docstring 清晰列出功能、降级策略；类和方法文档完整
2. **`backend/app/ai/tts_gateway.py`** — 缓存策略、降级策略在模块级 docstring 中说明
3. **`backend/app/ai/llm_gateway.py`** — 场景提示词、安全护栏策略文档化
4. **`backend/app/services/pronunciation_scorer.py`** — 算法设计要点在模块级 docstring 中列出，数据结构有类型注解和 docstring
5. **`docs/deployment-guide.md`** — 架构图、前置条件、分步操作、测试账号、CI/CD、监控、FAQ 结构完整

---

## 修复优先级建议

| 阶段 | 修复项 | 预估工作量 | 目标 |
|------|--------|-----------|------|
| **第一阶段** | D-01, D-02, D-03 | 2.25 人天 | 消除核心模块文档盲区 + 建立 Runbook |
| **第二阶段** | D-04, D-05, D-06, D-07, D-08, D-09 | 3.25 人天 | 完善项目入口文档 + 代码内文档 |
| **第三阶段** | D-10 ~ D-18 | 2.35 人天 | 文档一致性 + 改善性 |

---

*本报告基于实际文档内容和代码对比，所有文件路径和行号均已验证。标注"待确认"的内容已注明。*
