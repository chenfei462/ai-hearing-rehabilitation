"""
TrainingService 单元测试

测试内容：
- start_session: 开始训练会话
- get_user_ability: 获取用户能力
- select_next_item: 选择下一题
- submit_answer: 提交答案
- finish_session: 结束会话
"""
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.training_service import TrainingService
from app.models.training import TrainingSession, TrainingItem
from app.models.item_bank import ItemBank
from app.models.ability import UserAbility


@pytest.fixture
def mock_db():
    """模拟数据库会话"""
    db = AsyncMock(spec=AsyncSession)
    db.execute = AsyncMock()
    db.flush = AsyncMock()
    db.add = MagicMock()
    return db


@pytest.fixture
def training_service(mock_db):
    """创建 TrainingService 实例"""
    return TrainingService(mock_db)


class TestStartSession:
    """测试 start_session 方法"""

    @pytest.mark.asyncio
    async def test_start_session_success(self, training_service, mock_db):
        """测试成功开始训练会话"""
        session = await training_service.start_session(1, 'syllable')

        assert session.user_id == 1
        assert session.level == 'syllable'
        assert session.status == 'active'
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()

    @pytest.mark.asyncio
    async def test_start_session_different_levels(self, training_service, mock_db):
        """测试开始不同级别的训练会话"""
        for level in ['syllable', 'word', 'sentence', 'noise']:
            session = await training_service.start_session(1, level)
            assert session.level == level


class TestGetUserAbility:
    """测试 get_user_ability 方法"""

    @pytest.mark.asyncio
    async def test_get_user_ability_exists(self, training_service, mock_db):
        """测试获取已存在的用户能力"""
        mock_ability = UserAbility(user_id=1, level='syllable', theta=0.5, se=0.8)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_ability
        mock_db.execute.return_value = mock_result

        ability = await training_service.get_user_ability(1, 'syllable')

        assert ability.theta == 0.5
        assert ability.se == 0.8

    @pytest.mark.asyncio
    async def test_get_user_ability_not_exists(self, training_service, mock_db):
        """测试获取不存在的用户能力"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        ability = await training_service.get_user_ability(1, 'syllable')

        assert ability is None


class TestSelectNextItem:
    """测试 select_next_item 方法"""

    @pytest.mark.asyncio
    async def test_select_next_item_success(self, training_service, mock_db):
        """测试成功选择下一题"""
        # 模拟会话
        mock_session = TrainingSession(id=1, user_id=1, level='syllable')
        mock_result1 = MagicMock()
        mock_result1.scalar_one_or_none.return_value = mock_session

        # 模拟用户能力
        mock_ability = UserAbility(user_id=1, level='syllable', theta=0.0, se=1.0)
        mock_result2 = MagicMock()
        mock_result2.scalar_one_or_none.return_value = mock_ability

        # 模拟题目列表
        mock_items = [
            ItemBank(id=1, level='syllable', text='ma', difficulty_b=-1.0),
            ItemBank(id=2, level='syllable', text='ba', difficulty_b=0.0),
        ]
        mock_result3 = MagicMock()
        mock_result3.scalars.return_value.all.return_value = mock_items

        mock_db.execute.side_effect = [mock_result1, mock_result2, mock_result3]

        with patch('app.services.training_service.irt_engine') as mock_irt:
            mock_irt.select_next_item.return_value = 1

            item = await training_service.select_next_item(1)

            assert item is not None
            assert item['id'] == 1

    @pytest.mark.asyncio
    async def test_select_next_item_session_not_found(self, training_service, mock_db):
        """测试会话不存在时返回None"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        item = await training_service.select_next_item(999)

        assert item is None

    @pytest.mark.asyncio
    async def test_select_next_item_no_items(self, training_service, mock_db):
        """测试没有可用题目时"""
        mock_session = TrainingSession(id=1, user_id=1, level='syllable')
        mock_result1 = MagicMock()
        mock_result1.scalar_one_or_none.return_value = mock_session

        mock_ability = UserAbility(user_id=1, level='syllable', theta=0.0, se=1.0)
        mock_result2 = MagicMock()
        mock_result2.scalar_one_or_none.return_value = mock_ability

        mock_result3 = MagicMock()
        mock_result3.scalars.return_value.all.return_value = []

        mock_db.execute.side_effect = [mock_result1, mock_result2, mock_result3]

        item = await training_service.select_next_item(1)

        assert item is None


