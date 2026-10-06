# 部署指南

## 架构概览

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   用户浏览器  │────▶│  CDN / OSS   │────▶│  前端静态资源     │
│  (移动端优先) │     │  (前端托管)   │     │  (React SPA)    │
└──────┬──────┘     └──────────────┘     └─────────────────┘
       │
       │ /api/*
       ▼
┌──────────────┐     ┌──────────────┐     ┌─────────────────┐
│  API 网关     │────▶│  函数计算 FC  │────▶│  FastAPI 后端    │
│  (限流/鉴权)  │     │  (Serverless) │     │  (Python 3.11)  │
└──────────────┘     └──────┬───────┘     └────────┬────────┘
                            │                      │
                   ┌────────┴────────┐    ┌────────┴────────┐
                   │  RDS PostgreSQL  │    │   Redis 缓存     │
                   │  (业务数据)      │    │   (会话/限流)     │
                   └─────────────────┘    └─────────────────┘
```

## 前置条件

1. 阿里云账号（已开通以下服务）：
   - 函数计算 FC
   - RDS PostgreSQL
   - Redis
   - OSS
   - 百炼平台（DashScope API Key）
2. 域名（可选，用于自定义域名）
3. Docker（本地构建镜像）

## 一、本地开发环境

### 1.1 启动基础设施

```bash
# 启动 PostgreSQL + Redis
docker-compose up -d db redis

# 或使用全部容器
docker-compose up -d
```

### 1.2 配置环境变量

```bash
cd backend
cp .env.example .env
# 编辑 .env，填入 DASHSCOPE_API_KEY 等
```

### 1.3 启动后端

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

首次启动会自动：
- 创建数据库表
- 填充种子数据（训练题库 + 测试用户）

### 1.4 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3000

### 1.5 本地登录测试

验证码由后端随机生成并写入 Redis，系统不会把验证码打印到日志，也不接受固定的万能验证码。
测试环境应通过测试 fixture 读取内存 Redis 中的验证码；手工联调请接入短信供应商或使用隔离的测试短信通道。

## 二、Serverless 部署（阿里云 FC）

### 2.1 构建 Docker 镜像

```bash
# 构建后端镜像
cd backend
docker build -t registry.cn-hangzhou.aliyuncs.com/cochlear-rehab/backend:latest .
docker push registry.cn-hangzhou.aliyuncs.com/cochlear-rehab/backend:latest

# 构建前端镜像
cd frontend
docker build -t registry.cn-hangzhou.aliyuncs.com/cochlear-rehab/frontend:latest .
docker push registry.cn-hangzhou.aliyuncs.com/cochlear-rehab/frontend:latest
```

### 2.2 配置阿里云资源

#### RDS PostgreSQL
1. 创建 PostgreSQL 15 实例
2. 创建数据库 `cochlear_rehab`
3. 创建用户并授权
4. 记录连接信息

#### Redis
1. 创建 Redis 7 实例
2. 设置密码
3. 记录连接信息

#### VPC 网络
1. 创建 VPC 和交换机
2. 确保 FC、RDS、Redis 在同一 VPC

### 2.3 部署

```bash
# 安装 Serverless Devs
npm install -g @serverless-devs/s

# 配置阿里云密钥
s config add --AccessKeyID <your-key> --AccessKeySecret <your-secret> --alias default

# 设置环境变量
export DATABASE_URL="postgresql+asyncpg://user:pass@rm-xxx.pg.rds.aliyuncs.com:5432/cochlear_rehab"
export REDIS_URL="redis://:password@r-xxx.redis.rds.aliyuncs.com:6379/0"
# 使用密码管理器生成并注入至少 32 位随机密钥，不要使用固定示例值
export SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(64))')"
export DASHSCOPE_API_KEY="sk-xxx"

# 部署
cd deploy
s deploy
```

### 2.4 前端部署到 OSS

```bash
# 构建前端
cd frontend
npm run build

# 上传到 OSS
ossutil cp -r dist/ oss://cochlear-rehab-web/ --force

# 设置缓存策略
ossutil set-meta oss://cochlear-rehab-web/ \
  --header "Cache-Control:max-age=31536000" \
  --include "*.js" "*.css"
```

## 三、CI/CD 自动化

项目已配置 GitHub Actions 自动化流水线：

### 触发条件

| 事件 | 动作 |
|------|------|
| PR → main | 运行后端测试 + 前端构建 |
| Push → main | 测试 + 构建 Docker 镜像 + 部署 |
| Push → develop | 仅运行测试 |

### 配置 Secrets

在 GitHub 仓库 Settings → Secrets 中添加：

| Secret 名称 | 说明 |
|-------------|------|
| `ALIYUN_CR_USER` | 阿里云容器镜像服务用户名 |
| `ALIYUN_CR_PASSWORD` | 阿里云容器镜像服务密码 |
| `ALIYUN_ACCESS_KEY_ID` | 阿里云 AccessKey ID |
| `ALIYUN_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret |

## 四、监控与告警

### 4.1 性能监控端点

| 端点 | 说明 |
|------|------|
| `GET /api/health` | 基础健康检查 |
| `GET /api/health/detailed` | 详细健康检查（含 DB/Redis） |
| `GET /api/metrics` | 监控指标汇总 |
| `GET /api/metrics/ai-latency` | AI 服务延迟统计 |
| `GET /api/metrics/errors` | 最近错误列表 |

### 4.2 性能指标要求

| 指标 | 要求 | 监控方式 |
|------|------|---------|
| ASR 延迟 | < 500ms | `/api/metrics/ai-latency` |
| 对话响应 | < 3s | HTTP 响应时间 |
| 发音评分 | < 2s | HTTP 响应时间 |
| 页面加载 | < 3s | Lighthouse |

### 4.3 告警配置建议

- P95 响应时间 > 阈值 → 告警
- 错误率 > 1% → 告警
- AI 服务不可用 → 告警
- 数据库/Redis 连接失败 → 告警

## 五、测试

### 运行集成测试

```bash
cd backend
pip install pytest pytest-asyncio httpx aiosqlite
pytest tests/ -v
```

### 性能测试

```bash
# 安装压测工具
pip install locust

# 运行压测（示例）
locust -f tests/performance.py --host http://localhost:8000
```

## 六、常见问题

### Q: 冷启动延迟高怎么办？
A: FC 预留实例可解决。在函数计算控制台设置预留实例数 ≥ 1。

### Q: 数据库连接数不够？
A: 调整 SQLAlchemy 连接池大小：`create_async_engine(url, pool_size=20, max_overflow=10)`

### Q: Redis 连接失败？
A: 检查 VPC 配置，确保 FC 和 Redis 在同一 VPC 且安全组允许访问。
