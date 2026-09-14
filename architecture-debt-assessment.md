# 听觉康复项目 — 架构债评估报告

**评估人:** Archi（系统架构师）  
**日期:** 2025-07-22  
**项目路径:** `C:\Users\hacjr\Desktop\听觉康复`  
**评估范围:** Backend (FastAPI) + Frontend (React) 全栈架构

---

## 一、架构总览

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                   │
│  pages/ → components/ + hooks/ + stores/ + services/  │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP/REST
┌──────────────────────▼──────────────────────────────┐
│                 Backend (FastAPI)                     │
│  api/ → services/ → models/ (SQLAlchemy ORM)         │
│         services/ → ai/ (ASR/TTS/LLM Gateways)       │
│  core/: config, database, redis, security, errors    │
│  middleware/: performance, monitoring                 │
│  tasks/: background jobs                             │
└─────────────────────────────────────────────────────┘
```

整体分层方向正确：**API → Service → Model/AI**。项目规模适中（72 个 Python 文件，40 个 TS/TSX 文件），架构复杂度可控。以下是基于实际代码 import 关系的具体发现。

---

## 二、发现清单

---

### ARCH-01 [P1] API 层直接访问 ORM Model，绕过 Service 层

**问题位置：**  
- `backend/app/api/deps.py` 第 6-7 行：`from app.models.user import User` + `from sqlalchemy import select`
- `backend/app/api/auth.py` 第 9 行：`from app.models.user import User`
- `backend/app/api/dialogue.py` 第 9 行：`from app.models.user import User`
- `backend/app/api/report.py` 第 15 行：`from app.models.user import User`

**问题描述：**  
`deps.py` 中的 `get_current_user()` 直接使用 SQLAlchemy `select(User)` 查询数据库，完全绕过了 Service 层。`auth.py` 的 `get_me` 端点也直接读取 `current_user.phone`、`current_user.role` 等 ORM 属性。API 层多个路由文件直接 import `app.models.user`。

**产生的影响：**
- **可测试性差：** API 层测试需要同时 mock 数据库和 ORM 模型
- **职责混乱：** API 层承担了数据查询职责，违反单一职责原则
- **扩展困难：** 如果需要在用户查询中加入缓存、审计日志等逻辑，需要改 API 层代码

**修复建议：**
1. 在 `AuthService` 中添加 `get_user_by_id(user_id: int) -> User` 方法
2. `deps.py` 改为调用 `AuthService.get_user_by_id()`，或将 `deps.py` 视为"基础设施层"（FastAPI 的 Depends 机制本身需要访问数据源）
3. API 路由中的 `User` 类型注解可以保留（用于 ORM 关系加载），但不应直接操作 ORM 属性做业务判断

**预估工作量：** 0.5 人天  
**定级理由：P1** — 影响可测试性和后续维护，但当前项目规模下风险可控。`deps.py` 直接查 DB 是 FastAPI 社区的常见模式，可接受但需标注为技术债。

---

### ARCH-02 [P1] `ReportService` 是 God Module，承担过多职责

**问题位置：**  
- `backend/app/services/report_service.py`（498 行）

**问题描述：**  
`ReportService` 单个类承担了以下 5 个不同职责：
1. `get_summary()` — 用户训练概览聚合（含正确率曲线、依从率、连续训练天数）
2. `get_level_distribution()` — 训练级别分布
3. `get_patients_for_therapist()` — 听力师患者列表（含预警逻辑）
4. `generate_weekly_report()` — 周报生成（含趋势分析、亮点/建议生成）
5. 私有方法 `_calculate_adherence()`、`_calculate_streak()` 等 5 个统计辅助方法

**产生的影响：**
- **可维护性差：** 498 行代码，修改任一功能需理解全部上下文
- **测试困难：** 每个方法的测试数据准备复杂，因为共享同一个 DB session
- **SRP 违反：** 患者列表管理与个人报告生成是完全不同的业务域

**修复建议：**
1. 拆分为 3 个 Service：
   - `UserReportService` — 个人训练概览、级别分布、周报
   - `TherapistService` — 听力师患者列表、患者预警
   - `StatisticsService` — 依从率计算、连续训练天数等公共统计方法（可被前两者复用）
2. 提取公共统计逻辑为独立模块

**预估工作量：** 2 人天  
**定级理由：P1** — 当前已接近不可维护的临界点。随着业务增长（如添加月报、对比分析），此文件将快速膨胀。

---

### ARCH-03 [P1] `DialogueService` 职责过重，混合了场景管理、AI 编排、安全护栏

**问题位置：**  
- `backend/app/services/dialogue_service.py`（470 行）

**问题描述：**  
`DialogueService` 单个类混合了以下职责：
1. **场景元数据管理**（第 24-55 行）：`SCENARIOS` 字典硬编码在 Service 文件中
2. **会话生命周期**（`start_session`、`finish_session`）
3. **AI 编排**（`handle_turn` 中串联 ASR → LLM → TTS 三大 AI 服务）
4. **Redis 上下文管理**（`_init_context`、`_get_context`、`_update_context`、`_clear_context`）
5. **安全护栏**（`_check_safety`、`SAFETY_BLOCKLIST`）
6. **对话小结生成**（`_generate_summary`）

**产生的影响：**
- 单个方法 `handle_turn()` 长达 136 行，包含 7 个步骤
- 安全护栏逻辑与业务逻辑耦合，无法独立升级
- 场景配置硬编码，新增场景需修改 Service 代码

**修复建议：**
1. 提取 `SafetyGuard` 类（或函数）到独立模块
2. 提取 `DialogueContextManager` 类管理 Redis 上下文
3. 将 `SCENARIOS` 配置移到配置文件或数据库
4. `handle_turn()` 中的 ASR→LLM→TTS 编排可提取为 `DialogueOrchestrator`

**预估工作量：** 2 人天  
**定级理由：P1** — 对话陪练是核心功能，handle_turn 的复杂度已影响 bug 定位效率。

---

### ARCH-04 [P2] 安全护栏逻辑重复定义

**问题位置：**  
- `backend/app/services/dialogue_service.py` 第 62-66 行：`SAFETY_BLOCKLIST`
- `backend/app/ai/llm_gateway.py` 第 143-146 行：`SAFETY_KEYWORDS`

**问题描述：**  
安全关键词列表在两个不同位置独立定义：
- `dialogue_service.py` 的 `SAFETY_BLOCKLIST`：包含"自杀、自残、死亡、毒品、赌博、色情"等
- `llm_gateway.py` 的 `SAFETY_KEYWORDS`：包含"自杀、自残、死亡、医疗建议、用药、剂量、手术"等

两份列表内容不完全一致，且各自独立维护。

**产生的影响：**
- **安全隐患：** 关键词更新可能只改一处遗漏另一处
- **维护成本：** 新增敏感词需要同步修改两处
- **职责混乱：** 安全护栏应在统一位置管理

**修复建议：**
1. 创建 `app/core/safety.py` 统一管理安全关键词
2. `dialogue_service.py` 和 `llm_gateway.py` 都从 `app.core.safety` 导入
3. 支持配置化（从配置文件或数据库加载关键词）

**预估工作量：** 0.5 人天  
**定级理由：P2** — 当前不影响功能，但存在安全合规风险。

---

### ARCH-05 [P2] 两套不一致的响应格式

**问题位置：**  
- `backend/app/schemas/common.py`：`ApiResponse` 模型
- `backend/app/schemas/response.py`：`ApiResponse` 模型 + `success_response()` / `error_response()` 工具函数

**问题描述：**  
API 路由中存在两种不同的响应构建方式：
- `training.py`、`pronunciation.py`、`report.py`：使用 `schemas.common.ApiResponse` + 手动构造 `{"code": 0, "data": ..., "message": "ok"}`
- `dialogue.py`、`health.py`、`metrics.py`：使用 `schemas.response.success_response()` / `error_response()`
- `auth.py` 混合使用：部分端点手动构造，部分使用 `AppException`

**产生的影响：**
- **一致性差：** 不同端点的错误处理方式不统一
- **维护成本：** 修改响应格式需要检查所有 API 文件
- **前端适配复杂：** 前端需要处理多种错误响应模式

**修复建议：**
1. 统一使用 `schemas.response` 中的 `success_response()` / `error_response()`
2. 删除 `schemas/common.py` 中的重复 `ApiResponse`，或将其作为别名
3. 统一异常处理：业务异常统一抛 `AppException`，由全局处理器转换

**预估工作量：** 1 人天  
**定级理由：P2** — 不影响功能，但影响代码一致性和新成员上手效率。

---

### ARCH-06 [P2] 发音练习题库硬编码在 Service 中

**问题位置：**  
- `backend/app/services/pronunciation_service.py` 第 27-98 行：`PRONUNCIATION_TASKS` 列表

**问题描述：**  
10 条发音练习题目以 Python 字典列表的形式硬编码在 Service 文件中。训练模块已使用 `ItemBank` 模型和数据库存储题库，但发音模块没有复用。

**产生的影响：**
- **扩展困难：** 新增/修改题目需要改代码并重新部署
- **数据不一致：** 训练题库和发音题库使用不同的数据管理方式
- **运维成本：** 无法通过管理后台动态管理发音题库

**修复建议：**
1. 在 `ItemBank` 模型中添加 `module` 字段（`training` / `pronunciation`）区分用途
2. 或创建独立的 `PronunciationTaskBank` 模型
3. 将现有硬编码数据迁移为种子数据
4. `PronunciationService.get_next_task()` 改为从数据库查询

**预估工作量：** 1 人天  
**定级理由：P2** — 当前 10 条题目可维护，但业务增长后将成为瓶颈。

---

### ARCH-07 [P2] 前端存在两个 `appStore` 文件，职责重叠

**问题位置：**  
- `frontend/src/stores/appStore.ts`：完整的 `useAppStore`（含 user + training 状态）
- `frontend/src/stores/useAppStore.ts`：标记为 `@deprecated` 的兼容层，实际代理到 `a11yStore`

**问题描述：**  
- `appStore.ts` 定义了 `useAppStore`（包含 user 信息和 training 状态）
- `useAppStore.ts` 也导出 `useAppStore`，但实际是 `a11yStore` 的子集代理
- 两个文件导出同名 hook，可能造成 import 混淆

**产生的影响：**
- **开发者困惑：** `import { useAppStore } from './stores/appStore'` 和 `import { useAppStore } from './stores/useAppStore'` 语义完全不同
- **状态管理混乱：** user 信息同时存在于 `appStore` 和 `authStore` 中

**修复建议：**
1. 删除 `useAppStore.ts`（已标记 deprecated）
2. `appStore.ts` 中的 user 状态与 `authStore.ts` 合并（`authStore` 已有完整的 user/token 管理）
3. `appStore.ts` 只保留 training 状态，或与 `sessionStore.ts` 合并

**预估工作量：** 0.5 人天  
**定级理由：P2** — 当前不影响功能，但增加新开发者上手成本。

---

### ARCH-08 [P2] 前端 `sessionStore` 与 `appStore` 训练状态重复

**问题位置：**  
- `frontend/src/stores/sessionStore.ts`：训练会话状态（sessionId、level、currentItem、progress）
- `frontend/src/stores/appStore.ts` 第 13-17 行：`training` 状态（currentModule、progress、streak）

**问题描述：**  
两个 store 都管理训练相关状态，但粒度不同：
- `sessionStore`：详细的会话级状态（当前题目、答题进度）
- `appStore.training`：概要级状态（当前模块、进度百分比、连续天数）

**产生的影响：**
- **状态同步问题：** 两个 store 的 training 状态可能不一致
- **开发者困惑：** 不确定该从哪个 store 读取训练状态

**修复建议：**
1. `sessionStore` 保留为会话级状态（运行时状态，不持久化）
2. `appStore.training` 改为只存储持久化的训练统计（streak 等），或完全移除
3. 明确划分：运行时状态 → `sessionStore`，持久化状态 → `authStore` + `a11yStore`

**预估工作量：** 0.5 人天  
**定级理由：P2** — 当前可工作，但随着功能增长会导致状态管理混乱。

---

### ARCH-09 [P2] AI 网关全局单例缺少依赖注入机制

**问题位置：**  
- `backend/app/ai/__init__.py` 第 29-31 行：全局单例 `asr_gateway`、`tts_gateway`、`llm_gateway`

**问题描述：**  
三个 AI 网关以模块级全局变量形式创建，所有 Service 共享同一实例。Service 层通过 `from app.ai import asr_gateway` 直接引用。

**产生的影响：**
- **测试困难：** 无法轻松 mock AI 服务（需要 monkeypatch 全局变量）
- **配置不灵活：** 无法为不同场景使用不同的 AI 配置
- **生命周期管理：** 全局单例的初始化时机不受 FastAPI 生命周期控制

**修复建议：**
1. 将 AI 网关实例注入到 Service 构造函数中（通过 FastAPI Depends 或手动注入）
2. 或创建 `AIServiceProvider` 作为工厂，支持测试时替换
3. 保持当前全局单例作为默认实现，但提供覆盖机制

**预估工作量：** 1.5 人天  
**定级理由：P2** — 当前功能正常，但影响单元测试编写效率。

---

### ARCH-10 [P3] CORS 配置硬编码

**问题位置：**  
- `backend/app/main.py` 第 86 行：`allow_origins=["http://localhost:3000", "https://your-domain.com"]`
- `backend/app/core/config.py` 第 58-62 行：`CORS_ORIGINS` 配置已定义但未使用

**问题描述：**  
`config.py` 中已定义 `CORS_ORIGINS` 配置项，但 `main.py` 中硬编码了 CORS 来源列表，未使用配置。

**产生的影响：**
- 部署时需要手动修改代码中的 CORS 配置
- 配置项 `CORS_ORIGINS` 成为死代码

**修复建议：**
将 `main.py` 第 86 行改为 `allow_origins=settings.CORS_ORIGINS`。

**预估工作量：** 0.1 人天  
**定级理由：P3** — 简单修复，但不影响当前开发（开发环境 localhost 已覆盖）。

---

### ARCH-11 [P3] `TrainingService` 未使用 `asr_gateway` import

**问题位置：**  
- `backend/app/services/training_service.py` 第 7 行：`from app.ai import asr_gateway`

**问题描述：**  
`TrainingService` import 了 `asr_gateway` 但在整个文件中未使用。这是残留的 dead import。

**产生的影响：**
- 代码整洁度下降
- 可能误导开发者认为训练模块使用了 ASR

**修复建议：**
删除第 7 行的 `from app.ai import asr_gateway`。

**预估工作量：** 0.05 人天  
**定级理由：P3** — 代码整洁问题，无功能影响。

---

### ARCH-12 [P2] AI 服务重试逻辑重复实现

**问题位置：**  
- `backend/app/ai/asr_gateway.py` 第 48-91 行：`_retry_with_backoff()` 函数
- `backend/app/ai/llm_gateway.py` 第 367-389 行：`_retry_llm()` 方法
- `backend/app/ai/tts_gateway.py` 第 227-249 行：`_retry_tts()` 方法

**问题描述：**  
三个 AI 网关各自实现了几乎相同的重试+超时+指数退避逻辑：
- ASR：独立函数 `_retry_with_backoff()`
- LLM：实例方法 `_retry_llm()`
- TTS：实例方法 `_retry_tts()`

三者逻辑完全一致（重试次数、指数退避、超时处理），只是默认参数不同。

**产生的影响：**
- **维护成本：** 修改重试策略需要改三处
- **不一致风险：** 可能只改了一处导致行为不一致

**修复建议：**
1. 提取公共 `retry_with_backoff(coro_factory, max_retries, base_delay, timeout, service_name)` 到 `app/ai/retry.py`
2. 三个网关统一调用此公共函数
3. 各网关只传入不同的默认参数

**预估工作量：** 0.5 人天  
**定级理由：P2** — DRY 原则违反，但当前不影响功能。

---

### ARCH-13 [P3] AI 异常类定义在 `asr_gateway.py` 而非公共模块

**问题位置：**  
- `backend/app/ai/asr_gateway.py` 第 28-43 行：`AIServiceUnavailable`、`AIServiceTimeout`

**问题描述：**  
`AIServiceUnavailable` 和 `AIServiceTimeout` 是 AI 层的公共异常，但定义在 `asr_gateway.py` 中。其他模块通过 `from app.ai import AIServiceUnavailable` 导入（依赖 `__init__.py` 的 re-export）。

**产生的影响：**
- **语义不清：** 从 ASR 模块导入"AI 服务不可用"异常，暗示这些异常只与 ASR 相关
- **循环依赖风险：** `__init__.py` 从 `asr_gateway` 导出异常，其他网关如果也需要这些异常可能产生循环

**修复建议：**
将 `AIServiceUnavailable` 和 `AIServiceTimeout` 移到 `app/ai/exceptions.py`，各网关和 `__init__.py` 从那里导入。

**预估工作量：** 0.2 人天  
**定级理由：P3** — 当前可工作，代码组织优化。

---

### ARCH-14 [P3] 前端 `reportService.ts` 重复定义类型

**问题位置：**  
- `frontend/src/services/reportService.ts` 第 5-77 行：重新定义了 `AccuracyPoint`、`LevelProgress`、`DailyActivity`、`TrainingSummary` 等类型
- `frontend/src/types/index.ts`：通用类型定义

**问题描述：**  
`reportService.ts` 在文件顶部重新定义了所有报告相关的 TypeScript 接口（77 行），而这些类型应该统一放在 `types/index.ts` 中。

**产生的影响：**
- **类型不一致风险：** 两处定义可能随时间产生差异
- **import 混淆：** 开发者不确定从哪里导入这些类型

**修复建议：**
将 `reportService.ts` 中的类型定义移到 `types/index.ts`，`reportService.ts` 从 `types` 导入。

**预估工作量：** 0.2 人天  
**定级理由：P3** — 代码整洁问题，不影响功能。

---

## 三、架构债分布热力图

```
                    P0    P1    P2    P3    总计
