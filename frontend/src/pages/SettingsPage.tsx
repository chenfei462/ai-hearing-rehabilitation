import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  Slider,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Paper,
} from '@mui/material';
import {
  VolumeUp,
  TextFields,
  Contrast,
  RecordVoiceOver,
  Subtitles,
  Speed,
  Restore,
} from '@mui/icons-material';
import { useA11yStore, ThemeMode } from '../stores/a11yStore';
import { useSpeechGuide } from '../hooks/useSpeechGuide';

export default function SettingsPage() {
  const {
    fontSize,
    setFontSize,
    themeMode,
    setThemeMode,
    volume,
    setVolume,
    voiceGuide,
    toggleVoiceGuide,
    highContrast,
    toggleHighContrast,
    subtitle,
    toggleSubtitle,
    speechRate,
    setSpeechRate,
    resetToDefaults,
  } = useA11yStore();

  const { speak } = useSpeechGuide();

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        无障碍设置
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        根据您的使用习惯调整界面和交互设置
      </Typography>

      <Paper elevation={2} sx={{ borderRadius: 3, mb: 3 }}>
        <List disablePadding>
          {/* 字体大小 */}
          <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 1 }}>
              <ListItemIcon sx={{ minWidth: 48 }}>
                <TextFields color="primary" sx={{ fontSize: 28 }} />
              </ListItemIcon>
              <ListItemText
                primary="字体大小"
                secondary={`当前: ${fontSize}px（建议 ≥18px）`}
              />
            </Box>
            <Slider
              value={fontSize}
              onChange={(_, v) => setFontSize(v as number)}
              min={16}
              max={28}
              step={2}
              marks={[
                { value: 16, label: '16' },
                { value: 20, label: '20' },
                { value: 24, label: '24' },
                { value: 28, label: '28' },
              ]}
              sx={{ px: 2 }}
              aria-label="字体大小"
            />
          </ListItem>

          <Divider />

          {/* 主题模式 */}
          <ListItem sx={{ py: 2.5 }}>
            <ListItemIcon sx={{ minWidth: 48 }}>
              <Contrast color="primary" sx={{ fontSize: 28 }} />
            </ListItemIcon>
            <ListItemText primary="主题模式" secondary="选择适合您的显示模式" />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>主题</InputLabel>
              <Select
                value={themeMode}
                label="主题"
                onChange={(e) => {
                  const mode = e.target.value as ThemeMode;
                  setThemeMode(mode);
                  speak(
                    mode === 'large'
                      ? '已切换到大字体模式'
                      : mode === 'high-contrast'
                        ? '已切换到高对比度模式'
                        : '已切换到默认模式',
                  );
                }}
              >
                <MenuItem value="default">默认模式</MenuItem>
                <MenuItem value="large">大字体模式</MenuItem>
                <MenuItem value="high-contrast">高对比度</MenuItem>
              </Select>
            </FormControl>
          </ListItem>

          <Divider />

          {/* 高对比度开关 */}
          <ListItem sx={{ py: 2.5 }}>
            <ListItemIcon sx={{ minWidth: 48 }}>
              <Contrast color="primary" sx={{ fontSize: 28 }} />
            </ListItemIcon>
            <ListItemText
              primary="高对比度模式"
              secondary="增强文字与背景对比度"
            />
            <Switch
              checked={highContrast}
              onChange={() => {
                toggleHighContrast();
                speak(highContrast ? '已关闭高对比度模式' : '已开启高对比度模式');
              }}
              inputProps={{ 'aria-label': '高对比度模式' }}
            />
          </ListItem>

          <Divider />

          {/* 音量设置 */}
          <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 1 }}>
              <ListItemIcon sx={{ minWidth: 48 }}>
                <VolumeUp color="primary" sx={{ fontSize: 28 }} />
              </ListItemIcon>
              <ListItemText primary="音量" secondary={`当前: ${Math.round(volume * 100)}%`} />
            </Box>
            <Slider
              value={volume}
              onChange={(_, v) => setVolume(v as number)}
              min={0}
              max={1}
              step={0.1}
              marks={[
                { value: 0, label: '静音' },
                { value: 0.5, label: '50%' },
                { value: 1, label: '100%' },
              ]}
              sx={{ px: 2 }}
              aria-label="音量"
            />
          </ListItem>

          <Divider />

          {/* 语音引导 */}
          <ListItem sx={{ py: 2.5 }}>
            <ListItemIcon sx={{ minWidth: 48 }}>
              <RecordVoiceOver color="primary" sx={{ fontSize: 28 }} />
            </ListItemIcon>
            <ListItemText
              primary="语音引导"
              secondary="关键操作和页面切换时语音提示"
            />
            <Switch
              checked={voiceGuide}
              onChange={() => {
                toggleVoiceGuide();
                speak(voiceGuide ? '已关闭语音引导' : '已开启语音引导');
              }}
              inputProps={{ 'aria-label': '语音引导' }}
            />
          </ListItem>

          <Divider />

          {/* 语速设置 */}
          <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 1 }}>
              <ListItemIcon sx={{ minWidth: 48 }}>
                <Speed color="primary" sx={{ fontSize: 28 }} />
              </ListItemIcon>
              <ListItemText primary="语音速率" secondary={`当前: ${speechRate}x（越小越慢）`} />
            </Box>
            <Slider
              value={speechRate}
              onChange={(_, v) => setSpeechRate(v as number)}
              min={0.5}
              max={1.5}
              step={0.1}
              marks={[
                { value: 0.5, label: '慢' },
                { value: 0.8, label: '正常' },
                { value: 1.2, label: '快' },
              ]}
              sx={{ px: 2 }}
              aria-label="语音速率"
            />
          </ListItem>

          <Divider />

          {/* 字幕开关 */}
          <ListItem sx={{ py: 2.5 }}>
            <ListItemIcon sx={{ minWidth: 48 }}>
              <Subtitles color="primary" sx={{ fontSize: 28 }} />
            </ListItemIcon>
            <ListItemText
              primary="字幕显示"
              secondary="音频播放时显示字幕"
            />
            <Switch
              checked={subtitle}
              onChange={() => {
                toggleSubtitle();
                speak(subtitle ? '已关闭字幕' : '已开启字幕');
              }}
              inputProps={{ 'aria-label': '字幕显示' }}
            />
          </ListItem>
        </List>
      </Paper>

      {/* 重置按钮 */}
      <Box sx={{ textAlign: 'center' }}>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<Restore />}
          onClick={() => {
            resetToDefaults();
            speak('已恢复默认设置');
          }}
          sx={{
            minHeight: 48,
            fontSize: '1rem',
            borderColor: 'text.secondary',
            '&:hover': {
              borderColor: 'text.primary',
            },
          }}
        >
          恢复默认设置
        </Button>
      </Box>
    </Box>
  );
}
