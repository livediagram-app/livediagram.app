// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createShape, type Element, type Tab } from '@livediagram/document';
import { presetSetup } from '@livediagram/items';
import { renderHook } from '@testing-library/react';
import {
  STATUS_SIGNATURE_CACHE_MAX,
  documentBoardSetups,
  documentStatusSignatures,
  statusColumnsOf,
  usePlanStatuses,
} from './usePlanStatusNames';

// docs/specs/026-plan/plan-board.md "All Cards".
describe('statusColumnsOf', () => {
  it('names each status once, in board and column order, skipping All Cards and Archive boards', () => {
    const board = (preset: Parameters<typeof presetSetup>[0]) =>
      ({ ...createShape('plan-board', 0, 0), planBoard: presetSetup(preset) }) as Element;
    const names = statusColumnsOf([
      board('blank'),
      board('kanban'),
      board('kanban'),
      board('all-cards'),
      board('archive'),
    ]);
    // Blank has no columns; the Kanban's come first, each status once though two boards name it.
    const first = presetSetup('kanban').columns[0]!;
    expect(names[0]).toEqual([first.status, first.name]);
    expect(names.filter(([s]) => s === first.status)).toHaveLength(1);
    expect(names.some(([s]) => s === 'all' || s === 'archived')).toBe(false);
  });
});

// docs/specs/026-plan/plan-templates.md "Hand-offs": the document's statuses, the open tab's first.
describe('document-wide statuses', () => {
  const board = (columns: { status: string; name: string }[], doneColumnId?: string) =>
    ({
      ...createShape('plan-board', 0, 0),
      planBoard: {
        ...presetSetup('blank'),
        columns: columns.map((c) => ({ id: c.status, ...c })),
        ...(doneColumnId ? { doneColumnId } : {}),
      },
    }) as Element;
  const backlog = board([
    { status: 'backlog', name: 'Backlog' },
    { status: 'sprint', name: 'This Sprint' },
  ]);
  const sprint = board(
    [
      { status: 'sprint', name: 'Sprint Todo' },
      { status: 'doing', name: 'Doing' },
      { status: 'done', name: 'Done' },
    ],
    'done',
  );
  const tabs: Tab[] = [
    { id: 'a', name: 'Backlog', elements: [backlog] },
    { id: 'b', name: 'Sprint', elements: [sprint] },
    { id: 'c', name: 'Flow', elements: [] },
  ];

  it('reads the open tab’s boards first, then the others in tab order', () => {
    expect(documentBoardSetups(tabs, 'b')).toEqual([
      sprint.type === 'shape' && sprint.planBoard,
      backlog.type === 'shape' && backlog.planBoard,
    ]);
    const { result } = renderHook(() => usePlanStatuses(tabs, 'b', true));
    expect([...result.current.names]).toEqual([
      ['sprint', 'Sprint Todo'],
      ['doing', 'Doing'],
      ['done', 'Done'],
      ['backlog', 'Backlog'],
    ]);
  });

  it('gives a tab with no board the phases of the boards beside it', () => {
    const { result } = renderHook(() => usePlanStatuses(tabs, 'c', true));
    expect(result.current.phases.get('done')).toBe('done');
    expect(result.current.phases.get('backlog')).toBe('todo');
  });

  it('reads nothing while Plan is not in play, and keeps the maps while nothing changes', () => {
    const off = renderHook(() => usePlanStatuses(tabs, 'a', false));
    expect(off.result.current.names.size).toBe(0);
    const on = renderHook(({ t }) => usePlanStatuses(t, 'a', true), { initialProps: { t: tabs } });
    const first = on.result.current;
    // A new tab list with the same tabs (a render that changed no board).
    on.rerender({ t: [...tabs] });
    expect(on.result.current.names).toBe(first.names);
    expect(on.result.current.phases).toBe(first.phases);
    expect(on.result.current.types).toBe(first.types);
  });

  it('gives each status the card types its boards show: their union, or every type', () => {
    const typed = (columns: string[], addTypes?: string[]) =>
      ({
        ...createShape('plan-board', 0, 0),
        planBoard: {
          ...presetSetup('blank'),
          columns: columns.map((status) => ({ id: status, status, name: status })),
          ...(addTypes ? { addTypes } : {}),
        },
      }) as Element;
    const typedTabs: Tab[] = [
      {
        id: 't',
        name: 'Typed',
        elements: [
          typed(['todo', 'doing'], ['bug']),
          typed(['todo'], ['task']),
          typed(['doing']),
          { ...typed(['shelf']), planBoard: presetSetup('all-cards') } as Element,
        ],
      },
    ];
    const { result } = renderHook(() => usePlanStatuses(typedTabs, 't', true));
    const types = result.current.types;
    expect(types.get('todo')).toEqual(new Set(['bug', 'task']));
    expect(types.get('doing')).toBe('all');
    // An All Cards board names no status.
    expect([...types.keys()]).toEqual(['todo', 'doing']);
    // Once Bug is deleted from the catalogue, the board that named only Bug shows every type again.
    const later = renderHook(() => usePlanStatuses(typedTabs, 't', true, ['task', 'note']));
    expect(later.result.current.types.get('todo')).toBe('all');
    expect(later.result.current.types.get('doing')).toBe('all');
  });

  it('reuses the signatures while every tab’s boards are the same, and keeps the cache bounded', () => {
    const a = documentStatusSignatures(tabs, 'a');
    expect(documentStatusSignatures([...tabs], 'a')).toBe(a);
    // A tab whose elements changed is read afresh.
    const changed = [{ ...tabs[0]!, elements: [...tabs[0]!.elements] }, ...tabs.slice(1)];
    const b = documentStatusSignatures(changed, 'a');
    expect(b).not.toBe(a);
    expect(b).toEqual(a);
    for (let i = 0; i <= STATUS_SIGNATURE_CACHE_MAX; i++)
      documentStatusSignatures([{ ...tabs[0]!, elements: [] }, ...tabs.slice(1)], 'a');
    expect(documentStatusSignatures(tabs, 'a')).not.toBe(a);
  });
});
