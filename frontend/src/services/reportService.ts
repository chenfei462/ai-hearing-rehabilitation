import api from './api';
import { ApiResponse } from '../types';

/** 正确率曲线数据点 */
export interface AccuracyPoint {
  date: string;
  accuracy: number;
  session_count: number;
}

/** 各级别进度 */
export interface LevelProgress {
  level: string;
  theta: number;
  se: number;
  session_count: number;
  avg_accuracy: number;
}

/** 每日活动 */
export interface DailyActivity {
  date: string;
  session_count: number;
  total_items: number;
  duration_minutes: number;
}

/** 训练概览 */
export interface TrainingSummary {
  total_sessions: number;
  total_items: number;
  correct_items: number;
  avg_accuracy: number;
  total_duration_minutes: number;
  accuracy_curve: AccuracyPoint[];
  adherence_rate: number;
  daily_activity: DailyActivity[];
  level_progress: LevelProgress[];
  streak_days: number;
  last_training_date: string | null;
}

/** 训练级别分布 */
export interface LevelDistribution {
  level: string;
  count: number;
}

/** 周报数据 */
export interface WeeklyReportData {
  user_id: number;
  week_start: string;
  week_end: string;
  total_sessions: number;
  total_duration_minutes: number;
  avg_accuracy: number;
  adherence_rate: number;
  accuracy_trend: 'improving' | 'stable' | 'declining';
  level_progress: LevelProgress[];
  daily_breakdown: DailyActivity[];
  highlight: string;
  suggestion: string;
}

/** 患者概要（听力师视角）*/
export interface PatientSummary {
  user_id: number;
  nickname: string;
  phone: string;
  last_training_date: string | null;
  total_sessions: number;
  avg_accuracy: number;
  adherence_rate: number;
  current_level: string;
  streak_days: number;
  alert: string | null;
}

export const reportService = {
  /** 获取用户训练概览 */
  getSummary: (days: number = 30) =>
    api.get<ApiResponse<TrainingSummary>>('/report/summary', { params: { days } }),

  /** 获取训练级别分布 */
  getLevelDistribution: () =>
    api.get<ApiResponse<LevelDistribution[]>>('/report/levels'),

  /** 获取患者列表（听力师权限） */
  getPatients: () =>
    api.get<ApiResponse<PatientSummary[]>>('/report/patients'),

  /** 获取周报 */
  getWeeklyReport: () =>
    api.get<ApiResponse<WeeklyReportData>>('/report/weekly'),
};
