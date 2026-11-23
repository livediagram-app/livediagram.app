import { refusal } from './index-error';
import { describe, expect, it } from 'vitest';
import { createIndexAppClient, createIndexClient } from './client';
import {
  isPlanDay,
  planSendDescription,
  planSendDoorPath,
  planSendRef,
  PLAN_CARDS_CHANGED_MAX,
  PLAN_SEND_CARDS_MAX,
  PLAN_SEND_CHECKLIST_MAX,
  PLAN_SEND_PLACES_MAX,
  readAgentSentFrom,
  readPlanCardChanges,
  readPlanSendAsk,
  readPlanSendDoorCall,
  readSentFrom,
  textPart,
  type PlanSendPlace,
} from './plan-sends';
import { readSourceChange } from './sheet-sources';

const PLACE: PlanSendPlace = {
  app: 'livediagram',
  itemId: 'd1',
  kind: 'element',
  tabId: 't1',
  elementId: 'e1',
  part: null,
  label: 'Sprint 12',
  text: 'Fix the login',
};
const SENT = {
  app: 'livediagram',
  itemId: 'd1',
  title: 'Retro',
  kind: 'element',
  label: 'Sprint 12',
  text: 'Fix the login',
  link: 'https://www.livediagram.app/document/d1#t=t1&el=e1',
};

type Seen = { url: string; method: string; headers: Headers; body: unknown };
function fakeFetch(answer: unknown) {
  const seen: Seen[] = [];
  const doFetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    seen.push({
      url: String(input),
      method: init.method ?? 'GET',
      headers: new Headers(init.headers),
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    return Response.json(answer);
  }) as typeof fetch;
  return { seen, doFetch };
}

describe('a place', () => {
  it('is named by its ref, each part empty when null', () => {
    expect(planSendRef(PLACE)).toBe('element:t1:e1:');
    expect(planSendRef({ kind: 'thread', tabId: null, elementId: null, part: 'th1' })).toBe(
      'thread:::th1',
    );
  });

  it('keys picked words alike whatever their case and spacing', () => {
    expect(textPart('Fix  the\nLogin ')).toBe(textPart('fix the login'));
    expect(textPart('  fix the login')).toBe(textPart('fix the login'));
    expect(textPart('fix the login')).not.toBe(textPart('fix the logout'));
    expect(textPart('')).toMatch(/^[0-9a-f]{8}$/);
    // A character beyond the basic plane counts each of its halves.
    expect(textPart('ship 🚀')).not.toBe(textPart('ship'));
  });

  it('reads a day', () => {
    expect(isPlanDay('2026-12-01')).toBe(true);
    expect(isPlanDay('1 Dec')).toBe(false);
    expect(isPlanDay(3)).toBe(false);
  });

  it("opens at liveplanner's door path", () => {
    expect(planSendDoorPath('p/1')).toBe('/api/internal/items/p%2F1/plan-send');
  });
});

describe('a send', () => {
  const ask = {
    board: 'b1',
    column: 'To Do',
    cards: [{ title: ' Fix the login ', assignee: 'Sam', due: '2026-12-01', places: [PLACE] }],
  };

  it('is read whole, its title trimmed', () => {
    expect(readPlanSendAsk(ask)).toEqual({
      board: 'b1',
      column: 'To Do',
      cards: [{ title: 'Fix the login', assignee: 'Sam', due: '2026-12-01', places: [PLACE] }],
    });
    expect(
      readPlanSendAsk({
        ...ask,
        again: true,
        cards: [{ title: 'a', checklist: ['x'], places: [PLACE] }],
      }),
    ).toEqual({
      board: 'b1',
      column: 'To Do',
      again: true,
      cards: [{ title: 'a', checklist: ['x'], places: [PLACE] }],
    });
  });

  it('refuses anything over a cap or of the wrong type', () => {
    const card = ask.cards[0]!;
    const bad = [
      null,
      [],
      { ...ask, board: '' },
      { ...ask, column: 3 },
      { ...ask, cards: [] },
      { ...ask, cards: 'x' },
      { ...ask, cards: Array.from({ length: PLAN_SEND_CARDS_MAX + 1 }, () => card) },
      { ...ask, cards: [{ ...card, title: '  ' }] },
      { ...ask, cards: [{ ...card, title: 'x'.repeat(201) }] },
      { ...ask, cards: [null] },
      { ...ask, cards: [{ ...card, assignee: 4 }] },
      { ...ask, cards: [{ ...card, due: 'Friday' }] },
      { ...ask, cards: [{ ...card, checklist: 'x' }] },
      { ...ask, cards: [{ ...card, checklist: Array(PLAN_SEND_CHECKLIST_MAX + 1).fill('x') }] },
      { ...ask, cards: [{ ...card, places: [] }] },
      { ...ask, cards: [{ ...card, places: 'x' }] },
      { ...ask, cards: [{ ...card, places: Array(PLAN_SEND_PLACES_MAX + 1).fill(PLACE) }] },
      { ...ask, cards: [{ ...card, places: [{ ...PLACE, app: 'nope' }] }] },
      { ...ask, cards: [{ ...card, places: [{ ...PLACE, itemId: '' }] }] },
      { ...ask, cards: [{ ...card, places: [{ ...PLACE, kind: 'sticky' }] }] },
      { ...ask, cards: [{ ...card, places: [{ ...PLACE, tabId: 3 }] }] },
      { ...ask, cards: [{ ...card, places: [{ ...PLACE, elementId: '' }] }] },
      { ...ask, cards: [{ ...card, places: [{ ...PLACE, part: 'x'.repeat(65) }] }] },
      { ...ask, cards: [{ ...card, places: [{ ...PLACE, label: 'x'.repeat(121) }] }] },
      { ...ask, cards: [{ ...card, places: [{ ...PLACE, text: 'x'.repeat(2001) }] }] },
      { ...ask, cards: [{ ...card, places: [null] }] },
    ];
    for (const b of bad) expect(readPlanSendAsk(b)).toBeNull();
  });
});

