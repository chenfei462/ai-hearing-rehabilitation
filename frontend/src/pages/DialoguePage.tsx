import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  IconButton,
  Avatar,
  Chip,
  CircularProgress,
  Button,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  Mic,
  Stop,
  PlayArrow,
  Pause,
  ArrowBack,
} from '@mui/icons-material';
import { dialogueService } from '../services/dialogueService';
import { useRecorder } from '../hooks/useRecorder';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { getErrorMessage } from '../utils/errors';
import type {
  DialogueScenario,
  DialogueSessionStart,
  DialogueTurn,
  DialogueSessionFinish,
} from '../types';

// ─── 场景图标映射（与 t03 SCENARIO_PROMPTS 对齐）─────────
const SCENARIO_ICONS: Record<string, string> = {
  ordering: '🍽️',
  directions: '🗺️',
  phone: '📞',
  shopping: '🛒',
  daily: '💬',
};

// ─── 消息类型 ─────────────────────────────────────────────
interface ChatMessage {
  id: string;
  sender: 'user' | 'ai' | 'system';
  text: string;
  audioUrl?: string | null;
  latencyMs?: number;
}

// ─── 页面状态 ─────────────────────────────────────────────
type PageState = 'loading' | 'scenario-select' | 'in-dialogue' | 'summary';

