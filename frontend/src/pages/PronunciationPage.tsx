import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Grid, Chip, Alert,
  CircularProgress, Divider, Collapse,
} from '@mui/material';
import {
  Mic, Stop, Replay, VolumeUp, ExpandMore, ExpandLess,
  CheckCircle, Cancel, History, TrendingUp,
} from '@mui/icons-material';
import ScoreRing from '../components/common/ScoreRing';
import { useRecorder } from '../hooks/useRecorder';
import { pronunciationService } from '../services/pronunciationService';
import { getErrorMessage } from '../utils/errors';
import type {
  PronunciationTask, PronunciationResult, PhonemeDetail,
  PronunciationHistoryItem, PronunciationStats,
} from '../types';

type PageState = 'loading' | 'ready' | 'recording' | 'evaluating' | 'result' | 'error';

export default function PronunciationPage() {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [task, setTask] = useState<PronunciationTask | null>(null);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [history, setHistory] = useState<PronunciationHistoryItem[]>([]);
  const [stats, setStats] = useState<PronunciationStats | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showPhonemeDetail, setShowPhonemeDetail] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const recorder = useRecorder();
  const { resetRecording } = recorder;
  const userWaveRef = useRef<HTMLDivElement>(null);
  const demoAudioRef = useRef<HTMLAudioElement | null>(null);

  // 加载任务
  const loadTask = useCallback(async () => {
    setPageState('loading');
    setResult(null);
    resetRecording();
    try {
      const res = await pronunciationService.getNextTask();
      setTask(res.data);
      setPageState('ready');
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err, '获取任务失败'));
      setPageState('error');
    }
  }, [resetRecording]);

  // 加载历史和统计
  const loadHistoryAndStats = useCallback(async () => {
    try {
      const [histRes, statsRes] = await Promise.all([
        pronunciationService.getHistory(10, 0),
        pronunciationService.getStats(),
      ]);
      setHistory(histRes.data);
      setStats(statsRes.data);
    } catch {
      // 非阻塞
    }
  }, []);

  useEffect(() => {
    loadTask();
    loadHistoryAndStats();
  }, [loadTask, loadHistoryAndStats]);

  // 播放示范音频
  const playDemo = () => {
    const url = task?.demo_audio_url || result?.tts_demo_url;
    if (!url) return;
    if (demoAudioRef.current) {
      demoAudioRef.current.pause();
    }
    const audio = new Audio(url);
    demoAudioRef.current = audio;
    audio.play().catch(() => {});
  };

  // 开始录音
  const handleStartRecord = async () => {
    await recorder.startRecording();
    setPageState('recording');
  };

  // 停止录音并评估
  const handleStopAndEvaluate = async () => {
    const blob = await recorder.stopRecording();
    if (!blob || !task) return;

    setPageState('evaluating');
    try {
      const res = await pronunciationService.evaluate(blob, task.text, task.phonemes);
      setResult(res.data);
      setPageState('result');
      loadHistoryAndStats();
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err, '评估失败，请重试'));
      setPageState('ready');
    }
  };

  // 重试当前任务
  const handleRetry = () => {
    setResult(null);
    recorder.resetRecording();
    setPageState('ready');
  };

  // 下一个任务
  const handleNext = () => {
    loadTask();
  };

  // ---- 渲染 ----

  // 加载中
  if (pageState === 'loading') {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <CircularProgress size={48} />
        <Typography variant="h6" sx={{ mt: 2 }}>正在加载练习任务...</Typography>
      </Box>
    );
  }

  // 错误
  if (pageState === 'error') {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>
        <Button variant="contained" onClick={loadTask}>重新加载</Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* 页面标题 */}
      <Typography variant="h4" gutterBottom>发音反馈</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        朗读屏幕上的文字，获取实时发音评分与纠正建议
      </Typography>

      {/* 统计概览 */}
      {stats && stats.total_attempts > 0 && (
        <Card sx={{ mb: 3, bgcolor: 'primary.50' }}>
          <CardContent sx={{ py: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={4} sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">练习次数</Typography>
                <Typography variant="h6">{stats.total_attempts}</Typography>
              </Grid>
              <Grid item xs={4} sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">平均分</Typography>
                <Typography variant="h6">{stats.average_score}</Typography>
              </Grid>
              <Grid item xs={4} sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  <TrendingUp sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                  进步趋势
                </Typography>
                <Typography
                  variant="h6"
                  color={stats.improvement_trend >= 0 ? 'success.main' : 'error.main'}
                >
                  {stats.improvement_trend >= 0 ? '+' : ''}{stats.improvement_trend}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* 练习任务卡片 */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          {/* 难度标签 */}
          {task && (
            <Chip
              label={task.difficulty === 'easy' ? '简单' : task.difficulty === 'medium' ? '中等' : '困难'}
              color={task.difficulty === 'easy' ? 'success' : task.difficulty === 'medium' ? 'warning' : 'error'}
              size="small"
              sx={{ mb: 2 }}
            />
          )}

          {/* 目标文本 */}
          <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 2, letterSpacing: 2 }}>
            {task?.text}
          </Typography>

          {/* 音素标注 */}
          {task?.phonemes && (
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
              {task.phonemes.map((p, i) => (
                <Chip
                  key={i}
                  label={p}
                  variant="outlined"
                  size="medium"
                  sx={{ fontSize: '1rem', px: 1 }}
                />
              ))}
            </Box>
          )}

          {/* 播放示范按钮 */}
          <Button
            variant="outlined"
            startIcon={<VolumeUp />}
            onClick={playDemo}
            disabled={!task?.demo_audio_url && !result?.tts_demo_url}
            sx={{ mb: 3 }}
          >
            听标准发音
          </Button>

          {/* 录音波形占位区 */}
          {pageState === 'recording' && (
            <Box sx={{ my: 2 }}>
              <Box
                ref={userWaveRef}
                sx={{
                  height: 80,
                  bgcolor: 'grey.100',
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* 录音中的动画效果 */}
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  {[...Array(12)].map((_, i) => (
                    <Box
                      key={i}
                      sx={{
                        width: 4,
                        bgcolor: 'primary.main',
                        borderRadius: 1,
                        animation: `pulse 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
                        '@keyframes pulse': {
                          '0%': { height: 10 },
                          '100%': { height: 40 + Math.random() * 30 },
                        },
                      }}
                    />
                  ))}
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                正在录音... {recorder.duration}s
              </Typography>
            </Box>
          )}

          {/* 用户录音播放 */}
          {pageState === 'result' && recorder.audioUrl && (
            <Box sx={{ my: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                您的录音（时长: {recorder.duration}s）
              </Typography>
              <audio controls src={recorder.audioUrl} style={{ width: '100%', maxWidth: 400 }} />
            </Box>
          )}

          {/* 操作按钮 */}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
            {(pageState === 'ready') && (
              <Button
                variant="contained"
                size="large"
                startIcon={<Mic />}
                onClick={handleStartRecord}
                sx={{
                  bgcolor: '#e53935',
                  '&:hover': { bgcolor: '#c62828' },
                  minHeight: 64,
                  px: 4,
                  fontSize: '1.25rem',
                  borderRadius: 32,
                }}
              >
                开始录音
              </Button>
            )}

            {pageState === 'recording' && (
              <Button
                variant="contained"
                size="large"
                startIcon={<Stop />}
                onClick={handleStopAndEvaluate}
                sx={{
                  bgcolor: '#e53935',
                  '&:hover': { bgcolor: '#c62828' },
                  minHeight: 64,
                  px: 4,
                  fontSize: '1.25rem',
                  borderRadius: 32,
                }}
              >
                停止并评分
              </Button>
            )}

            {pageState === 'evaluating' && (
              <Box sx={{ textAlign: 'center' }}>
                <CircularProgress size={40} />
                <Typography variant="body1" sx={{ mt: 1 }}>正在评分...</Typography>
              </Box>
            )}

            {pageState === 'result' && (
              <>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<Replay />}
                  onClick={handleRetry}
                  sx={{ minHeight: 56, px: 3 }}
                >
                  重新录音
                </Button>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleNext}
                  sx={{ minHeight: 56, px: 3 }}
                >
                  下一个练习
                </Button>
              </>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* 评分结果 */}
      {pageState === 'result' && result && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
              评分结果
              {result.latency_ms > 0 && (
                <Chip
                  label={`${result.latency_ms}ms`}
                  size="small"
                  sx={{ ml: 1 }}
                  color={result.latency_ms < 2000 ? 'success' : 'warning'}
                />
              )}
            </Typography>

            {/* 四个评分环 */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <ScoreRing score={result.overall} size={100} label="综合" />
              </Grid>
              <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <ScoreRing score={result.accuracy} size={80} label="准确度" />
              </Grid>
              <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <ScoreRing score={result.fluency} size={80} label="流利度" />
              </Grid>
              <Grid item xs={3} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <ScoreRing score={result.completeness} size={80} label="完整度" />
              </Grid>
            </Grid>

            {/* 音素详情（可折叠） */}
            {result.phoneme_details && result.phoneme_details.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Button
                  onClick={() => setShowPhonemeDetail(!showPhonemeDetail)}
                  endIcon={showPhonemeDetail ? <ExpandLess /> : <ExpandMore />}
                  sx={{ textTransform: 'none' }}
                >
                  音素级详情
                </Button>
                <Collapse in={showPhonemeDetail}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                    {result.phoneme_details.map((d: PhonemeDetail, i: number) => (
                      <Chip
                        key={i}
                        icon={d.is_match ? <CheckCircle /> : <Cancel />}
                        label={`${d.target} → ${d.asr || '缺失'}`}
                        color={d.is_match ? 'success' : 'error'}
                        variant={d.is_match ? 'outlined' : 'filled'}
                        size="medium"
                      />
                    ))}
                  </Box>
                </Collapse>
              </Box>
            )}

            {/* 纠正建议 */}
            {result.suggestions && result.suggestions.length > 0 && (
              <Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  发音建议
                </Typography>
                {result.suggestions.map((s: string, i: number) => (
                  <Alert
                    key={i}
                    severity={i === 0 ? 'info' : 'warning'}
                    sx={{ mb: 1 }}
                    icon={i === 0 ? <TrendingUp /> : undefined}
                  >
                    {s}
                  </Alert>
                ))}
              </Box>
            )}

            {/* 对比播放 */}
            {(task?.demo_audio_url || result.tts_demo_url) && (
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  对比播放
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      标准发音
                    </Typography>
                    <audio
                      controls
                      src={task?.demo_audio_url || result.tts_demo_url || ''}
                      style={{ width: '100%' }}
                    />
                  </Grid>
                  {recorder.audioUrl && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        您的发音
                      </Typography>
                      <audio controls src={recorder.audioUrl} style={{ width: '100%' }} />
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* 历史记录（可折叠） */}
      {history.length > 0 && (
        <Card>
          <CardContent>
            <Button
              onClick={() => setShowHistory(!showHistory)}
              startIcon={<History />}
              endIcon={showHistory ? <ExpandLess /> : <ExpandMore />}
              sx={{ textTransform: 'none', mb: 1 }}
            >
              历史记录
            </Button>
            <Collapse in={showHistory}>
              {history.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    py: 1.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-child': { borderBottom: 'none' },
                  }}
                >
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                      {item.target_text}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : ''}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip
                      label={`准确 ${Math.round(item.accuracy)}`}
                      size="small"
                      color={item.accuracy >= 80 ? 'success' : item.accuracy >= 60 ? 'warning' : 'error'}
                      variant="outlined"
                    />
                    <ScoreRing score={item.overall} size={48} strokeWidth={4} showValue label="" />
                  </Box>
                </Box>
              ))}
            </Collapse>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
