import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  LinearProgress,
  IconButton,
  Paper,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Mic,
  MicOff,
  CheckCircle,
  Cancel,
  ArrowUpward,
  ArrowDownward,
  Refresh,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { trainingService } from '../services/trainingService';
import { useRecorder } from '../hooks/useRecorder';
import LevelBadge from '../components/common/LevelBadge';
import { TrainingLevel, TrainingSession, TrainingItem, UserAbility } from '../types';

// 训练级别配置
const levels = [
  { level: 'syllable' as TrainingLevel, desc: '基础音节辨识训练', items: 20 },
  { level: 'word' as TrainingLevel, desc: '日常词汇听辨训练', items: 30 },
  { level: 'sentence' as TrainingLevel, desc: '完整语句理解训练', items: 25 },
  { level: 'noise' as TrainingLevel, desc: '噪声环境听辨训练', items: 20 },
];

type TrainingState = 'selecting' | 'loading' | 'playing' | 'answering' | 'feedback' | 'completed';

export default function TrainingPage() {
  const navigate = useNavigate();
  const recorder = useRecorder();

  // 训练状态
  const [trainingState, setTrainingState] = useState<TrainingState>('selecting');
  const [selectedLevel, setSelectedLevel] = useState<TrainingLevel | null>(null);
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [currentItem, setCurrentItem] = useState<TrainingItem | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<{
    is_correct: boolean;
    next_action: string;
    theta?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const questionStartTime = useRef<number>(0);  // 记录答题开始时间

  // 音频播放
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // 开始训练会话
  const startTraining = async (level: TrainingLevel) => {
    try {
      setTrainingState('loading');
      setSelectedLevel(level);
      setError(null);

      const response = await trainingService.startSession(level);
      const { session_id, first_item } = response.data.data;

      setSession({
        id: session_id,
        user_id: 0,
        level,
        start_time: new Date().toISOString(),
        end_time: null,
        total_items: 0,
        correct_items: 0,
        accuracy: 0,
        status: 'active',
      });

      setCurrentItem(first_item);
      setTrainingState('playing');
      setProgress(0);
      setTotalAnswered(0);
    } catch (err: any) {
      setError(err.message || '开始训练失败');
      setTrainingState('selecting');
    }
  };

  // 播放音频
  const playAudio = () => {
    if (currentItem?.audio_url && audioRef.current) {
      audioRef.current.src = currentItem.audio_url;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // 停止播放
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  // 音频播放结束
  const handleAudioEnded = () => {
    setIsPlaying(false);
    setTrainingState('answering');
    questionStartTime.current = Date.now();  // 记录答题开始时间
  };

  // 开始录音
  const startRecording = async () => {
    await recorder.startRecording();
  };

  // 停止录音并提交
  const stopRecordingAndSubmit = async () => {
    const blob = await recorder.stopRecording();
    if (blob && session && currentItem) {
      // 将录音转换为文本（这里简化处理，实际需要 ASR）
      // 对于音节/词语训练，用户可以直接选择或输入
      await submitAnswer(userAnswer || '录音回答');
    }
  };

  // 提交答案
  const submitAnswer = async (answer: string) => {
    if (!session || !currentItem) return;

    try {
      setTrainingState('loading');
      const responseMs = questionStartTime.current > 0
        ? Date.now() - questionStartTime.current
        : 0;

      const response = await trainingService.submitAnswer(
        session.id,
        currentItem.id,
        answer,
        responseMs
      );

      const result = response.data.data;
      setFeedback(result);
      setTotalAnswered(prev => prev + 1);
      setProgress(prev => Math.min(100, prev + 100 / 20)); // 假设每级 20 题

      setTrainingState('feedback');
    } catch (err: any) {
      setError(err.message || '提交答案失败');
      setTrainingState('answering');
    }
  };

  // 获取下一题
  const getNextItem = async () => {
    if (!session) return;

    try {
      setTrainingState('loading');
      const response = await trainingService.getNextItem(session.id);
      const item = response.data.data;

      setCurrentItem(item);
      setUserAnswer('');
      setFeedback(null);
      setTrainingState('playing');
    } catch (err: any) {
      // 如果没有下一题，结束训练
      if (err.code === 40401) {
        finishTraining();
      } else {
        setError(err.message || '获取下一题失败');
      }
    }
  };

  // 结束训练
  const finishTraining = async () => {
    if (!session) return;

    try {
      setTrainingState('loading');
      const response = await trainingService.finishSession(session.id);
      const result = response.data.data;

      setSession(prev => prev ? {
        ...prev,
        status: 'completed',
        end_time: new Date().toISOString(),
        total_items: result.total_items,
        correct_items: result.correct_items,
        accuracy: result.accuracy,
      } : null);

      setTrainingState('completed');
    } catch (err: any) {
      setError(err.message || '结束训练失败');
    }
  };

  // 处理升降级
  const handleLevelChange = (action: string) => {
    if (!selectedLevel) return;

    const levelOrder: TrainingLevel[] = ['syllable', 'word', 'sentence', 'noise'];
    const currentIndex = levelOrder.indexOf(selectedLevel);

    if (action === 'upgrade' && currentIndex < levelOrder.length - 1) {
      setSelectedLevel(levelOrder[currentIndex + 1]);
    } else if (action === 'downgrade' && currentIndex > 0) {
      setSelectedLevel(levelOrder[currentIndex - 1]);
    }
  };

  // 重新开始
  const restartTraining = () => {
    setTrainingState('selecting');
    setSelectedLevel(null);
    setSession(null);
    setCurrentItem(null);
    setUserAnswer('');
    setFeedback(null);
    setProgress(0);
    setTotalAnswered(0);
    recorder.clearRecording();
  };

  // 渲染级别选择界面
  const renderLevelSelection = () => (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        听觉训练
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4, fontSize: '1.1rem' }}>
        选择训练难度，系统将根据您的表现自动调整
      </Typography>

      <Grid container spacing={3}>
        {levels.map((item) => (
          <Grid item xs={12} sm={6} key={item.level}>
            <Card
              sx={{
                height: '100%',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: 8,
                  transform: 'translateY(-4px)',
                },
              }}
              onClick={() => startTraining(item.level)}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    {item.level === 'syllable' ? '音节' :
                     item.level === 'word' ? '词语' :
                     item.level === 'sentence' ? '语句' : '噪声'}
                  </Typography>
                  <LevelBadge level={item.level} />
                </Box>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                  {item.desc}
                </Typography>
                <Typography variant="body2" color="primary">
                  共 {item.items} 题
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  // 渲染训练进行中界面
  const renderTrainingSession = () => {
    if (!currentItem) return null;

    return (
      <Box>
        {/* 进度条 */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              训练进度
            </Typography>
            <Typography variant="body2" color="primary">
              {totalAnswered} 题
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 10,
              borderRadius: 5,
              '& .MuiLinearProgress-bar': {
                borderRadius: 5,
              },
            }}
          />
        </Box>

        {/* 当前题目 */}
        <Paper
          elevation={3}
          sx={{
            p: 4,
            mb: 4,
            borderRadius: 3,
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom color="text.secondary">
              请听音频并回答
            </Typography>

            {/* 音频播放器 */}
            <Box sx={{ my: 3 }}>
              <IconButton
                onClick={isPlaying ? stopAudio : playAudio}
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                {isPlaying ? <Pause sx={{ fontSize: 40 }} /> : <PlayArrow sx={{ fontSize: 40 }} />}
              </IconButton>
              <audio ref={audioRef} onEnded={handleAudioEnded} />
            </Box>

            <Typography variant="body1" color="text.secondary">
              {isPlaying ? '播放中...' : '点击播放音频'}
            </Typography>
          </Box>
        </Paper>

        {/* 答题区域 */}
        {trainingState === 'answering' && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              请输入您听到的内容
            </Typography>

            {/* 文本输入 */}
            <Box sx={{ mb: 3 }}>
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="输入答案..."
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '1.25rem',  // 20px 老年适配
                  border: '2px solid #e0e0e0',
                  borderRadius: '12px',
                  outline: 'none',
                  minHeight: '48px',  // 触控目标至少 48px
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && userAnswer.trim()) {
                    submitAnswer(userAnswer);
                  }
                }}
              />
            </Box>

            {/* 录音按钮（用于语句/噪声训练） */}
            {(selectedLevel === 'sentence' || selectedLevel === 'noise') && (
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  或者使用语音回答
                </Typography>
                <IconButton
                  onClick={recorder.isRecording ? stopRecordingAndSubmit : startRecording}
                  sx={{
                    width: 64,
                    height: 64,
                    bgcolor: recorder.isRecording ? 'error.main' : 'secondary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: recorder.isRecording ? 'error.dark' : 'secondary.dark',
                    },
                  }}
                >
                  {recorder.isRecording ? <MicOff sx={{ fontSize: 32 }} /> : <Mic sx={{ fontSize: 32 }} />}
                </IconButton>
                {recorder.isRecording && (
                  <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                    录音中... {recorder.duration.toFixed(1)}s
                  </Typography>
                )}
              </Box>
            )}

            {/* 提交按钮 */}
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={() => submitAnswer(userAnswer)}
              disabled={!userAnswer.trim() && !recorder.audioBlob}
              sx={{
                py: 2,
                fontSize: '1.1rem',
                fontWeight: 600,
                borderRadius: 2,
              }}
            >
              提交答案
            </Button>
          </Box>
        )}

        {/* 反馈界面 */}
        {trainingState === 'feedback' && feedback && (
          <Box sx={{ mb: 4 }}>
            <Paper
              elevation={2}
              sx={{
                p: 3,
                borderRadius: 3,
                bgcolor: feedback.is_correct ? 'success.light' : 'error.light',
                mb: 3,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                {feedback.is_correct ? (
                  <CheckCircle sx={{ fontSize: 40, color: 'success.dark' }} />
                ) : (
                  <Cancel sx={{ fontSize: 40, color: 'error.dark' }} />
                )}
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {feedback.is_correct ? '回答正确！' : '回答错误'}
                </Typography>
              </Box>

              {!feedback.is_correct && currentItem && (
                <Typography variant="body1" sx={{ mb: 2 }}>
                  正确答案是：<strong>{currentItem.text}</strong>
                </Typography>
              )}

              {/* 升降级提示 */}
              {feedback.next_action !== 'continue' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                  {feedback.next_action === 'upgrade' ? (
                    <>
                      <ArrowUpward color="success" />
                      <Typography color="success.dark" fontWeight={600}>
                        表现优秀，难度提升！
                      </Typography>
                    </>
                  ) : (
                    <>
                      <ArrowDownward color="warning" />
                      <Typography color="warning.dark" fontWeight={600}>
                        继续加油，难度调整
                      </Typography>
                    </>
                  )}
                </Box>
              )}
            </Paper>

            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={() => {
                if (feedback.next_action !== 'continue') {
                  handleLevelChange(feedback.next_action);
                }
                getNextItem();
              }}
              sx={{
                py: 2,
                fontSize: '1.1rem',
                fontWeight: 600,
                borderRadius: 2,
              }}
            >
              下一题
            </Button>
          </Box>
        )}

        {/* 结束训练按钮 */}
        <Button
          variant="outlined"
          color="secondary"
          fullWidth
          onClick={finishTraining}
          sx={{ mt: 2 }}
        >
          结束训练
        </Button>
      </Box>
    );
  };

  // 渲染训练完成界面
  const renderTrainingCompleted = () => {
    if (!session) return null;

    const accuracyPercent = Math.round(session.accuracy * 100);

    return (
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
          训练完成！
        </Typography>

        <Paper
          elevation={3}
          sx={{
            p: 4,
            mb: 4,
            borderRadius: 3,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
          }}
        >
          <Typography variant="h6" gutterBottom>
            本次训练成绩
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, my: 3 }}>
            <Box>
              <Typography variant="h3" sx={{ fontWeight: 700 }}>
                {accuracyPercent}%
              </Typography>
              <Typography variant="body2">正确率</Typography>
            </Box>
            <Box>
              <Typography variant="h3" sx={{ fontWeight: 700 }}>
                {session.correct_items}
              </Typography>
              <Typography variant="body2">答对题数</Typography>
            </Box>
            <Box>
              <Typography variant="h3" sx={{ fontWeight: 700 }}>
                {session.total_items}
              </Typography>
              <Typography variant="body2">总题数</Typography>
            </Box>
          </Box>

          <Typography variant="body1" sx={{ mt: 2 }}>
            {accuracyPercent >= 80
              ? '表现优秀！继续保持！'
              : accuracyPercent >= 60
              ? '不错的进步，继续努力！'
              : '需要更多练习，加油！'}
          </Typography>
        </Paper>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="contained"
            size="large"
            onClick={restartTraining}
            startIcon={<Refresh />}
            sx={{
              px: 4,
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 600,
              borderRadius: 2,
            }}
          >
            再次训练
          </Button>

          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate('/report')}
            sx={{
              px: 4,
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 600,
              borderRadius: 2,
            }}
          >
            查看报告
          </Button>
        </Box>
      </Box>
    );
  };

  // 渲染加载状态
  const renderLoading = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
      <CircularProgress size={60} sx={{ mb: 3 }} />
      <Typography variant="h6" color="text.secondary">
        加载中...
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 录音错误提示 */}
      {recorder.error && (
        <Alert severity="warning" sx={{ mb: 3 }} onClose={() => recorder.clearRecording()}>
          {recorder.error}
        </Alert>
      )}

      {/* 根据状态渲染不同界面 */}
      {trainingState === 'selecting' && renderLevelSelection()}
      {trainingState === 'loading' && renderLoading()}
      {(trainingState === 'playing' || trainingState === 'answering' || trainingState === 'feedback') &&
        renderTrainingSession()}
      {trainingState === 'completed' && renderTrainingCompleted()}
    </Box>
  );
}