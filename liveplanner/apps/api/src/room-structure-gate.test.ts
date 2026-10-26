import { describe, expect, it, vi } from 'vitest';
import { presetSetup } from '@liveplanner/items';
import { structureAgainst, structureFirst } from './room-structure-gate';
import { RoomScopedStructure } from './room-scoped-structure';
import type { StructuredTab } from './tab-structure';

// The room's half of a tab-scoped Editor's limits (docs/specs/013-workspace/tab-scoped-share-links.md "Structure"):
// what the gate answers from the op alone, what it answers from the stored tab, and that the ops of a scoped
// session still relay in the order it sent them.

const board = { id: 'b1', type: 'shape', shape: 'plan-board', planBoard: presetSetup('kanban') };
const view = { id: 'v1', type: 'shape', shape: 'plan-view', planView: { view: 'gantt' } };
const card = (itemId: string) => ({
  id: 'c1',
  type: 'shape',
  shape: 'plan-card',
  planCard: { itemId },
});
const sticky = { id: 's1', type: 'sticky', text: 'hi' };
const el = (op: unknown) => ({ kind: 'el', tabId: 't1', op });
const stored: StructuredTab = {
  name: 'Board',
  elements: [board, card('i1'), sticky],
  form: { destination: { tabId: 't2', typeId: 'task', status: 'todo' } },
};

describe('structureFirst', () => {
  it('drops an added board, plan view or Plan card, and relays any other add', () => {
    for (const element of [board, view, card('i9')])
      expect(structureFirst(el({ kind: 'add', element, at: 0 }), 't1')).toBe('drop');
    expect(structureFirst(el({ kind: 'add', element: sticky, at: 0 }), 't1')).toBe('relay');
  });

  it('drops a rename and a patch touching what an element pulls in', () => {
    expect(structureFirst({ kind: 'tab-meta', tabId: 't1', patch: { name: 'X' } }, 't1')).toBe(
      'drop',
    );
    expect(
      structureFirst({ kind: 'tab-meta', tabId: 't1', patch: {}, clear: ['name'] }, 't1'),
    ).toBe('drop');
    expect(
      structureFirst(el({ kind: 'patch', id: 's1', set: { shape: 'plan-board' } }), 't1'),
    ).toBe('drop');
    expect(structureFirst(el({ kind: 'patch', id: 's1', set: { x: 4 } }), 't1')).toBe('relay');
  });

  it('relays a form kept on its tab and asks the store about one pointed elsewhere', () => {
    const meta = (tabId: string) => ({
      kind: 'tab-meta',
      tabId: 't1',
      patch: { form: { destination: { tabId, typeId: 'task', status: 'todo' } } },
    });
    expect(structureFirst(meta('t1'), 't1')).toBe('relay');
    expect(structureFirst(meta('t2'), 't1')).toBe('stored');
    expect(structureFirst({ kind: 'tab-meta', tabId: 't1', patch: { theme: 'x' } }, 't1')).toBe(
      'relay',
    );
  });

  it('asks the store about an update, a remove and a whole tab; relays the rest', () => {
    expect(structureFirst(el({ kind: 'update', element: sticky }), 't1')).toBe('stored');
    expect(structureFirst(el({ kind: 'remove', id: 's1' }), 't1')).toBe('stored');
    expect(structureFirst({ kind: 'tab', tabId: 't1', tab: {} }, 't1')).toBe('stored');
    expect(structureFirst(el({ kind: 'reorder', ids: [] }), 't1')).toBe('relay');
    expect(structureFirst({ kind: 'vote', tabId: 't1' }, 't1')).toBe('relay');
  });
});

describe('structureAgainst', () => {
  it('lets a board or Plan card move, never change what it pulls in or turn into one', () => {
    expect(
      structureAgainst(el({ kind: 'update', element: { ...board, x: 9 } }), stored, 't1'),
    ).toBe(true);
    expect(structureAgainst(el({ kind: 'update', element: card('i1') }), stored, 't1')).toBe(true);
    expect(structureAgainst(el({ kind: 'update', element: card('i2') }), stored, 't1')).toBe(false);
    expect(
      structureAgainst(el({ kind: 'update', element: { ...board, id: 's1' } }), stored, 't1'),
    ).toBe(false);
    expect(
      structureAgainst(el({ kind: 'update', element: { ...sticky, id: 'b1' } }), stored, 't1'),
    ).toBe(false);
    expect(structureAgainst(el({ kind: 'update', element: sticky }), stored, 't1')).toBe(true);
  });

  it('refuses removing a board or Plan card, and lets anything else go', () => {
    expect(structureAgainst(el({ kind: 'remove', id: 'b1' }), stored, 't1')).toBe(false);
    expect(structureAgainst(el({ kind: 'remove', id: 'c1' }), stored, 't1')).toBe(false);
    expect(structureAgainst(el({ kind: 'remove', id: 's1' }), stored, 't1')).toBe(true);
  });

  it('judges a whole tab and a form against the stored one', () => {
    const tab = (over: Partial<StructuredTab>) => ({
      kind: 'tab',
      tabId: 't1',
      tab: { ...stored, ...over },
    });
    expect(structureAgainst(tab({}), stored, 't1')).toBe(true);
    expect(structureAgainst(tab({ name: 'Mine' }), stored, 't1')).toBe(false);
    expect(
      structureAgainst(tab({ elements: [board, card('i1'), sticky, view] }), stored, 't1'),
    ).toBe(false);
    // The owner's destination on another tab, kept while a question changes.
    const meta = (destination: unknown) => ({
      kind: 'tab-meta',
      tabId: 't1',
      patch: { form: { heading: 'New', destination } },
    });
    expect(
      structureAgainst(meta({ tabId: 't2', typeId: 'task', status: 'todo' }), stored, 't1'),
    ).toBe(true);
    expect(
      structureAgainst(meta({ tabId: 't3', typeId: 'task', status: 'todo' }), stored, 't1'),
    ).toBe(false);
  });
});

describe('RoomScopedStructure', () => {
  it('relays in the order sent, holding later ops behind one that reads the store', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const scoped = new RoomScopedStructure(async () => {
      await gate;
      return stored;
    });
    const relayed: string[] = [];
    scoped.admit(el({ kind: 'add', element: sticky, at: 0 }), 't1', 'D', () => relayed.push('add'));
    scoped.admit(el({ kind: 'remove', id: 'b1' }), 't1', 'D', () => relayed.push('remove board'));
    scoped.admit(el({ kind: 'update', element: sticky }), 't1', 'D', () => relayed.push('update'));
    scoped.admit(el({ kind: 'reorder', ids: [] }), 't1', 'D', () => relayed.push('reorder'));
    scoped.admit(el({ kind: 'add', element: view, at: 0 }), 't1', 'D', () => relayed.push('view'));
    expect(relayed).toEqual(['add']);
    release();
    await scoped.settled();
    expect(relayed).toEqual(['add', 'update', 'reorder']);
    // Caught up, an op the gate answers alone relays at once again.
    scoped.admit(el({ kind: 'reorder', ids: [] }), 't1', 'D', () => relayed.push('now'));
    expect(relayed.at(-1)).toBe('now');
  });

  it('relays nothing when the store cannot be read', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scoped = new RoomScopedStructure(async () => {
      throw new Error('down');
    });
    const relay = vi.fn();
    scoped.admit(el({ kind: 'remove', id: 's1' }), 't1', 'D', relay);
    await scoped.settled();
    expect(relay).not.toHaveBeenCalled();
  });
});
