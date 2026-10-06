import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './LoginPage';
import { useAuthStore } from '../stores/authStore';
import { loginWithPhone, sendSmsCode } from '../api/auth';

vi.mock('../api/auth', () => ({
  sendSmsCode: vi.fn(),
  loginWithPhone: vi.fn(),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  it('rejects an invalid phone number before requesting a code', () => {
    render(<LoginPage />, { wrapper: MemoryRouter });

    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '22345678901' } });
    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));

    expect(screen.getByText('请输入正确的手机号')).toBeInTheDocument();
    expect(sendSmsCode).not.toHaveBeenCalled();
  });

  it('sends a code and logs in with the submitted code', async () => {
    vi.mocked(sendSmsCode).mockResolvedValue({} as never);
    vi.mocked(loginWithPhone).mockResolvedValue({
      user: { id: 1, phone: '13800138000', role: 'patient', nickname: '测试用户' },
    } as never);
    render(<LoginPage />, { wrapper: MemoryRouter });

    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13800138000' } });
    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));
    await waitFor(() => expect(screen.getByLabelText('验证码')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('验证码'), { target: { value: '9876' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => expect(loginWithPhone).toHaveBeenCalledWith({
      phone: '13800138000',
      code: '9876',
    }));
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
