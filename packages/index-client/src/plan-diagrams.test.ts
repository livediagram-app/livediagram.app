// The Diagrams and Plans contract (liveworkspace/docs/specs/004-index/diagrams-and-plans.md "The contract"): every body
// read at the edge, refused whole when anything is over a cap, of the wrong type, or names what is not in it.
import { describe, expect, it } from 'vitest';
import { createIndexAppClient, createIndexClient } from './client';
import {
  PLAN_EDITS_MAX,
  PLAN_MAKE_CARDS_MAX,
  PLAN_VIEW_CARDS_MAX,
  PLAN_VIEWS_PER_PLAN_MAX,
  planCardElementId,
  planDepElementId,
  planDiagramDoorPath,
  planLaneElementId,
  readPlanDiagramDoorCall,
  readPlanDiagramDraw,
  readPlanDiagramGraph,
  readPlanEdits,
  readPlanElementId,
  readPlanMakeAsk,
  readPlanViewAsk,
  readPlanViewRedraws,
} from './plan-diagrams';
import type { SentFrom } from './plan-sends';

const source = { itemId: 'd1', tabId: 't1', label: 'Q1' };
const card = (element: string, over: Record<string, unknown> = {}) => ({
  element,
  title: `Card ${element}`,
  text: 'words',
  ...over,
});
const ask = (over: Record<string, unknown> = {}) => ({
  board: 'b1',
  column: 'To Do',
  source,
  cards: [card('e1'), card('e2', { blockedBy: ['e1'] })],
  ...over,
});

describe('a make', () => {
  it('reads the cards with their columns, labels, dates and links', () => {
    const read = readPlanMakeAsk(
      ask({
        cards: [
          card('e1', {
            column: 'Doing',
            labels: ['Design'],
            start: '2026-12-01',
            due: '2026-12-05',
          }),
          card('e2', { blockedBy: ['e1'] }),
        ],
        trash: ['k1', 'k1'],
      }),
    );
    expect(read).toEqual({
      board: 'b1',
      column: 'To Do',
      source,
      cards: [
        {
          element: 'e1',
          title: 'Card e1',
          text: 'words',
          column: 'Doing',
          labels: ['Design'],
          start: '2026-12-01',
          due: '2026-12-05',
        },
        { element: 'e2', title: 'Card e2', text: 'words', blockedBy: ['e1'] },
      ],
      trash: ['k1'],
    });
  });

  it('takes a make that only trashes, never one that does nothing', () => {
    expect(readPlanMakeAsk(ask({ cards: [], trash: ['k1'] }))).toMatchObject({
      cards: [],
      trash: ['k1'],
    });
    expect(readPlanMakeAsk(ask({ cards: [] }))).toBeNull();
  });

  it.each([
    ['a shape named twice', ask({ cards: [card('e1'), card('e1')] })],
    ['a link to a shape not in it', ask({ cards: [card('e1', { blockedBy: ['e9'] })] })],
    ['a link to itself', ask({ cards: [card('e1', { blockedBy: ['e1'] })] })],
    ['an id with a colon', ask({ cards: [card('e:1')] })],
    ['an empty title', ask({ cards: [card('e1', { title: '  ' })] })],
    ['a bad date', ask({ cards: [card('e1', { due: '1 Dec' })] })],
    ['a blank column', ask({ cards: [card('e1', { column: ' ' })] })],
    ['a long label', ask({ cards: [card('e1', { labels: ['x'.repeat(40)] })] })],
    [
      'too many cards',
      ask({ cards: Array.from({ length: PLAN_MAKE_CARDS_MAX + 1 }, (_, i) => card(`e${i}`)) }),
    ],
    ['no source', ask({ source: null })],
    ['no board', ask({ board: '' })],
    ['a bad trash', ask({ trash: 'k1' })],
    ['not an object', 'make'],
  ])('refuses %s', (_why, raw) => {
    expect(readPlanMakeAsk(raw)).toBeNull();
  });

  it('refuses more links than a make may hold', () => {
    const many = Array.from({ length: 30 }, (_, i) => `e${i}`);
    const cards = Array.from({ length: 60 }, (_, i) =>
      card(`x${i}`, i < 30 ? {} : { blockedBy: [] }),
    );
    // 40 cards each waiting on 26 others: 1,040 links.
    const linked = Array.from({ length: 40 }, (_, i) =>
      card(`y${i}`, { blockedBy: many.slice(0, 26) }),
    );
    expect(readPlanMakeAsk(ask({ cards: [...many.map((m) => card(m)), ...linked] }))).toBeNull();
    expect(readPlanMakeAsk(ask({ cards }))).not.toBeNull();
  });
});

