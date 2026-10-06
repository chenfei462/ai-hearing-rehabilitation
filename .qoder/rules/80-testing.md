# 80 — 测试规则

## 测试金字塔与真实命令

| 层 | 工具 | 命令（已核实） | 范围 |
|---|---|---|---|
| 后端单测 | pytest + pytest-asyncio | `python -m pytest -q`（backend/，venv `backend/.venv`） | services/ai/models/schemas/core，DB 用 sqlite+aiosqlite |
| 后端集成 | pytest + postgres | `pytest tests/test_integration.py tests/test_training_api.py tests/test_role_permissions.py -q` | CI 既有 postgres job 同款 |
| 后端 lint | ruff | `ruff check app/` | E,F,W（CI 基线）；本地可用 pyproject 全量规则 |
| 前端单测 | vitest + Testing Library | `npm test -- --run` | 页面渲染、store、utils |
| 前端类型 | tsc | `npx tsc --noEmit` | 全量 |
| 前端 lint | eslint | `npm run lint` | --max-warnings 0 |
| 前端构建 | vite | `npm run build` | production build 必须成功 |
| 前端 E2E | playwright | `npm run test:e2e` | chromium 冒烟 |
| 迁移 | alembic | `alembic upgrade head` → `downgrade -1` → `upgrade head` | clean DB 上验证 |
| 容器 | docker | `docker compose build` | backend/frontend Dockerfile |

禁止引用不存在的命令（如 mypy、独立 `npm run typecheck`）；新增测试命令先落地到 pyproject/package.json/CI 再写入门禁。

## 强制要求

1. **测试先行意识**：TASK_SPEC 的 MANDATORY_TESTS 必须是真实可运行命令；新功能无测试不得 PASS。
2. **安全测试**：涉及认证/授权/归属的任务必须含 401/403/IDOR 用例；医疗敏感任务必须含医疗安全回归；隐私任务必须含隔离/删除/导出/脱敏用例。
3. **RAG/知识库测试**：retrieval 命中与过滤（unapproved/expired exclusion）、citation 真实性、D 类数据不入向量库的隔离测试。
4. **回归基线**：全量后端测试 + 前端测试是 Milestone/Release Gate 的必跑项；任何任务不得使其变红。
5. **外部依赖 mock**：dashscope/OSS/短信一律 mock；禁止测试消耗真实 API 配额或触达真实用户。
6. **测试数据**：使用 conftest fixture 与安全测试配置（CI env：sqlite / postgres 测试库 / `ci-only-secret-key…`）；禁止硬编码真实 Secret。
7. **禁止行为**：删除、注释、skip、xfail 既有测试以通过门禁；降低断言强度；catch 后静默吞异常。

## 评测类测试（EVAL-*，区别于单元测试）

- ASR 准确率（目标 >85%）、发音评分效度、自适应阈值（≥80% 正确率规则）、噪声/语速鲁棒性均为**待验证工程目标**：用固定评测集 + 报告产出，结论写入评测报告，不得凭单次抽查宣称达标。
- 评测集覆盖：普通话标准音、老年用户语音、人工耳蜗使用者语音、构音差异样本、多噪声类型/SNR、多语速。
- 评测结果不达标的处置是记录 + 立修复/调参任务，禁止修改指标定义来"达标"。

## 覆盖率

- CI 已产出 coverage.xml；MVP 阶段要求：新增核心 service 代码有对应测试；Release Gate 前设定并检查覆盖率阈值（具体数值由 OPS-001 落地，禁止无阈值空谈）。
