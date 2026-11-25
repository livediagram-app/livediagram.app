import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanDiagramDoorCall, PlanViewRedraw, SentFrom } from '@liveworkspace/index-client';
import { defaultCatalogue, presetSetup, readSentFrom, type Item } from '@liveplanner/items';
import { endRepeatWorld } from './test-repeat-world';
import { automationWorld, USER, type AutomationWorld } from './automations/test-automation-world';

// Diagrams and Plans at this plan (liveworkspace's diagrams-and-plans.md "The doors"), through the real room: Make
// Plan Cards makes, updates and trashes cards as the person, arrows becoming Blocked By (a board type gaining the field
// when it needs one), loops left out; the graph op draws the board; a watch keeps it live; a drawn diagram's edits
// are checked as the card panel checks them.
vi.mock('../auth/accounts', async () => (await import('./test-accounts-mock')).accountsMock);

const redrawn: PlanViewRedraw[][] = [];
vi.mock('../index-service', async (original) => {
  const real = await original<typeof import('../index-service')>();
  return {
    ...real,
    indexAppClient: () => ({
      planCardsChanged: async () => ({ told: 1 }),
      planDiagramsChanged: async (_planId: string, views: readonly PlanViewRedraw[]) => {
        redrawn.push([...views]);
        return { views: views.map((v) => ({ diagramId: v.diagramId, status: 'ok' })) };
      },
    }),
  };
});

let w: AutomationWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  redrawn.length = 0;
  w = await automationWorld();
  // The built-in card types, as a plan made from a template holds them (Task without a Blocked By field).
  await w.send('PUT', '/api/projects/A/item-types', { itemTypes: defaultCatalogue() });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  endRepeatWorld();
});

const room = () => w.plans.get('A')!.room;
const FROM: SentFrom = {
  app: 'livediagram',
  itemId: 'D',
  title: 'Roadmap',
  kind: 'element',
  label: 'Q1',
  text: 'Design',
  link: 'https://www.livediagram.app/d/D#t=t1&el=e1',
};
type Make = Extract<PlanDiagramDoorCall, { op: 'make' }>;
const shape = (
  element: string,
  over: Partial<Make['cards'][number]> = {},
): Make['cards'][number] => ({
  element,
  title: `Shape ${element}`,
  description: `From Roadmap: ${element}`,
  sentFrom: FROM,
  ...over,
});
const make = (over: Partial<Make> = {}): Make => ({
  op: 'make',
  person: USER,
  board: 'b1',
  column: 'To Do',
  trash: [],
  cards: [
    shape('e1', { column: 'In Progress', start: '2026-12-01', due: '2026-12-05' }),
    shape('e2', { blockedBy: ['e1'] }),
  ],
  ...over,
});
type MakeAnswer = {
  ok: true;
  cards: { element: string; id: string; made: boolean; column: string }[];
  trashed: number;
  skipped: number;
};
const run = async (call: PlanDiagramDoorCall): Promise<Record<string, unknown>> =>
  room().planDiagram('A', call);
const byTitle = (items: Item[], title: string) => items.find((i) => i.fields['title'] === title)!;

describe('Make Plan Cards at the plan', () => {
  it('makes each shape a card in its lane’s column, with its dates, Sent From and Blocked By', async () => {
    const answer = (await run(make())) as MakeAnswer;
    expect(answer.ok).toBe(true);
    expect(answer.cards.map((c) => [c.element, c.made, c.column])).toEqual([
      ['e1', true, 'In Progress'],
      ['e2', true, 'To Do'],
    ]);
    const items = await w.items('A');
    const design = byTitle(items, 'Shape e1');
    expect(design.fields['start']).toBe('2026-12-01');
    expect(design.fields['due']).toBe('2026-12-05');
    expect(readSentFrom(design.fields['sentFrom'])).toEqual(FROM);
    const build = byTitle(items, 'Shape e2');
    // The board's type gained a Blocked By field, holding the link.
    expect(
      Object.values(build.fields).filter((v) => Array.isArray(v) && v.includes(design.id)),
    ).toHaveLength(1);
  });

  it('making again updates the same cards in place and trashes only those asked', async () => {
    const first = (await run(make())) as MakeAnswer;
    const [e1, e2] = first.cards;
    const again = (await run(
      make({
        cards: [shape('e1', { cardId: e1!.id, title: 'Design, renamed', column: 'Done' })],
        trash: [e2!.id],
      }),
    )) as MakeAnswer;
    expect(again).toMatchObject({
      ok: true,
      trashed: 1,
      cards: [{ id: e1!.id, made: false, column: 'In Progress' }],
    });
    const items = await w.items('A');
    expect(items.find((i) => i.id === e1!.id)!.fields['title']).toBe('Design, renamed');
    expect(items.find((i) => i.id === e2!.id)!.fields['status']).toBe('trash');
  });

  it('leaves out a link that would close a loop', async () => {
    const answer = (await run(
      make({ cards: [shape('a', { blockedBy: ['b'] }), shape('b', { blockedBy: ['a'] })] }),
    )) as MakeAnswer;
    expect(answer.skipped).toBe(1);
  });

  it('answers a board gone', async () => {
    expect(await run(make({ board: 'gone' }))).toMatchObject({ ok: false, code: 'target_gone' });
  });
});

