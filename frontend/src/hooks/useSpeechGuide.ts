import { useCallback, useEffect, useRef } from 'react';
import { useA11yStore } from '../stores/a11yStore';
import { useLocation } from 'react-router-dom';

/** 页面名称映射 */
const PAGE_NAMES: Record<string, string> = {
  '/': '首页',
  '/training': '听觉训练',
  '/dialogue': '对话陪练',
  '/pronunciation': '发音反馈',
  '/report': '训练报告',
  '/settings': '设置',
  '/login': '登录',
  '/conversation': '对话练习',
};

/** 语音引导 Hook */
export function useSpeechGuide() {
  const { voiceGuide, volume, speechRate } = useA11yStore();
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const location = useLocation();

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    return () => {
      synthRef.current?.cancel();
    };
  }, []);

  /** 页面切换时自动播报 */
  useEffect(() => {
    if (!voiceGuide) return;
    const pageName = PAGE_NAMES[location.pathname];
    if (pageName) {
      // 延迟一下让页面先渲染
      const timer = setTimeout(() => speak(`已进入${pageName}页面`), 500);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, voiceGuide]);

  /** 朗读文本 */
  const speak = useCallback(
    (text: string) => {
      if (!voiceGuide || !synthRef.current) return;
      synthRef.current.cancel(); // 取消之前的朗读
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = speechRate;
      utterance.volume = volume;
      synthRef.current.speak(utterance);
    },
    [voiceGuide, volume, speechRate],
  );

  /** 停止朗读 */
  const stop = useCallback(() => {
    synthRef.current?.cancel();
  }, []);

  /** 朗读操作提示 */
  const speakAction = useCallback(
    (action: string) => {
      speak(action);
    },
    [speak],
  );

  /** 朗读按钮文本（自动添加"按钮"后缀） */
  const speakButton = useCallback(
    (label: string) => {
      speak(`${label}按钮`);
    },
    [speak],
  );

  /** 朗读错误提示 */
  const speakError = useCallback(
    (message: string) => {
      speak(`提示：${message}`);
    },
    [speak],
  );

  /** 朗读成功提示 */
  const speakSuccess = useCallback(
    (message: string) => {
      speak(`完成：${message}`);
    },
    [speak],
  );

  return {
    speak,
    stop,
    speakAction,
    speakButton,
    speakError,
    speakSuccess,
    isSpeaking: synthRef.current?.speaking ?? false,
    voiceGuide,
  };
}

export default useSpeechGuide;
