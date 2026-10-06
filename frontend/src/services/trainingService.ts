import api from './api';
import { ApiResponse, TrainingItem } from '../types';

export const trainingService = {
  startSession: (level: string) =>
    api.post<ApiResponse<{ session_id: number; level: string; first_item: TrainingItem | null }>>(
      `/training/sessions?level=${encodeURIComponent(level)}`
    ),

  getNextItem: (sessionId: number) =>
    api.get<ApiResponse<TrainingItem>>(`/training/sessions/${sessionId}/next`),

  submitAnswer: (sessionId: number, itemId: number, answer: string, responseMs?: number) =>
    api.post<ApiResponse<{ is_correct: boolean; theta: number; se: number; next_action: string }>>(
      `/training/sessions/${sessionId}/answer?item_id=${itemId}&answer=${encodeURIComponent(answer)}`,
      { response_ms: responseMs ?? 0 },
    ),

  finishSession: (sessionId: number) =>
    api.post<ApiResponse<{ accuracy: number; total_items: number; correct_items: number }>>(
      `/training/sessions/${sessionId}/finish`,
    ),
};
