# 听觉康复项目 — 长期记忆

## 项目概况
- **技术栈**：React 18 + TypeScript + MUI + FastAPI + PostgreSQL + Redis + 阿里云百炼 AI
- **核心模块**：训练系统、AI 对话、发音评估、报告系统
- **测试现状**：后端 ~123 个测试用例，前端零测试
- **CI/CD**：GitHub Actions，后端有测试 + ruff lint，前端仅类型检查 + 构建
- **无 Git 仓库**：项目根目录无 .git

## 测试质量标杆
- `test_irt_engine.py`（26 tests）和 `test_pronunciation.py`（29 tests）质量优秀

## 上线前全检结论（2026-09-14）
- **放行结论**：🟡 修复后上线，安全评级 D
- **5 个阻断 bug**：Redis decode 崩溃、useRecorder API 不匹配、训练 API 无认证、Alembic downgrade bug、健康检查状态码
- **安全阻断项**：对话 IDOR、流式安全检查滞后、Token 存 localStorage、DEBUG 默认 True、Docker 密码硬编码
- **已排除**：✅ SECRET_KEY 默认值已有启动校验、✅ 硬编码验证码 "1234" 已不在生产代码中

## 架构债（14 项）
- P1（3项）：ReportService God Module、DialogueService 职责过重、API 绕过 Service
- P2（7项）+ P3（4项）：详见 architecture-debt-assessment.md
