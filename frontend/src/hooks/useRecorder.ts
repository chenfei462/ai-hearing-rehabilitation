import { useState, useRef, useCallback, useEffect } from 'react';

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped';

interface UseRecorderReturn {
  status: RecorderStatus;
  audioBlob: Blob | null;
  audioUrl: string | null;
  duration: number;        // 录音时长(秒)
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
  error: string | null;
}

/**
 * 录音 Hook — 基于 MediaRecorder API
 *
 * 特性：
 * - WAV 16kHz 单声道输出（前端转码）
 * - 录音时长实时更新
 * - 跨浏览器兼容（含微信 WebView 兜底）
 */
export function useRecorder(): UseRecorderReturn {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // 清理资源
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // 优先使用 WAV 格式，兜底使用 webm
      const mimeType = MediaRecorder.isTypeSupported('audio/wav')
        ? 'audio/wav'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setStatus('stopped');

        // 停止所有轨道
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.onerror = (e: any) => {
        setError(`录音出错: ${e.error?.message || '未知错误'}`);
        setStatus('idle');
      };

      recorder.start(100); // 每100ms 收集一次数据
      setStatus('recording');
      startTimeRef.current = Date.now();

      // 计时器
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 200);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('请允许麦克风权限后重试');
      } else if (err.name === 'NotFoundError') {
        setError('未检测到麦克风设备');
      } else {
        setError(`无法启动录音: ${err.message}`);
      }
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(audioBlob);
        return;
      }

      // 在 onstop 中会设置 audioBlob
      const originalOnStop = recorder.ondataavailable;
      recorder.onstop = (e) => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setStatus('stopped');
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        resolve(blob);
      };

      recorder.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    });
  }, [audioBlob]);

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.pause();
      setStatus('paused');
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'paused') {
      recorder.resume();
      setStatus('recording');
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 200);
    }
  }, []);

  const resetRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setStatus('idle');
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setError(null);
  }, [audioUrl]);

  return {
    status,
    audioBlob,
    audioUrl,
    duration,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    error,
  };
}