export default function DialoguePage() {
  // 页面状态
  const [pageState, setPageState] = useState<PageState>('loading');
  const [scenarios, setScenarios] = useState<DialogueScenario[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 会话状态
  const [sessionData, setSessionData] = useState<DialogueSessionStart | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [maxTurns, setMaxTurns] = useState(5);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summaryData, setSummaryData] = useState<DialogueSessionFinish | null>(null);

  // 录音 & 播放
  const recorder = useRecorder();
  const player = useAudioPlayer();

  // 消息列表自动滚动
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, []);

  // 加载场景列表
  useEffect(() => {
    loadScenarios();
  }, []);

  // 消息变化时滚动
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadScenarios = async () => {
    try {
      setPageState('loading');
      const res = await dialogueService.listScenarios();
      setScenarios(res.data || []);
      setPageState('scenario-select');
    } catch (err: unknown) {
      setError(getErrorMessage(err, '加载场景失败，请重试'));
      setPageState('scenario-select');
    }
  };

  // ─── 开始对话会话 ────────────────────────────────────────
  const handleStartSession = async (scenarioId: string) => {
    try {
      setError(null);
      setPageState('loading');
      const res = await dialogueService.startSession(scenarioId);
      const data = res.data;
      setSessionData(data);
      setCurrentTurn(0);
      setMaxTurns(data.max_turns);
      setMessages([
        {
          id: 'greeting',
          sender: 'ai',
          text: data.greeting_text,
          audioUrl: data.greeting_audio_url,
        },
      ]);
      setPageState('in-dialogue');

      // 自动播放开场白音频
      if (data.greeting_audio_url) {
        setTimeout(() => player.play(data.greeting_audio_url!), 500);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, '开始对话失败，请重试'));
      setPageState('scenario-select');
    }
  };

  // ─── 录音并发送 ──────────────────────────────────────────
  const handleRecordToggle = async () => {
    if (isProcessing) return;

    if (recorder.status === 'recording') {
      // 停止录音并发送
      const blob = await recorder.stopRecording();
      if (blob && blob.size > 0) {
        await sendAudio(blob);
      }
    } else {
      // 开始录音
      try {
        setError(null);
        await recorder.startRecording();
      } catch (err: unknown) {
        setError('无法启动录音，请检查麦克风权限');
      }
    }
  };

  const sendAudio = async (audioBlob: Blob) => {
    if (!sessionData) return;

    setIsProcessing(true);
    try {
      const res = await dialogueService.handleTurn(sessionData.session_id, audioBlob);
      const turn: DialogueTurn = res.data;

      // 添加用户消息
      const userMsg: ChatMessage = {
        id: `user-${turn.turn_index}`,
        sender: 'user',
        text: turn.user_text || '(未识别到语音)',
      };

      // 添加 AI 回复
      const aiMsg: ChatMessage = {
        id: `ai-${turn.turn_index}`,
        sender: 'ai',
        text: turn.ai_text,
        audioUrl: turn.ai_audio_url,
        latencyMs: turn.latency_ms,
      };

      setMessages((prev) => [...prev, userMsg, aiMsg]);
      setCurrentTurn(turn.turn_index);
      setMaxTurns(turn.turn_index + turn.remaining_turns);

      // 自动播放 AI 回复音频
      if (turn.ai_audio_url) {
        setTimeout(() => player.play(turn.ai_audio_url!), 300);
      }

      // 如果没有剩余轮次，提示结束
      if (turn.remaining_turns <= 0) {
        setMessages((prev) => [
          ...prev,
          {
            id: 'system-limit',
            sender: 'system',
            text: '对话轮次已用完，请点击"结束对话"查看小结。',
          },
        ]);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, '发送失败，请重试'));
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── 结束对话 ────────────────────────────────────────────
  const handleFinishSession = async () => {
    if (!sessionData) return;

    // 停止录音和播放
    recorder.resetRecording();
    player.stop();

    setIsProcessing(true);
    try {
      const res = await dialogueService.finishSession(sessionData.session_id);
      setSummaryData(res.data);
      setPageState('summary');
    } catch (err: unknown) {
      setError(getErrorMessage(err, '结束对话失败'));
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── 返回场景选择 ────────────────────────────────────────
  const handleBackToScenarios = () => {
    recorder.resetRecording();
    player.stop();
    setSessionData(null);
    setMessages([]);
    setCurrentTurn(0);
    setSummaryData(null);
    setError(null);
    setPageState('scenario-select');
  };

  // ─── 渲染：加载中 ───────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
        <CircularProgress size={48} sx={{ mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          加载中...
        </Typography>
      </Box>
    );
  }

  // ─── 渲染：场景选择 ─────────────────────────────────────
  if (pageState === 'scenario-select') {
    return (
      <Box>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
          对话陪练
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          选择一个场景，与 AI 进行 3-5 轮对话练习
        </Typography>

        <Grid container spacing={3}>
          {scenarios.map((s) => (
            <Grid item xs={12} sm={6} key={s.id}>
              <Card
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 8,
                  },
                  '&:active': {
                    transform: 'scale(0.98)',
                  },
                }}
                onClick={() => handleStartSession(s.id)}
              >
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="h2" sx={{ mb: 2, fontSize: '3rem' }}>
                    {SCENARIO_ICONS[s.id] || '💬'}
                  </Typography>
                  <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                    {s.name}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                    {s.description}
                  </Typography>
                  <Chip
                    label={`${s.rounds} 轮对话`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  // ─── 渲染：对话进行中 ───────────────────────────────────
  if (pageState === 'in-dialogue') {
    const scenarioName =
      scenarios.find((s) => s.id === sessionData?.scenario)?.name || '对话';
    const progress = maxTurns > 0 ? (currentTurn / maxTurns) * 100 : 0;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 对话头部信息 */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: 'primary.light',
            color: 'primary.contrastText',
            borderRadius: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              size="small"
              onClick={handleBackToScenarios}
              sx={{ color: 'inherit' }}
            >
              <ArrowBack />
            </IconButton>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {SCENARIO_ICONS[sessionData?.scenario || '']} {scenarioName}
            </Typography>
          </Box>
          <Chip
            label={`第 ${currentTurn}/${maxTurns} 轮`}
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit', fontWeight: 600 }}
          />
        </Paper>

        {/* 进度条 */}
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            mb: 1,
            height: 6,
            borderRadius: 3,
            bgcolor: 'grey.200',
            '& .MuiLinearProgress-bar': { borderRadius: 3 },
          }}
        />

        {/* 消息列表 */}
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 2,
            mb: 1,
            bgcolor: 'grey.50',
            borderRadius: 3,
          }}
        >
          {messages.map((msg) => (
            <Box
              key={msg.id}
              sx={{
                display: 'flex',
                flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                mb: 2,
                opacity: msg.sender === 'system' ? 0.7 : 1,
              }}
            >
              {msg.sender !== 'system' && (
                <Avatar
                  sx={{
                    bgcolor: msg.sender === 'user' ? 'primary.main' : 'secondary.main',
                    width: 48,
                    height: 48,
                    fontSize: '1.2rem',
                    flexShrink: 0,
                  }}
                >
                  {msg.sender === 'user' ? '我' : 'AI'}
                </Avatar>
              )}

              <Paper
                elevation={msg.sender === 'system' ? 0 : 1}
                sx={{
                  p: 2,
                  mx: 2,
                  maxWidth: '75%',
                  borderRadius: 3,
                  bgcolor:
                    msg.sender === 'user'
                      ? 'primary.light'
                      : msg.sender === 'system'
                        ? 'warning.light'
                        : 'white',
                  color:
                    msg.sender === 'user'
                      ? 'primary.contrastText'
                      : msg.sender === 'system'
                        ? 'warning.contrastText'
                        : 'text.primary',
                }}
              >
                <Typography variant="body1" sx={{ lineHeight: 1.6 }}>
                  {msg.text}
                </Typography>

                {/* AI 消息附加信息 */}
                {msg.sender === 'ai' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    {msg.audioUrl && (
                      <IconButton
                        size="small"
                        onClick={() =>
                          player.state === 'playing'
                            ? player.pause()
                            : player.play(msg.audioUrl!)
                        }
                        sx={{ minWidth: 36, minHeight: 36 }}
                      >
                        {player.state === 'playing' ? (
                          <Pause fontSize="small" />
                        ) : (
                          <PlayArrow fontSize="small" />
                        )}
                      </IconButton>
                    )}
                    {msg.latencyMs !== undefined && (
                      <Typography variant="caption" color="text.secondary">
                        {msg.latencyMs}ms
                      </Typography>
                    )}
                  </Box>
                )}
              </Paper>
            </Box>
          ))}

          {/* 处理中指示器 */}
          {isProcessing && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Avatar sx={{ bgcolor: 'secondary.main', width: 48, height: 48 }}>
                AI
              </Avatar>
              <Paper elevation={1} sx={{ p: 2, borderRadius: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    AI 正在思考...
                  </Typography>
                </Box>
              </Paper>
            </Box>
          )}

          <div ref={messagesEndRef} />
        </Paper>

        {/* 操作区 */}
        <Paper
          elevation={2}
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            borderRadius: 3,
          }}
        >
          {/* 录音按钮 */}
          <Box sx={{ position: 'relative' }}>
            <IconButton
              onClick={handleRecordToggle}
              disabled={isProcessing || currentTurn >= maxTurns}
              sx={{
                width: 72,
                height: 72,
                bgcolor: recorder.status === 'recording' ? 'error.main' : 'primary.main',
                color: 'white',
                '&:hover': {
                  bgcolor: recorder.status === 'recording' ? 'error.dark' : 'primary.dark',
                },
                '&.Mui-disabled': {
                  bgcolor: 'grey.300',
                  color: 'grey.500',
                },
                transition: 'all 0.2s',
                animation: recorder.status === 'recording' ? 'pulse 1.5s infinite' : 'none',
                '@keyframes pulse': {
                  '0%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.4)' },
                  '70%': { boxShadow: '0 0 0 16px rgba(211, 47, 47, 0)' },
                  '100%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0)' },
                },
              }}
            >
              {recorder.status === 'recording' ? <Stop sx={{ fontSize: 36 }} /> : <Mic sx={{ fontSize: 36 }} />}
            </IconButton>
          </Box>

          {/* 状态提示 */}
          <Typography variant="body1" color="text.secondary" sx={{ minWidth: 120, textAlign: 'center' }}>
            {isProcessing
              ? '处理中...'
              : recorder.status === 'recording'
                ? '录音中，点击停止'
                : currentTurn >= maxTurns
                  ? '对话轮次已满'
                  : '点击开始说话'}
          </Typography>

          {/* 结束对话按钮 */}
          <Button
            variant="outlined"
            color="secondary"
            onClick={handleFinishSession}
            disabled={isProcessing}
            sx={{ minWidth: 100 }}
          >
            结束对话
          </Button>
        </Paper>
      </Box>
    );
  }

  // ─── 渲染：对话小结 ─────────────────────────────────────
  if (pageState === 'summary' && summaryData) {
    const scenarioName =
      scenarios.find((s) => s.id === summaryData.scenario)?.name || '对话';

    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
          对话完成！
        </Typography>

        <Paper
          elevation={2}
          sx={{
            p: 4,
            mt: 3,
            mb: 4,
            borderRadius: 4,
            maxWidth: 500,
            mx: 'auto',
          }}
        >
          <Typography variant="h2" sx={{ mb: 2, fontSize: '3rem' }}>
            {SCENARIO_ICONS[summaryData.scenario] || '💬'}
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
            {scenarioName}
          </Typography>

          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, my: 3 }}>
            <Box>
              <Typography variant="h3" color="primary.main" sx={{ fontWeight: 700 }}>
                {summaryData.turn_count}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                对话轮次
              </Typography>
            </Box>
            <Box>
              <Typography variant="h3" color="primary.main" sx={{ fontWeight: 700 }}>
                {Math.floor(summaryData.duration_seconds / 60)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                分钟
              </Typography>
            </Box>
          </Box>

          <Typography
            variant="body1"
            sx={{
              mt: 3,
              p: 2,
              bgcolor: 'grey.50',
              borderRadius: 2,
              lineHeight: 1.8,
              textAlign: 'left',
            }}
          >
            {summaryData.summary}
          </Typography>
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Button
            variant="contained"
            size="large"
            onClick={handleBackToScenarios}
          >
            再来一次
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => {
              window.location.href = '/report';
            }}
          >
            查看报告
          </Button>
        </Box>
      </Box>
    );
  }

  return null;
}
