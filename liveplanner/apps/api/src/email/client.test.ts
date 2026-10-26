import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../server-telemetry', () => ({ reportServerEvent: vi.fn(async () => {}) }));
import { EMAIL_SEND_TIMEOUT_MS } from '@liveworkspace/email';
import type { Env } from '../types';
import { reportServerEvent } from '../server-telemetry';
import { appBaseUrl, emailEnabled, sendEmail } from './client';

// A fake Cloudflare Email Service binding (liveworkspace/docs/specs/003-accounts/email.md), standing in for `env.EMAIL`.
const fakeEmail = (send = vi.fn(async (_message: unknown) => ({ messageId: 'm' }))) => ({ send });
const withBinding = (email = fakeEmail(), extra: Partial<Env> = {}) =>
  ({ EMAIL: email, ...extra }) as unknown as Env;
const noBinding = {} as Env;

const message = { kind: 'CommentNotification', to: 'a@b.com', subject: 's', html: 'h' } as const;

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(reportServerEvent).mockClear();
  vi.useRealTimers();
});

describe('emailEnabled', () => {
  it('is false without the EMAIL binding', () => expect(emailEnabled(noBinding)).toBe(false));
  it('is true with the EMAIL binding', () => expect(emailEnabled(withBinding())).toBe(true));
});

describe('appBaseUrl', () => {
  it('defaults to liveplanner.app', () =>
    expect(appBaseUrl(noBinding)).toBe('https://www.liveplanner.app'));
  it('uses + trims a trailing slash from APP_BASE_URL', () =>
    expect(appBaseUrl({ APP_BASE_URL: 'https://example.com/' } as unknown as Env)).toBe(
      'https://example.com',
    ));
});

describe('sendEmail', () => {
  it('no-ops without the binding and reports nothing', async () => {
    const res = await sendEmail(noBinding, message);
    expect(res).toEqual({ sent: false });
    expect(reportServerEvent).not.toHaveBeenCalled();
  });

  it('sends through the binding with the default sender and counts the kind', async () => {
    const email = fakeEmail();
    const res = await sendEmail(withBinding(email), {
      ...message,
      subject: 'Hi',
      html: '<p>h</p>',
    });
    expect(res).toEqual({ sent: true });
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(email.send.mock.calls[0]![0]).toMatchObject({
      from: { email: 'hello@liveplanner.app', name: 'liveplanner' },
      to: 'a@b.com',
      subject: 'Hi',
      html: '<p>h</p>',
    });
    expect(reportServerEvent).toHaveBeenCalledWith(
      expect.anything(),
      'Email',
      'Sent',
      'CommentNotification',
    );
  });

  it('honours an EMAIL_FROM override', async () => {
    const email = fakeEmail();
    await sendEmail(withBinding(email, { EMAIL_FROM: 'X <x@y.com>' }), message);
    expect(email.send.mock.calls[0]![0]).toHaveProperty('from', { email: 'x@y.com', name: 'X' });
  });

  it('sends List-Unsubscribe when given an unsubscribe link', async () => {
    const email = fakeEmail();
    await sendEmail(withBinding(email), { ...message, unsubscribeUrl: 'https://app.test/profile' });
    expect(email.send.mock.calls[0]![0]).toHaveProperty('headers', {
      'List-Unsubscribe': '<https://app.test/profile>',
    });
  });

  it('returns sent:false and reports the refusal code when Email Service refuses', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const refused = Object.assign(new Error('suppressed'), { code: 'E_RECIPIENT_SUPPRESSED' });
    const email = fakeEmail(
      vi.fn(async () => {
        throw refused;
      }),
    );
    expect(await sendEmail(withBinding(email), message)).toEqual({ sent: false });
    expect(reportServerEvent).toHaveBeenCalledWith(
      expect.anything(),
      'Error',
      'Api',
      'E_RECIPIENT_SUPPRESSED.SendEmail',
    );
  });

  it('never throws, and counts an error without a code as Network', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const email = fakeEmail(vi.fn().mockRejectedValue(new Error('network')));
    expect(await sendEmail(withBinding(email), message)).toEqual({ sent: false });
    expect(reportServerEvent).toHaveBeenCalledWith(
      expect.anything(),
      'Error',
      'Api',
      'Network.SendEmail',
    );
    // The log line carries a redacted address, never the whole one.
    expect(String(error.mock.calls[0]![0])).toContain('to=***@b.com');
    expect(String(error.mock.calls[0]![0])).not.toContain('a@b.com');
  });
});

// A hung send no longer holds the daily email cron behind it: the send gives up, as a failure.
describe('sendEmail timeout', () => {
  it('fails a send the binding never answers, after EMAIL_SEND_TIMEOUT_MS', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const email = fakeEmail(vi.fn(() => new Promise<{ messageId: string }>(() => {})));
    const sent = sendEmail(withBinding(email), message);
    await vi.advanceTimersByTimeAsync(EMAIL_SEND_TIMEOUT_MS);
    expect(await sent).toEqual({ sent: false });
    expect(reportServerEvent).toHaveBeenCalledWith(
      expect.anything(),
      'Error',
      'Api',
      'Network.SendEmail',
    );
  });
});
