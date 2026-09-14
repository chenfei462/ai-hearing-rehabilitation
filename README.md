# AI 听觉康复助手

> 天猫 AI 黑客松 · AI 辅助人工耳蜗术后听觉康复助手 MVP

## 项目背景

人工耳蜗植入术后患者需要长期的听觉康复训练。本项目利用 AI 技术，为患者提供个性化的家庭听觉训练方案，降低康复成本，提升训练效果。

**核心价值：**
- 分级训练体系（音素 → 词语 → 句子），基于 IRT 自适应调整难度
- AI 驱动的对话陪练，模拟真实生活场景
- 音素级发音评分，精准定位发音问题
- 数据可视化报告，帮助听力师远程跟踪患者进展

## 技术栈

| 层级 | 选型 |
|------|------|
| 前端 | Vite + React 18 + TypeScript + MUI + Tailwind CSS |
| 后端 | Python 3.11 + FastAPI + Uvicorn |
| 数据库 | PostgreSQL 15 + Redis 7 |
| AI 能力 | 阿里云百炼（Fun-ASR / Qwen3-TTS / 通义千问） |

## 快速开始

### 前置条件

- Node.js >= 18
- Python >= 3.11
- PostgreSQL 15+
- Redis 7+

### 后端

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 SECRET_KEY 和 DASHSCOPE_API_KEY

# 启动服务
uvicorn app.main:app --reload
```

访问 http://localhost:8000/docs 查看 API 文档

### 前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3000

## API 概览

| 模块 | 端点前缀 | 说明 |
|------|----------|------|
| 健康检查 | `/health` | 服务状态检测 |
| 认证 | `/api/auth` | 短信验证码登录、用户信息 |
| 训练 | `/api/training` | 训练会话管理、答题提交 |
| 对话 | `/api/dialogue` | 场景列表、对话会话 |
| 发音 | `/api/pronunciation` | 发音任务、评分反馈 |
| 报告 | `/api/report` | 训练概览、周报、患者列表 |
| 监控 | `/api/metrics` | Prometheus 格式指标 |

完整 API 文档请访问 http://localhost:8000/docs（需 DEBUG=true）

## 项目结构

```
├── frontend/              # 前端项目
│   ├── src/
│   │   ├── api/           # API 请求封装
│   │   ├── components/    # 通用组件
│   │   ├── hooks/         # 自定义 Hooks
│   │   ├── pages/         # 页面组件
│   │   ├── services/      # 业务 API 服务
│   │   ├── stores/        # Zustand 状态管理
│   │   ├── theme/         # MUI 主题配置
│   │   ├── types/         # TypeScript 类型
│   │   └── utils/         # 工具函数
│   └── package.json
├── backend/               # 后端项目
│   ├── app/
│   │   ├── ai/            # AI 网关（ASR/TTS/LLM）
│   │   ├── api/           # API 路由
│   │   ├── core/          # 核心配置与安全
│   │   ├── db/            # 数据库初始化
│   │   ├── middleware/     # 中间件（限流、监控）
│   │   ├── models/        # SQLAlchemy 数据模型
│   │   ├── schemas/       # Pydantic 请求/响应模型
│   │   ├── services/      # 业务逻辑层
│   │   └── utils/         # 工具函数
│   ├── tests/             # 测试用例
│   ├── pyproject.toml     # Python 项目配置
│   └── .env.example       # 环境变量模板
├── docs/                  # 设计文档
├── deploy/                # 部署配置
└── docker-compose.yml     # Docker 编排
```

## 功能模块

1. **听觉训练** - 分级训练（音素/词语/句子）+ IRT 自适应难度调整
2. **对话陪练** - AI 场景对话练习（餐厅、医院、超市等）
3. **发音反馈** - 音素级发音评分，支持音频回放对比
4. **训练报告** - 数据可视化、正确率趋势、依从率统计
5. **听力师后台** - 患者列表、预警提醒、远程跟踪

## 测试

```bash
cd backend

# 运行全部测试
pytest

# 运行特定测试
pytest tests/test_health.py
pytest tests/test_role_permissions.py

# 运行性能测试
pytest tests/test_performance.py -v
```

## 部署

项目支持 Docker Compose 一键部署：

```bash
docker-compose up -d
```

详细部署说明请参考 `deploy/` 目录。

## 设计文档

- `overview.md` - 项目总览
- `PRD_技术规格.md` - 产品需求文档
- `system_design.md` - 系统设计文档
- `class-diagram.mermaid` - 类图
- `sequence-diagram.mermaid` - 时序图

## 贡献指南

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'feat: add your feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 提交 Pull Request

**提交规范：** 遵循 [Conventional Commits](https://www.conventionalcommits.org/)
- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `test:` 测试相关
- `refactor:` 重构
