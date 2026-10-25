import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { EMAIL_SEND_TIMEOUT_MS } from '@liveworkspace/email';
import { appBaseUrl, emailEnabled, sendEmail } from './client';

vi.mock('../server-telemetry', () => ({ reportServerEvent: vi.fn(async () => {}) }));
import { reportServerEvent } from '../server-telemetry';

// A stand-in for Email Service's `send_email` binding.
const fakeBinding = () => ({ send: vi.fn(async (_message: unknown) => ({ messageId: 'm' })) });
const withBinding = (binding = fakeBinding(), extra: Partial<Env> = {}) =>
  ({ EMAIL: binding, ...extra }) as unknown as Env;
const noBinding = {} as Env;

afterEach(() => vi.clearAllMocks());

describe('emailEnabled', () => {
  it('is false without the binding', () => expect(emailEnabled(noBinding)).toBe(false));
  it('is true with the binding', () => expect(emailEnabled(withBinding())).toBe(true));
});

describe('appBaseUrl', () => {
  it('defaults to livedesign.app', () =>
    expect(appBaseUrl(noBinding)).toBe('https://livedesign.app'));
  it('uses + trims a trailing slash from APP_BASE_URL', () =>
    expect(appBaseUrl({ APP_BASE_URL: 'https://example.com/' } as unknown as Env)).toBe(
      'https://example.com',
    ));
});

describe('sendEmail', () => {
  it('no-ops without the binding and reports nothing', async () => {
    const res = await sendEmail(noBinding, {
      kind: 'AccountDeleted',
      to: 'a@b.com',
      subject: 's',
      html: '<p>h</p>',
    });
    expect(res).toEqual({ sent: false });
    expect(reportServerEvent).not.toHaveBeenCalled();
  });

  it('sends through the binding from the default sender, and counts it', async () => {
    const binding = fakeBinding();
    const res = await sendEmail(withBinding(binding), {
      kind: 'AccountDeleted',
      to: 'a@b.com',
      subject: 'Hi',
      html: '<p>h</p>',
    });
    expect(res).toEqual({ sent: true });
    expect(binding.send).toHaveBeenCalledOnce();
    expect(binding.send.mock.calls[0]![0]).toMatchObject({
      from: { email: 'hello@livedesign.app', name: 'livedesign' },
      to: 'a@b.com',
      subject: 'Hi',
      html: '<p>h</p>',
    });
    expect(binding.send.mock.calls[0]![0]).not.toHaveProperty('headers');
    expect(reportServerEvent).toHaveBeenCalledWith(
      expect.anything(),
      'Email',
      'Sent',
      'AccountDeleted',
    );
  });

  it('honours an EMAIL_FROM override', async () => {
    const binding = fakeBinding();
    await sendEmail(withBinding(binding, { EMAIL_FROM: 'X <x@y.com>' }), {
      kind: 'AccountDeleted',
      to: 'a@b.com',
      subject: 's',
      html: 'h',
    });
    expect(binding.send.mock.calls[0]![0]).toHaveProperty('from', { email: 'x@y.com', name: 'X' });
  });

  it('sends List-Unsubscribe for an opt-out email', async () => {
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

  it("returns sent:false on a refusal, reported under Email Service's code", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const binding = {
      send: vi.fn(async () => {
        throw Object.assign(new Error('suppressed'), { code: 'E_RECIPIENT_SUPPRESSED' });
      }),
    };
    expect(
      await sendEmail(withBinding(binding as never), {
        kind: 'AccountDeleted',
        to: 'someone@b.com',
        subject: 's',
        html: 'h',
      }),
    ).toEqual({ sent: false });
    expect(reportServerEvent).toHaveBeenCalledWith(
      expect.anything(),
      'Error',
      'Api',
      'E_RECIPIENT_SUPPRESSED.SendEmail',
    );
    // The address is redacted in the log line.
    expect(String(vi.mocked(console.error).mock.calls[0]![0])).toContain('so***@b.com');
    expect(String(vi.mocked(console.error).mock.calls[0]![0])).not.toContain('someone@b.com');
  });

  it('never throws — returns sent:false, as Network, when the send rejects without a code', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const binding = { send: vi.fn().mockRejectedValue(new Error('network')) };
    expect(
      await sendEmail(withBinding(binding as never), {
        kind: 'AccountDeleted',
        to: 'a@b.com',
        subject: 's',
        html: 'h',
      }),
    ).toEqual({ sent: false });
    expect(reportServerEvent).toHaveBeenCalledWith(
      expect.anything(),
      'Error',
      'Api',
      'Network.SendEmail',
    );
  });
});

// A hung send doesn't hold the daily email cron behind it: @liveworkspace/email gives up, as a failure.
describe('sendEmail timeout', () => {
  it('fails a send the binding never answers', async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const binding = { send: vi.fn(() => new Promise<never>(() => {})) };
      const sent = sendEmail(withBinding(binding as never), {
        kind: 'AccountDeleted',
        to: 'a@b.com',
        subject: 's',
        html: 'h',
      });
      await vi.advanceTimersByTimeAsync(EMAIL_SEND_TIMEOUT_MS);
      expect(await sent).toEqual({ sent: false });
      expect(reportServerEvent).toHaveBeenCalledWith(
        expect.anything(),
        'Error',
        'Api',
        'Network.SendEmail',
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
