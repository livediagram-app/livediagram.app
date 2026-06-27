import type { Tab } from '@livediagram/diagram';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// getGuestSelfSig is the only ../local-identity symbol core.ts uses; mock
// it so the guest-signature header is deterministic per case.
const { identity } = vi.hoisted(() => ({
  identity: { getGuestSelfSig: vi.fn((): string | null => null) },
}));
vi.mock('../local-identity', () => identity);

import {
  ApiError,
  apiHeaders,
  expectOk,
  expectOkOrNull,
  expectOkVoid,
  setSessionSharePassword,
  setTokenProvider,
  stripUiTabFields,
} from './core';

const H = (h: HeadersInit) => h as Record<string, string>;

beforeEach(() => {
  setTokenProvider(null);
  setSessionSharePassword(null);
  identity.getGuestSelfSig.mockReturnValue(null);
});

describe('apiHeaders (hybrid identity gate, spec/04)', () => {
  it('sends X-Owner-Id for a guest, no Authorization', async () => {
    const h = H(await apiHeaders('guest-1'));
    expect(h['X-Owner-Id']).toBe('guest-1');
    expect(h['Authorization']).toBeUndefined();
  });

  it('attaches the guest signature when one is held', async () => {
    identity.getGuestSelfSig.mockReturnValue('sig-abc');
    expect(H(await apiHeaders('guest-1'))['X-Owner-Sig']).toBe('sig-abc');
  });

  it('sends Bearer and NOT X-Owner-Id when a token resolves (never both)', async () => {
    setTokenProvider(() => Promise.resolve('jwt-xyz'));
    const h = H(await apiHeaders('guest-1'));
    expect(h['Authorization']).toBe('Bearer jwt-xyz');
    expect(h['X-Owner-Id']).toBeUndefined();
    expect(h['X-Owner-Sig']).toBeUndefined();
  });

  it('falls back to X-Owner-Id when the provider resolves null', async () => {
    setTokenProvider(() => Promise.resolve(null));
    const h = H(await apiHeaders('guest-1'));
    expect(h['X-Owner-Id']).toBe('guest-1');
    expect(h['Authorization']).toBeUndefined();
  });

  it('adds Content-Type only for body requests, and the share code when given', async () => {
    expect(H(await apiHeaders('g'))['Content-Type']).toBeUndefined();
    expect(H(await apiHeaders('g', { body: true }))['Content-Type']).toBe('application/json');
    expect(H(await apiHeaders('g', { share: 'code1' }))['X-Share-Code']).toBe('code1');
  });

  it('rides the session share password on every request once set', async () => {
    expect(H(await apiHeaders('g'))['X-Share-Password']).toBeUndefined();
    setSessionSharePassword('pw');
    expect(H(await apiHeaders('g'))['X-Share-Password']).toBe('pw');
  });
});

describe('ApiError', () => {
  it('carries action/status/code and the canonical message', () => {
    const e = new ApiError('save', 403, 'forbidden');
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe('save failed: 403');
    expect(e.status).toBe(403);
    expect(e.code).toBe('forbidden');
    expect(e.name).toBe('ApiError');
  });
});

describe('expectOk / expectOkOrNull / expectOkVoid', () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  const err = (status: number, code?: string) =>
    new Response(JSON.stringify(code ? { error: code } : {}), { status });

  it('expectOk parses a 2xx body and throws ApiError with the worker error code on failure', async () => {
    expect(await expectOk<{ a: number }>(ok({ a: 1 }), 'load')).toEqual({ a: 1 });
    await expect(expectOk(err(403, 'forbidden'), 'load')).rejects.toMatchObject({
      status: 403,
      code: 'forbidden',
    });
  });

  it('expectOkOrNull maps 404 to null but still throws other failures', async () => {
    expect(await expectOkOrNull(err(404), 'read')).toBeNull();
    expect(await expectOkOrNull<{ a: number }>(ok({ a: 2 }), 'read')).toEqual({ a: 2 });
    await expect(expectOkOrNull(err(500), 'read')).rejects.toBeInstanceOf(ApiError);
  });

  it('expectOkVoid resolves on 2xx and throws otherwise', async () => {
    await expect(expectOkVoid(ok({}), 'del')).resolves.toBeUndefined();
    await expect(expectOkVoid(err(403), 'del')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('stripUiTabFields', () => {
  const tab = (over: Partial<Tab> = {}): Tab =>
    ({ id: 't', name: 'T', elements: [], ...over }) as Tab;

  it('drops the UI-only templateChosen + folder fields', () => {
    const out = stripUiTabFields(tab({ templateChosen: true, folder: 'f1' } as Partial<Tab>));
    expect('templateChosen' in out).toBe(false);
    expect('folder' in out).toBe(false);
    expect(out.id).toBe('t');
  });

  it('returns the same object when there is nothing to strip', () => {
    const t = tab();
    expect(stripUiTabFields(t)).toBe(t);
  });
});