describe('a view and its edits', () => {
  it('reads a view', () => {
    expect(readPlanViewAsk({ board: 'b1', name: ' Launch ', filtered: true })).toEqual({
      board: 'b1',
      name: 'Launch',
      filtered: true,
    });
    expect(readPlanViewAsk({ board: 'b1', name: 'x' })).toEqual({ board: 'b1', name: 'x' });
    for (const bad of [{ board: 'b1', name: '' }, { board: 'b:1', name: 'x' }, { name: 'x' }, null])
      expect(readPlanViewAsk(bad)).toBeNull();
  });

  it('reads edits, at most PLAN_EDITS_MAX, each a block or a move', () => {
    const block = { kind: 'block', card: 'k2', blocker: 'k1' };
    const move = { kind: 'move', card: 'k2', column: 'Done' };
    expect(readPlanEdits({ edits: [block, move] })).toEqual([block, move]);
    for (const bad of [
      { edits: [] },
      { edits: Array.from({ length: PLAN_EDITS_MAX + 1 }, () => block) },
      { edits: [{ ...block, blocker: 'k2' }] },
      { edits: [{ kind: 'move', card: 'k2', column: '' }] },
      { edits: [{ kind: 'rename', card: 'k2' }] },
      { edits: 'x' },
    ])
      expect(readPlanEdits(bad)).toBeNull();
  });
});

const node = (cardId: string, over: Record<string, unknown> = {}) => ({
  card: cardId,
  label: `#1 ${cardId}`,
  lane: 'c0',
  done: false,
  critical: false,
  link: `https://liveplanner.test/project/p#item=${cardId}`,
  ...over,
});
const graph = (over: Record<string, unknown> = {}) => ({
  title: 'Board',
  lanes: [{ id: 'c0', label: 'To Do' }],
  nodes: [node('k1'), node('k2')],
  edges: [{ from: 'k1', to: 'k2', critical: false }],
  total: 1,
  ...over,
});

describe('a graph', () => {
  it('reads one, its total never under what it draws', () => {
    expect(readPlanDiagramGraph(graph())).toMatchObject({
      total: 2,
      nodes: [{ card: 'k1' }, { card: 'k2' }],
    });
  });

  it.each([
    ['a node in no lane', graph({ nodes: [node('k1', { lane: 'c9' })], edges: [] })],
    ['a card twice', graph({ nodes: [node('k1'), node('k1')], edges: [] })],
    [
      'a lane twice',
      graph({
        lanes: [
          { id: 'c0', label: 'a' },
          { id: 'c0', label: 'b' },
        ],
      }),
    ],
    ['an edge to nothing', graph({ edges: [{ from: 'k1', to: 'k9', critical: false }] })],
    ['an edge to itself', graph({ edges: [{ from: 'k1', to: 'k1', critical: false }] })],
    [
      'a link that is not the web',
      graph({ nodes: [node('k1', { link: 'javascript:x' })], edges: [] }),
    ],
    ['a bad total', graph({ total: -1 })],
    [
      'too many nodes',
      graph({
        nodes: Array.from({ length: PLAN_VIEW_CARDS_MAX + 1 }, (_, i) => node(`k${i}`)),
        edges: [],
      }),
    ],
    ['no title', graph({ title: 3 })],
  ])('refuses %s', (_why, raw) => {
    expect(readPlanDiagramGraph(raw)).toBeNull();
  });

  it("reads livediagram's draw, new or a redraw of one tab", () => {
    const draw = {
      owner: 'u1',
      name: ' Plan ',
      graph: graph(),
      caption: 'Drawn',
      link: 'https://p.test/x',
    };
    expect(readPlanDiagramDraw(draw)).toMatchObject({ name: 'Plan' });
    expect(readPlanDiagramDraw({ ...draw, itemId: 'd1', tabId: 't1' })).toMatchObject({
      itemId: 'd1',
      tabId: 't1',
    });
    expect(readPlanDiagramDraw({ ...draw, itemId: 'd1' })).toBeNull();
    expect(readPlanDiagramDraw({ ...draw, link: 'ftp://x' })).toBeNull();
    expect(readPlanDiagramDraw({ ...draw, graph: {} })).toBeNull();
    expect(readPlanDiagramDraw({ ...draw, itemId: 'd:1', tabId: 't1' })).toBeNull();
  });

  it("reads liveplanner's redraws, at most a plan's views", () => {
    const v = { diagramId: 'd1', tabId: 't1', person: 'u1', graph: graph() };
    expect(readPlanViewRedraws({ views: [v] })).toHaveLength(1);
    expect(readPlanViewRedraws({ views: [] })).toBeNull();
    expect(
      readPlanViewRedraws({ views: Array.from({ length: PLAN_VIEWS_PER_PLAN_MAX + 1 }, () => v) }),
    ).toBeNull();
    expect(readPlanViewRedraws({ views: [{ ...v, graph: null }] })).toBeNull();
    expect(readPlanViewRedraws({ views: [{ ...v, person: '' }] })).toBeNull();
  });
});