describe('the change call', () => {
  const change = { id: 'c1', title: 'Fix', column: 'Done', done: true, gone: false };

  it('reads its cards', () => {
    expect(readPlanCardChanges({ cards: [change] })).toEqual([change]);
  });

  it('refuses a body that is not one', () => {
    const bad = [
      null,
      { cards: [] },
      { cards: Array(PLAN_CARDS_CHANGED_MAX + 1).fill(change) },
      { cards: [null] },
      { cards: [{ ...change, id: '' }] },
      { cards: [{ ...change, title: 3 }] },
      { cards: [{ ...change, column: 3 }] },
      { cards: [{ ...change, done: 'yes' }] },
      { cards: [{ ...change, gone: 1 }] },
    ];
    for (const b of bad) expect(readPlanCardChanges(b)).toBeNull();
  });

  it('rides the source-changed door with the cards and no sheets', () => {
    expect(
      readSourceChange({ app: 'liveplanner', itemId: 'p1', sheetIds: [], cards: ['c1', 'c1'] }),
    ).toEqual({ app: 'liveplanner', itemId: 'p1', sheetIds: [], cards: ['c1'] });
    expect(
      readSourceChange({ app: 'liveplanner', itemId: 'p1', sheetIds: ['s1'], cards: [] }),
    ).toEqual({
      app: 'liveplanner',
      itemId: 'p1',
      sheetIds: ['s1'],
    });
    expect(
      readSourceChange({ app: 'liveplanner', itemId: 'p1', sheetIds: [], cards: [] }),
    ).toBeNull();
    expect(
      readSourceChange({ app: 'liveplanner', itemId: 'p1', sheetIds: [], cards: 'c1' }),
    ).toBeNull();
    expect(
      readSourceChange({ app: 'liveplanner', itemId: 'p1', sheetIds: [], cards: ['bad id'] }),
    ).toBeNull();
    expect(
      readSourceChange({
        app: 'liveplanner',
        itemId: 'p1',
        sheetIds: [],
        cards: Array(101).fill('c'),
      }),
    ).toBeNull();
  });
});

describe('Sent From', () => {
  it('reads a stored one', () => {
    expect(readSentFrom(SENT)).toEqual(SENT);
  });

  it('refuses one that is not', () => {
    const bad = [
      null,
      { ...SENT, app: 'x' },
      { ...SENT, itemId: '' },
      { ...SENT, kind: 'x' },
      { ...SENT, title: 3 },
      { ...SENT, label: 3 },
      { ...SENT, text: 3 },
      { ...SENT, link: 3 },
      { ...SENT, link: 'javascript:alert(1)' },
    ];
    for (const b of bad) expect(readSentFrom(b)).toBeNull();
  });

  it("reads an agent's", () => {
    expect(readAgentSentFrom({ app: 'liveknowledge', itemId: 'k1', text: 'Todo' })).toEqual({
      app: 'liveknowledge',
      itemId: 'k1',
      text: 'Todo',
    });
    expect(
      readAgentSentFrom({
        app: 'livediagram',
        itemId: 'd1',
        tabId: 't1',
        elementId: 'e1',
        text: '',
      }),
    ).toEqual({ app: 'livediagram', itemId: 'd1', tabId: 't1', elementId: 'e1', text: '' });
    for (const b of [
      null,
      { app: 'x', itemId: 'd1', text: '' },
      { app: 'livediagram', itemId: '', text: '' },
      { app: 'livediagram', itemId: 'd1', text: 3 },
      { app: 'livediagram', itemId: 'd1', text: '', tabId: '' },
      { app: 'livediagram', itemId: 'd1', text: '', elementId: 3 },
    ])
      expect(readAgentSentFrom(b)).toBeNull();
  });
});

