# AI 听觉康复助手 — 上线前问题修复计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复上线前全检报告中发现的所有阻断级和严重级问题，确保系统可以安全部署

**Architecture:** 按优先级分层修复：P0阻断问题（运行时崩溃、安全漏洞）→ P1安全问题 → P2改进项，每个任务包含完整的测试验证

**Tech Stack:** React 18 + TypeScript + FastAPI + PostgreSQL + Redis + Alembic

---

## 文件结构

### 后端修改
- `backend/app/services/auth_service.py` — 修复Redis decode bug和验证码安全问题
- `backend/app/api/training.py` — 添加训练API认证和session归属校验
- `backend/app/api/dialogue.py` — 修复对话API IDOR漏洞
- `backend/app/api/health.py` — 修复健康检查状态码
- `backend/alembic/versions/001_init_tables.py` — 修复Alembic downgrade bug
- `backend/app/core/config.py` — 修改DEBUG默认值
- `backend/app/ai/llm_gateway.py` — 修复流式输出安全检查
- `backend/docker-compose.yml` — Docker密码外部化

### 前端修改
- `frontend/src/pages/TrainingPage.tsx` — 修复useRecorder API不匹配
- `frontend/src/services/api.ts` — Token迁移到httpOnly Cookie
- `frontend/src/stores/authStore.ts` — Token存储方式修改

### 测试文件
- `backend/tests/test_auth_service.py` — 认证服务测试
- `backend/tests/test_training_api.py` — 训练API测试
- `backend/tests/test_dialogue_api.py` — 对话API测试

---

## Task 1: 修复Redis decode bug (P0)

**Files:**
- Modify: `backend/app/services/auth_service.py:47`
- Test: `backend/tests/test_auth_service.py`

- [ ] **Step 1: 分析问题**

查看`auth_service.py:47`行：
```python
if stored and stored.decode() == code:
```

问题：Redis配置了`decode_responses=True`，`stored`已经是字符串，调用`.decode()`会抛出`AttributeError`

- [ ] **Step 2: 编写失败测试**

```python
# backend/tests/test_auth_service.py
import pytest
from unittest.mock import AsyncMock, patch
from app.services.auth_service import AuthService

@pytest.mark.asyncio
async def test_verify_sms_with_decoded_redis():
    """测试Redis返回已解码字符串时验证码验证正常工作"""
    mock_redis = AsyncMock()
    mock_redis.get.return_value = "1234"  # 已解码的字符串
    
    with patch('app.services.auth_service.get_redis', return_value=mock_redis):
        auth_service = AuthService(db=AsyncMock())
        result = await auth_service.verify_sms("13800138000", "1234")
        
    assert result is True
    mock_redis.delete.assert_called_once_with("sms:13800138000")
```

- [ ] **Step 3: 运行测试确认失败**

运行：`pytest backend/tests/test_auth_service.py::test_verify_sms_with_decoded_redis -v`
预期：FAIL with "AttributeError: 'str' object has no attribute 'decode'"

- [ ] **Step 4: 实施修复**

修改`backend/app/services/auth_service.py:47`行：
```python
# 修复前
if stored and stored.decode() == code:

# 修复后
if stored and stored == code:
```

- [ ] **Step 5: 运行测试确认通过**

运行：`pytest backend/tests/test_auth_service.py::test_verify_sms_with_decoded_redis -v`
预期：PASS

- [ ] **Step 6: 提交**

```bash
git add backend/app/services/auth_service.py backend/tests/test_auth_service.py
git commit -m "fix: 修复Redis decode responses导致的验证码验证失败"
```

---

## Task 2: 修复useRecorder API不匹配 (P0)

**Files:**
- Modify: `frontend/src/pages/TrainingPage.tsx:240,396-407`
- Test: 前端手动测试

- [ ] **Step 1: 分析问题**

