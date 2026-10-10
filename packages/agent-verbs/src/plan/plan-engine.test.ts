import { describe, expect, it } from 'vitest';
import { ApiError } from '@livediagram/api-client';
import { ITEM_TYPES, TRASH_STATUS, type Item } from '@livediagram/items';
import { fakeApi } from '../testing/fake-api';
import { addBoard } from './add-board';
import { apiRefusalOf } from './api-refusal';
import { changeCardTypes } from './card-types';
import { changeBoard, resolveBoard } from './change-board';
import { applyItemChanges } from './item-changes';
import { NO_BOARD_HINT, planListing } from './plan-listing';
import { readPlanState } from './plan-state';

// The Plan engine (docs/specs/026-plan/plan-agents.md): names in, ids out, refusals that say what is there.
const D = 'doc1';
const by = { id: 'p', name: 'Priya', color: '#7c3aed' };
const item = (
  key: number,
  id: string,
  fields: Item['fields'],
  type = 'task',
  rank = 'i',
): Item => ({
  id,
  type,
  key,
  rank,
  fields,
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
});
const BUG = {
  ...ITEM_TYPES[1],
  id: 'bug',
  label: 'Bug',
  fields: ['title', 'status', 'f-sev'],
  custom: [{ id: 'f-sev', label: 'Severity', kind: 'choice' as const, options: ['S1', 'S2'] }],
};
const BOARD = (types: string[] | null = null) => ({
  tabId: 't1',
  tabName: 'Board',
  elementId: 'b1',
  title: 'Sprint',
  kind: 'board' as const,
  types,
  columns: [
    { status: 'todo~x', name: 'To Do', wipLimit: 2 },
    { status: 'done~x', name: 'Done' },
  ],
});
const STATUSES = [
  { status: 'todo~x', name: 'To Do' },
  { status: 'done~x', name: 'Done' },
];
const ITEMS = [
  item(1, 'aaa111', { title: 'B', status: 'todo~x' }, 'task', 'k'),
  item(2, 'bbb222', { title: 'A', status: 'todo~x' }, 'task', 'j'),
  item(
    3,
    'ccc333',
    { title: 'Crash', status: 'done~x', assignee: { id: 'u1', name: 'Sam', color: '#2563eb' } },
    'bug',
  ),
  item(4, 'ddd444', { title: 'Loose', status: 'elsewhere' }),
  item(5, 'eee555', { title: 'Gone', status: TRASH_STATUS }),
];

function api(
  over: Record<string, unknown> = {},
  plan: unknown = { boards: [BOARD()], statuses: STATUSES, types: [...ITEM_TYPES, BUG] },
) {
  const seen: { method: string; path: string; body: unknown }[] = [];
  const record = async (r: Request, answer: unknown) => {
    const text = await r.text();
    seen.push({
      method: r.method,
      path: new URL(r.url).pathname.replace(/^\/api/, ''),
      body: text ? JSON.parse(text) : undefined,
    });
    return Response.json(answer);
  };
  const made = (r: Request) =>
    record(r, { item: item(9, 'new999', { title: 'New', status: 'todo~x' }), rev: 2 });
  const fake = fakeApi({
    [`/documents/${D}/items`]: (r: Request) =>
      r.method === 'GET' ? Response.json({ items: ITEMS, rev: 1 }) : made(r),
    [`/documents/${D}/plan`]: plan,
    [`/documents/${D}/items/aaa111`]: made,
    [`/documents/${D}/items/aaa111/move`]: made,
    [`/documents/${D}/items/ccc333`]: made,
    [`/documents/${D}/item-types`]: (r: Request) => record(r, { itemTypes: null }),
    [`/documents/${D}`]: {
      document: {
        id: D,
        // The catalogue the plan above reads (chosen: it has Bug).
        itemTypes: { version: 1, types: (plan as { types?: unknown }).types },
        tabs: [
          { id: 't1', name: 'Board', orderIndex: 0 },
          { id: 't2', name: 'Other', orderIndex: 1 },
        ],
      },
    },
    [`/documents/${D}/tabs/t1`]: {
      tab: {
        id: 't1',
        name: 'Board',
        elements: [
          { id: 'e', x: 0, y: 0, width: 100, height: 50 },
          {
            id: 'b1',
            type: 'shape',
            shape: 'plan-board',
            x: 200,
            y: 0,
            width: 800,
            height: 500,
            planBoard: {
              title: 'Sprint',
              columns: [
                { id: 'todo', status: 'todo~x', name: 'To Do', wipLimit: 2 },
                { id: 'done', status: 'done~x', name: 'Done' },
              ],
              swimlaneBy: 'none',
              cardFields: ['key'],
              voting: { on: false },
              hideWriting: false,
            },
          },
        ],
        rev: 7,
      },
    },
    [`/documents/${D}/tabs/t2`]: { tab: { id: 't2', name: 'Other', elements: [], rev: 1 } },
    [`/documents/${D}/tabs/t1/changesets`]: (r: Request) =>
      record(r, { changeset: { id: 'cs1', rev: 8 } }),
    [`/documents/${D}/tabs/t2/changesets`]: (r: Request) =>
      record(r, { changeset: { id: 'cs2', rev: 2 } }),
    ...over,
  });
  return { api: fake, seen };
}

