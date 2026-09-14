import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TrainingSessionState {
  sessionId: number | null;
  level: string;
  currentItem: {
    id: number;
    text: string;
    audio_url: string;
    phonemes: string[];
    options?: string[];
  } | null;
  progress: {
    total: number;
    correct: number;
    current: number;
  };
  isTraining: boolean;
}

interface SessionStore {
  training: TrainingSessionState;

  // 训练会话 actions
  startTraining: (sessionId: number, level: string, firstItem: TrainingSessionState['currentItem']) => void;
  setCurrentItem: (item: TrainingSessionState['currentItem']) => void;
  recordAnswer: (isCorrect: boolean) => void;
  finishTraining: () => void;
  resetTraining: () => void;
}

const initialTraining: TrainingSessionState = {
  sessionId: null,
  level: '',
  currentItem: null,
  progress: { total: 0, correct: 0, current: 0 },
  isTraining: false,
};

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      training: { ...initialTraining },

      startTraining: (sessionId, level, firstItem) =>
        set({
          training: {
            sessionId,
            level,
            currentItem: firstItem,
            progress: { total: 10, correct: 0, current: 0 },
            isTraining: true,
          },
        }),

      setCurrentItem: (item) =>
        set((state) => ({
          training: { ...state.training, currentItem: item },
        })),

      recordAnswer: (isCorrect) =>
        set((state) => ({
          training: {
            ...state.training,
            progress: {
              ...state.training.progress,
              current: state.training.progress.current + 1,
              correct: state.training.progress.correct + (isCorrect ? 1 : 0),
            },
          },
        })),

      finishTraining: () =>
        set({ training: { ...initialTraining } }),

      resetTraining: () =>
        set({ training: { ...initialTraining } }),
    }),
    { name: 'session-storage' },
  ),
);
