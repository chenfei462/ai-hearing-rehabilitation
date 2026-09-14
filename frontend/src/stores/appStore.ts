import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  // 用户信息
  user: {
    id: string | null;
    name: string;
    avatar: string | null;
  };

  // Actions
  setUser: (user: Partial<AppState['user']>) => void;
  reset: () => void;
}

const initialState = {
  user: {
    id: null,
    name: '',
    avatar: null,
  },
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialState,

      setUser: (user) =>
        set((state) => ({
          user: { ...state.user, ...user },
        })),

      reset: () => set(initialState),
    }),
    {
      name: 'hearing-rehab-storage',
      partialize: (state) => ({
        user: { id: state.user.id, name: state.user.name },
      }),
    },
  ),
);

export default useAppStore;
