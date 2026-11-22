import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanCardChange, PlanSendDoorCall } from '@liveworkspace/index-client';
import { readSentFrom } from '@liveplanner/items';
import { endRepeatWorld } from './test-repeat-world';
import { automationWorld, USER, type AutomationWorld } from './automations/test-automation-world';

// Send to Plan at this plan (docs/specs/026-plan/items.md "Sent From"; liveworkspace send-to-plan.md "The card"),
// through the real room: cards made as the person on the board's column, assigned and due as written, with their
// checklist and Sent From; and a sent card's move told to the index once, for the source's chip.
vi.mock('../auth/accounts', async () => (await import('./test-accounts-mock')).accountsMock);

const told: { planId: string; cards: PlanCardChange[] }[] = [];
vi.mock('../index-service', async (original) => {
  const real = await original<typeof import('../index-service')>();
  return {
    ...real,
    indexAppClient: () => ({
      planCardsChanged: async (planId: string, cards: readonly PlanCardChange[]) => {
        told.push({ planId, cards: [...cards] });
        return { told: 1 };
      },
      recordPlanSends: async (
        _planId: string,
        _person: string,
        cards: readonly { id: string }[],
      ) => ({
        sentFrom: cards.map((c) => (c.id ? FROM : null)),
      }),
    }),
  };
});

let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  told.length = 0;
  w = await automationWorld();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  endRepeatWorld();
});

const room = () => w.plans.get('A')!.room;
const FROM = {
  app: 'livediagram' as const,
  itemId: 'D',
  title: 'Retro',
  kind: 'element' as const,
  label: 'Board',
  text: 'Fix the login',
  link: 'https://www.livediagram.app/document/D#t=t1&el=e1',
};
const call = (over: Partial<PlanSendDoorCall> = {}): PlanSendDoorCall => ({
  person: USER,
  board: 'b1',
  column: 'in progress',
  cards: [
    {
      title: 'Fix the login',
      description: 'Fix the login\n\nFrom Retro, Board (livediagram): https://x',
      due: '2026-12-01',
      assignee: 'Nobody Here',
      checklist: ['One', 'Two'],
      sentFrom: FROM,
    },
    { title: 'Second', description: '', sentFrom: FROM },
  ],
  ...over,
});

describe('Send to Plan at the plan', () => {
  it('makes each card on the column as the person, with its checklist, due day and Sent From', async () => {
    const answer = await room().planSend('A', call());
    expect(answer).toMatchObject({
      ok: true,
      cards: [
        { title: 'Fix the login', column: 'In Progress', done: false },
        { title: 'Second', column: 'In Progress', done: false },
      ],
    });
    const items = await w.items('A');
    const card = items.find((i) => i.fields['title'] === 'Fix the login')!;
    expect(card.fields['status']).toBe('doing');
    expect(card.fields['due']).toBe('2026-12-01');
    expect(card.fields['assignee']).toBeUndefined();
    expect(card.fields['checklist']).toEqual([
      { text: 'One', done: false },
      { text: 'Two', done: false },
    ]);
    expect(readSentFrom(card.fields['sentFrom'])).toEqual(FROM);
    const second = items.find((i) => i.fields['title'] === 'Second')!;
    expect(second.fields['description']).toBeUndefined();
    expect(second.key).not.toBe(card.key);
  });

  it('answers a board gone', async () => {
    expect(await room().planSend('A', call({ board: 'gone' }))).toMatchObject({
      ok: false,
      code: 'target_gone',
    });
  });

  it("tells the index once when a sent card moves, for the source's chip", async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const answer = await room().planSend('A', call());
    const id = answer.ok ? answer.cards[0]!.id : '';
    // The burst's tell, its board read and all, settled.
    const settled = async () => {
      await vi.runAllTimersAsync();
      for (let i = 0; i < 20; i += 1) await new Promise((r) => setImmediate(r));
    };
    await settled();
    expect(told).toHaveLength(1);
    told.length = 0;
    await w.send('POST', `/api/projects/A/items/${id}/move`, { status: 'done' });
    await settled();
    expect(told).toHaveLength(1);
    expect(told[0]).toEqual({
      planId: 'A',
      cards: [{ id, title: 'Fix the login', column: 'Done', done: true, gone: false }],
    });
  });
});

describe("an agent's card from another app (share roles)", () => {
  const body = (sentFrom: unknown, title = 'From the retro') => ({
    type: 'task',
    fields: { title },
    sentFrom,
  });
  const source = { app: 'livediagram', itemId: 'D', elementId: 'e1', tabId: 't1', text: 'Fix it' };

  it("an Editor's token makes it with the Sent From the index filled in", async () => {
    const res = await w.as('token', 'POST', '/items', body(source));
    expect(res.status).toBe(201);
    const card = (await w.items('A')).find((i) => i.fields['title'] === 'From the retro')!;
    expect(readSentFrom(card.fields['sentFrom'])).toEqual(FROM);
  });

  it('a Participant, a Viewer and one tab’s Editor are refused; a bad source is a 400', async () => {
    for (const who of ['token_participant', 'participant', 'tab_editor_link', 'viewer'] as const)
      expect([403, 404]).toContain((await w.as(who, 'POST', '/items', body(source))).status);
    expect((await w.as('token', 'POST', '/items', body({ app: 'nowhere' }))).status).toBe(400);
    expect((await w.items('A')).some((i) => i.fields['title'] === 'From the retro')).toBe(false);
  });

  it('a run of them through the bulk route too', async () => {
    const res = await w.as('token', 'POST', '/items/bulk', {
      items: [body(source), body(source, 'Two')],
    });
    expect(res.status).toBe(201);
    const two = (await w.items('A')).find((i) => i.fields['title'] === 'Two')!;
    expect(readSentFrom(two.fields['sentFrom'])).toEqual(FROM);
  });
});
