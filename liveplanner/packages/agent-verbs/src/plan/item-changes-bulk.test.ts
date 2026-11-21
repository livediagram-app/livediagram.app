import { describe, expect, it } from 'vitest';
import { ITEM_BULK_MAX, ITEM_TYPES, type Item } from '@liveplanner/items';
import { fakeApi } from '../testing/fake-api';
import { applyItemChanges, type ItemChange } from './item-changes';
import { readPlanState } from './plan-state';

// docs/specs/026-plan/plan-agents.md "Adding many cards": a run of new cards is one write.
const D = 'doc1';
const by = { id: 'p', name: 'Priya', color: '#7c3aed' };
const card = (key: number, fields: Item['fields']): Item => ({
  id: `id${key}`,
  type: 'task',
  key,
  rank: `r${key}`,
  fields,
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
});
const STATUSES = [
  { status: 'todo~x', name: 'To Do' },
  { status: 'done~x', name: 'Done' },
];
const BOARD = {
  tabId: 't1',
  tabName: 'Board',
  elementId: 'b1',
  title: 'Sprint',
  kind: 'board' as const,
  types: null,
  columns: [
    { status: 'todo~x', name: 'To Do' },
    { status: 'done~x', name: 'Done', done: true as const },
  ],
};
type Body = { type: string; fields: Item['fields']; place?: { status: string } };

// The api as the engine reaches it: the card route makes one card, the bulk route one for each it is given (or
// answers `bulk`), each numbered after the last.
function api(
  opts: { bulk?: (bodies: Body[]) => Response | null; one?: (body: Body) => Response | null } = {},
) {
  const seen: { path: string; body: unknown }[] = [];
  let key = 1;
  const make = (body: Body) =>
    card(++key, { ...body.fields, status: body.place?.status ?? 'todo~x' });
  const read = async (r: Request) => {
    const body = (await r.json()) as unknown;
    seen.push({ path: new URL(r.url).pathname.replace(/^\/api/, ''), body });
    return body;
  };
  const fake = fakeApi({
    [`/projects/${D}/items`]: async (r: Request) => {
      if (r.method === 'GET')
        return Response.json({ items: [card(1, { title: 'First', status: 'todo~x' })], rev: 1 });
      const body = (await read(r)) as Body;
      return opts.one?.(body) ?? Response.json({ item: make(body), rev: 2 }, { status: 201 });
    },
    [`/projects/${D}/items/bulk`]: async (r: Request) => {
      const { items } = (await read(r)) as { items: Body[] };
      return (
        opts.bulk?.(items) ?? Response.json({ items: items.map(make), rev: 2 }, { status: 201 })
      );
    },
    [`/projects/${D}/items/id1`]: async (r: Request) => {
      await read(r);
      return Response.json({ item: card(1, { title: 'First', status: 'done~x' }), rev: 3 });
    },
    [`/projects/${D}/plan`]: { boards: [BOARD], statuses: STATUSES, types: ITEM_TYPES },
  });
  return { api: fake, seen };
}
const add = (
  title: string,
  more: Partial<Extract<ItemChange, { op: 'add' }>> = {},
): ItemChange => ({
  op: 'add',
  title,
  ...more,
});
const paths = (seen: { path: string }[]) => seen.map((s) => s.path);
const BULK = `/projects/${D}/items/bulk`;
const ONE = `/projects/${D}/items`;

