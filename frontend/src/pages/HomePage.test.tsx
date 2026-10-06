import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from './HomePage';

const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../hooks/useSpeechGuide', () => ({
  useSpeechGuide: () => ({ speakButton: vi.fn() }),
}));

describe('HomePage', () => {
  beforeEach(() => navigate.mockClear());

  it('navigates to the selected training module', () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole('button', { name: /听觉训练/ }));

    expect(navigate).toHaveBeenCalledWith('/training');
  });
});