查看`TrainingPage.tsx`：
- 第240行：`recorder.clearRecording()` → 应为 `recorder.resetRecording()`
- 第396-407行：`recorder.isRecording` → 应为 `recorder.status === 'recording'`

查看`useRecorder.ts`返回值：
```typescript
return {
  status,        // 不是 isRecording
  resetRecording, // 不是 clearRecording
  // ...
}
```

- [ ] **Step 2: 实施修复**

修改`frontend/src/pages/TrainingPage.tsx`：

第240行附近：
```typescript
// 修复前
recorder.clearRecording();

// 修复后
recorder.resetRecording();
```

第396-407行附近：
```typescript
// 修复前
onClick={recorder.isRecording ? stopRecordingAndSubmit : startRecording}
sx={{
  bgcolor: recorder.isRecording ? 'error.main' : 'secondary.main',
}}
{recorder.isRecording ? <MicOff /> : <Mic />}

// 修复后
onClick={recorder.status === 'recording' ? stopRecordingAndSubmit : startRecording}
sx={{
  bgcolor: recorder.status === 'recording' ? 'error.main' : 'secondary.main',
}}
{recorder.status === 'recording' ? <MicOff /> : <Mic />}
```

- [ ] **Step 3: 验证修复**

1. 启动前端开发服务器：`cd frontend && npm run dev`
2. 打开训练页面
3. 点击录音按钮，确认不再报错
4. 确认录音状态显示正确

- [ ] **Step 4: 提交**

```bash
git add frontend/src/pages/TrainingPage.tsx
git commit -m "fix: 修复useRecorder hook API不匹配导致的TypeError崩溃"
```

---

## Task 3: 为训练API添加认证和session归属校验 (P0)

**Files:**
- Modify: `backend/app/api/training.py:30-62`
- Test: `backend/tests/test_training_api.py`

- [ ] **Step 1: 分析问题**

查看`training.py:30-62`行，三个端点缺少认证：
- `get_next_item` (第30行)
- `submit_answer` (第41行)  
- `finish_session` (第54行)

问题：任何人可通过遍历session_id操控任意用户的训练数据（水平越权）

- [ ] **Step 2: 编写失败测试**

```python
# backend/tests/test_training_api.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_training_endpoints_require_auth():
    """测试训练API端点需要认证"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # 测试get_next_item
        response = await client.get("/api/training/sessions/1/next")
        assert response.status_code == 401
        
        # 测试submit_answer
        response = await client.post("/api/training/sessions/1/answer", params={
            "item_id": 1, "answer": "test", "response_ms": 100
        })
        assert response.status_code == 401
        
        # 测试finish_session
        response = await client.post("/api/training/sessions/1/finish")
        assert response.status_code == 401

@pytest.mark.asyncio
async def test_training_session_ownership_check():
    """测试用户只能访问自己的训练session"""
    # 创建两个用户和各自的session
    # 用户A尝试访问用户B的session应返回403
    pass  # 需要完整的测试实现
```

- [ ] **Step 3: 运行测试确认失败**

运行：`pytest backend/tests/test_training_api.py -v`
预期：FAIL with "401 Unauthorized" 未返回

- [ ] **Step 4: 实施修复**

修改`backend/app/api/training.py`：

```python
# 添加认证依赖
from app.api.deps import get_current_user

# 修改get_next_item端点
@router.get("/sessions/{session_id}/next", response_model=ApiResponse)
async def get_next_item(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),  # 添加认证
):
    service = TrainingService(db)
    
    # 验证session归属
    session = await service.get_session(session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail={"code": 40301, "message": "无权访问该训练session"})
    
    item = await service.select_next_item(session_id)
    if not item:
        raise HTTPException(status_code=404, detail={"code": 40401, "message": "没有更多题目"})
    
    return {"code": 0, "data": item, "message": "ok"}

# 类似地修改submit_answer和finish_session端点
```

- [ ] **Step 5: 运行测试确认通过**

运行：`pytest backend/tests/test_training_api.py -v`
预期：PASS

