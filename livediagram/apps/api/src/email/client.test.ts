import { afterEach, describe, expect, it, vi } from 'vitest';
import { redactAddress } from '@liveworkspace/email';
import type { Env } from '../types';

const { reportServerEvent } = vi.hoisted(() => ({ reportServerEvent: vi.fn(async () => {}) }));
vi.mock('../server-telemetry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../server-telemetry')>()),
  reportServerEvent,
}));

import { appBaseUrl, EMAIL_SEND_TIMEOUT_MS, emailEnabled, sendEmail } from './client';

// A stand-in for the `send_email` binding (liveworkspace/docs/email.md).
function fakeBinding(send = vi.fn(async (_message: unknown) => ({ messageId: 'm' }))) {
  return { send };
}
const withBinding = (binding = fakeBinding(), vars: Record<string, string> = {}) =>
  ({ EMAIL: binding, ...vars }) as unknown as Env;
const noBinding = {} as Env;
const message = { kind: 'Milestone', to: 'a@b.com', subject: 's', html: 'h' } as const;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  reportServerEvent.mockClear();
});

describe('emailEnabled', () => {
  it('is false without the EMAIL binding', () => expect(emailEnabled(noBinding)).toBe(false));
  it('is true with the EMAIL binding', () => expect(emailEnabled(withBinding())).toBe(true));
});

describe('appBaseUrl', () => {
  it('defaults to livediagram.app', () =>
    expect(appBaseUrl(noBinding)).toBe(
      'https://livediagram-router.liveworkspace-easing509.workers.dev',
    ));
  it('uses + trims a trailing slash from APP_BASE_URL', () =>
    expect(appBaseUrl({ APP_BASE_URL: 'https://example.com/' } as unknown as Env)).toBe(
      'https://example.com',
    ));
});

describe('sendEmail', () => {
  it('no-ops without the binding and sends nothing', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await sendEmail(noBinding, message)).toEqual({ sent: false });
    expect(f).not.toHaveBeenCalled();
    expect(reportServerEvent).not.toHaveBeenCalled();
  });

  it('sends through the binding, from the default sender, and counts the kind', async () => {
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
      from: { email: 'hello@livediagram.app', name: 'livediagram' },
      to: 'a@b.com',
      subject: 'Hi',
      html: '<p>h</p>',
    });
    expect(reportServerEvent).toHaveBeenCalledWith(expect.anything(), 'Email', 'Sent', 'Milestone');
  });

  it('honours an EMAIL_FROM override', async () => {
    const binding = fakeBinding();
    await sendEmail(withBinding(binding, { EMAIL_FROM: 'X <x@y.com>' }), message);
    expect(binding.send.mock.calls[0]![0]).toHaveProperty('from', { email: 'x@y.com', name: 'X' });
  });

  it('sends List-Unsubscribe when given an unsubscribe link', async () => {
    const binding = fakeBinding();
    await sendEmail(withBinding(binding), { ...message, unsubscribeUrl: 'https://app.test/p' });
    expect(binding.send.mock.calls[0]![0]).toHaveProperty('headers', {
      'List-Unsubscribe': '<https://app.test/p>',
    });
  });

  it("returns sent:false on a refusal, reporting Email Service's code", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const refused = Object.assign(new Error('suppressed'), { code: 'E_RECIPIENT_SUPPRESSED' });
    const binding = fakeBinding(vi.fn().mockRejectedValue(refused));
    expect(await sendEmail(withBinding(binding), message)).toEqual({ sent: false });
    expect(reportServerEvent).toHaveBeenCalledWith(
      expect.anything(),
      'Error',
      'Api',
      'E_RECIPIENT_SUPPRESSED.SendEmail',
    );
    // The log line carries the redacted address, never the whole one.
    const logged = String(vi.mocked(console.error).mock.calls[0]![0]);
    expect(logged).toContain(redactAddress('a@b.com'));
    expect(logged).not.toContain('to=a@b.com');
  });

  it('never throws: returns sent:false and reports Network when the send rejects without a code', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const binding = fakeBinding(vi.fn().mockRejectedValue(new Error('network')));
    expect(await sendEmail(withBinding(binding), message)).toEqual({ sent: false });
    expect(reportServerEvent).toHaveBeenCalledWith(
      expect.anything(),
      'Error',
      'Api',
      'Network.SendEmail',
    );
  });
});

// A hung send no longer holds the daily email cron behind it: the send gives up, as a failure.
describe('sendEmail timeout', () => {
  it('fails a send the binding never answers, after EMAIL_SEND_TIMEOUT_MS', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const binding = fakeBinding(vi.fn(() => new Promise<never>(() => {})));
    const sent = sendEmail(withBinding(binding), message);
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
