"""
DialogueService 单元测试

测试内容：
- list_scenarios: 获取场景列表
- start_session: 开始对话会话
- handle_turn: 处理对话轮次
- finish_session: 结束对话会话
"""
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.dialogue_service import DialogueService, SCENARIOS


@pytest.fixture
def mock_db():
    """模拟数据库会话"""
    db = AsyncMock(spec=AsyncSession)
    db.execute = AsyncMock()
    db.flush = AsyncMock()
    db.add = MagicMock()
    return db


@pytest.fixture
def mock_redis():
    """模拟Redis客户端"""
    redis = AsyncMock()
    redis.get = AsyncMock()
    redis.set = AsyncMock()
    redis.delete = AsyncMock()
    redis.setex = AsyncMock()
    return redis


@pytest.fixture
def dialogue_service(mock_db, mock_redis):
    """创建 DialogueService 实例"""
    return DialogueService(mock_db, redis_client=mock_redis)


class TestListScenarios:
    """测试 list_scenarios 方法"""

    @pytest.mark.asyncio
    async def test_list_scenarios_success(self, dialogue_service):
        """测试成功获取场景列表"""
        scenarios = await dialogue_service.list_scenarios()

        assert isinstance(scenarios, list)
        assert len(scenarios) == 5  # 5个场景

        # 验证场景结构
        for scenario in scenarios:
            assert 'id' in scenario
            assert 'name' in scenario
            assert 'description' in scenario
            assert 'rounds' in scenario

    @pytest.mark.asyncio
    async def test_list_scenarios_contains_all(self, dialogue_service):
        """测试包含所有场景"""
        scenarios = await dialogue_service.list_scenarios()
        scenario_ids = [s['id'] for s in scenarios]

        assert 'ordering' in scenario_ids
        assert 'directions' in scenario_ids
        assert 'phone' in scenario_ids
        assert 'shopping' in scenario_ids
        assert 'daily' in scenario_ids


class TestStartSession:
    """测试 start_session 方法"""

    @pytest.mark.asyncio
    async def test_start_session_success(self, dialogue_service, mock_db):
        """测试成功开始对话会话"""
        with patch('app.services.dialogue_orchestrator.tts_gateway') as mock_tts:
            mock_tts.synthesize_to_url = AsyncMock(return_value='http://example.com/audio.wav')

            result = await dialogue_service.start_session(1, 'ordering')

            assert result['scenario'] == 'ordering'
            assert 'session_id' in result
            assert 'greeting_text' in result
            assert result['greeting_text'] != ''
            mock_db.add.assert_called()
            mock_db.flush.assert_called()

    @pytest.mark.asyncio
    async def test_start_session_invalid_scenario(self, dialogue_service):
        """测试无效场景时抛出异常"""
        with pytest.raises(ValueError) as exc_info:
            await dialogue_service.start_session(1, 'invalid_scenario')

        assert '未知场景' in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_start_session_tts_failure(self, dialogue_service, mock_db):
        """测试TTS失败时仍能开始会话"""
        with patch('app.services.dialogue_orchestrator.tts_gateway') as mock_tts:
            mock_tts.synthesize_to_url = AsyncMock(side_effect=Exception('TTS失败'))

            result = await dialogue_service.start_session(1, 'ordering')

            assert result['scenario'] == 'ordering'
            assert result['greeting_audio_url'] is None


class TestHandleTurn:
    """测试 handle_turn 方法"""

    @pytest.mark.asyncio
    async def test_handle_turn_success(self, dialogue_service, mock_db, mock_redis):
        """测试成功处理对话轮次"""
        # 模拟会话
        mock_session = MagicMock()
        mock_session.id = 1
        mock_session.user_id = 1
        mock_session.scenario = 'ordering'
        mock_session.turn_count = 0
        mock_session.status = "active"
        mock_result1 = MagicMock()
        mock_result1.scalar_one_or_none.return_value = mock_session

        # 模拟Redis上下文
        mock_redis.get.return_value = None

        # handle_turn 会查询两次：1) 会话；2) Redis 无上下文时降级读取 DB 历史
        mock_result2 = MagicMock()
        mock_result2.scalars.return_value.all.return_value = []
        mock_db.execute.side_effect = [mock_result1, mock_result2]

        with patch('app.services.dialogue_orchestrator.asr_gateway') as mock_asr:
            mock_asr.recognize = AsyncMock(return_value=MagicMock(text='你好', confidence=0.9))

            with patch('app.services.dialogue_orchestrator.llm_gateway') as mock_llm:
                mock_llm.chat = AsyncMock(return_value=MagicMock(content='你好！欢迎光临！'))

                with patch('app.services.dialogue_orchestrator.tts_gateway') as mock_tts:
                    mock_tts.synthesize_to_url = AsyncMock(return_value='http://example.com/reply.wav')

                    result = await dialogue_service.handle_turn(1, b'audio_data')

                    assert 'user_text' in result
                    assert 'ai_text' in result
                    assert result['user_text'] == '你好'

    @pytest.mark.asyncio
    async def test_handle_turn_session_not_found(self, dialogue_service, mock_db):
        """测试会话不存在时抛出异常"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        with pytest.raises(ValueError) as exc_info:
            await dialogue_service.handle_turn(999, b'audio_data')

        assert '会话不存在' in str(exc_info.value)


class TestFinishSession:
    """测试 finish_session 方法"""

    @pytest.mark.asyncio
    async def test_finish_session_success(self, dialogue_service, mock_db, mock_redis):
        """测试成功结束对话会话"""
        # 模拟会话
        mock_session = MagicMock()
        mock_session.id = 1
        mock_session.user_id = 1
        mock_session.scenario = 'ordering'
        mock_session.turn_count = 3
        mock_session.started_at = MagicMock()
        mock_result1 = MagicMock()
        mock_result1.scalar_one_or_none.return_value = mock_session

        # 模拟对话轮次
        mock_turns = [
            MagicMock(turn_index=1, user_text='你好', ai_text='你好！'),
            MagicMock(turn_index=2, user_text='我要点餐', ai_text='好的，请问您想吃什么？'),
        ]
        mock_result2 = MagicMock()
        mock_result2.scalars.return_value.all.return_value = mock_turns

        mock_db.execute.side_effect = [mock_result1, mock_result2]

        with patch('app.services.dialogue_orchestrator.llm_gateway') as mock_llm:
            mock_llm.chat = AsyncMock(return_value=MagicMock(content='您完成了对话练习，表现不错！'))

            result = await dialogue_service.finish_session(1)

            assert 'session_id' in result
            assert 'scenario' in result
            assert 'turn_count' in result
            assert 'summary' in result
            assert result['turn_count'] == 3

    @pytest.mark.asyncio
    async def test_finish_session_not_found(self, dialogue_service, mock_db):
        """测试会话不存在时抛出异常"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        with pytest.raises(ValueError) as exc_info:
            await dialogue_service.finish_session(999)

        assert '会话不存在' in str(exc_info.value)




