# API 参考

所有接口使用 `/api` 前缀，成功响应统一为 `{ "code": 0, "data": ..., "message": "ok" }`。
除场景列表、健康检查和监控读取接口外，接口需要 httpOnly `access_token` Cookie 或 `Authorization: Bearer <token>`。

## 认证

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/sms/send` | 发送验证码 |
| POST | `/api/auth/login` | 验证码登录并设置 Cookie |
| POST | `/api/auth/logout` | 清除登录 Cookie |
| GET | `/api/auth/me` | 获取当前用户 |
| PUT | `/api/auth/users/me/preferences` | 更新无障碍偏好 |

## 训练

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/training/sessions?level=...` | 创建训练会话 |
| GET | `/api/training/sessions/{id}/next` | 获取下一题 |
| POST | `/api/training/sessions/{id}/answer` | 提交答案 |
| POST | `/api/training/sessions/{id}/finish` | 结束训练 |
| GET | `/api/training/adaptive/recommendation` | 获取 BKT 推荐 |
| POST | `/api/training/adaptive/submit` | 提交 BKT 结果 |

## 对话、发音和报告

- 对话：`/api/dialogue/scenarios`、`/api/dialogue/sessions` 及其 `/{id}/turn`、`/{id}/finish`。
- 发音：`/api/pronunciation/tasks/next`、`/api/pronunciation/attempts`、`/api/pronunciation/stats`。
- 报告：`/api/report/summary`、`/api/report/levels`、`/api/report/patients`、`/api/report/weekly`。
- 硬件：`/api/hardware/devices` 及设备控制子路径。

## 运维

- `GET /api/health`：存活检查。
- `GET /api/health/detailed`：数据库和 Redis 就绪检查。
- `GET /api/metrics`：请求和错误指标。
- `GET /api/metrics/ai-latency`：AI 延迟指标。
- `GET /api/metrics/errors`：最近错误。

交互式 OpenAPI 文档在开发环境的 `/docs`，生产环境应通过配置关闭公开文档或限制访问来源。