class TestSubmitAnswer:
    """测试 submit_answer 方法"""

    @pytest.mark.asyncio
    async def test_submit_answer_correct(self, training_service, mock_db):
        """测试提交正确答案"""
        # 模拟题目
        mock_item = ItemBank(id=1, text='ma', difficulty_b=-1.0)
        mock_result1 = MagicMock()
        mock_result1.scalar_one_or_none.return_value = mock_item

        # 模拟会话
        mock_session = TrainingSession(id=1, user_id=1, level='syllable')
        mock_result2 = MagicMock()
        mock_result2.scalar_one.return_value = mock_session

        # 模拟用户能力
        mock_ability = UserAbility(user_id=1, level='syllable', theta=0.0, se=1.0)
        mock_result3 = MagicMock()
        mock_result3.scalar_one_or_none.return_value = mock_ability

        # 模拟最近作答记录
        mock_result4 = MagicMock()
        mock_result4.all.return_value = [(True,)]

        mock_db.execute.side_effect = [mock_result1, mock_result2, mock_result3, mock_result4]

        with patch('app.services.training_service.irt_engine') as mock_irt:
            mock_irt.estimate_ability.return_value = (0.5, 0.8)
            mock_irt.decide_next_action.return_value = MagicMock(action='continue')

            result = await training_service.submit_answer(1, 1, 'ma', 1000)

            assert result['is_correct'] is True
            assert result['theta'] == 0.5
            assert result['next_action'] == 'continue'

    @pytest.mark.asyncio
    async def test_submit_answer_wrong(self, training_service, mock_db):
        """测试提交错误答案"""
        mock_item = ItemBank(id=1, text='ma', difficulty_b=-1.0)
        mock_result1 = MagicMock()
        mock_result1.scalar_one_or_none.return_value = mock_item

        mock_session = TrainingSession(id=1, user_id=1, level='syllable')
        mock_result2 = MagicMock()
        mock_result2.scalar_one.return_value = mock_session

        mock_ability = UserAbility(user_id=1, level='syllable', theta=0.0, se=1.0)
        mock_result3 = MagicMock()
        mock_result3.scalar_one_or_none.return_value = mock_ability

        mock_result4 = MagicMock()
        mock_result4.all.return_value = [(False,)]

        mock_db.execute.side_effect = [mock_result1, mock_result2, mock_result3, mock_result4]

        with patch('app.services.training_service.irt_engine') as mock_irt:
            mock_irt.estimate_ability.return_value = (-0.5, 0.8)
            mock_irt.decide_next_action.return_value = MagicMock(action='continue')

            result = await training_service.submit_answer(1, 1, 'ba', 2000)

            assert result['is_correct'] is False
            assert result['theta'] == -0.5


class TestFinishSession:
    """测试 finish_session 方法"""

    @pytest.mark.asyncio
    async def test_finish_session_success(self, training_service, mock_db):
        """测试成功结束训练会话"""
        mock_session = TrainingSession(id=1, user_id=1, level='syllable', status='active')
        mock_result1 = MagicMock()
        mock_result1.scalar_one.return_value = mock_session

        mock_stats = MagicMock()
        mock_stats.total = 10
        mock_stats.correct = 8
        mock_result2 = MagicMock()
        mock_result2.one.return_value = mock_stats

        mock_db.execute.side_effect = [mock_result1, mock_result2]

        result = await training_service.finish_session(1)

        assert result['accuracy'] == 0.8
        assert result['total_items'] == 10
        assert result['correct_items'] == 8
        assert mock_session.status == 'completed'

    @pytest.mark.asyncio
    async def test_finish_session_no_items(self, training_service, mock_db):
        """测试结束没有作答记录的会话"""
        mock_session = TrainingSession(id=1, user_id=1, level='syllable', status='active')
        mock_result1 = MagicMock()
        mock_result1.scalar_one.return_value = mock_session

        mock_stats = MagicMock()
        mock_stats.total = 0
        mock_stats.correct = 0
        mock_result2 = MagicMock()
        mock_result2.one.return_value = mock_stats

        mock_db.execute.side_effect = [mock_result1, mock_result2]

        result = await training_service.finish_session(1)

        assert result['accuracy'] == 0
        assert result['total_items'] == 0
        assert result['correct_items'] == 0