describe('planListing', () => {
  it('files live cards under each column in rank order, and lists the rest', async () => {
    const { api: a } = api();
    const listing = planListing(await readPlanState(a, D));
    expect(listing.boards[0]).toMatchObject({
      title: 'Sprint',
      takes: 'every type',
      columns: [
        { name: 'To Do', wipLimit: 2, cards: ['#2', '#1'] },
        { name: 'Done', cards: ['#3'] },
      ],
    });
    expect(listing.notOnBoard).toEqual(['#4']);
    expect(listing.items.find((i) => i.ref === '#5')!.column).toBe('Trash');
    expect(listing.items.find((i) => i.ref === '#4')!.column).toBeNull();
    expect(listing.types.find((t) => t.id === 'bug')!.custom).toEqual([
      { id: 'f-sev', name: 'Severity', kind: 'choice', options: ['S1', 'S2'] },
    ]);
    expect(listing.hint).toBeUndefined();
  });

  it('names custom fields as writes do', async () => {
    const withSev = [
      item(7, 'fff777', { title: 'Sev', status: 'done~x', 'f-sev': 'S2', 'f-gone': 1 }, 'bug'),
    ];
    const { api: a } = api({ [`/documents/${D}/items`]: { items: withSev, rev: 1 } });
    const listing = planListing(await readPlanState(a, D));
    expect(listing.items[0]!.fields).toEqual({
      title: 'Sev',
      status: 'done~x',
      Severity: 'S2',
      'f-gone': 1,
    });
  });

  it('hides cards of types a board does not take, filters by names, and hints with no board', async () => {
    const { api: a } = api(
      {},
      { boards: [BOARD(['bug'])], statuses: STATUSES, types: [...ITEM_TYPES, BUG] },
    );
    const state = await readPlanState(a, D);
    const listing = planListing(state, { type: 'Bug', status: 'done' });
    expect(listing.boards[0]!.takes).toEqual(['Bug']);
    expect(listing.boards[0]!.columns[0]!.cards).toEqual([]);
    expect(listing.items.map((i) => i.ref)).toEqual(['#3']);
    const { api: none } = api({}, { boards: [], statuses: [], types: ITEM_TYPES });
    expect(planListing(await readPlanState(none, D)).hint).toBe(NO_BOARD_HINT);
  });
});

