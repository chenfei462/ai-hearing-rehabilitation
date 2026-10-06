import api from './api';
import type {
  ApiResponse,
  LevelDistribution,
  PatientSummary,
  TrainingSummary,
  WeeklyReportData,
} from '../types';

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
