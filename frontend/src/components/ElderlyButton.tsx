import { Button, ButtonProps } from '@mui/material';

interface ElderlyButtonProps extends ButtonProps {
  speak?: (text: string) => void;
}

export function ElderlyButton({ children, speak, onClick, ...props }: ElderlyButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (speak && typeof children === 'string') {
      speak(children);
    }
    onClick?.(e);
  };

  return (
    <Button
      {...props}
      onClick={handleClick}
      sx={{
        minHeight: 56,
        minWidth: 120,
        fontSize: '1.25rem',
        ...props.sx,
      }}
    >
      {children}
    </Button>
  );
}