describe('applyItemChanges', () => {
  it('says what landed when the api fails part way, so a retry does not make it twice', async () => {
    const { api: a } = api({
      [`/documents/${D}/items/aaa111`]: () => Response.json({ error: 'boom' }, { status: 503 }),
    });
    const state = await readPlanState(a, D);
    const result = await applyItemChanges(
      a,
      D,
      [
        { op: 'add', title: 'New', type: 'Bug', status: 'to do' },
        { op: 'set', item: '#1', fields: { Priority: 'High' } },
      ],
      state,
    );
    expect(result.applied).toHaveLength(1);
    expect(result.refusal?.code).toBe('api_error');
    // Before anything landed, the failure is thrown as ever.
    await expect(
      applyItemChanges(a, D, [{ op: 'set', item: '#1', fields: { Priority: 'High' } }], state),
    ).rejects.toThrow();
  });

  it('writes ids for the names it is given', async () => {
    const { api: a, seen } = api();
    const result = await applyItemChanges(
      a,
      D,
      [
        {
          op: 'add',
          title: 'New',
          type: 'Bug',
          status: 'to do',
          fields: { severity: 's2', assignee: 'sam' },
        },
        { op: 'set', item: '#1', fields: { Priority: 'High' }, clear: ['Due Date'] },
        { op: 'move', item: '#1', status: 'DONE', before: '#3' },
      ],
      await readPlanState(a, D),
    );
    expect(result.refusal).toBeUndefined();
    expect(seen.map((s) => s.body)).toEqual([
      {
        type: 'bug',
        fields: {
          'f-sev': 'S2',
          assignee: { id: 'u1', name: 'Sam', color: '#2563eb' },
          title: 'New',
        },
        place: { status: 'todo~x' },
      },
      { set: { priority: 'high' }, clear: ['due'] },
      { status: 'done~x', before: 'ccc333' },
    ]);
    expect(result.applied[0]).toBe('+ #9 [task] New in To Do');
  });

  it('stops at an unknown name, saying what applied before it', async () => {
    const { api: a, seen } = api();
    const result = await applyItemChanges(
      a,
      D,
      [
        { op: 'add', title: 'New' },
        { op: 'move', item: '#1', status: 'Review' },
        { op: 'delete', item: '#2' },
      ],
      await readPlanState(a, D),
    );
    expect(result.refusal).toMatchObject({ code: 'status_unknown' });
    expect(result.refusal!.message).toContain('Columns: To Do, Done');
    expect(result.applied).toHaveLength(1);
    expect(seen).toHaveLength(1);
  });

  it("turns the api's refusal into words and lets a 5xx throw", async () => {
    const { api: refusing } = api({
      [`/documents/${D}/items/aaa111/move`]: () =>
        Response.json({ error: 'status_excluded' }, { status: 400 }),
    });
    const r = await applyItemChanges(
      refusing,
      D,
      [{ op: 'move', item: '#1', status: 'Done' }],
      await readPlanState(refusing, D),
    );
    expect(r.refusal!.message).toContain('card type does not use that column');
    const { api: down } = api({
      [`/documents/${D}/items/aaa111`]: () => new Response('x', { status: 503 }),
    });
    await expect(
      applyItemChanges(
        down,
        D,
        [{ op: 'set', item: '#1', fields: { priority: 'low' } }],
        await readPlanState(down, D),
      ),
    ).rejects.toBeInstanceOf(ApiError);
    const { api: gone } = api({
      [`/documents/${D}/items/aaa111`]: () => new Response('nope', { status: 404 }),
    });
    const del = await applyItemChanges(
      gone,
      D,
      [{ op: 'delete', item: '#1' }],
      await readPlanState(gone, D),
    );
    expect(del.refusal).toMatchObject({ code: 'http_404' });
  });
});

