import { Box, Typography, Button, TextField, Card, CardContent, Alert, CircularProgress } from '@mui/material';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendSmsCode, loginWithPhone } from '../api/auth';
import { useAuthStore } from '../stores/authStore';
import { getErrorMessage } from '../utils/errors';

type Step = 'phone' | 'code';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // 已登录则跳转首页
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendSmsCode(phone);
      setStep('code');
      setCountdown(60);
      setTimeout(() => codeInputRef.current?.focus(), 100);
    } catch (err: unknown) {
      setError(getErrorMessage(err, '发送验证码失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (code.length < 4) {
      setError('请输入验证码');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await loginWithPhone({ phone, code });
      login(result.user);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(getErrorMessage(err, '登录失败，请检查验证码'));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (step === 'phone') handleSendCode();
      else handleLogin();
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Card sx={{ maxWidth: 420, width: '100%', mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" align="center" gutterBottom sx={{ fontSize: '2rem' }}>
            AI 听觉康复助手
          </Typography>
          <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 4, fontSize: '1.125rem' }}>
            请登录以开始训练
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {step === 'phone' && (
            <>
              <TextField
                fullWidth
                label="手机号"
                variant="outlined"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                onKeyDown={handleKeyDown}
                placeholder="请输入11位手机号"
                inputProps={{ inputMode: 'numeric' }}
                sx={{ mb: 3 }}
              />
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleSendCode}
                disabled={loading || phone.length !== 11}
                sx={{ height: 52, fontSize: '1.125rem' }}
              >
                {loading ? <CircularProgress size={24} /> : '发送验证码'}
              </Button>
            </>
          )}

          {step === 'code' && (
            <>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2, fontSize: '1rem' }}>
                验证码已发送至 {phone}
              </Typography>
              <TextField
                fullWidth
                label="验证码"
                variant="outlined"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={handleKeyDown}
                placeholder="请输入4-6位验证码"
                inputProps={{ inputMode: 'numeric' }}
                inputRef={codeInputRef}
                sx={{ mb: 3 }}
              />
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleLogin}
                disabled={loading || code.length < 4}
                sx={{ height: 52, fontSize: '1.125rem', mb: 2 }}
              >
                {loading ? <CircularProgress size={24} /> : '登录'}
              </Button>
              <Button
                fullWidth
                variant="text"
                onClick={() => {
                  if (countdown === 0) {
                    handleSendCode();
                  }
                }}
                disabled={countdown > 0}
              >
                {countdown > 0 ? `${countdown}秒后可重新发送` : '重新发送验证码'}
              </Button>
              <Button
                fullWidth
                variant="text"
                size="small"
                onClick={() => {
                  setStep('phone');
                  setCode('');
                  setError('');
                }}
                sx={{ mt: 1 }}
              >
                更换手机号
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
