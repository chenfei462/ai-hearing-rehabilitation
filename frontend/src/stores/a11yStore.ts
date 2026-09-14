import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** 主题模式 */
export type ThemeMode = 'default' | 'large' | 'high-contrast';

/** 无障碍状态 */
interface A11yState {
  /** 字体大小 (px) */
  fontSize: number;
  /** 主题模式 */
  themeMode: ThemeMode;
  /** 音量 (0-1) */
  volume: number;
  /** 语音引导开关 */
  voiceGuide: boolean;
  /** 高对比度开关 */
  highContrast: boolean;
  /** 字幕开关 */
  subtitle: boolean;
  /** 语音引导速率 (0.5-1.5) */
  speechRate: number;

  // Actions
  setFontSize: (size: number) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setVolume: (vol: number) => void;
  toggleVoiceGuide: () => void;
  toggleHighContrast: () => void;
  toggleSubtitle: () => void;
  setSpeechRate: (rate: number) => void;
  resetToDefaults: () => void;
}

const defaults = {
  fontSize: 18,
  themeMode: 'default' as ThemeMode,
  volume: 0.8,
  voiceGuide: true,
  highContrast: false,
  subtitle: true,
  speechRate: 0.8,
};

export const useA11yStore = create<A11yState>()(
  persist(
    (set) => ({
      ...defaults,

      setFontSize: (size) => {
        const clamped = Math.min(28, Math.max(16, size));
        document.documentElement.style.fontSize = `${clamped}px`;
        set({ fontSize: clamped });
      },

      setThemeMode: (mode) => {
        if (mode === 'high-contrast') {
          set({ themeMode: mode, highContrast: true });
        } else {
          set({ themeMode: mode });
        }
      },

      setVolume: (vol) => set({ volume: Math.min(1, Math.max(0, vol)) }),

      toggleVoiceGuide: () => set((s) => ({ voiceGuide: !s.voiceGuide })),

      toggleHighContrast: () =>
        set((s) => ({
          highContrast: !s.highContrast,
          themeMode: !s.highContrast ? 'high-contrast' : 'default',
        })),

      toggleSubtitle: () => set((s) => ({ subtitle: !s.subtitle })),

      setSpeechRate: (rate) => set({ speechRate: Math.min(1.5, Math.max(0.5, rate)) }),

      resetToDefaults: () => {
        document.documentElement.style.fontSize = `${defaults.fontSize}px`;
        set(defaults);
      },
    }),
    {
      name: 'a11y-preferences',
      partialize: (state) => ({
        fontSize: state.fontSize,
        themeMode: state.themeMode,
        volume: state.volume,
        voiceGuide: state.voiceGuide,
        highContrast: state.highContrast,
        subtitle: state.subtitle,
        speechRate: state.speechRate,
      }),
    },
  ),
);

export default useA11yStore;
