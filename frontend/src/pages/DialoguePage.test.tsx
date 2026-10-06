import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DialoguePage from './DialoguePage';
import { dialogueService } from '../services/dialogueService';

vi.mock('../services/dialogueService', () => ({
  dialogueService: {
    listScenarios: vi.fn(),
    startSession: vi.fn(),
    handleTurn: vi.fn(),
    finishSession: vi.fn(),
  },
}));

vi.mock('../hooks/useRecorder', () => ({
  useRecorder: () => ({
    status: 'idle',
    audioBlob: null,
    audioUrl: null,
    duration: 0,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    pauseRecording: vi.fn(),
    resumeRecording: vi.fn(),
    resetRecording: vi.fn(),
    error: null,
  }),
}));

vi.mock('../hooks/useAudioPlayer', () => ({
  useAudioPlayer: () => ({
    state: 'idle',
    currentTime: 0,
    duration: 0,
    play: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    volume: 1,
  }),
}));

describe('DialoguePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads scenarios and starts the selected dialogue', async () => {
    vi.mocked(dialogueService.listScenarios).mockResolvedValue({
      data: [{ id: 'daily', name: '日常交流', description: '练习日常对话', rounds: 3 }],
    } as never);
    vi.mocked(dialogueService.startSession).mockResolvedValue({
      data: {
        session_id: 4,
        scenario: 'daily',
        greeting_text: '你好，今天感觉怎么样？',
        greeting_audio_url: null,
        max_turns: 3,
      },
    } as never);

    render(<DialoguePage />);
    expect(await screen.findByText('日常交流')).toBeInTheDocument();
    fireEvent.click(screen.getByText('日常交流'));

    await waitFor(() => expect(dialogueService.startSession).toHaveBeenCalledWith('daily'));
    expect(await screen.findByText('你好，今天感觉怎么样？')).toBeInTheDocument();
  });
});
