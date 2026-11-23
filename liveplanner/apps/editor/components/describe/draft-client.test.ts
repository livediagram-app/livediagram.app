import { afterEach, describe, expect, it, vi } from 'vitest';

// An AI draft's call (docs/specs/026-plan/describe-a-plan.md "Which AI drafts it"): a refusal the api names throws a
// DraftRefusal in its words, and a key's failure rides it for the source line, never any part of the key.
const fetched = vi.hoisted(() => ({ res: new Response('{}') }));
vi.mock('@/lib/api/core', () => ({
  API_BASE: '/api',
  apiFetch: vi.fn(async () => fetched.res),
  apiHeaders: vi.fn(async () => ({})),
  expectOk: vi.fn(async (res: Response) => (await res.json()) as unknown),
}));

import { DraftRefusal, postDraft } from './draft-client';

const make = (status: number, code: string, message: string) =>
  new DraftRefusal(status, code, message);
const post = () =>
  postDraft('plan-drafts', 'o1', 'a plan', ['ai_key_failed', 'x_off'], make, 'draft');
const answer = (status: number, body: unknown) =>
  (fetched.res = new Response(JSON.stringify(body), { status }));

afterEach(() => vi.clearAllMocks());

describe('postDraft', () => {
  it('carries a key’s failure on the refusal', async () => {
    const aiKey = { source: 'account', provider: 'openai', kind: 'no-credit' };
    answer(422, { error: 'ai_key_failed', message: 'OpenAI says it is out of credit.', aiKey });
    const refusal = (await post().catch((e: unknown) => e)) as DraftRefusal;
    expect(refusal).toBeInstanceOf(DraftRefusal);
    expect(refusal.code).toBe('ai_key_failed');
    expect(refusal.message).toBe('OpenAI says it is out of credit.');
    expect(refusal.aiKey).toEqual(aiKey);
  });

  it('carries none on any other refusal, and answers a draft', async () => {
    answer(422, { error: 'x_off', message: 'Not a plan.' });
    expect(((await post().catch((e: unknown) => e)) as DraftRefusal).aiKey).toBeNull();
    answer(200, { draft: { ok: true } });
    expect(await post()).toEqual({ draft: { ok: true } });
  });
});
