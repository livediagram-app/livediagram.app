import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { appBaseUrl, EMAIL_SEND_TIMEOUT_MS, emailEnabled, sendEmail } from './client';

const withKey = { RESEND_API_KEY: 're_test' } as unknown as Env;
const noKey = {} as Env;

afterEach(() => vi.restoreAllMocks());

describe('emailEnabled', () => {
  it('is false without a key', () => expect(emailEnabled(noKey)).toBe(false));
  it('is true with a key', () => expect(emailEnabled(withKey)).toBe(true));
  it('is false for an empty key', () =>
    expect(emailEnabled({ RESEND_API_KEY: '' } as unknown as Env)).toBe(false));
});

describe('appBaseUrl', () => {
  it('defaults to livepages.app', () =>
    expect(appBaseUrl(noKey)).toBe('https://livepages.app'));
  it('uses + trims a trailing slash from APP_BASE_URL', () =>
    expect(appBaseUrl({ APP_BASE_URL: 'https://example.com/' } as unknown as Env)).toBe(
      'https://example.com',
    ));
});

describe('sendEmail', () => {
  it('no-ops without a key and never calls fetch', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const res = await sendEmail(noKey, {
      kind: 'Welcome',
      to: 'a@b.com',
      subject: 's',
      html: '<p>h</p>',
    });
    expect(res).toEqual({ sent: false });
    expect(f).not.toHaveBeenCalled();
  });

  it('POSTs to Resend with auth + payload when keyed', async () => {
    const f = vi.fn().mockResolvedValue(new Response('{"id":"x"}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    const res = await sendEmail(withKey, {
      kind: 'Welcome',
      to: 'a@b.com',
      subject: 'Hi',
      html: '<p>h</p>',
    });
    expect(res).toEqual({ sent: true });
    const [url, init] = f.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer re_test');
    expect(JSON.parse(init.body as string)).toMatchObject({
      to: ['a@b.com'],
      subject: 'Hi',
      from: expect.stringContaining('hello@livepages.app'),
    });
  });

  it('honours a RESEND_FROM override', async () => {
    const f = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    await sendEmail({ RESEND_API_KEY: 're', RESEND_FROM: 'X <x@y.com>' } as unknown as Env, {
      kind: 'Welcome',
      to: 'a@b.com',
      subject: 's',
      html: 'h',
    });
    expect(JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string)).toHaveProperty(
      'from',
      'X <x@y.com>',
    );
  });

  it('returns sent:false on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 422 })));
    expect(
      await sendEmail(withKey, { kind: 'Welcome', to: 'a@b.com', subject: 's', html: 'h' }),
    ).toEqual({
      sent: false,
    });
  });

  it('never throws — returns sent:false when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(
      await sendEmail(withKey, { kind: 'Welcome', to: 'a@b.com', subject: 's', html: 'h' }),
    ).toEqual({
      sent: false,
    });
  });
});

// A hung Resend call no longer holds the daily email cron behind it: the send gives up, as a failure.
describe('sendEmail timeout', () => {
  it('fails a send Resend never answers, after EMAIL_SEND_TIMEOUT_MS', async () => {
    // The bound itself is the platform's (AbortSignal.timeout); stand in an already-expired one.
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(() => AbortSignal.abort(new DOMException('timed out', 'TimeoutError')));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        if (init.signal?.aborted) throw init.signal.reason;
        return new Response('{}', { status: 200 });
      }),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const sent = sendEmail(withKey, { kind: 'Welcome', to: 'a@b.com', subject: 's', html: 'h' });
    expect(await sent).toEqual({ sent: false });
    expect(timeout).toHaveBeenCalledWith(EMAIL_SEND_TIMEOUT_MS);
  });
});
