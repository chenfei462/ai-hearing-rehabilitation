# 代码审查报告 — AI 听觉康复助手

**审查范围**: 后端 ~72 Python 文件 + 前端 ~40 TS/TSX 文件
**审查维度**: 逻辑正确性、边界处理、并发性能、命名重复、调试残留、日志一致性

---

## 【阻断】— 必须修复才能上线 (4 项)

### B1. useRecorder Hook API 不匹配 → TrainingPage 运行时崩溃
**文件**: `frontend/src/pages/TrainingPage.tsx:240,396-407,636`

`useRecorder()` 返回的接口是 `{ status, resetRecording }`，但 TrainingPage 使用了不存在的属性：
- `recorder.isRecording`（实际应为 `recorder.status === 'recording'`）
- `recorder.clearRecording()`（实际应为 `recorder.resetRecording()`）

**影响**: TrainingPage 打开即崩溃（TypeError: Cannot read property of undefined）。

**修复**:
```typescript
// 第 396 行: recorder.isRecording → recorder.status === 'recording'
// 第 400-407 行: recorder.isRecording → recorder.status === 'recording'
// 第 240 行: recorder.clearRecording() → recorder.resetRecording()
// 第 636 行: recorder.clearRecording() → recorder.resetRecording()
```

---

### B2. Redis decode_responses=True 导致 verify_sms 崩溃 → 登录流程完全不可用
**文件**: `backend/app/services/auth_service.py:47`

```python
stored = await redis.get(f"sms:{phone}")
if stored and stored.decode() == code:  # ← BUG: decode_responses=True 时 stored 已是 str
```

`redis_client` 在 `redis.py` 中配置了 `decode_responses=True`，`redis.get()` 返回的是 `str`，调用 `.decode()` 会抛 `AttributeError: 'str' object has no attribute 'decode'`。

**影响**: 所有验证码验证都会抛异常，用户无法登录。

**修复**: 删除 `.decode()` 调用：
```python
if stored and stored == code:
```

---

### B3. 对话 handle_turn 异常时 session.turn_count 已递增但 turn 未持久化 → 轮次计数漂移
**文件**: `backend/app/services/dialogue_service.py:120-137,167,203`

当 ASR 超时或返回空文本时，函数在第 130-149 行 `return`，此时：
- `session.turn_count` **未递增**（return 发生在递增之前）
- 但用户端收到的 `remaining_turns` = `MAX_TURNS - session.turn_count` 不变

然而，安全护栏命中时（第 167 行），`session.turn_count` **被递增**且 turn 被持久化，但 ASR 超时/空文本路径不递增也不持久化。这导致：

1. 安全护栏触发会消耗轮次（合理但需确认为预期行为）
2. ASR 超时不消耗轮次（可能导致用户无限重试超时的音频）
3. 若 ASR 超时后 session 在 DB 中的 turn_count 与实际 turn 行数不一致

**修复**: 统一策略 — ASR 超时/空文本也应该记录 turn（标记为空），并递增 turn_count：
```python
# ASR 超时后，记录空 turn 并递增计数
turn_index = session.turn_count + 1
turn = DialogueTurn(
    session_id=session_id,
    turn_index=turn_index,
    user_text="",
    ai_text="语音识别超时了，请再说一遍。",
    latency_ms=int((time.monotonic() - start_time) * 1000),
)
self.db.add(turn)
session.turn_count = turn_index
```

---

### B4. 训练 API 多个端点缺少会话所有权验证 → 任意用户可操作他人会话
**文件**: `backend/app/api/training.py:30-34,43-53,55-62`

```python
# 第 30 行: get_next_item 无 current_user 依赖
@router.get("/sessions/{session_id}/next", response_model=ApiResponse)
async def get_next_item(session_id: int, db: AsyncSession = Depends(get_db)):
    # ← 无 auth，任意用户可获取任意 session 的下一题

# 第 43 行: submit_answer 无 current_user 依赖
@router.post("/sessions/{session_id}/answer", response_model=ApiResponse)
async def submit_answer(session_id: int, item_id: int, answer: str, ...):
    # ← 无 auth，任意用户可提交任意 session 的答案

# 第 55 行: finish_session 无 current_user 依赖
@router.post("/sessions/{session_id}/finish", response_model=ApiResponse)
async def finish_session(session_id: int, ...):
    # ← 无 auth，任意用户可结束任意 session
```

**影响**: 水平越权 — 用户 A 可以操作用户 B 的训练会话。

**修复**: 为所有三个端点添加 `current_user = Depends(get_current_user)` 并在 service 层验证 `session.user_id == current_user.id`。

---

## 【严重】— 强烈建议修复 (7 项)

### S1. 对话 API 绕过 Service 层权限检查 → dialogue.py 未验证 session 归属
**文件**: `backend/app/api/dialogue.py:54-84,87-103`

`handle_turn` 和 `finish_session` 端点虽然有 `current_user` 依赖，但未将 `current_user.id` 传入 service 层验证 session 是否属于当前用户。

