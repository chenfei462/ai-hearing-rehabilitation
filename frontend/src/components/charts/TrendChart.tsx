import React from 'react';
import ReactECharts from 'echarts-for-react';
import type { AccuracyPoint } from '../../types';

interface TrendChartProps {
  data: AccuracyPoint[];
  title?: string;
}

/**
 * 正确率趋势图（折线图）
 * 显示按日期聚合的训练正确率变化曲线
 */
const TrendChart: React.FC<TrendChartProps> = ({ data, title = '正确率趋势' }) => {
  const dates = data.map((d) => d.date);
  const accuracies = data.map((d) => Math.round(d.accuracy * 100));
  const sessionCounts = data.map((d) => d.session_count);

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
      trigger: 'axis' as const,
      formatter: (params: Array<{ axisValue: string; value: number }>) => {
        const acc = params[0];
        const count = params[1];
        return `
          <div style="font-size: 14px;">
            <b>${acc.axisValue}</b><br/>
            正确率: <b>${acc.value}%</b><br/>
            训练次数: <b>${count.value}</b>
          </div>
        `;
      },
    },
    legend: {
      data: ['正确率', '训练次数'],
      bottom: 0,
      textStyle: { fontSize: 14 },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '12%',
      top: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category' as const,
      data: dates,
      axisLabel: {
        fontSize: 12,
        rotate: dates.length > 10 ? 45 : 0,
        formatter: (value: string) => {
          // 只显示月-日
          const parts = value.split('-');
          return parts.length >= 3 ? `${parts[1]}-${parts[2]}` : value;
        },
      },
    },
    yAxis: [
      {
        type: 'value' as const,
        name: '正确率(%)',
        min: 0,
        max: 100,
        axisLabel: { fontSize: 12, formatter: '{value}%' },
        splitLine: { lineStyle: { type: 'dashed' as const } },
      },
      {
        type: 'value' as const,
        name: '训练次数',
        min: 0,
        axisLabel: { fontSize: 12 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '正确率',
        type: 'line',
        yAxisIndex: 0,
        data: accuracies,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: {
          width: 3,
          color: '#1976d2',
        },
        itemStyle: {
          color: '#1976d2',
          borderWidth: 2,
        },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(25, 118, 210, 0.3)' },
              { offset: 1, color: 'rgba(25, 118, 210, 0.02)' },
            ],
          },
        },
        // 80% 基准线
        markLine: {
          silent: true,
          data: [
            {
              yAxis: 80,
              lineStyle: { color: '#4caf50', type: 'dashed' as const, width: 2 },
              label: {
                formatter: '目标 80%',
                position: 'end' as const,
                fontSize: 12,
                color: '#4caf50',
              },
            },
          ],
        },
      },
      {
        name: '训练次数',
        type: 'bar',
        yAxisIndex: 1,
        data: sessionCounts,
        barWidth: '40%',
        itemStyle: {
          color: 'rgba(156, 39, 176, 0.6)',
          borderRadius: [4, 4, 0, 0],
        },
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

export default TrendChart;