describe("the door's call", () => {
  const call = {
    person: 'user_1',
    board: 'b1',
    column: 'To Do',
    cards: [{ title: 'Fix', description: 'd', sentFrom: SENT }],
  };

  it('is read whole', () => {
    expect(readPlanSendDoorCall(call)).toEqual(call);
    const full = {
      ...call,
      cards: [{ ...call.cards[0], assignee: 'Sam', due: '2026-12-01', checklist: ['a'] }],
    };
    expect(readPlanSendDoorCall(full)).toEqual(full);
  });

  it('refuses one that is not', () => {
    const card = call.cards[0]!;
    const bad = [
      null,
      { ...call, person: '' },
      { ...call, board: '' },
      { ...call, column: 3 },
      { ...call, cards: [] },
      { ...call, cards: Array(PLAN_SEND_CARDS_MAX + 1).fill(card) },
      { ...call, cards: [null] },
      { ...call, cards: [{ ...card, title: ' ' }] },
      { ...call, cards: [{ ...card, description: 3 }] },
      { ...call, cards: [{ ...card, assignee: 3 }] },
      { ...call, cards: [{ ...card, due: 'x' }] },
      { ...call, cards: [{ ...card, checklist: [3] }] },
      { ...call, cards: [{ ...card, sentFrom: null }] },
    ];
    for (const b of bad) expect(readPlanSendDoorCall(b)).toBeNull();
  });
});

describe('the description', () => {
  it('holds every word sent, then the line back', () => {
    const from = {
      title: 'Retro',
      label: 'Sprint 12',
      app: 'livediagram' as const,
      link: 'https://x',
    };
    expect(planSendDescription([{ text: ' a ' }, { text: '' }, { text: 'b' }], from)).toBe(
      'a\n\nb\n\nFrom Retro, Sprint 12 (livediagram): https://x',
    );
    expect(planSendDescription([], { ...from, title: '', label: '' })).toBe(
      'From Untitled (livediagram): https://x',
    );
  });
});

describe('the clients', () => {
  it('sends, reads a source and makes a plan, as the person', async () => {
    const { seen, doFetch } = fakeFetch({ sends: [] });
    const client = createIndexClient({ getToken: () => 'tok', fetch: doFetch });
    await client.sendToPlan('p1', { board: 'b1', column: 'To Do', cards: [] });
    await client.planSends('d1');
    await client.planSends('d1', { share: { code: 'abc' } });
    await client.newPlanForSend('Launch');
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'POST /api/index/items/p1/plan-sends',
      'GET /api/index/items/d1/plan-sends',
      'GET /api/index/items/d1/plan-sends',
      'POST /api/index/plan-sends/plans',
    ]);
    expect(seen[2]!.headers.get('X-Share-Code')).toBe('abc');
    expect(seen[3]!.body).toEqual({ name: 'Launch' });
  });

  it("tells the index of a plan's changed cards and records an agent's", async () => {
    const { seen, doFetch } = fakeFetch({ told: 1 });
    const app = createIndexAppClient({
      app: 'liveplanner',
      key: 'k',
      baseUrl: 'https://x/api/index',
      fetch: doFetch,
    });
    await app.planCardsChanged('p1', [
      { id: 'c1', title: 'a', column: 'b', done: false, gone: false },
    ]);
    await app.recordPlanSends('p1', 'user_1', [
      {
        id: 'c1',
        title: 'a',
        column: 'b',
        done: false,
        sentFrom: { app: 'livediagram', itemId: 'd1', text: '' },
      },
    ]);
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'POST https://x/api/index/app/items/p1/plan-cards',
      'POST https://x/api/index/app/items/p1/plan-sends',
    ]);
    expect(seen[1]!.body).toMatchObject({ person: 'user_1' });
  });
});

describe("a Send to Plan refusal's detail", () => {
  it('keeps the body of an already_sent and a plan_refused, and of nothing else', () => {
    const res = (status: number) => new Response(null, { status });
    const sent = refusal(res(409), { error: 'already_sent', send: { id: 'ps_1' } });
    expect(sent.detail).toEqual({ error: 'already_sent', send: { id: 'ps_1' } });
    expect(refusal(res(422), { error: 'plan_refused', reason: 'x' }).detail).toMatchObject({
      reason: 'x',
    });
    expect(refusal(res(403), { error: 'forbidden', send: 1 }).detail).toBeNull();
    expect(refusal(res(500), null).detail).toBeNull();
  });
});