describe("liveplanner's door call", () => {
  const sentFrom: SentFrom = {
    app: 'livediagram',
    itemId: 'd1',
    title: 'Roadmap',
    kind: 'element',
    label: 'Q1',
    text: 'words',
    link: 'https://ld.test/document/d1',
  };
  const readSent = (v: unknown) => (v ? sentFrom : null);

  it('reads each op', () => {
    expect(
      readPlanDiagramDoorCall(
        { op: 'graph', person: 'u1', board: 'b1', filtered: false },
        readSent,
      ),
    ).toEqual({
      op: 'graph',
      person: 'u1',
      board: 'b1',
      filtered: false,
    });
    expect(
      readPlanDiagramDoorCall(
        { op: 'watch', person: 'u1', board: 'b1', filtered: true, diagramId: 'd1', tabId: 't1' },
        readSent,
      ),
    ).toMatchObject({ op: 'watch', diagramId: 'd1' });
    expect(
      readPlanDiagramDoorCall(
        { op: 'edit', person: 'u1', edits: [{ kind: 'move', card: 'k', column: 'Done' }] },
        readSent,
      ),
    ).toMatchObject({ op: 'edit' });
    const make = {
      op: 'make',
      person: 'u1',
      board: 'b1',
      column: 'To Do',
      trash: [],
      cards: [
        { element: 'e1', title: 'A', description: 'd', sentFrom: true, cardId: 'k1' },
        { element: 'e2', title: 'B', description: 'd', sentFrom: true, blockedBy: ['e1'] },
      ],
    };
    expect(readPlanDiagramDoorCall(make, readSent)).toMatchObject({
      op: 'make',
      cards: [
        { element: 'e1', cardId: 'k1', sentFrom },
        { element: 'e2', blockedBy: ['e1'] },
      ],
    });
  });

  it.each([
    ['no person', { op: 'graph', board: 'b1', filtered: false }],
    ['a watch with no diagram', { op: 'watch', person: 'u1', board: 'b1', filtered: false }],
    ['an unknown op', { op: 'drop', person: 'u1' }],
    ['a graph with no filter word', { op: 'graph', person: 'u1', board: 'b1' }],
    ['a bad edit', { op: 'edit', person: 'u1', edits: [] }],
    [
      'a make with no trash list',
      { op: 'make', person: 'u1', board: 'b1', column: 'c', cards: [] },
    ],
    [
      'a make card with no line back',
      {
        op: 'make',
        person: 'u1',
        board: 'b1',
        column: 'c',
        trash: [],
        cards: [{ element: 'e1', title: 'A', description: 'd' }],
      },
    ],
    [
      'a make card with a bad card id',
      {
        op: 'make',
        person: 'u1',
        board: 'b1',
        column: 'c',
        trash: [],
        cards: [{ element: 'e1', title: 'A', description: 'd', sentFrom: true, cardId: 'k:1' }],
      },
    ],
  ])('refuses %s', (_why, raw) => {
    expect(readPlanDiagramDoorCall(raw, readSent)).toBeNull();
  });
});

describe('element ids', () => {
  it('round-trip a card, a lane and a link, and read nothing a person drew', () => {
    expect(readPlanElementId(planCardElementId('c0', 'k1'))).toEqual({
      kind: 'card',
      lane: 'c0',
      card: 'k1',
    });
    expect(readPlanElementId(planLaneElementId('c2'))).toEqual({ kind: 'lane', lane: 'c2' });
    expect(readPlanElementId(planDepElementId('k1', 'k2'))).toEqual({
      kind: 'dep',
      blocker: 'k1',
      card: 'k2',
    });
    for (const id of [
      'abc',
      'card:c0',
      'card::k1',
      'lane:',
      'dep:k1',
      'plan:caption',
      'card:a:b:c',
    ])
      expect(readPlanElementId(id)).toBeNull();
    expect(planDiagramDoorPath('p 1')).toBe('/api/internal/items/p%201/plan-diagram');
  });
});

describe('the clients', () => {
  function fakeFetch() {
    const seen: { url: string; method: string; body: unknown }[] = [];
    const doFetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
      seen.push({
        url: String(input),
        method: init.method ?? 'GET',
        body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      });
      return Response.json({});
    }) as typeof fetch;
    return { seen, doFetch };
  }

  it('makes cards, draws a view and applies edits as the person; liveplanner tells of changed views', async () => {
    const { seen, doFetch } = fakeFetch();
    const client = createIndexClient({ getToken: () => 'tok', fetch: doFetch });
    await client.makePlanCards('p1', { board: 'b1', column: 'c', source, cards: [] });
    await client.viewPlanAsDiagram('p1', { board: 'b1', name: 'x' });
    await client.applyPlanEdits('p1', [{ kind: 'move', card: 'k', column: 'Done' }]);
    const app = createIndexAppClient({
      app: 'liveplanner',
      key: 'k',
      baseUrl: 'https://x/api/index',
      fetch: doFetch,
    });
    await app.planDiagramsChanged('p1', []);
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'POST /api/index/items/p1/plan-makes',
      'POST /api/index/items/p1/plan-views',
      'POST /api/index/items/p1/plan-edits',
      'POST https://x/api/index/app/items/p1/plan-diagrams',
    ]);
    expect(seen[2]!.body).toEqual({ edits: [{ kind: 'move', card: 'k', column: 'Done' }] });
  });
});