describe('changeCardTypes', () => {
  it('saves the catalogue once and trashes the cards of a deleted type', async () => {
    const { api: a, seen } = api();
    const r = await changeCardTypes(a, D, [
      { op: 'add', name: 'Risk', custom: [{ name: 'Impact', kind: 'number' }] },
      { op: 'delete', type: 'Bug' },
    ]);
    expect(r.refusal).toBeUndefined();
    expect(r.applied).toEqual(['+ Risk (risk): Impact (f-impact)', '- Bug (bug)']);
    const put = seen.find((s) => s.method === 'PUT')!;
    const ids = (put.body as { itemTypes: { types: { id: string }[] } }).itemTypes.types.map(
      (t) => t.id,
    );
    expect(ids).toContain('risk');
    expect(ids).not.toContain('bug');
    expect(seen.find((s) => s.path.endsWith('/ccc333'))!.body).toEqual({
      set: { status: TRASH_STATUS, trashedFrom: 'done~x' },
    });
    expect(r.trashed).toEqual(['#3']);
    expect(r.types.some((t) => t.id === 'risk')).toBe(true);
  });

  it('saves nothing when a change is refused', async () => {
    const { api: a, seen } = api();
    const r = await changeCardTypes(a, D, [
      { op: 'add', name: 'Risk' },
      { op: 'set', type: 'Epic', name: 'X' },
    ]);
    expect(r.refusal).toMatchObject({ code: 'type_unknown' });
    expect(r.refusal!.message).toContain('Nothing was saved');
    expect(seen).toEqual([]);
  });

  it("reports the api's refusal of the save", async () => {
    const { api: a } = api({
      [`/documents/${D}/item-types`]: () => new Response('{"error":"forbidden"}', { status: 403 }),
    });
    const r = await changeCardTypes(a, D, [{ op: 'add', name: 'Risk' }]);
    expect(r.refusal!.message).toContain('view this document but not change it');
  });

  // docs/specs/026-plan/item-types.md "Storage and sync": a save names the revision it read; when an editor's change
  // landed first, the plan is read again and the change applied to it, keeping the editor's.
  it('applies its changes again to card types someone else changed meanwhile', async () => {
    let rev = 4;
    let types: unknown[] = [...ITEM_TYPES, BUG];
    const puts: { itemTypes: { types: { id: string }[] }; expectedRev: number }[] = [];
    const { api: a } = api({
      [`/documents/${D}/plan`]: () =>
        Response.json({ boards: [BOARD()], statuses: STATUSES, types, itemTypesRev: rev }),
      [`/documents/${D}/item-types`]: async (r: Request) => {
        const body = (await r.json()) as (typeof puts)[number];
        puts.push(body);
        if (puts.length === 1) {
          // An editor added a type between the read and the save.
          rev = 5;
          types = [...types, { ...BUG, id: 'spike', label: 'Spike' }];
          return Response.json(
            { error: 'item_types_stale', itemTypes: null, itemTypesRev: 5 },
            { status: 409 },
          );
        }
        return Response.json({ itemTypes: body.itemTypes, itemTypesRev: 6 });
      },
    });
    const r = await changeCardTypes(a, D, [{ op: 'add', name: 'Risk' }]);
    expect(r.refusal).toBeUndefined();
    expect(puts.map((p) => p.expectedRev)).toEqual([4, 5]);
    const ids = puts[1]!.itemTypes.types.map((t) => t.id);
    expect(ids).toContain('spike');
    expect(ids).toContain('risk');
  });

  it('gives up with a refusal when the card types keep changing', async () => {
    const { api: a } = api({
      [`/documents/${D}/item-types`]: () =>
        Response.json(
          { error: 'item_types_stale', itemTypes: null, itemTypesRev: 9 },
          { status: 409 },
        ),
    });
    const r = await changeCardTypes(a, D, [{ op: 'add', name: 'Risk' }]);
    expect(r.refusal).toMatchObject({ code: 'item_types_stale' });
  });
});

