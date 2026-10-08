// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import { presetSetup, statusColumn, type Item } from '@livediagram/items';
import { useMergeDuplicateStatuses } from './useMergeDuplicateStatuses';

// docs/specs/026-plan/plan-board.md "One name, one state": two states of one name merge into the first.
const board = (id: string, columns: ReturnType<typeof statusColumn>[]) => ({
  id,
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y: 0,
  width: 800,
  height: 400,
  planBoard: { ...presetSetup('kanban'), columns },
});
const tabs = [
  { id: 't1', name: 'A', elements: [board('b1', [statusColumn('todo', 'To Do')])] },
  { id: 't2', name: 'B', elements: [board('b2', [statusColumn('todo~ab12', 'To do')])] },
] as unknown as Tab[];
const card = (id: string, status: string) =>
  [id, { id, fields: { status } } as unknown as Item] as const;
const items = new Map([card('c1', 'todo~ab12'), card('c2', 'todo')]);

function run(enabled: boolean, itemsReady = true) {
  const tickTabs = vi.fn();
  const writeQuiet = vi.fn(async () => true);
  renderHook(() =>
    useMergeDuplicateStatuses({ tabs, enabled, itemsReady, items, tickTabs, writeQuiet }),
  );
  return { tickTabs, writeQuiet };
}

describe('useMergeDuplicateStatuses', () => {
  it('takes boards and cards to the first state of the name, once', () => {
    const { tickTabs, writeQuiet } = run(true);
    expect(tickTabs).toHaveBeenCalledOnce();
    const next = tickTabs.mock.calls[0]![0](tabs) as Tab[];
    const second = next[1]!.elements[0] as unknown as {
      planBoard: { columns: { status: string }[] };
    };
    expect(second.planBoard.columns.map((c) => c.status)).toEqual(['todo']);
    expect(next[0]).toBe(tabs[0]);
    expect(writeQuiet).toHaveBeenCalledWith({
      kind: 'patches',
      patches: [{ id: 'c1', patch: { set: { status: 'todo' } } }],
    });
  });

  it('waits for edit rights and the cards', () => {
    expect(run(false).tickTabs).not.toHaveBeenCalled();
    expect(run(true, false).tickTabs).not.toHaveBeenCalled();
  });
});