**影响**: 认证用户 A 可以向用户 B 的对话会话提交音频。

**修复**: 在 DialogueService 中添加 session 归属检查，或在 API 层查询 session 后验证 `session.user_id == current_user.id`。

---

### S2. ASR recognize/recognize_with_timestamps 在事件循环中执行同步阻塞 I/O
**文件**: `backend/app/ai/asr_gateway.py:94-129,148-208`

`dashscope.AudioRecognition.call()` 是同步阻塞调用，直接在 `async def _call()` 中执行，会阻塞整个 asyncio 事件循环。

```python
async def _call():
    # ...
    response = client.AudioRecognition.call(...)  # ← 同步阻塞！
```

**影响**: 在高并发场景下，一个 ASR 请求会阻塞所有其他并发请求的处理。即使是单用户场景，ASR 期间也无法处理健康检查等请求。

**修复**: 使用 `asyncio.to_thread()` 或 `loop.run_in_executor()` 将同步调用包装到线程池：
```python
response = await asyncio.to_thread(
    client.AudioRecognition.call, model=self.model, ...
)
```

---

### S3. TTS _upload_to_oss 同步阻塞调用 oss2
**文件**: `backend/app/ai/tts_gateway.py:262`

`bucket.put_object(object_key, audio_bytes)` 是同步阻塞调用，与 S2 同理。

**修复**: 使用 `asyncio.to_thread()` 包装。

---

### S4. LLM chat_stream 流式输出无法撤回安全过滤内容
**文件**: `backend/app/ai/llm_gateway.py:350-355`

```python
# 输出安全检查 (对完整内容)
is_safe, reason = self._check_safety_output(full_content)
if not is_safe:
    # 已经流式输出了部分内容，无法撤回
    logger.warning(...)
```

**影响**: 敏感内容（如医疗建议）在安全检查之前已逐 token 流式发送给前端。

**修复**: 在 MVP 阶段可改为非流式输出；长期方案需要实现 token 级别的安全缓冲区（先缓冲 N 个 token，检查后再发送）。

---

### S5. LLM 输入安全检查只检查最后一条消息 → 历史消息中的敏感内容绕过
**文件**: `backend/app/ai/llm_gateway.py:249-252`

```python
if messages:
    last_msg = messages[-1].get("content", "")
    is_safe, reason = self._check_safety_input(last_msg)
```

**影响**: 用户可以在第 N-1 轮输入敏感关键词，第 N 轮输入正常内容，安全检查只检查第 N 轮。

**修复**: 检查所有消息或至少检查最后 3 条消息。

---

### S6. ResponseCacheMiddleware 未使用 get_redis() 且不区分用户会话
**文件**: `backend/app/middleware/performance.py:68,95,119`

1. 直接使用 `redis_client` 而非 `get_redis()`，无法优雅降级
2. 缓存 key 用 `auth[:20]`（token 前 20 字符），但 `/api/report/summary` 的数据是用户特定的，缓存可能在 token 刷新后命中旧数据

**修复**: 使用完整 token hash 或 user_id 作为缓存 key 的一部分。

---

### S7. MonitoringMiddleware 活跃请求数有竞态条件
**文件**: `backend/app/middleware/monitoring.py:26-27,63-64`

```python
active = metrics_collector.get_gauge("active_requests")
metrics_collector.set_gauge("active_requests", active + 1)  # ← 非原子操作
```

两个并发请求可能同时读到相同的 `active` 值，导致计数不准确。

**修复**: 使用 `atomic_increment` / `atomic_decrement` 操作。

---

## 【建议】— 建议改进 (12 项)

### A1. 硬编码验证码 "1234" 已从生产代码移除，但仍存在于测试文件
**文件**: `backend/tests/test_auth_service.py`, `backend/tests/test_integration.py`, `backend/tests/test_performance.py`

测试中使用 `code: "1234"` 是合理的（mock Redis 返回值），但需确认生产环境不会误加载测试配置。

**状态**: 已确认生产代码中无硬编码验证码。✅ 已修复。

---

### A2. AuthService 验证码日志只记录手机号后 4 位
**文件**: `backend/app/services/auth_service.py:39`

```python
logger.info(f"[SMS] 向 {phone[-4:]}**** 发送验证码成功")
```

✅ 已做脱敏处理。但验证码明文存储在 Redis 中（`await redis.setex(f"sms:{phone}", 300, code)`），Redis 内部可被直接查看。

**建议**: 对验证码做 hash 存储（`hashlib.sha256(code.encode()).hexdigest()`），验证时对比 hash。

---

### A3. training.py submit_answer 参数应使用 Request Body 而非 Query Params
**文件**: `backend/app/api/training.py:43-53`

```python
@router.post("/sessions/{session_id}/answer")
async def submit_answer(
    session_id: int,
    item_id: int,      # ← Query Param
    answer: str,        # ← Query Param
    response_ms: int = 0,  # ← Query Param
    ...
):
```

