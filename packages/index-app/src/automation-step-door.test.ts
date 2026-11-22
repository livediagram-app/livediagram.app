// The automation doors (blueprint cross-app.md "The door"): a step runs only on the author's own Editor grant for this
// item, checked here before the app's handler sees it; anything less is a 403, which the index reads as no access.
import type { GrantClaims } from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { grantWrites, readDoorCall, type AutomationDoorGrants } from './automation-step-door';
import { handleInternalItems, type InternalItemHandlers } from './internal';

afterEach(() => vi.restoreAllMocks());

const CLAIMS: GrantClaims = {
  iss: 'https://liveworkspace.app/api/index',
  aud: 'liveknowledge',
  sub: 'user_ada',
  item: 'A',
  level: 'edit',
  tab: null,
  team: null,
  iat: 1,
  exp: 2,
} as GrantClaims;

const CALL = {
  author: 'user_ada',
  rule: { id: 'r1', name: 'Release Note', app: 'liveplanner', item: 'P' },
  from: { title: 'Launch', url: 'https://liveplanner.app/project/P' },
  chain: { id: 'c', hops: 1, rules: ['liveplanner:P:r1'] },
  step: {
    kind: 'kb_page',
    target: { app: 'liveknowledge', item: 'A', title: 'Docs' },
    title: 'T',
    body: 'B',
  },
};

const grants =
  (claims: GrantClaims | null): AutomationDoorGrants =>
  async (grant, itemId) =>
    grant === 'g' && itemId === 'A' ? claims : null;

const send = (
  door: 'automation-step' | 'automation-target',
  body: unknown,
  handlers: Partial<InternalItemHandlers>,
  verifyGrant: AutomationDoorGrants | null = grants(CLAIMS),
  grant = 'g',
) =>
  handleInternalItems(
    new Request(`https://app.test/api/internal/items/A/${door}`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer k',
        'Content-Type': 'application/json',
        'X-Index-Grant': grant,
      },
      body: JSON.stringify(body),
    }),
    {
      key: 'k',
      handlers: { purge: async () => {}, ...handlers },
      ...(verifyGrant ? { verifyGrant } : {}),
    },
  );

describe('a step in another app at its target', () => {
  it('runs the app’s handler on the author’s Editor grant and answers what it said', async () => {
    const automationStep = vi.fn(async () => ({ ok: true as const, text: 'Wrote “T” in Docs' }));
    const res = await send('automation-step', CALL, { automationStep });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, text: 'Wrote “T” in Docs' });
    expect(automationStep).toHaveBeenCalledWith('A', CALL, CLAIMS, 'g');
  });

  it('refuses any grant short of the author’s Editor one on the whole item', async () => {
    const automationStep = vi.fn();
    for (const claims of [
      null,
      { ...CLAIMS, sub: 'user_ben' },
      { ...CLAIMS, item: 'B' },
      { ...CLAIMS, level: 'participate' },
      { ...CLAIMS, tab: 't1' },
      { ...CLAIMS, trashed: true },
    ] as (GrantClaims | null)[])
      expect((await send('automation-step', CALL, { automationStep }, grants(claims))).status).toBe(
        403,
      );
    expect(
      (await send('automation-step', CALL, { automationStep }, grants(CLAIMS), 'forged')).status,
    ).toBe(403);
    expect(automationStep).not.toHaveBeenCalled();
    expect(grantWrites(CLAIMS, 'user_ada', 'A')).toBe(true);
  });

  it('answers a failure when the handler throws, and 404 where the app is no target', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const automationStep = vi.fn(async () => {
      throw new Error('boom');
    });
    expect(await (await send('automation-step', CALL, { automationStep })).json()).toEqual({
      ok: false,
      code: 'failed',
      reason: '',
    });
    expect((await send('automation-step', CALL, {})).status).toBe(404);
    expect((await send('automation-step', CALL, { automationStep }, null)).status).toBe(404);
  });

  it('reads only a whole call, and never a Notify', () => {
    expect(readDoorCall(CALL)).toEqual(CALL);
    for (const bad of [
      null,
      { ...CALL, author: 3 },
      { ...CALL, rule: { ...CALL.rule, id: 1 } },
      { ...CALL, rule: { ...CALL.rule, app: 1 } },
      { ...CALL, rule: null },
      { ...CALL, from: { title: 'x' } },
      { ...CALL, chain: { id: 'c', hops: 1.5, rules: [] } },
      { ...CALL, chain: { id: 'c', hops: 1, rules: [3] } },
      { ...CALL, chain: null },
      { ...CALL, step: { kind: 'inbox_notice', to: [], text: 'x' } },
      { ...CALL, step: { kind: 'nope' } },
      { ...CALL, step: { ...CALL.step, body: 'x'.repeat(70_000) } },
    ])
      expect(readDoorCall(bad)).toBeNull();
  });

  it('answers 400 to a call it cannot read', async () => {
    expect(
      (await send('automation-step', { ...CALL, step: null }, { automationStep: vi.fn() })).status,
    ).toBe(400);
  });
});

describe('what a target offers the pickers', () => {
  it('answers the handler’s description on the author’s grant', async () => {
    const automationTarget = vi.fn(async () => ({
      pages: [{ id: 'p', name: 'Home', parent: null }],
    }));
    const res = await send('automation-target', { author: 'user_ada' }, { automationTarget });
    expect(await res.json()).toEqual({ pages: [{ id: 'p', name: 'Home', parent: null }] });
    expect(automationTarget).toHaveBeenCalledWith('A', 'user_ada', CLAIMS);
    expect(
      (await send('automation-target', { author: 'user_ben' }, { automationTarget })).status,
    ).toBe(403);
    expect((await send('automation-target', {}, { automationTarget })).status).toBe(400);
    expect((await send('automation-target', { author: 'user_ada' }, {})).status).toBe(404);
  });

  it('answers 503 when the handler throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const automationTarget = vi.fn(async () => {
      throw new Error('x');
    });
    expect(
      (await send('automation-target', { author: 'user_ada' }, { automationTarget })).status,
    ).toBe(503);
  });
});
