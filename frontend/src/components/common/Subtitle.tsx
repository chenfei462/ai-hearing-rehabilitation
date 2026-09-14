import { Box, Typography } from '@mui/material';
import { useA11yStore } from '../../stores/a11yStore';

interface SubtitleProps {
  /** 字幕文本 */
  text: string;
  /** 是否激活（高亮显示） */
  active?: boolean;
  /** 是否显示背景 */
  withBackground?: boolean;
}

/**
 * 字幕组件
 * - 大字体显示
 * - 高对比度支持
 * - 可选背景
 */
export default function Subtitle({
  text,
  active = false,
  withBackground = true,
}: SubtitleProps) {
  const { subtitle, highContrast } = useA11yStore();

  if (!subtitle || !text) return null;

  return (
    <Box
      sx={{
        py: 1.5,
        px: 2,
        borderRadius: 2,
        bgcolor: withBackground
          ? highContrast
            ? 'rgba(0, 0, 0, 0.85)'
            : 'rgba(0, 0, 0, 0.75)'
          : 'transparent',
        textAlign: 'center',
        minHeight: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Typography
        variant="h6"
        sx={{
          color: active ? '#ffd54f' : '#ffffff',
          fontWeight: active ? 700 : 500,
          fontSize: { xs: '1.125rem', sm: '1.25rem' },
          lineHeight: 1.6,
          letterSpacing: 1,
          textShadow: highContrast ? '0 0 4px rgba(0,0,0,0.8)' : 'none',
        }}
      >
        {text}
      </Typography>
    </Box>
  );
}