─────────────────────────────────────────────────
模块耦合              0     1     0     0      1   (ARCH-01)
职责边界              0     2     0     0      2   (ARCH-02, ARCH-03)
分层合理性            0     0     2     0      2   (ARCH-05, ARCH-06)
重复代码              0     0     2     1      3   (ARCH-04, ARCH-12, ARCH-13)
前端架构              0     0     2     1      3   (ARCH-07, ARCH-08, ARCH-14)
依赖注入              0     0     1     0      1   (ARCH-09)
配置管理              0     0     0     1      1   (ARCH-10)
代码整洁              0     0     0     1      1   (ARCH-11)
─────────────────────────────────────────────────
总计                  0     3     7     4     14
```

## 四、优先修复建议

### 第一批（1-2 周）— P1 项
| 编号 | 工作量 | 说明 |
|------|--------|------|
| ARCH-02 | 2d | 拆分 ReportService |
| ARCH-03 | 2d | 拆分 DialogueService |
| ARCH-01 | 0.5d | deps.py 依赖治理（标注为已知技术债即可） |

### 第二批（3-4 周）— P2 项
| 编号 | 工作量 | 说明 |
|------|--------|------|
| ARCH-05 | 1d | 统一响应格式 |
| ARCH-12 | 0.5d | 提取公共重试逻辑 |
| ARCH-04 | 0.5d | 统一安全护栏 |
| ARCH-06 | 1d | 发音题库迁移到数据库 |
| ARCH-09 | 1.5d | AI 网关依赖注入 |
| ARCH-07+08 | 1d | 前端 Store 清理 |

### 第三批（持续改进）— P3 项
| 编号 | 工作量 | 说明 |
|------|--------|------|
| ARCH-10 | 0.1d | CORS 配置修复 |
| ARCH-11 | 0.05d | 删除 dead import |
| ARCH-13 | 0.2d | 异常类位置调整 |
| ARCH-14 | 0.2d | 前端类型统一 |

**总预估工作量：** 约 10.5 人天

## 五、架构优点（值得保持）

1. **分层方向正确：** API → Service → Model 的依赖方向总体一致，没有反向依赖
2. **AI 网关设计良好：** Base 类 + 具体实现的抽象模式，支持未来切换 AI 供应商
3. **错误处理体系完整：** `AppException` + `ErrorCode` + 全局异常处理器的三层设计
4. **前端分层清晰：** pages/components/hooks/stores/services 五层职责划分合理
5. **IRT 自适应引擎独立：** `irt_engine.py` 纯算法模块，无外部依赖，可独立测试
6. **发音评分引擎独立：** `pronunciation_scorer.py` 纯算法模块，设计优秀
7. **中间件架构合理：** 性能/监控/限流/缓存通过中间件链式处理，职责清晰

---

*本报告基于 2025-07-22 代码快照，建议每季度重新评估。*
