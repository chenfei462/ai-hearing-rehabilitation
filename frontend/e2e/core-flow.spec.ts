import { expect, test } from '@playwright/test';

test('logs in and starts an auditory training session', async ({ page }) => {
  await page.route('**/api/auth/sms/send', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, data: { message: '验证码已发送' }, message: 'ok' }),
    });
  });
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        data: { user: { id: 1, phone: '13800138000', role: 'patient', nickname: '测试用户' } },
        message: 'ok',
      }),
    });
  });
  await page.route('**/api/training/sessions?level=syllable', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
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
        message: 'ok',
      }),
    });
  });

  await page.goto('/login');
  await page.getByLabel('手机号').fill('13800138000');
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect(page.getByLabel('验证码')).toBeVisible();
  await page.getByLabel('验证码').fill('9876');
  await page.getByRole('button', { name: '登录' }).click();

  await expect(page.getByText('欢迎使用 AI 听觉康复助手')).toBeVisible();
  await page.getByRole('button', { name: /听觉训练/ }).click();
  await page.getByRole('heading', { name: '音节' }).click();

  await expect(page.getByText('请听音频并回答')).toBeVisible();
  await expect(page.getByText('点击播放音频')).toBeVisible();
});