describe('addBoard', () => {
  it('adds a board as one changeset on the first tab holding a board', async () => {
    const { api: a, seen } = api();
    const r = await addBoard(a, D, { columns: ['Ideas', 'Done'], types: ['Bug'] }, 'mcp');
    if (!r.ok) throw new Error(r.message);
    expect(r).toMatchObject({ tabId: 't1', changesetId: 'cs1', rev: 8, takes: ['Bug'] });
    expect(r.columns).toEqual([
      { name: 'Ideas', status: expect.stringMatching(/^ideas~/) },
      { name: 'Done', status: 'done~x' },
    ]);
    const body = seen[0]!.body as {
      operations: { element: { x: number; planBoard: { addTypes: string[] } } }[];
      base: { rev: number };
    };
    expect(body.base.rev).toBe(7);
    expect(body.operations[0]!.element.x).toBeGreaterThan(100);
    expect(body.operations[0]!.element.planBoard.addTypes).toEqual(['bug']);
    // The document has Bug already: nothing is brought, nothing more is written.
    expect(r.brought).toEqual([]);
    expect(seen).toHaveLength(1);
  });

  // docs/specs/026-plan/plan-agents.md "Adding a board": a preset brings the types the document lacks.
  it('brings the preset’s card types the document lacks, saved once after the board', async () => {
    const { api: a, seen } = api();
    const r = await addBoard(a, D, { preset: 'sprint' }, 'mcp');
    if (!r.ok) throw new Error(r.message);
    expect(r.takes).toEqual(['Story', 'Task', 'Bug']);
    expect(r.brought).toEqual(['Story']);
    expect(seen.map((s) => `${s.method} ${s.path}`)).toEqual([
      `POST /documents/${D}/tabs/t1/changesets`,
      `PUT /documents/${D}/item-types`,
    ]);
    const saved = (seen[1]!.body as { itemTypes: { types: { id: string }[] } }).itemTypes;
    expect(saved.types.map((t) => t.id)).toEqual([...ITEM_TYPES.map((t) => t.id), 'bug', 'story']);
  });

  // docs/specs/026-plan/item-types.md "Storage and sync": the types a board brings are saved against the revision read.
  it('saves the brought card types against the revision the document was read at', async () => {
    const { api: a, seen } = api({
      [`/documents/${D}`]: {
        document: {
          id: D,
          itemTypes: { version: 1, types: [...ITEM_TYPES, BUG] },
          itemTypesRev: 3,
          tabs: [{ id: 't1', name: 'Board', orderIndex: 0 }],
        },
      },
    });
    const r = await addBoard(a, D, { preset: 'sprint' }, 'mcp');
    if (!r.ok) throw new Error(r.message);
    const put = seen.find((s) => s.method === 'PUT')!;
    expect((put.body as { expectedRev: number }).expectedRev).toBe(3);
  });

  it('takes a tab, and refuses an unknown tab, type or preset', async () => {
    const { api: a } = api();
    expect(await addBoard(a, D, { tabId: 't2', preset: 'todo' }, 'cli')).toMatchObject({
      ok: true,
      tabId: 't2',
    });
    expect(await addBoard(a, D, { tabId: 'nope' }, 'mcp')).toMatchObject({
      ok: false,
      code: 'tab_unknown',
    });
    expect(await addBoard(a, D, { types: ['Epic'] }, 'mcp')).toMatchObject({
      ok: false,
      code: 'type_unknown',
    });
    expect(await addBoard(a, D, { preset: 'scrum' }, 'mcp')).toMatchObject({
      ok: false,
      code: 'board_invalid',
    });
    const { api: empty } = api(
      { [`/documents/${D}`]: { document: { id: D, tabs: [] } } },
      { boards: [], statuses: [], types: ITEM_TYPES },
    );
    expect(await addBoard(empty, D, {}, 'mcp')).toMatchObject({ ok: false, code: 'tab_unknown' });
  });
});

describe('apiRefusalOf', () => {
  it('names codes and statuses, and leaves a 5xx or another error alone', () => {
    expect(apiRefusalOf(new ApiError(410, '{"error":"gone"}'))!.message).toContain('in the Trash');
    expect(apiRefusalOf(new ApiError(400, '{"error":"field_value_invalid"}'))!.message).toContain(
      'Fields:',
    );
    expect(apiRefusalOf(new ApiError(400, '{"error":"weird"}'))).toEqual({
      code: 'weird',
      message: 'The api refused it (weird).',
    });
    expect(apiRefusalOf(new ApiError(503, ''))).toBeNull();
    expect(apiRefusalOf(new Error('x'))).toBeNull();
  });
});

