import { useEffect } from 'react';
import { useA11yStore } from '../stores/a11yStore';

/**
 * 字体大小 Hook
 * 同步字体大小到 document.documentElement.style.fontSize
 */
export function useFontSize() {
  const { fontSize, setFontSize } = useA11yStore();

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  return { fontSize, setFontSize };
}

/**
 * 语音引导 Hook（简化版）
 * 完整版请使用 useSpeechGuide
 */
export function useVoiceGuide() {
  const { voiceGuide, toggleVoiceGuide, volume } = useA11yStore();

  const speak = (text: string) => {
    if (!voiceGuide) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.8;
    utterance.volume = volume;
    speechSynthesis.speak(utterance);
  };

  return { voiceGuide, toggleVoiceGuide, speak };
}