- [ ] **Step 6: 提交**

```bash
git add backend/app/api/training.py backend/tests/test_training_api.py
git commit -m "fix: 为训练API添加认证和session归属校验，防止水平越权"
```

---

## Task 4: 修复Alembic downgrade bug (P0)

**Files:**
- Modify: `backend/alembic/versions/001_init_tables.py:124`
- Test: 手动测试数据库迁移

- [ ] **Step 1: 分析问题**

查看`001_init_tables.py:124`行：
```python
op.create_table("user_abilities")  # 错误：应该是drop_table
```

问题：downgrade时创建表而不是删除表，导致回滚失败

- [ ] **Step 2: 实施修复**

修改`backend/alembic/versions/001_init_tables.py:124`行：
```python
# 修复前
op.create_table("user_abilities")

# 修复后
op.drop_table("user_abilities")
```

- [ ] **Step 3: 验证修复**

1. 测试upgrade：`alembic upgrade head`
2. 测试downgrade：`alembic downgrade -1`
3. 再次upgrade：`alembic upgrade head`
4. 确认没有错误

- [ ] **Step 4: 提交**

```bash
git add backend/alembic/versions/001_init_tables.py
git commit -m "fix: 修复Alembic downgrade中user_abilities表操作错误"
```

---

## Task 5: 修复健康检查状态码 (P0)

**Files:**
- Modify: `backend/app/api/health.py:67-73`
- Test: `backend/tests/test_health.py`

- [ ] **Step 1: 分析问题**

查看`health.py:67-73`行：
```python
status_code = 200 if overall_healthy else 503
return success_response(
    data=health_status,
    message="健康检查完成",
)
```

问题：`status_code`变量未被使用，`success_response`总是返回200

- [ ] **Step 2: 编写失败测试**

```python
# backend/tests/test_health.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_health_check_degraded_returns_503():
    """测试健康检查degraded状态返回503"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # 模拟Redis不可用
        with patch('app.core.redis.redis_client.ping', side_effect=Exception("Redis不可用")):
            response = await client.get("/api/health/detailed")
            
        assert response.status_code == 503
        data = response.json()
        assert data["data"]["status"] == "degraded"
```

- [ ] **Step 3: 运行测试确认失败**

运行：`pytest backend/tests/test_health.py -v`
预期：FAIL with "assert 200 == 503"

- [ ] **Step 4: 实施修复**

修改`backend/app/api/health.py`：

```python
from fastapi.responses import JSONResponse

@router.get("/health/detailed")
async def detailed_health_check():
    # ... 现有代码 ...
    
    health_status["status"] = "healthy" if overall_healthy else "degraded"
    
    response_data = {
        "code": 0,
        "data": health_status,
        "message": "健康检查完成",
    }
    
    if overall_healthy:
        return response_data
    else:
        return JSONResponse(
            status_code=503,
            content=response_data,
        )
```

- [ ] **Step 5: 运行测试确认通过**

运行：`pytest backend/tests/test_health.py -v`
预期：PASS

- [ ] **Step 6: 提交**

```bash
git add backend/app/api/health.py backend/tests/test_health.py
git commit -m "fix: 修复健康检查degraded状态返回错误状态码"
```

---

## Task 6: 修复对话API IDOR漏洞 (P1)

**Files:**
- Modify: `backend/app/api/dialogue.py:54-103`
- Test: `backend/tests/test_dialogue_api.py`

- [ ] **Step 1: 分析问题**

查看`dialogue.py:54-103`行，`handle_turn`和`finish_session`端点有认证但未验证session归属

问题：用户A可向用户B的对话session提交语音（IDOR）

- [ ] **Step 2: 编写失败测试**

```python
# backend/tests/test_dialogue_api.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_dialogue_session_ownership():
    """测试用户只能访问自己的对话session"""
    # 创建用户A和用户B的session
    # 用户A尝试访问用户B的session应返回403
    pass  # 需要完整的测试实现
```

