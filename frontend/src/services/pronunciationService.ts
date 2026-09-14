import api from './api';
import { ApiResponse, PronunciationTask, PronunciationResult, PronunciationHistoryItem, PronunciationStats } from '../types';

export const pronunciationService = {
  /** 获取下一个发音练习任务 */
  getNextTask: () =>
    api.get<ApiResponse<PronunciationTask>>('/pronunciation/tasks/next'),

  /** 提交录音，返回评分结果 */
  evaluate: (audioBlob: Blob, targetText: string, targetPhonemes?: string[]) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');
    formData.append('target_text', targetText);
    if (targetPhonemes) {
      formData.append('target_phonemes', JSON.stringify(targetPhonemes));
    }
    return api.post<ApiResponse<PronunciationResult>>('/pronunciation/attempts', formData);
  },

  /** 获取历史记录 */
  getHistory: (limit = 20, offset = 0) =>
    api.get<ApiResponse<PronunciationHistoryItem[]>>(
      `/pronunciation/attempts?limit=${limit}&offset=${offset}`
    ),

  /** 获取统计数据 */
  getStats: () =>
    api.get<ApiResponse<PronunciationStats>>('/pronunciation/stats'),
};
