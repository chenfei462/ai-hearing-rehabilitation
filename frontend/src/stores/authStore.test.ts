import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from './authStore';

const user = {
  id: 1,
  phone: '13800138000',
  role: 'patient' as const,
  nickname: '测试用户',
};

describe('auth store', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  it('stores the authenticated user without persisting a token', () => {
    useAuthStore.getState().login(user);

    expect(useAuthStore.getState().user).toEqual(user);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(localStorage.getItem('auth-storage')).toBeNull();
  });

  it('merges profile updates and can clear the session', () => {
    useAuthStore.getState().login(user);
    useAuthStore.getState().updateUser({ nickname: '新昵称' });

    expect(useAuthStore.getState().user?.nickname).toBe('新昵称');
    useAuthStore.setState({ user: null, isAuthenticated: false });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
