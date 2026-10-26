import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

vi.mock('../server-telemetry', () => ({ reportServerEvent: vi.fn(async () => {}) }));

import { reportServerEvent } from '../server-telemetry';
import { appBaseUrl, emailEnabled, sendEmail } from './client';

// A stand-in for Cloudflare Email Service's `send_email` binding (liveworkspace/docs/email.md).
const fakeBinding = (send = vi.fn(async (_message: unknown) => ({ messageId: 'm' }))) => ({ send });
const withBinding = (binding = fakeBinding(), vars: Partial<Env> = {}) =>
  ({ EMAIL: binding, ...vars }) as unknown as Env;
const noBinding = {} as Env;

// The `Category·Action·type` rows a send reported.
const reported = () =>
  vi.mocked(reportServerEvent).mock.calls.map(([, c, a, t]) => `${c}·${a}·${t}`);

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(reportServerEvent).mockClear();
});

describe('emailEnabled', () => {
  it('is false without the binding', () => expect(emailEnabled(noBinding)).toBe(false));
  it('is true with the binding', () => expect(emailEnabled(withBinding())).toBe(true));
});

describe('appBaseUrl', () => {
  it('defaults to livedocuments.app', () =>
    expect(appBaseUrl(noBinding)).toBe('https://www.livedocuments.app'));
  it('uses + trims a trailing slash from APP_BASE_URL', () =>
    expect(appBaseUrl({ APP_BASE_URL: 'https://example.com/' } as unknown as Env)).toBe(
      'https://example.com',
    ));
});

describe('sendEmail', () => {
  it('no-ops without the binding and reports nothing', async () => {
    const res = await sendEmail(noBinding, {
      kind: 'Milestone',
      to: 'a@b.com',
      subject: 's',
      html: '<p>h</p>',
    });
    expect(res).toEqual({ sent: false });
    expect(reportServerEvent).not.toHaveBeenCalled();
  });

  it('sends through the binding with the default sender', async () => {
    const binding = fakeBinding();
    const res = await sendEmail(withBinding(binding), {
      kind: 'Milestone',
      to: 'a@b.com',
      subject: 'Hi',
      html: '<p>h</p>',
    });
    expect(res).toEqual({ sent: true });
    expect(binding.send).toHaveBeenCalledTimes(1);
    expect(binding.send.mock.calls[0]![0]).toMatchObject({
      to: 'a@b.com',
      subject: 'Hi',
      html: '<p>h</p>',
      from: { email: 'hello@livedocuments.app', name: 'livedocuments' },
    });
  });

  it('honours EMAIL_FROM', async () => {
    const binding = fakeBinding();
    await sendEmail(withBinding(binding, { EMAIL_FROM: 'X <x@y.com>' }), {
      kind: 'Milestone',
      to: 'a@b.com',
      subject: 's',
      html: 'h',
    });
    expect(binding.send.mock.calls[0]![0]).toHaveProperty('from', { email: 'x@y.com', name: 'X' });
  });

  it('sends List-Unsubscribe when given an unsubscribe link', async () => {
    const binding = fakeBinding();
    await sendEmail(withBinding(binding), {
      kind: 'CommentNotification',
      to: 'a@b.com',
      subject: 's',
      html: 'h',
      unsubscribeUrl: 'https://app.test/explorer?settings=notifications',
    });
    expect(binding.send.mock.calls[0]![0]).toHaveProperty('headers', {
      'List-Unsubscribe': '<https://app.test/explorer?settings=notifications>',
    });
  });

  it('counts a delivered send as Email·Sent·<kind>', async () => {
    await sendEmail(withBinding(fakeBinding()), {
      kind: 'Milestone',
      to: 'a@b.com',
      subject: 's',
      html: 'h',
    });
    expect(reported()).toEqual(['Email·Sent·Milestone']);
  });

  it("never throws on a refusal: sent:false, reported with Email Service's code, address redacted", async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const refused = Object.assign(new Error('suppressed'), { code: 'E_RECIPIENT_SUPPRESSED' });
    const binding = fakeBinding(
      vi.fn(async () => {
        throw refused;
      }),
    );
    expect(
      await sendEmail(withBinding(binding), {
        kind: 'Milestone',
        to: 'alice@b.com',
        subject: 's',
        html: 'h',
      }),
    ).toEqual({ sent: false });
    expect(reported()).toEqual(['Error·Api·E_RECIPIENT_SUPPRESSED.SendEmail']);
    const line = String(error.mock.calls[0]![0]);
    expect(line).toContain('al***@b.com');
    expect(line).not.toContain('alice@b.com');
  });

  it('reports a failure without a code as Network', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const binding = fakeBinding(
      vi.fn(async () => {
        throw new Error('network');
      }),
    );
    expect(
      await sendEmail(withBinding(binding), {
        kind: 'Milestone',
        to: 'a@b.com',
        subject: 's',
        html: 'h',
      }),
    ).toEqual({ sent: false });
    expect(reported()).toEqual(['Error·Api·Network.SendEmail']);
  });
});

// A hung send no longer holds the daily email cron behind it: the send gives up, as a failure.
describe('sendEmail timeout', () => {
  it('fails a send the binding never answers, after the shared timeout', async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const binding = fakeBinding(vi.fn(() => new Promise<{ messageId: string }>(() => {})));
      const sent = sendEmail(withBinding(binding), {
        kind: 'Milestone',
        to: 'a@b.com',
        subject: 's',
        html: 'h',
      });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await sent).toEqual({ sent: false });
    } finally {
      vi.useRealTimers();
    }
  });
});