describe('change lines', () => {
  it('names the fields a set changed and says when an assignee is a new name', async () => {
    const { api: a } = api();
    const r = await applyItemChanges(
      a,
      D,
      [{ op: 'set', item: '#1', fields: { priority: 'high', assignee: 'Robin' }, clear: ['due'] }],
      await readPlanState(a, D),
    );
    expect(r.applied[0]).toContain('; set priority, assignee; cleared due');
    expect(r.applied[0]).toContain('Robin is a new name on this document');
  });

  it('warns when no board with the column takes the card type', async () => {
    const { api: a } = api(
      {
        [`/documents/${D}/items`]: (r: Request) =>
          r.method === 'GET'
            ? Response.json({ items: ITEMS, rev: 1 })
            : Response.json({
                item: item(9, 'new999', { title: 'Crash', status: 'todo~x' }, 'bug'),
                rev: 2,
              }),
      },
      { boards: [BOARD(['task'])], statuses: STATUSES, types: [...ITEM_TYPES, BUG] },
    );
    const r = await applyItemChanges(
      a,
      D,
      [{ op: 'add', title: 'Crash', type: 'Bug', status: 'To Do' }],
      await readPlanState(a, D),
    );
    expect(r.applied[0]).toContain('no board with that column takes Bug cards');
    expect(r.applied[0]).toContain('"Sprint" with change_board');
  });
});

describe('changeBoard', () => {
  it('reshapes the board as one changeset, by title', async () => {
    const { api: a, seen } = api();
    const r = await changeBoard(
      a,
      D,
      {
        board: 'sprint',
        columns: ['To Do', 'Review', 'Done'],
        types: ['Task', 'Bug'],
        title: 'Sprint 2',
      },
      'mcp',
    );
    if (!r.ok) throw new Error(r.message);
    expect(r).toMatchObject({ title: 'Sprint 2', takes: ['Task', 'Bug'], changesetId: 'cs1' });
    const op = seen[0]!.body as {
      operations: {
        target: string;
        fields: {
          planBoard: { columns: { name: string; wipLimit?: number }[]; addTypes: string[] };
        };
      }[];
      base: { elements: Record<string, string> };
    };
    expect(op.operations[0]!.target).toBe('id:"b1"');
    expect(op.operations[0]!.fields.planBoard.columns.map((c) => c.name)).toEqual([
      'To Do',
      'Review',
      'Done',
    ]);
    expect(op.operations[0]!.fields.planBoard.columns[0]!.wipLimit).toBe(2);
    expect(op.operations[0]!.fields.planBoard.addTypes).toEqual(['task', 'bug']);
    expect(Object.keys(op.base.elements)).toEqual(['b1']);
    const every = await changeBoard(a, D, { board: 'b1', types: [] }, 'cli');
    expect(every).toMatchObject({ ok: true, takes: 'every type' });
  });

  it('refuses an unknown or ambiguous board, type or column list', async () => {
    const { api: a } = api();
    expect(await changeBoard(a, D, { board: 'Roadmap' }, 'mcp')).toMatchObject({
      ok: false,
      code: 'board_unknown',
    });
    expect(await changeBoard(a, D, { board: 'Sprint', types: ['Epic'] }, 'mcp')).toMatchObject({
      code: 'type_unknown',
    });
    expect(await changeBoard(a, D, { board: 'Sprint', columns: ['A', 'a'] }, 'mcp')).toMatchObject({
      code: 'board_invalid',
    });
    const two = [BOARD(), { ...BOARD(), elementId: 'b2', tabName: 'Other' }];
    expect(resolveBoard('Sprint', two)).toMatchObject({ ok: false, code: 'board_ambiguous' });
    expect(resolveBoard('x', [])).toMatchObject({
      ok: false,
      message: expect.stringContaining('add_board'),
    });
    const { api: stale } = api({
      [`/documents/${D}/tabs/t1`]: { tab: { id: 't1', elements: [], rev: 1 } },
    });
    expect(await changeBoard(stale, D, { board: 'Sprint' }, 'mcp')).toMatchObject({
      ok: false,
      code: 'board_unknown',
    });
  });
});

