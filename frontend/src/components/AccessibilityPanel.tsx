import { Box, Typography, Slider, Switch, FormControlLabel } from '@mui/material';
import { useA11yStore } from '../stores/a11yStore';
import { useSpeechGuide } from '../hooks/useSpeechGuide';

/**
 * 无障碍设置面板（内嵌组件版本）
 * 完整设置请访问 /settings 页面
 */
export default function AccessibilityPanel() {
  const { fontSize, setFontSize, voiceGuide, toggleVoiceGuide, volume, setVolume } =
    useA11yStore();
  const { speak } = useSpeechGuide();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        无障碍设置
      </Typography>

      <Box sx={{ mb: 4 }}>
        <Typography gutterBottom>字体大小: {fontSize}px</Typography>
        <Slider
          value={fontSize}
          onChange={(_, v) => setFontSize(v as number)}
          min={16}
          max={28}
          step={2}
          marks={[
            { value: 16, label: '16px' },
            { value: 20, label: '20px' },
            { value: 24, label: '24px' },
            { value: 28, label: '28px' },
          ]}
          aria-label="字体大小"
        />
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography gutterBottom>音量: {Math.round(volume * 100)}%</Typography>
        <Slider
          value={volume}
          onChange={(_, v) => setVolume(v as number)}
          min={0}
          max={1}
          step={0.1}
          aria-label="音量"
        />
      </Box>

      <FormControlLabel
        control={
          <Switch
            checked={voiceGuide}
            onChange={() => {
              toggleVoiceGuide();
              speak(voiceGuide ? '已关闭语音引导' : '已开启语音引导');
            }}
          />
        }
        label="语音引导"
      />
    </Box>
  );
}
