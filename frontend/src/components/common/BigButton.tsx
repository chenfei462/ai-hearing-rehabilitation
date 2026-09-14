import { Button, ButtonProps, CircularProgress } from '@mui/material';
import { useSpeechGuide } from '../../hooks/useSpeechGuide';

interface BigButtonProps extends Omit<ButtonProps, 'onClick'> {
  /** 点击回调 */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** 是否加载中 */
  loading?: boolean;
  /** 是否启用语音提示 */
  withSpeech?: boolean;
}

/**
 * 老年友好大按钮组件
 * - 最小高度 56px，宽度自适应
 * - 字号 ≥18px
 * - 可选语音提示
 * - 支持加载状态
 */
export default function BigButton({
  children,
  onClick,
  loading = false,
  withSpeech = true,
  disabled,
  sx,
  ...props
}: BigButtonProps) {
  const { speakButton } = useSpeechGuide();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (loading || disabled) return;
    if (withSpeech && typeof children === 'string') {
      speakButton(children);
    }
    onClick?.(e);
  };

  return (
    <Button
      {...props}
      onClick={handleClick}
      disabled={disabled || loading}
      sx={{
        minHeight: 56,
        minWidth: 160,
        fontSize: '1.125rem',
        fontWeight: 600,
        borderRadius: 12,
        px: 4,
        py: 1.5,
        textTransform: 'none',
        boxShadow: 2,
        '&:hover': {
          boxShadow: 4,
        },
        ...sx,
      }}
    >
      {loading ? (
        <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} />
      ) : null}
      {children}
    </Button>
  );
}