describe('api refusals mid-write', () => {
  it('reports a refused changeset for add_board and change_board', async () => {
    const refuse = () => Response.json({ error: 'forbidden' }, { status: 403 });
    const { api: a } = api({ [`/documents/${D}/tabs/t1/changesets`]: refuse });
    expect(await addBoard(a, D, {}, 'mcp')).toMatchObject({ ok: false, code: 'forbidden' });
    expect(await changeBoard(a, D, { board: 'Sprint', title: 'X' }, 'mcp')).toMatchObject({
      ok: false,
      code: 'forbidden',
    });
    const { api: down } = api({
      [`/documents/${D}/tabs/t1/changesets`]: () => new Response('', { status: 502 }),
    });
    await expect(addBoard(down, D, {}, 'mcp')).rejects.toBeInstanceOf(ApiError);
  });

  it('says which cards went to the Trash before a refusal', async () => {
    const { api: a } = api({
      [`/documents/${D}/items/ccc333`]: () =>
        Response.json({ error: 'forbidden' }, { status: 403 }),
    });
    const r = await changeCardTypes(a, D, [{ op: 'delete', type: 'Bug' }]);
    expect(r).toMatchObject({
      applied: ['- Bug (bug)'],
      trashed: [],
      refusal: { code: 'forbidden' },
    });
  });
});

