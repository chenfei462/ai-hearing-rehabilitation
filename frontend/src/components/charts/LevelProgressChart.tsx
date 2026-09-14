import React from 'react';
import ReactECharts from 'echarts-for-react';
import { LevelProgress } from '../../services/reportService';

interface LevelProgressChartProps {
  data: LevelProgress[];
  title?: string;
}

const LEVEL_LABELS: Record<string, string> = {
  syllable: '音节',
  word: '词语',
  sentence: '语句',
  noise: '噪声环境',
};

const LEVEL_COLORS: Record<string, string> = {
  syllable: '#4caf50',
  word: '#2196f3',
  sentence: '#ff9800',
  noise: '#f44336',
};

/**
 * 训练级别进度图（雷达图）
 * 显示各级别的能力值(θ)和训练情况
 */
const LevelProgressChart: React.FC<LevelProgressChartProps> = ({
  data,
  title = '训练级别进度',
}) => {
  // 按固定顺序排列级别
  const orderedLevels = ['syllable', 'word', 'sentence', 'noise'];
  const indicators = orderedLevels.map((level) => {
    const item = data.find((d) => d.level === level);
    return {
      name: LEVEL_LABELS[level] || level,
      max: 3, // theta 最大值设为 3
    };
  });

  const thetaValues = orderedLevels.map((level) => {
    const item = data.find((d) => d.level === level);
    return item ? Math.max(0, item.theta + 1) : 0; // 偏移使值非负
  });

  const accuracyValues = orderedLevels.map((level) => {
    const item = data.find((d) => d.level === level);
    return item ? item.avg_accuracy * 3 : 0; // 映射到 0-3 范围
  });

  const option = {
    title: {
      text: title,
      left: 'center',
      textStyle: {
        fontSize: 18,
        fontWeight: 'bold' as const,
      },
    },
    tooltip: {
      trigger: 'item' as const,
    },
    legend: {
      data: ['能力值', '正确率'],
      bottom: 0,
      textStyle: { fontSize: 14 },
    },
    radar: {
      center: ['50%', '55%'],
      radius: '60%',
      indicator: indicators,
      axisName: {
        fontSize: 14,
        fontWeight: 'bold' as const,
      },
      splitArea: {
        areaStyle: {
          color: ['#f5f5f5', '#ffffff', '#f5f5f5', '#ffffff'],
        },
      },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: thetaValues,
            name: '能力值',
            lineStyle: { width: 2, color: '#1976d2' },
            areaStyle: { color: 'rgba(25, 118, 210, 0.2)' },
            itemStyle: { color: '#1976d2' },
          },
          {
            value: accuracyValues,
            name: '正确率',
            lineStyle: { width: 2, color: '#4caf50' },
            areaStyle: { color: 'rgba(76, 175, 80, 0.2)' },
            itemStyle: { color: '#4caf50' },
          },
        ],
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 350, width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  );
};

export default LevelProgressChart;
