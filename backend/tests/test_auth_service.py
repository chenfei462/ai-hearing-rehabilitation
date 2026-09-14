"""
AuthService 单元测试

测试内容：
- send_sms: 发送短信验证码
- verify_sms: 验证短信验证码
- get_or_create_user: 获取或创建用户
- login: 登录流程
- update_preferences: 更新用户偏好
"""
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.auth_service import AuthService
from app.models.user import User
from app.models.ability import UserAbility
from app.core.errors import AppException, ErrorCode


@pytest.fixture
def mock_db():
    """模拟数据库会话"""
    db = AsyncMock(spec=AsyncSession)
    db.execute = AsyncMock()
    db.flush = AsyncMock()
    db.add = MagicMock()
    return db


@pytest.fixture
def auth_service(mock_db):
    """创建 AuthService 实例"""
    return AuthService(mock_db)


class TestSendSms:
    """测试 send_sms 方法"""

    @pytest.mark.asyncio
    async def test_send_sms_success(self, auth_service):
        """测试成功发送短信"""
        with patch('app.services.auth_service.get_redis') as mock_redis:
            mock_redis_client = AsyncMock()
            mock_redis.return_value = mock_redis_client
            mock_redis_client.setex = AsyncMock()

            result = await auth_service.send_sms('13800138000')

            assert result is True
            mock_redis_client.setex.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_sms_redis_unavailable(self, auth_service):
        """测试Redis不可用时抛出异常"""
        with patch('app.services.auth_service.get_redis') as mock_redis:
            mock_redis.side_effect = Exception('Redis连接失败')

            with pytest.raises(AppException) as exc_info:
                await auth_service.send_sms('13800138000')

            assert exc_info.value.code == ErrorCode.REDIS_UNAVAILABLE
            assert exc_info.value.http_status == 503


class TestVerifySms:
    """测试 verify_sms 方法"""

    @pytest.mark.asyncio
    async def test_verify_sms_success_with_string(self, auth_service):
        """测试验证码验证成功 (Redis decode_responses=True 模式)

        Redis 配置 decode_responses=True 时，get() 返回字符串而非字节。
        """
        with patch('app.services.auth_service.get_redis') as mock_redis:
            mock_redis_client = AsyncMock()
            mock_redis.return_value = mock_redis_client
            mock_redis_client.get.return_value = '1234'
            mock_redis_client.delete = AsyncMock()

            result = await auth_service.verify_sms('13800138000', '1234')

            assert result is True
            mock_redis_client.delete.assert_called_once_with('sms:13800138000')

    @pytest.mark.asyncio
    async def test_verify_sms_wrong_code(self, auth_service):
        """测试验证码错误"""
        with patch('app.services.auth_service.get_redis') as mock_redis:
            mock_redis_client = AsyncMock()
            mock_redis.return_value = mock_redis_client
            mock_redis_client.get.return_value = '1234'

            result = await auth_service.verify_sms('13800138000', '9999')

            assert result is False

    @pytest.mark.asyncio
    async def test_verify_sms_code_expired(self, auth_service):
        """测试验证码已过期"""
        with patch('app.services.auth_service.get_redis') as mock_redis:
            mock_redis_client = AsyncMock()
            mock_redis.return_value = mock_redis_client
            mock_redis_client.get.return_value = None

            result = await auth_service.verify_sms('13800138000', '1234')

            assert result is False

    @pytest.mark.asyncio
    async def test_verify_sms_redis_unavailable(self, auth_service):
        """测试Redis不可用时抛出异常"""
        with patch('app.services.auth_service.get_redis') as mock_redis:
            mock_redis.side_effect = Exception('Redis连接失败')

            with pytest.raises(AppException) as exc_info:
                await auth_service.verify_sms('13800138000', '1234')

            assert exc_info.value.code == ErrorCode.REDIS_UNAVAILABLE


class TestGetOrCreateUser:
    """测试 get_or_create_user 方法"""

    @pytest.mark.asyncio
    async def test_get_existing_user(self, auth_service, mock_db):
        """测试获取已存在的用户"""
        mock_user = User(id=1, phone='13800138000', nickname='测试用户')
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_db.execute.return_value = mock_result

        user = await auth_service.get_or_create_user('13800138000')

        assert user.id == 1
        assert user.phone == '13800138000'
        mock_db.add.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_new_user(self, auth_service, mock_db):
        """测试创建新用户"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        user = await auth_service.get_or_create_user('13800138000')

        assert mock_db.add.call_count == 5  # 1个用户 + 4个能力记录
        mock_db.flush.assert_called_once()


class TestLogin:
    """测试 login 方法"""

    @pytest.mark.asyncio
    async def test_login_success(self, auth_service):
        """测试登录成功"""
        with patch.object(auth_service, 'verify_sms', return_value=True):
            with patch.object(auth_service, 'get_or_create_user') as mock_get_user:
                mock_user = User(id=1, phone='13800138000', role='patient', nickname='测试用户')
                mock_get_user.return_value = mock_user

                with patch('app.services.auth_service.create_access_token', return_value='test-token'):
                    result = await auth_service.login('13800138000', '1234')

                    assert result is not None
                    assert result['token'] == 'test-token'
                    assert result['user']['id'] == 1
                    assert result['user']['phone'] == '13800138000'

    @pytest.mark.asyncio
    async def test_login_wrong_code(self, auth_service):
        """测试验证码错误登录失败"""
        with patch.object(auth_service, 'verify_sms', return_value=False):
            result = await auth_service.login('13800138000', '9999')

            assert result is None


class TestUpdatePreferences:
    """测试 update_preferences 方法"""

    @pytest.mark.asyncio
    async def test_update_preferences_new(self, auth_service, mock_db):
        """测试更新用户偏好（首次设置）"""
        mock_user = User(id=1, phone='13800138000', cochlear_info=None)

        await auth_service.update_preferences(mock_user, {'font_scale': 1.5})

        assert mock_user.cochlear_info == {'accessibility': {'font_scale': 1.5}}
        mock_db.flush.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_preferences_merge(self, auth_service, mock_db):
        """测试更新用户偏好（合并已有配置）"""
        mock_user = User(
            id=1,
            phone='13800138000',
            cochlear_info={'brand': 'Cochlear', 'accessibility': {'font_scale': 1.0}}
        )

        await auth_service.update_preferences(mock_user, {'volume': 0.8})

        assert mock_user.cochlear_info['accessibility']['font_scale'] == 1.0
        assert mock_user.cochlear_info['accessibility']['volume'] == 0.8
        assert mock_user.cochlear_info['brand'] == 'Cochlear'
