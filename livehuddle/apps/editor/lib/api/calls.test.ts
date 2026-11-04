import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  apiCallClose,
  apiCallRenegotiate,
  apiCallSession,
  apiCallTracks,
  CallsApiError,
} from './calls';

const core = vi.hoisted(() => ({
  apiFetch: vi.fn<(url: string, init: RequestInit) => Promise<unknown>>(),
  apiHeaders: vi.fn(async (_o: string, opts: { share?: string | null; body?: boolean }) => ({
    share: String(opts.share),
    body: String(opts.body),
  })),
}));
vi.mock('./core', () => ({ API_BASE: '/api', ...core }));

const caller = { ownerId: 'o', documentId: 'd/1', shareCode: 'sc' };
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

afterEach(() => vi.clearAllMocks());

// docs/specs/012-collaboration/proximity-audio.md "The mint route".
describe('calls api client', () => {
  it('posts to the Space’s calls routes with the caller’s headers', async () => {
    core.apiFetch.mockResolvedValue(ok({ sessionId: 's' }));
    await expect(apiCallSession(caller)).resolves.toEqual({ sessionId: 's' });
    expect(core.apiFetch).toHaveBeenCalledWith('/api/documents/d%2F1/calls/session', {
      method: 'POST',
      headers: { share: 'sc', body: 'false' },
    });
    const proof = { sessionId: 's', sessionToken: 't' };
    await apiCallTracks(caller, { ...proof, subscribe: [] });
    await apiCallRenegotiate(caller, { ...proof, sdp: 'x' });
    await apiCallClose(caller, { ...proof, mids: ['1'] });
    expect(core.apiFetch.mock.calls.map(([url, init]) => [url, init.method, init.body])).toEqual([
      ['/api/documents/d%2F1/calls/session', 'POST', undefined],
      ['/api/documents/d%2F1/calls/tracks', 'POST', JSON.stringify({ ...proof, subscribe: [] })],
      ['/api/documents/d%2F1/calls/renegotiate', 'PUT', JSON.stringify({ ...proof, sdp: 'x' })],
      ['/api/documents/d%2F1/calls/close', 'PUT', JSON.stringify({ ...proof, mids: ['1'] })],
    ]);
  });

  it('throws the refusal’s code, or its status alone', async () => {
    core.apiFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: 'calls_off' }),
    });
    await expect(apiCallSession(caller)).rejects.toMatchObject({
      status: 503,
      code: 'calls_off',
      reason: null,
      paused: false,
    });
    // The kill switch's pause carries its reason (docs/specs/016-platform/calls-kill-switch.md "Calls Paused").
    core.apiFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: 'calls_off', reason: 'paused' }),
    });
    await expect(apiCallSession(caller)).rejects.toMatchObject({
      reason: 'paused',
      paused: true,
      message: 'calls 503 calls_off paused',
    });
    core.apiFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 7 }),
    });
    await expect(apiCallSession(caller)).rejects.toMatchObject({ code: null });
    core.apiFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => Promise.reject(new Error('no body')),
    });
    const err = await apiCallSession(caller).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CallsApiError);
    expect((err as Error).message).toBe('calls 502');
  });
});
