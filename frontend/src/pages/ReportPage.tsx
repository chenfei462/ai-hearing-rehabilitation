import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Alert,
  Tabs, Tab, CircularProgress, Divider, List, ListItem,
  ListItemText, ListItemAvatar, Avatar, Paper, ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Assessment, TrendingUp, Timer, FitnessCenter,
  Person, Warning, CheckCircle, TrendingFlat, TrendingDown,
} from '@mui/icons-material';
import { reportService, TrainingSummary, WeeklyReportData, PatientSummary } from '../services/reportService';
import { TrendChart, AdherenceChart, LevelProgressChart } from '../components/charts';

const LEVEL_LABELS: Record<string, string> = {
  syllable: '音节训练',
  word: '词语训练',
  sentence: '语句训练',
  noise: '噪声环境训练',
};

const LEVEL_COLORS: Record<string, string> = {
  syllable: '#4caf50',
  word: '#2196f3',
  sentence: '#ff9800',
  noise: '#f44336',
};

const TREND_ICONS: Record<string, React.ReactElement> = {
  improving: <TrendingUp sx={{ color: '#4caf50' }} />,
  stable: <TrendingFlat sx={{ color: '#ff9800' }} />,
  declining: <TrendingDown sx={{ color: '#f44336' }} />,
};

const TREND_LABELS: Record<string, string> = {
  improving: '持续提升',
  stable: '保持稳定',
  declining: '有所下降',
};