POST 请求的业务参数应放在 Request Body 中。当前设计会导致 URL 过长（尤其 answer 是用户输入文本时）。

**修复**: 创建 Pydantic schema，使用 `body: SubmitAnswerRequest`。

---

### A4. DialogueService 使用 ValueError 而非 AppException
**文件**: `backend/app/services/dialogue_service.py:57,115,117,121,139`

Service 层抛出 `ValueError`，API 层捕获后转为 `error_response`。应统一使用 `AppException` 保持一致的错误处理链。

---

### A5. 前端 useRecorder 的 useEffect 闭包问题
**文件**: `frontend/src/hooks/useRecorder.ts:40-48`

```typescript
useEffect(() => {
    return () => {
        // ...
        if (audioUrl) URL.revokeObjectURL(audioUrl);  // ← audioUrl 永远是初始值 null
    };
}, []);  // ← 空依赖数组，audioUrl 不会被追踪
```

**影响**: `URL.revokeObjectURL` 永远不会执行（`audioUrl` 在 effect 创建时为 `null`），导致内存泄漏。

**修复**: 添加 `audioUrl` 到依赖数组，或使用 `useRef` 追踪。

---

### A6. 前端 useLocalStorage Hook 有 console.error
**文件**: `frontend/src/hooks/useLocalStorage.ts`

开发环境可保留，生产环境应移除或降级为 `console.warn`。

---

### A7. IRT Engine decide_next_action 返回的 theta/se 固定为 0.0/1.0
**文件**: `backend/app/services/irt_engine.py:87-100`

```python
def decide_next_action(self, recent_accuracies: List[float]) -> IRTEstimate:
    if len(recent_accuracies) < self.consecutive_required:
        return IRTEstimate(0.0, 1.0, "continue")  # ← theta=0, se=1 不是实际估计值
```

返回值中的 `theta` 和 `se` 未被使用（调用方只用 `decision.action`），但数据结构暗示它们应有意义。这是设计债，不阻塞上线。

---

### A8. 训练答案判定使用简单字符串匹配 → 对中文听力训练不够鲁棒
**文件**: `backend/app/services/training_service.py:71`

```python
is_correct = user_answer.lower().strip() == item.text.lower().strip()
```

中文没有大小写，`lower()` 无实际效果。但对于听力训练场景，简单精确匹配可能是合理的（MVP 阶段）。

**建议**: 后续可引入模糊匹配或 ASR 对比。

---

### A9. 前端 authStore 和 appStore 存在重复的 user 状态
**文件**: `frontend/src/stores/authStore.ts`, `frontend/src/stores/appStore.ts`

两个 store 都存储用户信息，可能导致状态不一致。建议合并为单一 auth store。

---

### A10. api.ts 响应拦截器静默移除 token 后直接跳转
**文件**: `frontend/src/services/api.ts:24-25`

```typescript
if (code === 40101) {
    localStorage.removeItem('token');
    window.location.href = '/login';  // ← 硬跳转，丢失当前页面状态
}
```

建议使用 React Router 的 `navigate` 并提示用户。

---

### A11. 后端 DEBUG 默认为 True
**文件**: `backend/app/core/config.py:34`

```python
DEBUG: bool = True
```

生产环境必须设为 `False`，否则会暴露 Swagger 文档和 SQL 日志（`echo=settings.DEBUG`）。

**建议**: 添加 `.env.production` 模板，明确 `DEBUG=False`。

---

### A12. ai/__init__.py 中未使用的 import
**文件**: `backend/app/ai/__init__.py:32-33,45-46`

工厂函数中 `from app.core.config import get_settings` 和 `settings = get_settings()` 被 import 但未使用。

---

## 总结

| 级别 | 数量 | 阻塞上线？ |
|------|------|-----------|
| 阻断 | 4 | ✅ 必须修复 |
| 严重 | 7 | ⚠️ 强烈建议 |
| 建议 | 12 | 💡 改进项 |

**最高优先级**:
1. **B2** (Redis decode) — 修复仅需删 1 个 `.decode()` 调用，1 分钟搞定
2. **B1** (useRecorder API) — TrainingPage 运行时崩溃，需修改 ~6 行
3. **B4** (训练 API 无 auth) — 安全漏洞，需添加 auth 依赖 + 归属检查
4. **B3** (turn_count 漂移) — 需要统一 ASR 超时/空文本的处理策略

**已确认已修复的已知 P0**:
- ✅ SECRET_KEY 默认值：`config.py` 已添加 `model_validator` 启动时拒绝
- ✅ 硬编码验证码 "1234"：生产代码中无硬编码，测试中使用 mock

**仍需关注的安全问题**（由 security officer 审查）:
- JWT SECRET_KEY 已有校验，但 ACCESS_TOKEN_EXPIRE_DAYS=7 过长
- CORS 配置仅限 localhost，生产需修改
- 验证码明文存储在 Redis 中
