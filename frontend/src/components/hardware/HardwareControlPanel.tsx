/**
 * 硬件控制面板组件
 *
 * 提供 LED、蜂鸣器、显示屏的可视化控制界面。
 * 用于开发测试和设备调试。
 */
import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Divider,
  Alert,
} from '@mui/material';
import {
  Lightbulb,
  VolumeUp,
  TextFields,
} from '@mui/icons-material';
import { hardwareService } from '../../services/hardwareService';
import { getErrorMessage } from '../../utils/errors';

interface HardwareControlPanelProps {
  deviceId: string;
  isConnected: boolean;
}

export default function HardwareControlPanel({ deviceId, isConnected }: HardwareControlPanelProps) {
  const [ledColor, setLedColor] = useState('green');
  const [ledPattern, setLedPattern] = useState('on');
  const [buzzerFreq, setBuzzerFreq] = useState(1000);
  const [buzzerDuration, setBuzzerDuration] = useState(200);
  const [displayText, setDisplayText] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleLED = async () => {
    try {
      await hardwareService.controlLED(deviceId, {
        color: ledColor,
        pattern: ledPattern,
        duration_ms: ledPattern === 'off' ? 0 : 3000,
      });
      showMessage('success', 'LED 命令已发送');
    } catch (err: unknown) {
      showMessage('error', getErrorMessage(err, 'LED 控制失败'));
    }
  };

  const handleBuzzer = async () => {
    try {
      await hardwareService.controlBuzzer(deviceId, {
        frequency_hz: buzzerFreq,
        duration_ms: buzzerDuration,
      });
      showMessage('success', '蜂鸣器命令已发送');
    } catch (err: unknown) {
      showMessage('error', getErrorMessage(err, '蜂鸣器控制失败'));
    }
  };

  const handleDisplay = async () => {
    if (!displayText.trim()) return;
    try {
      await hardwareService.sendCommand(deviceId, {
        actuator_type: 'display',
        action: 'show_text',
        params: { text: displayText, line: 0 },
      });
      showMessage('success', '显示命令已发送');
    } catch (err: unknown) {
      showMessage('error', getErrorMessage(err, '显示控制失败'));
    }
  };

  if (!isConnected) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography color="text.secondary" textAlign="center">
          设备未连接，无法控制
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
        设备控制面板
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {/* LED 控制 */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Lightbulb fontSize="small" color="warning" />
          <Typography variant="body2" fontWeight={600}>
            LED 指示灯
          </Typography>
        </Box>

        <Stack spacing={1.5}>
          <FormControl size="small" fullWidth>
            <InputLabel>颜色</InputLabel>
            <Select
              value={ledColor}
              label="颜色"
              onChange={(e) => setLedColor(e.target.value)}
            >
              <MenuItem value="green">绿色</MenuItem>
              <MenuItem value="red">红色</MenuItem>
              <MenuItem value="blue">蓝色</MenuItem>
              <MenuItem value="yellow">黄色</MenuItem>
              <MenuItem value="white">白色</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>模式</InputLabel>
            <Select
              value={ledPattern}
              label="模式"
              onChange={(e) => setLedPattern(e.target.value)}
            >
              <MenuItem value="on">常亮</MenuItem>
              <MenuItem value="off">关闭</MenuItem>
              <MenuItem value="blink_slow">慢闪</MenuItem>
              <MenuItem value="blink_fast">快闪</MenuItem>
              <MenuItem value="pulse">呼吸灯</MenuItem>
            </Select>
          </FormControl>

          <Button variant="contained" size="small" onClick={handleLED} fullWidth>
            应用 LED
          </Button>
        </Stack>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* 蜂鸣器控制 */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <VolumeUp fontSize="small" color="info" />
          <Typography variant="body2" fontWeight={600}>
            蜂鸣器
          </Typography>
        </Box>

        <Stack spacing={1.5}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              频率: {buzzerFreq} Hz
            </Typography>
            <Slider
              value={buzzerFreq}
              onChange={(_, v) => setBuzzerFreq(v as number)}
              min={200}
              max={5000}
              step={100}
              size="small"
            />
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary">
              时长: {buzzerDuration} ms
            </Typography>
            <Slider
              value={buzzerDuration}
              onChange={(_, v) => setBuzzerDuration(v as number)}
              min={50}
              max={2000}
              step={50}
              size="small"
            />
          </Box>

          <Button variant="contained" size="small" onClick={handleBuzzer} fullWidth>
            响一声
          </Button>
        </Stack>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* 显示屏控制 */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <TextFields fontSize="small" color="action" />
          <Typography variant="body2" fontWeight={600}>
            OLED 显示屏
          </Typography>
        </Box>

        <Stack spacing={1.5}>
          <input
            type="text"
            value={displayText}
            onChange={(e) => setDisplayText(e.target.value)}
            placeholder="输入显示文字..."
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '14px',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleDisplay();
            }}
          />

          <Button variant="contained" size="small" onClick={handleDisplay} fullWidth>
            显示文字
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
