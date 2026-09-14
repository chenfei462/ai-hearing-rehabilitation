# AI 听觉康复助手修复任务清单

## P0 — 上线阻断（必须完成）

- [ ] Task 1: 修复Redis decode bug (P0)
- [ ] Task 2: 修复useRecorder API不匹配 (P0)
- [ ] Task 3: 为训练API添加认证和session归属校验 (P0)
- [ ] Task 4: 修复Alembic downgrade bug (P0)
- [ ] Task 5: 修复健康检查状态码 (P0)

## P1 — 安全阻断（上线前完成）

- [ ] Task 6: 修复对话API IDOR漏洞 (P1)
- [ ] Task 7: 修复流式输出安全检查滞后 (P1)
- [ ] Task 8: Token迁移到httpOnly Cookie (P1)
- [ ] Task 9: 修改DEBUG默认值 (P1)
- [ ] Task 10: Docker密码外部化 (P1)
- [ ] Task 11: 验证码改用secrets + 6位 (P1)

## 验证清单

### P0验证
- [ ] Redis decode bug修复：验证码验证正常工作
- [ ] useRecorder API修复：训练页面不再崩溃
- [ ] 训练API认证：未认证请求返回401
- [ ] Alembic downgrade：数据库回滚正常工作
- [ ] 健康检查状态码：degraded状态返回503

### P1验证
- [ ] 对话API IDOR：用户无法访问他人session
- [ ] 流式安全检查：不安全内容被拦截
- [ ] Token安全：token不在localStorage中
- [ ] DEBUG配置：默认为False
- [ ] Docker密码：使用环境变量
- [ ] 验证码安全：使用secrets模块，6位长度

### 上线前检查
- [ ] 所有P0和P1问题已修复
- [ ] 单元测试全部通过
- [ ] 集成测试通过
- [ ] 安全审查通过
- [ ] 性能测试通过
