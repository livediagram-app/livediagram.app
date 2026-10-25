import { afterEach, describe, expect, it, vi } from 'vitest';
import { inviteResponseEmail, sendCodeEmail } from './email.ts';
import type { Env } from './env.ts';

const env = (over: Partial<Env>) =>
  ({ ENVIRONMENT: 'production', EMAIL_FROM: 'sign-in@liveworkspace.app', ...over }) as Env;

afterEach(() => vi.unstubAllGlobals());

describe('sendCodeEmail', () => {
  const binding = (send: () => Promise<{ messageId: string }>) => ({ send: vi.fn(send) });

  it('sends through the EMAIL binding, from liveworkspace', async () => {
    const EMAIL = binding(async () => ({ messageId: 'm' }));
    await sendCodeEmail(env({ EMAIL: EMAIL as unknown as SendEmail }), 'ada@example.com', '123456');

    expect(EMAIL.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { email: 'sign-in@liveworkspace.app', name: 'liveworkspace' },
        to: 'ada@example.com',
        subject: '123456 is your liveworkspace sign-in code',
      }),
    );
  });

  it('fails when Email Service refuses, so the page can say the code was not sent', async () => {
    const EMAIL = binding(async () => {
      throw Object.assign(new Error('domain not onboarded'), { code: 'E_SENDER_NOT_VERIFIED' });
    });
    await expect(
      sendCodeEmail(env({ EMAIL: EMAIL as unknown as SendEmail }), 'ada@example.com', '123456'),
    ).rejects.toThrow('domain not onboarded');
  });

  it('logs the email in development without the binding', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await sendCodeEmail(env({ ENVIRONMENT: 'development' }), 'ada@example.com', '123456');

    expect(log).toHaveBeenCalledWith(
      '[email] To: ada@example.com Subject: 123456 is your liveworkspace sign-in code',
    );
    log.mockRestore();
  });

  it('refuses outside development without the binding, rather than dropping the email', async () => {
    await expect(sendCodeEmail(env({}), 'ada@example.com', '123456')).rejects.toThrow(
      'the EMAIL binding is not set',
    );
  });
});

describe('inviteResponseEmail', () => {
  it('links to the account’s settings, where admins turn these off', () => {
    const email = inviteResponseEmail(
      'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/',
      'Design',
      'Ada',
      true,
    );
    expect(email.unsubscribeUrl).toBe(
      'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/explorer?settings=notifications',
    );
    expect(email.html).toContain(
      'href="https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/explorer?settings=notifications"',
    );
    expect(email.text).toContain(
      'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/explorer?settings=notifications',
    );
  });

  it("opens the team's view in the Explorer", () => {
    const email = inviteResponseEmail(
      'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/',
      'Design',
      'Ada',
      true,
      'team_1',
    );
    expect(email.html).toContain(
      'href="https://liveworkspace-gateway.liveworkspace-easing509.workers.dev/explorer/team?id=team_1"',
    );
  });
});