describe('View As Diagram at the plan', () => {
  it('draws the board, then keeps a watched view live, redrawn once its cards change', async () => {
    await run(make());
    const graph = await run({ op: 'graph', person: USER, board: 'b1', filtered: false });
    expect(graph).toMatchObject({ ok: true });
    const drawn = graph['graph'] as {
      nodes: { card: string; critical: boolean }[];
      edges: unknown[];
    };
    expect(drawn.nodes.length).toBeGreaterThanOrEqual(2);
    expect(drawn.edges).toHaveLength(1);
    expect(drawn.nodes.filter((n) => n.critical)).toHaveLength(2);
    expect(await run({ op: 'graph', person: USER, board: 'gone', filtered: true })).toMatchObject({
      ok: false,
      code: 'target_gone',
    });

    vi.useFakeTimers({ toFake: ['setTimeout'] });
    await run({
      op: 'watch',
      person: USER,
      board: 'b1',
      filtered: false,
      diagramId: 'd1',
      tabId: 'dt1',
    });
    expect(room().planViews.count()).toBe(1);
    await run(make({ cards: [shape('e9')] }));
    await vi.runAllTimersAsync();
    expect(redrawn).toHaveLength(1);
    expect(redrawn[0]![0]).toMatchObject({ diagramId: 'd1', tabId: 'dt1', person: USER });
  });
});

describe("a drawn diagram's edits at the plan", () => {
  it('applies a block and a move as the person, refusing a loop, a card gone and a column the board lacks', async () => {
    const made = (await run(make())) as MakeAnswer;
    const [e1, e2] = made.cards.map((c) => c.id);
    const out = await run({
      op: 'edit',
      person: USER,
      edits: [
        { kind: 'move', card: e2!, column: 'done' },
        { kind: 'block', card: e1!, blocker: e2! },
        { kind: 'block', card: e2!, blocker: e1! },
        { kind: 'move', card: e1!, column: 'Nowhere' },
        { kind: 'move', card: 'gone', column: 'Done' },
        { kind: 'block', card: e1!, blocker: 'gone' },
        { kind: 'move', card: e1!, column: 'In Progress' },
      ],
    });
    expect(out['results']).toEqual([
      { status: 'applied' },
      { status: 'refused', reason: expect.any(String) },
      { status: 'applied' },
      { status: 'refused', reason: 'The board has no column called Nowhere' },
      { status: 'refused', reason: 'That card is gone' },
      { status: 'refused', reason: 'That card is gone' },
      { status: 'applied' },
    ]);
    const items = await w.items('A');
    expect(items.find((i) => i.id === e2)!.fields['status']).toBe('done');
  });

  it('moves a card only to a column of a board it is on, never one another board names', async () => {
    // A second tab whose board (first in the plan) has a column the drawn board lacks, and an All Cards board.
    const other = {
      id: 't0',
      name: 'Releases',
      kind: 'board',
      elements: [
        {
          id: 'b0',
          type: 'shape',
          shape: 'plan-board',
          x: 0,
          y: 0,
          width: 800,
          height: 500,
          planBoard: {
            ...presetSetup('kanban'),
            title: 'Releases',
            columns: [{ status: 'shipped', name: 'Shipped' }],
          },
        },
        {
          id: 'b9',
          type: 'shape',
          shape: 'plan-board',
          x: 0,
          y: 600,
          width: 800,
          height: 500,
          planBoard: presetSetup('all-cards'),
        },
      ],
    };
    expect((await w.send('PUT', '/api/projects/A/tabs/t0', other)).status).toBeLessThan(300);
    const made = (await run(make())) as MakeAnswer;
    const e1 = made.cards[0]!.id;
    const out = await run({
      op: 'edit',
      person: USER,
      edits: [
        { kind: 'move', card: e1, column: 'Shipped' },
        { kind: 'move', card: e1, column: 'All Cards' },
      ],
    });
    expect(out['results']).toEqual([
      { status: 'refused', reason: 'The board has no column called Shipped' },
      { status: 'refused', reason: 'The board has no column called All Cards' },
    ]);
    expect((await w.items('A')).find((i) => i.id === e1)!.fields['status']).not.toBe('shipped');
  });

  it('adds no second blocker to a Blocked By field stored holding one', async () => {
    // The Task's Blocked By as a field saved before Holds Several holds it: one card.
    const catalogue = defaultCatalogue();
    const single = {
      ...catalogue,
      types: catalogue.types.map((t) =>
        t.id === 'task'
          ? {
              ...t,
              fields: [...t.fields, 'f-old-blocked'],
              custom: [
                ...(t.custom ?? []),
                {
                  id: 'f-old-blocked',
                  label: 'Blocked By',
                  kind: 'card' as const,
                  linkType: 'task',
                  blocks: true,
                },
              ],
            }
          : t,
      ),
    };
    const put = await w.send('PUT', '/api/projects/A/item-types', { itemTypes: single });
    expect(put.status).toBeLessThan(300);
    const made = (await run(
      make({ cards: [shape('e1'), shape('e2', { blockedBy: ['e1'] }), shape('e3')] }),
    )) as MakeAnswer;
    const [e1, e2, e3] = made.cards.map((c) => c.id);
    const out = await run({
      op: 'edit',
      person: USER,
      edits: [{ kind: 'block', card: e2!, blocker: e3! }],
    });
    expect(out['results']).toEqual([
      { status: 'refused', reason: 'That card waits on as many cards as it may' },
    ]);
    expect(byTitle(await w.items('A'), 'Shape e2').fields['f-old-blocked']).toEqual([e1]);
  });
});
