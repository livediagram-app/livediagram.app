import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTokenBearer, createWorkbenchBearer } from './bearer-credentials';

class Unavailable extends Error {}

const responses = {
  json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
  unavailable: () => new Response(null, { status: 503 }),
  isUnavailable: (err: unknown) => err instanceof Unavailable,
};

type Env = { tokens: Record<string, { id: string }>; down?: boolean; boom?: boolean };

const readToken = createTokenBearer({
  ...responses,
  hasTokenPrefix: (bearer) => bearer.startsWith('lwt_'),
  isTokenFormat: (bearer) => bearer.length === 8,
  resolve: async (env: Env, bearer) => {
    if (env.boom) throw new Error('boom');
    if (env.down) throw new Unavailable();
    return env.tokens[bearer] ?? null;
  },
});

const readSession = createWorkbenchBearer({
  ...responses,
  sessionPrefix: 'lvw_',
  isSessionFormat: (bearer) => bearer.length === 8,
  resolve: async (env: Env, bearer) => {
    if (env.boom) throw new Error('boom');
    if (env.down) throw new Unavailable();
    return bearer === 'lvw_good' || bearer === 'lvw_view'
      ? { ok: true, workbench: { sessionId: bearer } }
      : { ok: false, reason: 'unknown', sessionPrefix: 'lvw_' };
  },
  refusal: (workbench, method) =>
    workbench.sessionId === 'lvw_view' && method === 'POST'
      ? new Response(null, { status: 403 })
      : null,
});

const env: Env = { tokens: { lwt_good: { id: 't1' } } };
const request = (method = 'GET') => new Request('https://api.example/api/documents', { method });

afterEach(() => vi.restoreAllMocks());

describe('createTokenBearer', () => {
  it('passes a bearer that is no token, and resolves a good one', async () => {
    expect(await readToken(env, null, '/api')).toEqual({ ok: true, value: null });
    expect(await readToken(env, 'eyJ.jwt', '/api')).toEqual({ ok: true, value: null });
    expect(await readToken(env, 'lwt_good', '/api')).toEqual({ ok: true, value: { id: 't1' } });
  });

  it('refuses a token-shaped bearer that is malformed or unknown, as invalid_token', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const bearer of ['lwt_', 'lwt_nope']) {
      const read = await readToken(env, bearer, '/api/x');
      expect(read.ok).toBe(false);
      if (read.ok) continue;
      expect(read.response.status).toBe(401);
      expect(read.response.headers.get('WWW-Authenticate')).toBe('Bearer error="invalid_token"');
      expect(await read.response.json()).toEqual({ error: 'invalid_token' });
    }
    expect(warn).toHaveBeenCalledWith('[tokens] invalid bearer refused', { path: '/api/x' });
  });

  it('answers 503 when liveworkspace cannot say, and rethrows anything else', async () => {
    const read = await readToken({ ...env, down: true }, 'lwt_good', '/api');
    expect(read.ok ? null : read.response.status).toBe(503);
    await expect(readToken({ ...env, boom: true }, 'lwt_good', '/api')).rejects.toThrow('boom');
  });
});

describe('createWorkbenchBearer', () => {
  it('passes a bearer that is no session, and resolves a good one', async () => {
    expect(await readSession(env, null, [], request())).toEqual({ ok: true, value: null });
    expect(await readSession(env, 'lwt_good', [], request())).toEqual({ ok: true, value: null });
    expect(await readSession(env, 'lvw_good', [], request())).toEqual({
      ok: true,
      value: { sessionId: 'lvw_good' },
    });
  });

  it('refuses a session-shaped bearer that is malformed or unknown, as invalid_session', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const malformed = await readSession(env, 'lvw_', [], request());
    const unknown = await readSession(env, 'lvw_nope', [], request());
    for (const read of [malformed, unknown]) {
      expect(read.ok).toBe(false);
      if (read.ok) continue;
      expect(read.response.status).toBe(401);
      expect(read.response.headers.get('WWW-Authenticate')).toBe('Bearer error="invalid_token"');
      expect(await read.response.json()).toEqual({ error: 'invalid_session' });
    }
    expect(warn).toHaveBeenCalledWith('[workbench] bearer-refused', {
      reason: 'malformed',
      sessionPrefix: '',
    });
    expect(warn).toHaveBeenCalledWith('[workbench] bearer-refused', {
      reason: 'unknown',
      sessionPrefix: 'lvw_',
    });
  });

  it('confines a resolved session to what it may do', async () => {
    expect((await readSession(env, 'lvw_view', [], request('GET'))).ok).toBe(true);
    const read = await readSession(env, 'lvw_view', [], request('POST'));
    expect(read.ok ? null : read.response.status).toBe(403);
  });

  it('answers 503 when liveworkspace cannot say, and rethrows anything else', async () => {
    const read = await readSession({ ...env, down: true }, 'lvw_good', [], request());
    expect(read.ok ? null : read.response.status).toBe(503);
    await expect(readSession({ ...env, boom: true }, 'lvw_good', [], request())).rejects.toThrow(
      'boom',
    );
  });
});
