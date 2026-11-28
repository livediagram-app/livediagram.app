import { afterEach, describe, expect, it, vi } from 'vitest';

// Plan AI's call (docs/specs/026-plan/blueprints/plan-ai.md "The editor"): a refusal the api names throws in its words.
const fetched = vi.hoisted(() => ({ res: new Response('{}'), init: null as RequestInit | null }));
vi.mock('@/lib/api/core', () => ({
  API_BASE: '/api',
  apiFetch: vi.fn(async (_url: string, init: RequestInit) => {
    fetched.init = init;
    return fetched.res;
  }),
  apiHeaders: vi.fn(async () => ({})),
  expectOk: vi.fn(async (res: Response) => {
    if (!res.ok) throw new Error('failed');
    return (await res.json()) as unknown;
  }),
}));

import { DraftRefusal } from '@/components/describe/draft-client';
import { askPlanAi } from './plan-ai-client';

const BODY = {
  projectId: 'p1',
  kind: 'board' as const,
  tabName: 'R',
  tab: 'Board',
  instruction: 'Hi',
};
const answer = (status: number, body: unknown) =>
  (fetched.res = new Response(JSON.stringify(body), { status }));

afterEach(() => vi.clearAllMocks());

describe('askPlanAi', () => {
  it('posts the turn and answers the reply', async () => {
    answer(200, { reply: 'Hello', changes: [], provider: 'built-in', role: 'edit' });
    const signal = new AbortController().signal;
    expect(await askPlanAi('o1', BODY, signal)).toMatchObject({ reply: 'Hello' });
    expect(JSON.parse(fetched.init!.body as string)).toEqual(BODY);
    expect(fetched.init!.signal).toBe(signal);
    answer(200, { reply: 'Again', changes: [], provider: 'built-in', role: 'edit' });
    await askPlanAi('o1', BODY);
    expect(fetched.init!.signal).toBeUndefined();
  });

  it('throws a refusal it names in the api’s words, and anything else as a failure', async () => {
    answer(429, { error: 'ask_built_in_limit', message: 'Used up.' });
    const refused = (await askPlanAi('o1', BODY).catch((e: unknown) => e)) as DraftRefusal;
    expect(refused).toBeInstanceOf(DraftRefusal);
    expect(refused.message).toBe('Used up.');
    answer(500, { error: 'boom', message: 'x' });
    const failed = await askPlanAi('o1', BODY).catch((e: unknown) => e);
    expect(failed).not.toBeInstanceOf(DraftRefusal);
  });
});
