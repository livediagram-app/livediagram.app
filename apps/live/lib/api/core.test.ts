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
  tabForWire,
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

// The kind is stamped at the PERSISTENCE boundary, not only at the editor's
// commit choke point: several mutation paths reach the wire (history commit,
// the non-undoable session tick, remote applies), and a field that depends on
// which one ran is a field you cannot trust. Every tab that goes out says
// what it is.
describe('tabForWire — board kind', () => {
  const tab = (over: Partial<Tab> = {}): Tab =>
    ({ id: 't', name: 'T', elements: [], ...over }) as Tab;

  it('stamps the ordinary kind onto a tab that has none', () => {
    expect(tabForWire(tab()).kind).toBe('diagram');
  });

  it('keeps a specialised kind', () => {
    expect(tabForWire(tab({ kind: 'event-storming' })).kind).toBe('event-storming');
  });

  it('resolves a legacy board by its layer instead of branding it a diagram', () => {
    const legacy = tab({ layers: [{ id: 'layer:es:big-picture', name: 'Big picture' }] });
    expect(tabForWire(legacy).kind).toBe('event-storming');
  });

  it('still strips the UI-only fields', () => {
    const out = tabForWire(tab({ templateChosen: true, folder: 'f1' } as Partial<Tab>));
    expect('templateChosen' in out).toBe(false);
    expect('folder' in out).toBe(false);
  });

  // Timeline lanes (spec/139 Phase 6) are BOARD state, not UI state: the
  // facilitator turns them on for the room, so the field has to reach the
  // wire like any other tab field.
  it('carries the timeline lane origin to the wire', () => {
    const out = tabForWire(
      tab({ kind: 'event-storming', esTimeline: { originX: 120, originY: 80 } }),
    );
    expect(out.esTimeline).toEqual({ originX: 120, originY: 80 });
  });
});
