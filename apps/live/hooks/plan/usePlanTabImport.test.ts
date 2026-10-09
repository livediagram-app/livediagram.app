// @vitest-environment jsdom

// A JSON tab export's Plan items joining the document (docs/specs/026-plan/items.md "Copies and exports").

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, ITEM_TYPE_CATALOGUE_VERSION, type Item } from '@livediagram/items';
import { usePlanTabImport } from './usePlanTabImport';

const person = { id: 'p', name: 'Sam', color: '#2563eb' };
const item = (id: string, type = 'task'): Item => ({
  id,
  type,
  key: 1,
  rank: 'i',
  fields: { title: id, status: 'todo' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: person,
  updatedBy: person,
});
const bug = { ...ITEM_TYPES[1]!, id: 'bug', label: 'Bug' };

function setup(existing: Item[], ok = true, status: 'loading' | 'ready' | 'error' = 'ready') {
  const addTypes = vi.fn();
  const write = vi.fn(async () => ok);
  const props = {
    status,
    items: new Map(existing.map((i) => [i.id, i])),
    types: ITEM_TYPES,
    addTypes,
    write,
    readyWaitMs: 150,
  };
  const { result, rerender } = renderHook((p: typeof props) => usePlanTabImport(p), {
    initialProps: props,
  });
  return {
    run: result.current,
    addTypes,
    write,
    // The store finishing its load (or changing) after the import began.
    become: (next: Partial<typeof props>) => rerender({ ...props, ...next }),
  };
}

describe('usePlanTabImport', () => {
  it('adds the missing types, then creates the new cards in one write', async () => {
    const { run, addTypes, write } = setup([item('a')]);
    const result = await run({
      items: [item('a'), item('b', 'bug')],
      itemTypes: { version: ITEM_TYPE_CATALOGUE_VERSION, types: [...ITEM_TYPES, bug] },
    });
    expect(addTypes).toHaveBeenCalledWith([bug]);
    expect(write).toHaveBeenCalledWith({
      kind: 'create',
      creates: [expect.objectContaining({ id: 'b', type: 'bug' })],
    });
    expect(result).toEqual({ added: 1, skipped: 1, failed: 0 });
  });

  it('writes nothing when the document already holds every card', async () => {
    const { run, addTypes, write } = setup([item('a')]);
    expect(await run({ items: [item('a')], itemTypes: null })).toEqual({
      added: 0,
      skipped: 1,
      failed: 0,
    });
    expect(addTypes).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('counts the cards the store refused', async () => {
    const { run } = setup([], false);
    expect(await run({ items: [item('a'), item('b')], itemTypes: null })).toEqual({
      added: 0,
      skipped: 0,
      failed: 2,
    });
  });

  it('adds nothing when the store never loads, so no card is made twice', async () => {
    for (const status of ['loading', 'error'] as const) {
      const { run, addTypes, write } = setup([], true, status);
      expect(await run({ items: [item('a'), item('b')], itemTypes: null })).toEqual({
        added: 0,
        skipped: 0,
        failed: 2,
      });
      expect(addTypes).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
    }
  });

  it('waits for a store that loads after the import began, and reads it as loaded', async () => {
    // A document with no Plan content: the imported board starts the load, which settles mid-import.
    const { run, write, become } = setup([], true, 'loading');
    const pending = run({ items: [item('a'), item('b')], itemTypes: null });
    act(() => become({ status: 'ready', items: new Map([['a', item('a')]]) }));
    expect(await pending).toEqual({ added: 1, skipped: 1, failed: 0 });
    expect(write).toHaveBeenCalledWith({
      kind: 'create',
      creates: [expect.objectContaining({ id: 'b' })],
    });
  });
});