export default function ReportPage() {
  const [tab, setTab] = useState(0);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 数据状态
  const [summary, setSummary] = useState<TrainingSummary | null>(null);
  const [weekly, setWeekly] = useState<WeeklyReportData | null>(null);
  const [patients, setPatients] = useState<PatientSummary[] | null>(null);
  const [isTherapist, setIsTherapist] = useState(false);

  // 加载训练概览
  useEffect(() => {
    loadData();
  }, [days]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, weeklyRes] = await Promise.all([
        reportService.getSummary(days),
        reportService.getWeeklyReport(),
      ]);
      setSummary((summaryRes as any).data);
      setWeekly((weeklyRes as any).data);

      // 尝试加载患者列表（可能是听力师）
      try {
        const patientsRes = await reportService.getPatients();
        setPatients((patientsRes as any).data);
        setIsTherapist(true);
      } catch {
        setIsTherapist(false);
      }
    } catch (err: any) {
      setError(err.message || '加载报告数据失败');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)} 分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours} 小时 ${mins} 分钟` : `${hours} 小时`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ ml: 2 }}>加载报告数据...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
        <Typography variant="body2" sx={{ mt: 1 }}>
          请稍后重试，或联系管理员。
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      {/* 页面标题 */}
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
        训练报告
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        查看您的训练进度与数据分析
      </Typography>

      {/* 时间范围选择 */}
      <ToggleButtonGroup
        value={days}
        exclusive
        onChange={(_, val) => val && setDays(val)}
        sx={{ mb: 3 }}
      >
        <ToggleButton value={7}>近 7 天</ToggleButton>
        <ToggleButton value={30}>近 30 天</ToggleButton>
        <ToggleButton value={90}>近 90 天</ToggleButton>
      </ToggleButtonGroup>

      {/* 选项卡 */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="我的报告" />
        <Tab label="本周周报" />
        {isTherapist && <Tab label="患者管理" />}
      </Tabs>

      {/* ====== Tab 0: 我的报告 ====== */}
      {tab === 0 && summary && (
        <Box>
          {/* 统计卡片 */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <Card sx={{ textAlign: 'center', py: 2 }}>
                <Assessment sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="h4" color="primary">
                  {summary.total_sessions}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  训练次数
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card sx={{ textAlign: 'center', py: 2 }}>
                <TrendingUp sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                <Typography variant="h4" color="success.main">
                  {Math.round(summary.avg_accuracy * 100)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  平均正确率
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card sx={{ textAlign: 'center', py: 2 }}>
                <Timer sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="h4" color="warning.main">
                  {formatDuration(summary.total_duration_minutes)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  累计训练时长
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card sx={{ textAlign: 'center', py: 2 }}>
                <FitnessCenter sx={{ fontSize: 40, color: 'secondary.main', mb: 1 }} />
                <Typography variant="h4" color="secondary.main">
                  {summary.streak_days}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  连续训练天数
                </Typography>
              </Card>
            </Grid>
          </Grid>

          {/* 正确率趋势图 */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              {summary.accuracy_curve.length > 0 ? (
                <TrendChart data={summary.accuracy_curve} />
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    暂无训练数据，完成训练后将显示趋势图
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* 依从率 + 级别进度 */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <Card>
                <CardContent>
                  <AdherenceChart
                    rate={summary.adherence_rate}
                    streakDays={summary.streak_days}
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Card>
                <CardContent>
                  <LevelProgressChart data={summary.level_progress} />
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* 各级别详情 */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                各级别训练详情
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                {summary.level_progress.map((level) => (
                  <Grid item xs={12} sm={6} key={level.level}>
                    <Paper
                      sx={{
                        p: 2,
                        borderLeft: 4,
                        borderColor: LEVEL_COLORS[level.level] || '#999',
                      }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {LEVEL_LABELS[level.level] || level.level}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        训练次数: {level.session_count} | 正确率: {Math.round(level.avg_accuracy * 100)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        能力值 θ: {level.theta.toFixed(2)}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ====== Tab 1: 本周周报 ====== */}
      {tab === 1 && weekly && (
        <Box>
          {/* 周报标题 */}
          <Card sx={{ mb: 3, bgcolor: 'primary.light', color: 'white' }}>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                {weekly.week_start} ~ {weekly.week_end} 周报
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>训练次数</Typography>
                  <Typography variant="h5">{weekly.total_sessions}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>平均正确率</Typography>
                  <Typography variant="h5">{Math.round(weekly.avg_accuracy * 100)}%</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>依从率</Typography>
                  <Typography variant="h5">{Math.round(weekly.adherence_rate * 100)}%</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* 趋势和亮点 */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Card sx={{ textAlign: 'center', py: 3 }}>
                {TREND_ICONS[weekly.accuracy_trend]}
                <Typography variant="h6" sx={{ mt: 1 }}>
                  {TREND_LABELS[weekly.accuracy_trend]}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  正确率趋势
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card sx={{ textAlign: 'center', py: 3 }}>
                <CheckCircle sx={{ fontSize: 40, color: '#4caf50' }} />
                <Typography variant="body1" sx={{ mt: 1, px: 1 }}>
                  {weekly.highlight}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  本周亮点
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card sx={{ textAlign: 'center', py: 3 }}>
                <TrendingUp sx={{ fontSize: 40, color: '#2196f3' }} />
                <Typography variant="body1" sx={{ mt: 1, px: 1 }}>
                  {weekly.suggestion}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  改进建议
                </Typography>
              </Card>
            </Grid>
          </Grid>

          {/* 每日明细 */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                每日训练明细
              </Typography>
              <Divider sx={{ mb: 1 }} />
              {weekly.daily_breakdown.length > 0 ? (
                <List>
                  {weekly.daily_breakdown.map((day) => (
                    <ListItem key={day.date} divider>
                      <ListItemText
                        primary={day.date}
                        secondary={`${day.session_count} 次训练 | ${day.total_items} 道题 | ${Math.round(day.duration_minutes)} 分钟`}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  本周暂无训练记录
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ====== Tab 2: 患者管理（听力师） ====== */}
      {tab === 2 && isTherapist && patients && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
            我的患者 ({patients.length})
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            查看患者的训练数据和依从性情况
          </Typography>

          {patients.length === 0 ? (
            <Alert severity="info">暂无关联患者</Alert>
          ) : (
            <Grid container spacing={2}>
              {patients.map((patient) => (
                <Grid item xs={12} key={patient.user_id}>
                  <Card
                    sx={{
                      borderLeft: 4,
                      borderColor: patient.alert ? '#f44336' : '#4caf50',
                    }}
                  >
                    <CardContent>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item>
                          <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                            <Person sx={{ fontSize: 32 }} />
                          </Avatar>
                        </Grid>
                        <Grid item xs>
                          <Typography variant="h6">{patient.nickname}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            当前级别: {LEVEL_LABELS[patient.current_level] || patient.current_level}
                            {' | '}
                            连续训练: {patient.streak_days} 天
                          </Typography>
                        </Grid>
                        <Grid item>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="body2" color="text.secondary">
                              正确率
                            </Typography>
                            <Typography
                              variant="h5"
                              color={patient.avg_accuracy >= 0.8 ? 'success.main' : patient.avg_accuracy >= 0.6 ? 'warning.main' : 'error.main'}
                            >
                              {Math.round(patient.avg_accuracy * 100)}%
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="body2" color="text.secondary">
                              依从率
                            </Typography>
                            <Typography
                              variant="h5"
                              color={patient.adherence_rate >= 0.7 ? 'success.main' : patient.adherence_rate >= 0.5 ? 'warning.main' : 'error.main'}
                            >
                              {Math.round(patient.adherence_rate * 100)}%
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="body2" color="text.secondary">
                              训练次数
                            </Typography>
                            <Typography variant="h5">
                              {patient.total_sessions}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                      {patient.alert && (
                        <Alert severity="warning" icon={<Warning />} sx={{ mt: 2 }}>
                          {patient.alert}
                        </Alert>
                      )}
                      {patient.last_training_date && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          最后训练: {patient.last_training_date}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}
    </Box>
  );
}
