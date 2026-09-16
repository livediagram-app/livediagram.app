import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { appBaseUrl, emailEnabled, sendEmail } from './client';

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
  it('defaults to livediagram.app', () =>
    expect(appBaseUrl(noKey)).toBe('https://livediagram.app'));
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
    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual(['a@b.com']);
    expect(body.subject).toBe('Hi');
    expect(body.from).toContain('hello@livediagram.app');
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
    expect(JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string).from).toBe(
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
