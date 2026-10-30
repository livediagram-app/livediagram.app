import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, defaultCatalogue, presetSetup } from '@liveplanner/items';
import { fakeApi } from '../testing/fake-api';
import { bringBoardCardTypes, joinBoardStatuses } from './brought-types';

// docs/specs/026-plan/plan-agents.md "Adding a board": a board an agent makes brings its card types.
const D = 'doc1';
const board = (preset: 'bug-triage' | 'retro' | 'kanban') => ({
  type: 'shape',
  shape: 'plan-board',
  planBoard: presetSetup(preset),
});

function api(
  put: (r: Request) => Response | Promise<Response>,
  doc: { itemTypes: unknown; items: unknown[] } = { itemTypes: null, items: [] },
) {
  const calls: string[] = [];
  const fake = fakeApi({
    [`/projects/${D}`]: (r: Request) => {
      calls.push(`${r.method} project`);
      return Response.json({ project: { id: D, tabs: [], itemTypes: doc.itemTypes } });
    },
    [`/projects/${D}/items`]: (r: Request) => {
      calls.push(`${r.method} items`);
      return Response.json({ items: doc.items, rev: 1 });
    },
    [`/projects/${D}/item-types`]: (r: Request) => {
      calls.push(`${r.method} item-types`);
      return put(r);
    },
  });
  return { api: fake, calls };
}

const savedIds = async (r: Request) =>
  ((await r.json()) as { itemTypes: { types: { id: string }[] } }).itemTypes.types.map((t) => t.id);

