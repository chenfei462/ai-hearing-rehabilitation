import { Chip, ChipProps } from '@mui/material';
import { TrainingLevel } from '../../types';

interface LevelBadgeProps extends Omit<ChipProps, 'label' | 'color'> {
  level: TrainingLevel;
  showDifficulty?: boolean;
}

const levelConfig: Record<TrainingLevel, {
  label: string;
  difficulty: string;
  color: ChipProps['color'];
}> = {
  syllable: {
    label: '音节',
    difficulty: '入门',
    color: 'success',
  },
  word: {
    label: '词语',
    difficulty: '初级',
    color: 'info',
  },
  sentence: {
    label: '语句',
    difficulty: '中级',
    color: 'warning',
  },
  noise: {
    label: '噪声',
    difficulty: '高级',
    color: 'error',
  },
};

export default function LevelBadge({ level, showDifficulty = true, ...props }: LevelBadgeProps) {
  const config = levelConfig[level];

  return (
    <Chip
      label={showDifficulty ? `${config.label} · ${config.difficulty}` : config.label}
      color={config.color}
      size="medium"
      sx={{
        fontSize: '1.125rem',  // 18px 老年适配
        fontWeight: 600,
        px: 1.5,
        py: 0.5,
        ...props.sx,
      }}
      {...props}
    />
  );
}