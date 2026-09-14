import { useState, useRef, useCallback, useEffect } from 'react';

export type PlayerState = 'idle' | 'loading' | 'playing' | 'paused';

export interface UseAudioPlayerReturn {
  state: PlayerState;
  currentTime: number;
  duration: number;
  play: (url: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  volume: number;
}

/**
 * 音频播放 hook
 * 用于播放 AI 回复音频（TTS 合成结果）
 */
export function useAudioPlayer(): UseAudioPlayerReturn {
  const [state, setState] = useState<PlayerState>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1.0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = window.setInterval(() => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const play = useCallback(
    async (url: string) => {
      // 停止当前播放
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      stopTimer();

      setState('loading');

      const audio = new Audio(url);
      audio.volume = volume;
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
      };

      audio.oncanplaythrough = () => {
        setState('playing');
        audio.play().catch((err) => {
          console.error('播放失败:', err);
          setState('idle');
        });
        startTimer();
      };

      audio.onended = () => {
        setState('idle');
        setCurrentTime(0);
        stopTimer();
      };

      audio.onerror = () => {
        console.error('音频加载失败:', url);
        setState('idle');
        stopTimer();
      };

      // 开始加载
      audio.load();
    },
    [volume, startTimer, stopTimer],
  );

  const pause = useCallback(() => {
    if (audioRef.current && state === 'playing') {
      audioRef.current.pause();
      setState('paused');
      stopTimer();
    }
  }, [state, stopTimer]);

  const resume = useCallback(() => {
    if (audioRef.current && state === 'paused') {
      audioRef.current.play().catch((err) => {
        console.error('恢复播放失败:', err);
      });
      setState('playing');
      startTimer();
    }
  }, [state, startTimer]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setState('idle');
    setCurrentTime(0);
    setDuration(0);
    stopTimer();
  }, [stopTimer]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  }, []);

  return {
    state,
    currentTime,
    duration,
    play,
    pause,
    resume,
    stop,
    seek,
    setVolume,
    volume,
  };
}
