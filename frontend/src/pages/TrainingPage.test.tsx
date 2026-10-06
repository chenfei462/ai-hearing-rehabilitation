import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TrainingPage from './TrainingPage';
import { trainingService } from '../services/trainingService';

vi.mock('../services/trainingService', () => ({
  trainingService: {
    startSession: vi.fn(),
    getNextItem: vi.fn(),
    submitAnswer: vi.fn(),
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

describe('TrainingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts a session after selecting a training level', async () => {
    vi.mocked(trainingService.startSession).mockResolvedValue({
      data: {
        session_id: 10,
        level: 'syllable',
        first_item: {
          id: 20,
          level: 'syllable',
          content_type: 'syllable',
          text: 'ma',
          audio_url: '/ma.mp3',
          phonemes: ['m', 'a'],
          difficulty_b: 0,
          tags: {},
        },
      },
    } as never);

    render(<TrainingPage />, { wrapper: MemoryRouter });
    fireEvent.click(screen.getByText('音节').closest('[role]') ?? screen.getByText('音节'));

    await waitFor(() => expect(trainingService.startSession).toHaveBeenCalledWith('syllable'));
    expect(await screen.findByText('请听音频并回答')).toBeInTheDocument();
  });
});
