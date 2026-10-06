# 10 — 项目规则

## 项目身份

- 名称：ai-hearing-rehabilitation（AI 听觉康复助手 / ai_cochlear_rehab_assistant）。
- 定位：人工耳蜗术后成人/老年患者的**家庭听觉康复训练与健康教育辅助工具**（非医疗器械，不申报诊断/治疗功能）。
- 仓库根：`听觉康复/`；主分支 `master`。

## 核心业务域（真实存在的模块）

| 域 | 后端 | 前端 |
|---|---|---|
| 认证/用户 | `app/api/auth.py`、`app/services/auth_service.py`（短信验证码 + JWT httpOnly Cookie） | `pages/LoginPage.tsx`、`stores/authStore.ts` |
| 听觉训练 + IRT/BKT | `app/services/training_service.py`、`irt_engine.py`、`app/ai/adaptive_engine.py`、`models/knowledge_state.py` | `pages/TrainingPage.tsx` |
| 对话陪练 | `app/services/dialogue_service.py`、`dialogue_orchestrator.py`、`scenario_service.py` | `pages/DialoguePage.tsx`、`ConversationPage.tsx` |
| 发音反馈 | `app/services/pronunciation_service.py`、`pronunciation_scorer.py`（DTW 音素对齐） | `pages/PronunciationPage.tsx` |
| 报告/听力师 | `app/services/report_service.py`、`patient_service.py`、`training_stats_service.py`、`app/tasks/report_weekly.py` | `pages/ReportPage.tsx` |
| 监控 | `app/api/metrics.py`、`app/middleware/*`、`app/monitoring/metrics.py` | — |
| 硬件（非 MVP） | `app/hardware/**`（ESP32 康复站） | `components/hardware/**` |

规划中（尚无代码）：知识库/RAG（pgvector）、知识管理后台、专家审查、医学安全引擎升级、隐私合规套件。

## 目标用户与体验约束

- 老年用户 / 人工耳蜗使用者优先：字体 ≥18px、按钮 ≥48px、对比度 ≥4.5:1、语音引导、字幕、移动端优先（320px–1920px）。
- 无障碍 token 集中在 `frontend/src/theme/index.ts`、`tailwind.config.js`、`stores/a11yStore.ts`。

## 范围纪律

- MVP 范围以 `docs/workflow/PROJECT_PLAN.md` 为准；远期功能（语音克隆、硬件对接、HIS 集成、模型微调、脱敏数据集平台）不得塞入 MVP/P0。
- 硬件模块（ESP32）为既有实验代码：保持可编译可测试，不在 MVP 投入新功能。
- 每个开发任务 0.5~1.5 开发日、可由 `project-feature-delivery` Workflow 独立执行；任务清单以 `docs/workflow/TASK_CATALOG.md` 为唯一权威。
- 历史文档中的 `[x]` 完成标记**不构成通过证据**；状态以 Machine Gate/Review/Verify 的当前真实输出为准。

## 语言与规范

- 文档与注释默认中文；代码标识符遵循 `system_design.md` §10.3（DB snake_case、Python PEP8、TS camelCase/PascalCase、时间 UTC ISO8601、时长毫秒 `_ms` 后缀）。
- 提交规范：Conventional Commits（feat/fix/docs/test/refactor）。
- 根目录遗留杂物（`temp_fix.py`、`test_output*.txt`、`nul`、`fix_syntax.py`、`update_todo.py` 等）为历史残留：不得引用，清理需人工决定（Agent 禁止擅自删除用户文件）。