describe('every branch of the engine', () => {
  const plan = (boards: unknown[], types: unknown[] = [...ITEM_TYPES, BUG]) => ({
    boards,
    statuses: STATUSES,
    types,
  });

  it('lists card fields, unknown board types, all-cards boards and an unknown status filter', async () => {
    const LINKED = {
      ...BUG,
      id: 'risk',
      label: 'Risk',
      custom: [{ id: 'f-blocks', label: 'Blocks', kind: 'card', linkType: 'task' }],
    };
    const { api: a } = api(
      {},
      plan(
        [BOARD(['ghost']), { ...BOARD(), elementId: 'all', kind: 'all-cards' }],
        [...ITEM_TYPES, LINKED],
      ),
    );
    const listing = planListing(await readPlanState(a, D), { status: 'nowhere' });
    expect(listing.types.find((t) => t.id === 'risk')!.custom[0]).toMatchObject({
      linkType: 'task',
    });
    expect(listing.boards[0]!.takes).toEqual(['ghost']);
    expect(listing.boards[1]!.columns.every((c) => c.cards.length === 0)).toBe(true);
    expect(listing.items).toEqual([]);
  });

  it('places cards with no status, a status no board names, and a type the catalogue lacks', async () => {
    const answer =
      (fields: Item['fields'], type = 'task') =>
      () =>
        Response.json({ item: item(9, 'new999', fields, type), rev: 2 });
    const lineFor = async (fields: Item['fields'], type = 'task', boards = [BOARD()]) => {
      const { api: a } = api(
        {
          [`/documents/${D}/items`]: (r: Request) =>
            r.method === 'GET' ? Response.json({ items: ITEMS, rev: 1 }) : answer(fields, type)(),
        },
        plan(boards),
      );
      return (
        await applyItemChanges(a, D, [{ op: 'add', title: 'New' }], await readPlanState(a, D))
      ).applied[0];
    };
    expect(await lineFor({ title: 'New' })).toContain('(on no board)');
    expect(await lineFor({ title: 'New', status: 'elsewhere' })).toContain('(on no board)');
    expect(await lineFor({ title: 'New', status: 'todo~x' }, 'ghost', [BOARD(['task'])])).toContain(
      'takes ghost cards',
    );
  });

  it('notes a clear-only set, says nothing for a type-only set, and knows a name already assigned', async () => {
    const withRobin = [
      ...ITEMS,
      item(8, 'ggg888', {
        title: 'R',
        assignee: { id: 'n-robin', name: 'Robin', color: '#2563eb' },
      }),
    ];
    const { api: a, seen } = api({ [`/documents/${D}/items`]: { items: withRobin, rev: 1 } });
    const state = await readPlanState(a, D);
    const r = await applyItemChanges(
      a,
      D,
      [
        { op: 'set', item: '#1', clear: ['due'] },
        { op: 'set', item: '#1', type: 'Bug' },
        { op: 'set', item: '#1', fields: { assignee: 'robin' } },
      ],
      state,
    );
    expect(r.applied[0]).toContain('; cleared due');
    expect(r.applied[1]).not.toContain(';');
    expect(r.applied[2]).not.toContain('new name');
    expect(seen[1]!.body).toEqual({ type: 'bug' });
  });

  it('answers a dry changeset, widens a board, names unknown types, and lets a 5xx throw', async () => {
    const { api: a, seen } = api({
      [`/documents/${D}/tabs/t1/changesets`]: (r: Request) =>
        r.text().then(() => Response.json({ changeset: null })),
    });
    expect(await addBoard(a, D, { preset: 'todo' }, 'mcp')).toMatchObject({
      ok: true,
      changesetId: null,
      rev: null,
    });
    const wide = await changeBoard(
      a,
      D,
      { board: 'Sprint', columns: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] },
      'mcp',
    );
    expect(wide).toMatchObject({ ok: true, changesetId: null, rev: null });
    void seen;
    const { api: noAction } = api(
      {},
      plan(
        [BOARD()],
        ITEM_TYPES.filter((t) => t.id !== 'action'),
      ),
    );
    const todo = await addBoard(noAction, D, { preset: 'todo' }, 'mcp');
    // The document lacked Action: the board brings it, named as it is made.
    expect(todo.ok && todo.takes).toEqual(['Action']);
    expect(todo.ok && todo.brought).toEqual(['Action']);
    const { api: down } = api({
      [`/documents/${D}/tabs/t1/changesets`]: () => new Response('', { status: 503 }),
    });
    await expect(
      changeBoard(down, D, { board: 'Sprint', title: 'X' }, 'mcp'),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('names a board type the catalogue lacks after a title change', async () => {
    const tab = {
      tab: {
        id: 't1',
        elements: [
          {
            id: 'b1',
            type: 'shape',
            shape: 'plan-board',
            x: 0,
            y: 0,
            width: 800,
            height: 500,
            planBoard: {
              title: 'Sprint',
              columns: [{ id: 'todo', status: 'todo~x', name: 'To Do' }],
              addTypes: ['ghost'],
              swimlaneBy: 'none',
              cardFields: ['key'],
              voting: { on: false },
              hideWriting: false,
            },
          },
        ],
        rev: 7,
      },
    };
    const { api: a } = api({ [`/documents/${D}/tabs/t1`]: tab });
    expect(await changeBoard(a, D, { board: 'Sprint', title: 'S2' }, 'mcp')).toMatchObject({
      ok: true,
      takes: ['ghost'],
    });
  });

  it('trashes a statusless card without a trashedFrom, and lets a 5xx save or trash throw', async () => {
    const loose = [item(4, 'hhh444', { title: 'Loose bug' }, 'bug')];
    const { api: a, seen } = api({
      [`/documents/${D}/items`]: { items: loose, rev: 1 },
      [`/documents/${D}/items/hhh444`]: (r: Request) =>
        r
          .text()
          .then(
            (t) => (
              seen.push({ method: 'POST', path: 'hhh444', body: JSON.parse(t) }),
              Response.json({ item: loose[0], rev: 2 })
            ),
          ),
    });
    await changeCardTypes(a, D, [{ op: 'delete', type: 'Bug' }]);
    expect(seen.find((s) => s.path === 'hhh444')!.body).toEqual({ set: { status: TRASH_STATUS } });
    const { api: putDown } = api({
      [`/documents/${D}/item-types`]: () => new Response('', { status: 500 }),
    });
    await expect(changeCardTypes(putDown, D, [{ op: 'add', name: 'Risk' }])).rejects.toBeInstanceOf(
      ApiError,
    );
    const { api: trashDown } = api({
      [`/documents/${D}/items/ccc333`]: () => new Response('', { status: 500 }),
    });
    await expect(
      changeCardTypes(trashDown, D, [{ op: 'delete', type: 'Bug' }]),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
