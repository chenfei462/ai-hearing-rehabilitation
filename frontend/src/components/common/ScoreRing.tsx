import { Box, Typography, SxProps, Theme } from '@mui/material';

interface ScoreRingProps {
  score: number;          // 0-100
  size?: number;          // 环直径 (px)
  strokeWidth?: number;   // 环宽度
  label?: string;         // 环内文字标签
  color?: string;         // 自定义颜色
  showValue?: boolean;    // 是否显示分数值
  sx?: SxProps<Theme>;
}

/**
 * 评分环组件 — 用于展示发音评分
 *
 * 颜色映射：
 * - >= 80: 绿色（优秀）
 * - >= 60: 橙色（良好）
 * - < 60:  红色（需改善）
 */
export default function ScoreRing({
  score,
  size = 120,
  strokeWidth = 8,
  label,
  color,
  showValue = true,
  sx,
}: ScoreRingProps) {
  const normalizedScore = Math.max(0, Math.min(100, score));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalizedScore / 100) * circumference;

  // 根据分数决定颜色
  const getColor = () => {
    if (color) return color;
    if (normalizedScore >= 80) return '#4caf50'; // 绿色
    if (normalizedScore >= 60) return '#ff9800'; // 橙色
    return '#f44336'; // 红色
  };

  const getGrade = () => {
    if (normalizedScore >= 90) return '优秀';
    if (normalizedScore >= 80) return '很好';
    if (normalizedScore >= 60) return '良好';
    if (normalizedScore >= 40) return '一般';
    return '需改善';
  };

  return (
    <Box
      sx={{
        position: 'relative',
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...sx,
      }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* 背景环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e0e0e0"
          strokeWidth={strokeWidth}
        />
        {/* 分数环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.8s ease-in-out',
          }}
        />
      </svg>

      {/* 中心文字 */}
      <Box
        sx={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {showValue && (
          <Typography
            variant="h4"
            sx={{
              fontWeight: 'bold',
              color: getColor(),
              lineHeight: 1,
              fontSize: size > 100 ? '2rem' : '1.25rem',
            }}
          >
            {Math.round(normalizedScore)}
          </Typography>
        )}
        {label && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontSize: size > 100 ? '1.125rem' : '1rem', // 18px/16px 老年适配
              mt: 0.5,
            }}
          >
            {label}
          </Typography>
        )}
        {!label && showValue && size > 100 && (
          <Typography
            variant="caption"
            sx={{ color: getColor(), fontSize: '1.125rem', mt: 0.5 }} // 18px 老年适配
          >
            {getGrade()}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
