// Send to Plan's door (liveworkspace/docs/specs/004-index/blueprints/send-to-plan.md "The door"): cards are made only on
// the person's own Editor grant for this plan, checked here before liveplanner's handler sees it.
import type { GrantClaims } from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AutomationDoorGrants } from './automation-step-door';
import { handleInternalItems, type InternalItemHandlers } from './internal';
import { tellSourceChanged } from './sheet-source-doors';

afterEach(() => vi.restoreAllMocks());

const CLAIMS = {
  iss: 'https://liveworkspace.app/api/index',
  aud: 'liveplanner',
  sub: 'user_ada',
  item: 'P',
  level: 'edit',
  tab: null,
  team: null,
  iat: 1,
  exp: 2,
} as GrantClaims;

const CALL = {
  person: 'user_ada',
  board: 'b1',
  column: 'To Do',
  cards: [
    {
      title: 'Fix the login',
      description: 'Fix the login\n\nFrom Retro (livediagram): https://x',
      sentFrom: {
        app: 'livediagram',
        itemId: 'D',
        title: 'Retro',
        kind: 'element',
        label: '',
        text: 'Fix the login',
        link: 'https://www.livediagram.app/document/D#t=t&el=e',
      },
    },
  ],
};

const grants =
  (claims: GrantClaims | null): AutomationDoorGrants =>
  async (grant, itemId) =>
    grant === 'g' && itemId === 'P' ? claims : null;

const send = (
  body: unknown,
  handlers: Partial<InternalItemHandlers>,
  verifyGrant: AutomationDoorGrants | null = grants(CLAIMS),
  grant = 'g',
) =>
  handleInternalItems(
    new Request('https://app.test/api/internal/items/P/plan-send', {
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

describe('Send to Plan at the plan', () => {
  it("makes the cards on the person's Editor grant and answers what the plan said", async () => {
    const planSend = vi.fn(async () => ({
      ok: true as const,
      cards: [{ id: 'c1', title: 'Fix the login', column: 'To Do', done: false }],
    }));
    const res = await send(CALL, { planSend });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      cards: [{ id: 'c1', title: 'Fix the login', column: 'To Do', done: false }],
    });
    expect(planSend).toHaveBeenCalledWith('P', CALL, CLAIMS);
  });

  it("refuses any grant short of the person's Editor one on the whole plan", async () => {
    const planSend = vi.fn();
    for (const claims of [
      null,
      { ...CLAIMS, sub: 'user_ben' },
      { ...CLAIMS, item: 'Q' },
      { ...CLAIMS, level: 'view' },
      { ...CLAIMS, tab: 't1' },
      { ...CLAIMS, trashed: true },
    ] as (GrantClaims | null)[])
      expect((await send(CALL, { planSend }, grants(claims))).status).toBe(403);
    expect((await send(CALL, { planSend }, grants(CLAIMS), 'forged')).status).toBe(403);
    expect(planSend).not.toHaveBeenCalled();
  });

  it('answers 400 to a call it cannot read, a failure when the handler throws, 404 elsewhere', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await send({ ...CALL, cards: [] }, { planSend: vi.fn() })).status).toBe(400);
    const planSend = vi.fn(async () => {
      throw new Error('boom');
    });
    expect(await (await send(CALL, { planSend })).json()).toEqual({
      ok: false,
      code: 'failed',
      reason: '',
    });
    expect((await send(CALL, {})).status).toBe(404);
    expect((await send(CALL, { planSend }, null)).status).toBe(404);
  });
});

describe("a plan's sent cards told to a source's room", () => {
  it('carries the cards beside the (empty) sheets', () => {
    const sent: unknown[] = [];
    const change = { app: 'liveplanner' as const, itemId: 'P', sheetIds: [], cards: ['c1'] };
    tellSourceChanged({ bind: () => {}, broadcast: (frame) => sent.push(frame) }, 'D', change);
    expect(sent).toEqual([{ kind: 'source-changed', ...change }]);
  });
});
