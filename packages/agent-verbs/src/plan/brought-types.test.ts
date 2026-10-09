import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, presetSetup } from '@livediagram/items';
import { fakeApi } from '../testing/fake-api';
import { bringBoardCardTypes } from './brought-types';

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
    [`/documents/${D}`]: (r: Request) => {
      calls.push(`${r.method} document`);
      return Response.json({ document: { id: D, tabs: [], itemTypes: doc.itemTypes } });
    },
    [`/documents/${D}/items`]: (r: Request) => {
      calls.push(`${r.method} items`);
      return Response.json({ items: doc.items, rev: 1 });
    },
    [`/documents/${D}/item-types`]: (r: Request) => {
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

  it('chooses a fresh document’s card types: exactly the board’s', async () => {
    let saved: string[] = [];
    const { api: a, calls } = api(async (r) => {
      saved = await savedIds(r);
      return Response.json({ itemTypes: null });
    });
    expect(await bringBoardCardTypes(a, D, [board('kanban')])).toEqual(['task', 'action']);
    expect(saved).toEqual(['task', 'action']);
    expect(calls.sort()).toEqual(['GET document', 'GET items', 'PUT item-types']);
  });

  it('adds only what is missing to a document with cards, after the default types', async () => {
    let saved: string[] = [];
    const { api: a } = api(
      async (r) => {
        saved = await savedIds(r);
        return Response.json({ itemTypes: null });
      },
      { itemTypes: null, items: [{ id: 'i1' }] },
    );
    expect(await bringBoardCardTypes(a, D, [board('bug-triage')])).toEqual(['bug']);
    expect(saved).toEqual([...ITEM_TYPES.map((t) => t.id), 'bug']);
  });

  it('writes nothing when the board brings nothing new', async () => {
    const { api: a, calls } = api(() => Response.json({ itemTypes: null }));
    const known = { stored: null, hasCards: true };
    expect(await bringBoardCardTypes(a, D, [board('retro')], known)).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('leaves the board as made when the save is refused', async () => {
    const { api: a } = api(() => Response.json({ error: 'forbidden' }, { status: 403 }));
    const known = { stored: null, hasCards: false };
    expect(await bringBoardCardTypes(a, D, [board('bug-triage')], known)).toEqual([]);
  });

  it('lets a failure that is not a refusal throw', async () => {
    const { api: a } = api(() => new Response('down', { status: 503 }));
    const known = { stored: null, hasCards: false };
    await expect(bringBoardCardTypes(a, D, [board('bug-triage')], known)).rejects.toThrow();
  });
});
