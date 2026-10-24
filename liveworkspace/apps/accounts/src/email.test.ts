import { afterEach, describe, expect, it, vi } from 'vitest';
import { inviteResponseEmail, sendCodeEmail } from './email.ts';
import type { Env } from './env.ts';

const env = (over: Partial<Env>) =>
  ({ ENVIRONMENT: 'production', EMAIL_FROM: 'sign-in@liveworkspace.app', ...over }) as Env;

afterEach(() => vi.unstubAllGlobals());

describe('sendCodeEmail', () => {
  it('sends through Resend with the key, from liveworkspace', async () => {
    const fetch = vi.fn(async () => new Response('{"id":"x"}'));
    vi.stubGlobal('fetch', fetch);
    await sendCodeEmail(env({ RESEND_API_KEY: 're_key' }), 'ada@example.com', '123456');

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer re_key');
    expect(JSON.parse(String(init.body))).toMatchObject({
      from: 'liveworkspace <sign-in@liveworkspace.app>',
      to: ['ada@example.com'],
      subject: '123456 is your liveworkspace sign-in code',
    });
  });

  it('fails when Resend refuses, so the page can say the code was not sent', async () => {
    vi.stubGlobal('fetch', async () => new Response('domain not verified', { status: 403 }));
    await expect(
      sendCodeEmail(env({ RESEND_API_KEY: 're_key' }), 'ada@example.com', '123456'),
    ).rejects.toThrow('Resend refused the email (403)');
  });

  it('logs the email in development without a key', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await sendCodeEmail(env({ ENVIRONMENT: 'development' }), 'ada@example.com', '123456');

    expect(fetch).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      '[email] To: ada@example.com Subject: 123456 is your liveworkspace sign-in code',
    );
    log.mockRestore();
  });

  it('refuses outside development without a key, rather than dropping the email', async () => {
    await expect(sendCodeEmail(env({}), 'ada@example.com', '123456')).rejects.toThrow(
      'RESEND_API_KEY is not set',
    );
  });
});

describe('inviteResponseEmail', () => {
  it('links to the account’s settings, where admins turn these off', () => {
    const email = inviteResponseEmail('https://liveworkspace.app/', 'Design', 'Ada', true);
    expect(email.unsubscribeUrl).toBe('https://liveworkspace.app/account/settings');
    expect(email.html).toContain('href="https://liveworkspace.app/account/settings"');
    expect(email.text).toContain('https://liveworkspace.app/account/settings');
  });

  it("opens the team's view in the Explorer", () => {
    const email = inviteResponseEmail(
      'https://liveworkspace.app/',
      'Design',
      'Ada',
      true,
      'team_1',
    );
    expect(email.html).toContain('href="https://liveworkspace.app/explorer/team?id=team_1"');
  });
});
