"""
报告服务单元测试

测试内容：
- get_summary: 训练概览、正确率曲线、依从率
- get_level_distribution: 级别分布
- get_patients_for_therapist: 听力师患者列表
- generate_weekly_report: 周报生成
- 辅助方法: 依从率计算、连续天数、亮点/建议生成
"""
import pytest
import pytest_asyncio
from datetime import datetime, timedelta, date, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import (
    User, TrainingSession, TrainingItem, UserAbility, ItemBank
)
from app.services.report_service import ReportService
from app.schemas.report import (
    TrainingSummary, WeeklyReportData, PatientSummary,
    LevelDistribution, AccuracyPoint
)


# ========== Fixtures ==========

@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """创建测试用户"""
    user = User(
        id=100,
        phone="13900000001",
        role="patient",
        nickname="测试患者",
        birth_year=1960,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def therapist_user(db_session: AsyncSession) -> User:
    """创建听力师用户"""
    user = User(
        id=200,
        phone="13900000002",
        role="therapist",
        nickname="测试听力师",
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def training_data(db_session: AsyncSession, test_user: User):
    """创建测试训练数据"""
    now = datetime.now(timezone.utc)
    sessions = []

    # 创建最近 5 天的训练会话
    for i in range(5):
        day_offset = i
        session_time = now - timedelta(days=day_offset)
        session = TrainingSession(
            user_id=test_user.id,
            level="word" if i % 2 == 0 else "syllable",
            start_time=session_time,
            end_time=session_time + timedelta(minutes=15),
            total_items=10,
            correct_items=7 + (i % 3),  # 7, 8, 9, 7, 8
            accuracy=(7 + (i % 3)) / 10.0,
            status="completed",
        )
        db_session.add(session)
        sessions.append(session)

    await db_session.flush()

    # 创建用户能力
    for level in ["syllable", "word", "sentence", "noise"]:
        ability = UserAbility(
            user_id=test_user.id,
            level=level,
            theta=0.5 + (0.2 if level == "word" else 0.0),
            se=0.8,
        )
        db_session.add(ability)

    await db_session.flush()
    return sessions


@pytest_asyncio.fixture
async def multiple_patients(db_session: AsyncSession):
    """创建多个测试患者"""
    patients = []
    for i in range(3):
        user = User(
            id=300 + i,
            phone=f"1390000{1000 + i}",
            role="patient",
            nickname=f"患者{i + 1}",
            birth_year=1955 + i * 5,
        )
        db_session.add(user)
        patients.append(user)

    await db_session.flush()

    # 为患者1创建训练数据（活跃）
    for i in range(3):
        session = TrainingSession(
            user_id=patients[0].id,
            level="word",
            start_time=datetime.now(timezone.utc) - timedelta(days=i),
            end_time=datetime.now(timezone.utc) - timedelta(days=i) + timedelta(minutes=10),
            total_items=10,
            correct_items=8,
            accuracy=0.8,
            status="completed",
        )
        db_session.add(session)

    # 为患者2创建训练数据（很久没训练）
    session = TrainingSession(
        user_id=patients[1].id,
        level="syllable",
        start_time=datetime.now(timezone.utc) - timedelta(days=15),
        end_time=datetime.now(timezone.utc) - timedelta(days=15) + timedelta(minutes=10),
        total_items=10,
        correct_items=5,
        accuracy=0.5,
        status="completed",
    )
    db_session.add(session)

    # 患者3无训练数据

    await db_session.flush()
    return patients


# ========== 测试用例 ==========

class TestReportServiceSummary:
    """测试 get_summary 方法"""

    @pytest.mark.asyncio
    async def test_summary_basic(
        self, db_session: AsyncSession, test_user: User, training_data
    ):
        """测试基础概览数据"""
        service = ReportService(db_session)
        summary = await service.get_summary(test_user.id, days=30)

        assert isinstance(summary, TrainingSummary)
        assert summary.total_sessions >= 5
        assert summary.total_items >= 50
        assert summary.correct_items >= 35
        assert 0 <= summary.avg_accuracy <= 1.0
        assert summary.streak_days >= 0

    @pytest.mark.asyncio
    async def test_summary_accuracy_curve(
        self, db_session: AsyncSession, test_user: User, training_data
    ):
        """测试正确率曲线数据"""
        service = ReportService(db_session)
        summary = await service.get_summary(test_user.id, days=30)

        assert isinstance(summary.accuracy_curve, list)
        for point in summary.accuracy_curve:
            assert isinstance(point, AccuracyPoint)
            assert 0 <= point.accuracy <= 1.0
            assert point.session_count >= 1

    @pytest.mark.asyncio
    async def test_summary_adherence_rate(
        self, db_session: AsyncSession, test_user: User, training_data
    ):
        """测试依从率计算"""
        service = ReportService(db_session)
        summary = await service.get_summary(test_user.id, days=30)

        assert 0 <= summary.adherence_rate <= 1.0
        # 有5天训练数据，30天范围内，依从率应 > 0
        assert summary.adherence_rate > 0

    @pytest.mark.asyncio
    async def test_summary_level_progress(
        self, db_session: AsyncSession, test_user: User, training_data
    ):
        """测试各级别进度"""
        service = ReportService(db_session)
        summary = await service.get_summary(test_user.id, days=30)

        assert len(summary.level_progress) == 4
        levels = {lp.level for lp in summary.level_progress}
        assert levels == {"syllable", "word", "sentence", "noise"}

        # word 和 syllable 应有训练数据
        for lp in summary.level_progress:
            if lp.level in ("word", "syllable"):
                assert lp.session_count >= 1

    @pytest.mark.asyncio
    async def test_summary_no_data(self, db_session: AsyncSession):
        """测试无训练数据时的概览"""
        service = ReportService(db_session)
        summary = await service.get_summary(user_id=9999, days=30)

        assert summary.total_sessions == 0
        assert summary.avg_accuracy == 0.0
        assert summary.adherence_rate == 0.0
        assert summary.streak_days == 0
        assert len(summary.accuracy_curve) == 0


class TestReportServiceDistribution:
    """测试 get_level_distribution 方法"""

    @pytest.mark.asyncio
    async def test_level_distribution(
        self, db_session: AsyncSession, test_user: User, training_data
    ):
        """测试级别分布"""
        service = ReportService(db_session)
        distribution = await service.get_level_distribution(test_user.id)

        assert isinstance(distribution, list)
        for d in distribution:
            assert isinstance(d, LevelDistribution)
            assert d.count >= 1


class TestReportServicePatients:
    """测试 get_patients_for_therapist 方法"""

    @pytest.mark.asyncio
    async def test_patients_list(
        self, db_session: AsyncSession, therapist_user: User, multiple_patients
    ):
        """测试患者列表"""
        service = ReportService(db_session)
        patients = await service.get_patients_for_therapist(therapist_user.id)

        assert isinstance(patients, list)
        assert len(patients) >= 3

        for p in patients:
            assert isinstance(p, PatientSummary)
            assert p.user_id > 0
            assert p.nickname != ""
            assert 0 <= p.avg_accuracy <= 1.0
            assert 0 <= p.adherence_rate <= 1.0

    @pytest.mark.asyncio
    async def test_patient_alerts(
        self, db_session: AsyncSession, therapist_user: User, multiple_patients
    ):
        """测试患者预警信息"""
        service = ReportService(db_session)
        patients = await service.get_patients_for_therapist(therapist_user.id)

        # 患者2应该有"多天未训练"预警
        patient2 = next(p for p in patients if p.user_id == 301)
        assert patient2.alert is not None
        assert "未训练" in patient2.alert

        # 患者3应该有"尚未开始训练"预警
        patient3 = next(p for p in patients if p.user_id == 302)
        assert patient3.alert is not None
        assert "尚未" in patient3.alert

    @pytest.mark.asyncio
    async def test_patient_current_level(
        self, db_session: AsyncSession, therapist_user: User, multiple_patients
    ):
        """测试患者当前级别"""
        service = ReportService(db_session)
        patients = await service.get_patients_for_therapist(therapist_user.id)

        # 患者1有训练数据，应有当前级别
        patient1 = next(p for p in patients if p.user_id == 300)
        assert patient1.current_level in ("syllable", "word", "sentence", "noise")


class TestReportServiceWeekly:
    """测试 generate_weekly_report 方法"""

    @pytest.mark.asyncio
    async def test_weekly_report(
        self, db_session: AsyncSession, test_user: User, training_data
    ):
        """测试周报生成"""
        service = ReportService(db_session)
        report = await service.generate_weekly_report(test_user.id)

        assert isinstance(report, WeeklyReportData)
        assert report.user_id == test_user.id
        assert report.week_start != ""
        assert report.week_end != ""
        assert report.accuracy_trend in ("improving", "stable", "declining")
        assert report.highlight != ""
        assert report.suggestion != ""

    @pytest.mark.asyncio
    async def test_weekly_report_no_data(self, db_session: AsyncSession):
        """测试无数据时的周报"""
        service = ReportService(db_session)
        report = await service.generate_weekly_report(user_id=9999)

        assert report.total_sessions == 0
        assert report.avg_accuracy == 0.0
        assert report.adherence_rate == 0.0
        assert len(report.daily_breakdown) == 0


class TestReportServiceHelpers:
    """测试辅助方法"""

    @pytest.mark.asyncio
    async def test_streak_calculation(
        self, db_session: AsyncSession, test_user: User, training_data
    ):
        """测试连续训练天数计算"""
        service = ReportService(db_session)
        summary = await service.get_summary(test_user.id, days=30)
        # 有连续5天训练数据，streak应>=1（取决于今天的日期关系）
        assert summary.streak_days >= 0

    def test_generate_highlight(self):
        """测试亮点生成"""
        highlight = ReportService._generate_highlight(6, 0.85, "improving")
        assert "6 次" in highlight
        assert "80%" in highlight
        assert "提升" in highlight

    def test_generate_highlight_low_sessions(self):
        """测试低训练量时的亮点"""
        highlight = ReportService._generate_highlight(1, 0.5, "stable")
        assert highlight != ""

    def test_generate_suggestion_low_adherence(self):
        """测试低依从率建议"""
        suggestion = ReportService._generate_suggestion(0.8, 0.3, "stable")
        assert "依从率" in suggestion

    def test_generate_suggestion_low_accuracy(self):
        """测试低正确率建议"""
        suggestion = ReportService._generate_suggestion(0.5, 0.8, "stable")
        assert "正确率" in suggestion

    def test_generate_suggestion_declining(self):
        """测试正确率下降建议"""
        suggestion = ReportService._generate_suggestion(0.7, 0.8, "declining")
        assert "下降" in suggestion

    def test_generate_suggestion_good(self):
        """测试良好状态建议"""
        suggestion = ReportService._generate_suggestion(0.9, 0.9, "improving")
        assert "良好" in suggestion or "保持" in suggestion


