import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkbenchSessionResponse } from '@livediagram/api-schema';
import { registerTokenProvider, setTokenProvider } from './core';
import {
  apiAnswerPairingRequest,
  apiEndWorkbenchSession,
  apiListWorkbenchPairings,
  apiReadPairingRequest,
  apiRedeemWorkbenchTicket,
  apiUnpairWorkbench,
} from './workbench';

// The workbench calls (docs/specs/013-workspace/blueprints/workbench-embeds.md "Routes"): redemption is
// credential-free, the page's own end presents the session, the pairing calls are the person's own.

type Seen = { method: string; url: string; headers: Headers; body: unknown };

const SESSION: WorkbenchSessionResponse = {
  session: `lvw_${'a'.repeat(43)}`,
  documentId: 'doc-1',
  tabId: null,
  origin: 'https://127.0.0.1:5175',
  role: 'edit',
  expiresAt: 1_000,
  person: { id: 'user_1', name: 'Webber', color: '#0ea5e9', pictureUrl: null },
};

let seen: Seen[];
let answer: () => Promise<Response>;

function reply(status: number, body?: unknown): () => Promise<Response> {
  return () =>
    Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
}

beforeEach(() => {
  seen = [];
  answer = reply(200, {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      seen.push({
        method: init?.method ?? 'GET',
        url: String(url),
        headers: new Headers(init?.headers),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return answer();
    }),
  );
});

afterEach(() => {
  setTokenProvider(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('apiRedeemWorkbenchTicket', () => {
  it('posts the ticket with no credential and answers the session', async () => {
    registerTokenProvider(async () => 'clerk-jwt');
    answer = reply(201, SESSION);

    const outcome = await apiRedeemWorkbenchTicket('t'.repeat(22));

    expect(outcome).toEqual({ kind: 'opened', session: SESSION });
    expect(seen[0]).toMatchObject({ method: 'POST', body: { ticket: 't'.repeat(22) } });
    expect(seen[0]!.url).toMatch(/\/workbench\/sessions$/);
    expect(seen[0]!.headers.get('Authorization')).toBeNull();
    expect(seen[0]!.headers.get('X-Owner-Id')).toBeNull();
  });

  it('reads a refused ticket with its reason', async () => {
    answer = reply(401, { error: 'invalid_ticket', reason: 'used' });

    expect(await apiRedeemWorkbenchTicket('t'.repeat(22))).toEqual({
      kind: 'refused',
      status: 401,
      reason: 'used',
    });
  });

  it('reads a refusal without a known reason as reasonless', async () => {
    answer = reply(401, { error: 'invalid_ticket', reason: 'stolen' });
    expect(await apiRedeemWorkbenchTicket('t'.repeat(22))).toMatchObject({ reason: null });
    answer = () => Promise.resolve(new Response('not json', { status: 401 }));
    expect(await apiRedeemWorkbenchTicket('t'.repeat(22))).toMatchObject({ reason: null });
  });

  it('reads a missing or trashed document as refused', async () => {
    answer = reply(404, { error: 'not_found' });
    expect(await apiRedeemWorkbenchTicket('t'.repeat(22))).toEqual({
      kind: 'refused',
      status: 404,
      reason: null,
    });
    answer = reply(410, { error: 'document_trashed' });
    expect((await apiRedeemWorkbenchTicket('t'.repeat(22))).kind).toBe('refused');
  });

  it('reads a server error as failed', async () => {
    answer = reply(503, { error: 'unavailable' });

    expect(await apiRedeemWorkbenchTicket('t'.repeat(22))).toEqual({ kind: 'failed', status: 503 });
  });

  it('reads a network failure as failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    answer = () => Promise.reject(new TypeError('offline'));

    expect(await apiRedeemWorkbenchTicket('t'.repeat(22))).toEqual({ kind: 'failed', status: 0 });
  });
});

describe('apiEndWorkbenchSession', () => {
  it('deletes the current session presenting it', async () => {
    answer = reply(204);

    await apiEndWorkbenchSession(SESSION.session);

    expect(seen[0]).toMatchObject({ method: 'DELETE' });
    expect(seen[0]!.url).toMatch(/\/workbench\/sessions\/current$/);
    expect(seen[0]!.headers.get('Authorization')).toBe(`Bearer ${SESSION.session}`);
  });

  it('never throws when the end is refused or unreachable', async () => {
    answer = reply(401, { error: 'invalid_session' });
    await expect(apiEndWorkbenchSession(SESSION.session)).resolves.toBeUndefined();
    answer = () => Promise.reject(new TypeError('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(apiEndWorkbenchSession(SESSION.session)).resolves.toBeUndefined();
  });
});

describe('the pairing calls', () => {
  beforeEach(() => {
    registerTokenProvider(async () => 'clerk-jwt');
  });

  it('reads a pairing request as the signed-in person', async () => {
    const request = {
      origin: 'https://127.0.0.1:5175',
      name: 'Spinner',
      tokenName: 'livediagram CLI',
      expiresAt: 5,
      status: 'pending',
    };
    answer = reply(200, { request });

    expect(await apiReadPairingRequest('user_1', 'c'.repeat(22))).toEqual(request);
    expect(seen[0]!.url).toMatch(new RegExp(`/workbench/pairing-requests/${'c'.repeat(22)}$`));
    expect(seen[0]!.headers.get('Authorization')).toBe('Bearer clerk-jwt');
  });

  it('reads an unknown request as null', async () => {
    answer = reply(404, { error: 'not_found' });

    expect(await apiReadPairingRequest('user_1', 'c'.repeat(22))).toBeNull();
  });

  it('approves and declines', async () => {
    answer = reply(200, { pairing: { id: 'p' } });
    expect(await apiAnswerPairingRequest('user_1', 'c'.repeat(22), 'approve')).toBe('approved');
    expect(seen[0]).toMatchObject({ method: 'POST' });
    expect(seen[0]!.url).toMatch(/\/approve$/);

    answer = reply(204);
    expect(await apiAnswerPairingRequest('user_1', 'c'.repeat(22), 'decline')).toBe('declined');
    expect(seen[1]!.url).toMatch(/\/decline$/);
  });

  it('names an answered, expired or missing request', async () => {
    answer = reply(409, { error: 'pairing_answered' });
    expect(await apiAnswerPairingRequest('user_1', 'c'.repeat(22), 'approve')).toBe('answered');
    answer = reply(410, { error: 'pairing_expired' });
    expect(await apiAnswerPairingRequest('user_1', 'c'.repeat(22), 'approve')).toBe('expired');
    answer = reply(404, { error: 'not_found' });
    expect(await apiAnswerPairingRequest('user_1', 'c'.repeat(22), 'decline')).toBe('missing');
  });

  it('throws on any other refusal', async () => {
    answer = reply(500, { error: 'internal' });

    await expect(apiAnswerPairingRequest('user_1', 'c'.repeat(22), 'approve')).rejects.toThrow(
      'answer pairing request failed: 500',
    );
  });

  it('lists the pairings and unpairs one', async () => {
    const pairing = {
      id: 'pair-1',
      tokenId: 'tok-1',
      origin: 'https://127.0.0.1:5175',
      name: 'Spinner',
      pairedAt: 3,
    };
    answer = reply(200, { pairings: [pairing] });
    expect(await apiListWorkbenchPairings('user_1')).toEqual([pairing]);
    expect(seen[0]!.url).toMatch(/\/workbench\/pairings$/);

    answer = reply(204);
    await apiUnpairWorkbench('user_1', 'pair-1');
    expect(seen[1]).toMatchObject({ method: 'DELETE' });
    expect(seen[1]!.url).toMatch(/\/workbench\/pairings\/pair-1$/);
  });
});