describe('adding many cards in one change_items', () => {
  it('writes a run of new cards in one request, in order, each with its line', async () => {
    const { api: a, seen } = api();
    const state = await readPlanState(a, D);
    const result = await applyItemChanges(
      a,
      D,
      [add('One', { status: 'Done' }), add('Two'), add('Three', { status: 'to do' })],
      state,
    );
    expect(paths(seen)).toEqual([BULK]);
    const { items } = seen[0]!.body as { items: Body[] };
    expect(items.map((i) => i.fields['title'])).toEqual(['One', 'Two', 'Three']);
    expect(items[0]!.place).toEqual({ status: 'done~x' });
    expect(items[2]!.place).toEqual({ status: 'todo~x' });
    expect(result.refusal).toBeUndefined();
    expect(result.applied).toHaveLength(3);
    expect(result.applied.map((l) => /One|Two|Three/.exec(l)?.[0])).toEqual([
      'One',
      'Two',
      'Three',
    ]);
    expect(result.touched.map((i) => i.key)).toEqual([2, 3, 4]);
  });

  it('writes one new card by the card route, as ever', async () => {
    const { api: a, seen } = api();
    const result = await applyItemChanges(a, D, [add('Only')], await readPlanState(a, D));
    expect(paths(seen)).toEqual([ONE]);
    expect(result.applied).toHaveLength(1);
  });

  it('keeps the order of the call: a run, another change, then the cards after it', async () => {
    const { api: a, seen } = api();
    const result = await applyItemChanges(
      a,
      D,
      [
        add('One'),
        add('Two'),
        { op: 'set', item: 'T-1', fields: { Priority: 'High' } },
        add('Three'),
      ],
      await readPlanState(a, D),
    );
    expect(paths(seen)).toEqual([BULK, `${ONE}/id1`, ONE]);
    expect(result.applied.map((l) => l[0])).toEqual(['+', '+', '~', '+']);
  });

  it('writes the run a card at a time when the bulk route refuses it, as for a Participant’s token', async () => {
    const { api: a, seen } = api({
      bulk: () => Response.json({ error: 'forbidden' }, { status: 403 }),
    });
    const result = await applyItemChanges(
      a,
      D,
      [add('One'), add('Two'), add('Three')],
      await readPlanState(a, D),
    );
    expect(paths(seen)).toEqual([BULK, ONE, ONE, ONE]);
    expect(result.refusal).toBeUndefined();
    expect(result.applied).toHaveLength(3);
  });

  it('names the card a refusal is about, after the ones before it landed', async () => {
    const refuse = () => Response.json({ error: 'value_invalid', field: 'title' }, { status: 400 });
    const { api: a, seen } = api({
      bulk: refuse,
      one: (body) => (body.fields['title'] === 'Two' ? refuse() : null),
    });
    const result = await applyItemChanges(
      a,
      D,
      [add('One'), add('Two'), add('Three')],
      await readPlanState(a, D),
    );
    expect(paths(seen)).toEqual([BULK, ONE, ONE]);
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0]).toContain('One');
    expect(result.refusal).toBeDefined();
  });

  it('throws a fault of the bulk route, writing nothing more', async () => {
    const { api: a, seen } = api({ bulk: () => Response.json({ error: 'boom' }, { status: 503 }) });
    const state = await readPlanState(a, D);
    await expect(applyItemChanges(a, D, [add('One'), add('Two')], state)).rejects.toThrow();
    expect(paths(seen)).toEqual([BULK]);
  });

  it('never writes again when the answer holds fewer cards than were added', async () => {
    const { api: a, seen } = api({
      bulk: (bodies) =>
        Response.json({ items: [card(2, bodies[0]!.fields)], rev: 2 }, { status: 201 }),
    });
    const state = await readPlanState(a, D);
    await expect(applyItemChanges(a, D, [add('One'), add('Two')], state)).rejects.toThrow(
      'The api answered 1 cards for 2 added.',
    );
    expect(paths(seen)).toEqual([BULK]);
  });

  it('writes the cards before one that cannot be read yet, then reads it again', async () => {
    const { api: a, seen } = api();
    const result = await applyItemChanges(
      a,
      D,
      [add('One'), add('Two'), add('Three', { status: 'Nowhere' })],
      await readPlanState(a, D),
    );
    // The first two land together; the third is still refused, and the answer says what landed.
    expect(paths(seen)).toEqual([BULK]);
    expect(result.applied).toHaveLength(2);
    expect(result.refusal).toBeDefined();
  });

  it('writes more cards than one request holds in as many requests as it takes', async () => {
    const { api: a, seen } = api();
    const many = Array.from({ length: ITEM_BULK_MAX + 1 }, (_, i) => add(`Card ${i}`));
    const result = await applyItemChanges(a, D, many, await readPlanState(a, D));
    expect(paths(seen)).toEqual([BULK, ONE]);
    expect((seen[0]!.body as { items: Body[] }).items).toHaveLength(ITEM_BULK_MAX);
    expect(result.applied).toHaveLength(ITEM_BULK_MAX + 1);
  });
});
