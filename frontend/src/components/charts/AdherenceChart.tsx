import React from 'react';
import ReactECharts from 'echarts-for-react';

interface AdherenceChartProps {
  rate: number; // 0-1 之间的依从率
  streakDays: number;
  title?: string;
}

/**
 * 依从率仪表盘图
 * 显示训练依从率和连续训练天数
 */
const AdherenceChart: React.FC<AdherenceChartProps> = ({
  rate,
  streakDays,
  title = '训练依从率',
}) => {
  const percentage = Math.round(rate * 100);

  // 根据依从率确定颜色
  const getColor = (val: number) => {
    if (val >= 80) return '#4caf50';
    if (val >= 60) return '#ff9800';
    return '#f44336';
  };

  const color = getColor(percentage);

  const option = {
    title: {
      text: title,
      left: 'center',
      top: '5%',
      textStyle: {
        fontSize: 18,
        fontWeight: 'bold' as const,
      },
    },
    series: [
      {
        type: 'gauge',
        center: ['50%', '60%'],
        radius: '80%',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        splitNumber: 10,
        axisLine: {
          lineStyle: {
            width: 20,
            color: [
              [0.6, '#f44336'],
              [0.8, '#ff9800'],
              [1, '#4caf50'],
            ],
          },
        },
        pointer: {
          icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
          length: '60%',
          width: 8,
          offsetCenter: [0, '-50%'],
          itemStyle: {
            color: 'auto',
          },
        },
        axisTick: {
          length: 8,
          lineStyle: {
            color: 'auto',
            width: 1,
          },
        },
        splitLine: {
          length: 15,
          lineStyle: {
            color: 'auto',
            width: 2,
          },
        },
        axisLabel: {
          fontSize: 14,
          distance: -50,
          formatter: (value: number) => {
            if (value === 0 || value === 50 || value === 100) return `${value}%`;
            return '';
          },
        },
        title: {
          offsetCenter: [0, '30%'],
          fontSize: 14,
          color: '#666',
        },
        detail: {
          fontSize: 32,
          offsetCenter: [0, '10%'],
          valueAnimation: true,
          formatter: '{value}%',
          color: color,
          fontWeight: 'bold' as const,
        },
        data: [
          {
            value: percentage,
            name: `连续训练 ${streakDays} 天`,
          },
        ],
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 300, width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  );
};

export default AdherenceChart;
