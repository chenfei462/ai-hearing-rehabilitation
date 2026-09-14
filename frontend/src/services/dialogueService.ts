import api from './api';
import { ApiResponse, DialogueScenario, DialogueSessionStart, DialogueTurn, DialogueSessionFinish } from '../types';

export const dialogueService = {
  /** 获取可用对话场景列表 */
  listScenarios: () =>
    api.get<ApiResponse<DialogueScenario[]>>('/dialogue/scenarios'),

  /** 开始对话会话 */
  startSession: (scenarioId: string) =>
    api.post<ApiResponse<DialogueSessionStart>>('/dialogue/sessions', {
      scenario: scenarioId,
    }),

  /** 提交一轮语音，获取 AI 回复 */
  handleTurn: (sessionId: number, audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    return api.post<ApiResponse<DialogueTurn>>(
      `/dialogue/sessions/${sessionId}/turn`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000, // 30s 超时（ASR + LLM + TTS）
      },
    );
  },

  /** 结束对话会话，获取对话小结 */
  finishSession: (sessionId: number) =>
    api.post<ApiResponse<DialogueSessionFinish>>(
      `/dialogue/sessions/${sessionId}/finish`,
    ),
};