- [ ] **Step 3: 实施修复**

修改`backend/app/api/dialogue.py`：

```python
# 在handle_turn和finish_session中添加session归属校验
@router.post("/sessions/{session_id}/turn", response_model=ApiResponse)
async def handle_turn(
    session_id: int,
    # ... 其他参数 ...
    current_user=Depends(get_current_user),
):
    service = DialogueService(db)
    
    # 验证session归属
    session = await service.get_session(session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail={"code": 40301, "message": "无权访问该对话session"})
    
    # ... 继续处理 ...
```

- [ ] **Step 4: 提交**

```bash
git add backend/app/api/dialogue.py backend/tests/test_dialogue_api.py
git commit -m "fix: 修复对话API IDOR漏洞，添加session归属校验"
```

---

## Task 7: 修复流式输出安全检查滞后 (P1)

**Files:**
- Modify: `backend/app/ai/llm_gateway.py:350-355`
- Test: 手动测试

- [ ] **Step 1: 分析问题**

查看`llm_gateway.py:350-355`行，流式输出时安全检查滞后，不安全内容已发送后才拦截

- [ ] **Step 2: 实施修复**

修改流式输出逻辑，在发送前进行安全检查：

```python
# 在发送每个chunk前进行安全检查
async for chunk in stream:
    if not await self._check_safety(chunk):
        yield {"error": "内容安全检查未通过"}
        return
    yield chunk
```

- [ ] **Step 3: 提交**

```bash
git add backend/app/ai/llm_gateway.py
git commit -m "fix: 修复流式输出安全检查滞后问题"
```

---

## Task 8: Token迁移到httpOnly Cookie (P1)

**Files:**
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/stores/authStore.ts`
- Test: 手动测试

- [ ] **Step 1: 分析问题**

当前token存储在localStorage，在XSS场景下可直接窃取

- [ ] **Step 2: 实施修复**

1. 后端设置httpOnly cookie
2. 前端移除localStorage中的token存储
3. 前端请求自动携带cookie

- [ ] **Step 3: 提交**

```bash
git add frontend/src/services/api.ts frontend/src/stores/authStore.ts
git commit -m "fix: 将token迁移到httpOnly cookie，提高安全性"
```

---

## Task 9: 修改DEBUG默认值 (P1)

**Files:**
- Modify: `backend/app/core/config.py:34`

- [ ] **Step 1: 实施修复**

修改`backend/app/core/config.py:34`行：
```python
# 修复前
DEBUG: bool = True

# 修复后
DEBUG: bool = False
```

- [ ] **Step 2: 提交**

```bash
git add backend/app/core/config.py
git commit -m "fix: 将DEBUG默认值改为False"
```

---

## Task 10: Docker密码外部化 (P1)

**Files:**
- Modify: `backend/docker-compose.yml`

- [ ] **Step 1: 实施修复**

将硬编码密码改为环境变量引用：

```yaml
# 修复前
environment:
  POSTGRES_PASSWORD: mysecretpassword

# 修复后
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

- [ ] **Step 2: 提交**

```bash
git add backend/docker-compose.yml
git commit -m "fix: Docker密码外部化，使用环境变量"
```

---

## Task 11: 验证码改用secrets + 6位 (P1)

**Files:**
- Modify: `backend/app/services/auth_service.py:27`

- [ ] **Step 1: 实施修复**

修改`backend/app/services/auth_service.py:27`行：
```python
# 修复前
import random
code = f"{random.randint(1000, 9999)}"

# 修复后
import secrets
code = f"{secrets.randbelow(900000) + 100000}"  # 6位验证码
```

- [ ] **Step 2: 提交**

```bash
git add backend/app/services/auth_service.py
git commit -m "fix: 验证码改用secrets模块，增加到6位"
```

---

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

---

> **注意：** 本计划基于上线前全检报告中的问题制定，修复后系统可安全部署。建议修复后进行完整的回归测试。