describe('bringBoardCardTypes', () => {
  it('reads nothing when no Plan board is among the elements', async () => {
    const { api: a, calls } = api(() => Response.json({ itemTypes: null }));
    expect(await bringBoardCardTypes(a, D, [{ type: 'sticky' }])).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('chooses a fresh project’s card types: exactly the board’s', async () => {
    let saved: string[] = [];
    const { api: a, calls } = api(async (r) => {
      saved = await savedIds(r);
      return Response.json({ itemTypes: null });
    });
    expect(await bringBoardCardTypes(a, D, [board('kanban')])).toEqual(['task', 'action']);
    expect(saved).toEqual(['task', 'action']);
    expect(calls.sort()).toEqual(['GET project', 'PUT item-types']);
  });

  it('adds only what is missing, after the types the project has', async () => {
    let saved: string[] = [];
    const { api: a } = api(
      async (r) => {
        saved = await savedIds(r);
        return Response.json({ itemTypes: null });
      },
      { itemTypes: defaultCatalogue(), items: [{ id: 'i1' }] },
    );
    expect(await bringBoardCardTypes(a, D, [board('bug-triage')])).toEqual(['bug']);
    expect(saved).toEqual([...ITEM_TYPES.map((t) => t.id), 'bug']);
  });

  it('writes nothing when the board brings nothing new', async () => {
    const { api: a, calls } = api(() => Response.json({ itemTypes: null }));
    const known = { stored: defaultCatalogue() };
    expect(await bringBoardCardTypes(a, D, [board('retro')], known)).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('leaves the board as made when the save is refused', async () => {
    const { api: a } = api(() => Response.json({ error: 'forbidden' }, { status: 403 }));
    const known = { stored: null };
    expect(await bringBoardCardTypes(a, D, [board('bug-triage')], known)).toEqual([]);
  });

  it('lets a failure that is not a refusal throw', async () => {
    const { api: a } = api(() => new Response('down', { status: 503 }));
    const known = { stored: null };
    await expect(bringBoardCardTypes(a, D, [board('bug-triage')], known)).rejects.toThrow();
  });

  // docs/specs/026-plan/item-types.md "Storage and sync": the save names the revision read; another change landing
  // first sends it back to read the card types again.
  it('reads the card types again when another change landed first', async () => {
    let rev = 2;
    const sent: unknown[] = [];
    const fake = fakeApi({
      [`/projects/${D}`]: () =>
        Response.json({ project: { id: D, tabs: [], itemTypes: null, itemTypesRev: rev } }),
      [`/projects/${D}/items`]: () => Response.json({ items: [], rev: 1 }),
      [`/projects/${D}/item-types`]: async (r: Request) => {
        sent.push(((await r.json()) as { expectedRev?: number }).expectedRev);
        if (sent.length === 1) {
          rev = 3;
          return Response.json(
            { error: 'item_types_stale', itemTypes: null, itemTypesRev: 3 },
            { status: 409 },
          );
        }
        return Response.json({ itemTypes: null, itemTypesRev: 4 });
      },
    });
    expect(await bringBoardCardTypes(fake, D, [board('kanban')])).toEqual(['task', 'action']);
    expect(sent).toEqual([2, 3]);
  });
});

// docs/specs/026-plan/item-types.md "The statuses a type uses": a board's statuses join only the types it takes.
describe('board statuses joining card types', () => {
  const task = ITEM_TYPES.find((t) => t.id === 'task')!;
  const note = ITEM_TYPES.find((t) => t.id === 'note')!;
  const typed = (statuses: Record<string, string[] | undefined>) => ({
    version: 1,
    types: [task, note].map((t) => {
      const s = statuses[t.id];
      return s ? { ...t, statuses: s } : t;
    }),
  });
  const savedStatuses = async (r: Request) =>
    Object.fromEntries(
      (
        (await r.json()) as { itemTypes: { types: { id: string; statuses?: string[] }[] } }
      ).itemTypes.types.map((t) => [t.id, t.statuses]),
    );
  const taking = (statuses: string[], addTypes?: string[]) => ({
    columns: statuses.map((s) => ({ id: `c-${s}`, status: s, name: s })),
    ...(addTypes ? { addTypes } : {}),
  });

  it('gives a new board’s statuses to the types it takes, writing old types in the new shape first', async () => {
    let saved: Record<string, string[] | undefined> = {};
    const { api: a } = api(async (r) => {
      saved = await savedStatuses(r);
      return Response.json({ itemTypes: null });
    });
    const known = { stored: typed({ task: ['todo'] }) };
    const el = { type: 'shape', shape: 'plan-board', planBoard: taking(['qa'], ['task']) };
    expect(await bringBoardCardTypes(a, D, [el], known, ['todo', 'done'])).toEqual([]);
    expect(saved).toEqual({ task: ['todo', 'qa'], note: ['todo', 'done'] });
  });

  it('gives a board taking every type its statuses for every type with a list', async () => {
    let saved: Record<string, string[] | undefined> = {};
    const { api: a } = api(async (r) => {
      saved = await savedStatuses(r);
      return Response.json({ itemTypes: null });
    });
    const known = { stored: typed({ task: ['todo'], note: [] }) };
    const el = { type: 'shape', shape: 'plan-board', planBoard: taking(['todo', 'qa']) };
    await bringBoardCardTypes(a, D, [el], known);
    expect(saved).toEqual({ task: ['todo', 'qa'], note: ['todo', 'qa'] });
  });

  it('joins a column change_board adds, and writes nothing when nothing joins', async () => {
    let saved: Record<string, string[] | undefined> = {};
    const { api: a, calls } = api(
      async (r) => {
        saved = await savedStatuses(r);
        return Response.json({ itemTypes: null });
      },
      { itemTypes: typed({ task: ['todo'], note: ['todo'] }), items: [] },
    );
    const was = taking(['todo'], ['note']);
    expect(await joinBoardStatuses(a, D, was, taking(['todo', 'qa'], ['note']), ['todo'])).toBe(
      true,
    );
    expect(saved).toEqual({ task: ['todo'], note: ['todo', 'qa'] });
    calls.length = 0;
    expect(await joinBoardStatuses(a, D, was, taking(['todo'], ['note']), ['todo'])).toBe(false);
    expect(calls).toEqual(['GET project']);
  });
});
