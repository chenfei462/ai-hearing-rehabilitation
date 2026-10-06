# 生产运行手册

## 发布前检查

1. 设置随机 `SECRET_KEY`（至少 32 个字符），并确认 `COOKIE_SECURE=true`。
2. 设置 PostgreSQL、Redis、DashScope 和 OSS 连接信息；不要把凭据提交到仓库或写入镜像。
3. 执行 `backend/.venv/Scripts/python -m pytest -q`（Windows）或 `backend/.venv/bin/python -m pytest -q`（Linux）。
4. 执行 `npm ci && npm run lint && npm test && npm run build`。
5. 确认 `/api/health` 返回 200；`/api/health/detailed` 的数据库和 Redis 状态均为 `ok`。

## 常见故障

### Redis 不可用

验证码发送/校验返回 503 是预期的安全降级，不得绕过校验。检查 Redis 网络、密码和连接池，再重试健康检查。

### 数据库不可用

先检查连接串、VPC/安全组和连接数；只读健康检查确认恢复后，再重启应用实例。不要在应用容器内手工修改生产数据。

### AI 服务不可用

对话和发音接口应返回可识别的降级响应。检查 DashScope 配额、API Key 和 `/api/metrics/ai-latency`，必要时暂时关闭相关入口并保留训练数据写入。

### 登录异常

检查 `/api/metrics/errors` 和认证服务日志。确认 Cookie 使用 HTTPS、域名和 `SameSite` 配置正确；不要通过日志查找验证码。

## 密钥轮换

1. 生成新的随机 `SECRET_KEY` 并通过密钥管理系统注入。
2. 滚动重启所有后端实例；旧 JWT 会立即失效，通知用户重新登录。
3. 轮换 DashScope、数据库、Redis 和 OSS 凭据，验证健康检查后删除旧凭据。

## 回滚

保留上一版本镜像和数据库迁移记录。应用代码回滚前确认迁移向后兼容；禁止直接删除生产表。回滚后执行健康检查、登录、训练开始和报告查询四条冒烟路径。

## 监控与告警

- `/api/health`：存活探针。
- `/api/health/detailed`：数据库和 Redis 就绪状态。
- `/api/metrics`：HTTP 请求、错误率和活跃请求数。
- `/api/metrics/ai-latency`：ASR、TTS、LLM P95 延迟。
- 告警条件：错误率超过 1%、Redis/数据库非 `ok`、AI P95 超过配置阈值。
