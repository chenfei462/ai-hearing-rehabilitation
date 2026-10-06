import { describe, expect, it } from 'vitest';
import { getErrorMessage } from './errors';

describe('getErrorMessage', () => {
  it('returns Error messages', () => {
    expect(getErrorMessage(new Error('请求失败'), '默认错误')).toBe('请求失败');
  });

  it('supports API error objects', () => {
    expect(getErrorMessage({ message: '验证码错误' }, '默认错误')).toBe('验证码错误');
  });

  it('uses the fallback for unknown values', () => {
    expect(getErrorMessage({ code: 50001 }, '默认错误')).toBe('默认错误');
  });
});
