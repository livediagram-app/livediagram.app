// @vitest-environment jsdom
// docs/specs/026-plan/board-widgets.md "The board's filter" (Work Tracker 881, 882): a filter change arriving from a
// teammate re-projects every open copy of the board, so on a full board (ITEMS_MAX) it must cost one filtered projection:
// the unfiltered projection the widgets count is kept, the widgets do not recount, and only the cards the filter
// shows or hides are drawn. Inside a CPU budget (not wall-clock: docs/specs/003-system-architecture/testing.md).
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  ITEMS_MAX,
  ITEM_TYPES,
  presetSetup,
  type BoardFilter,
  type Item,
} from '@liveplanner/items';
import type { ShapeElement } from '@liveplanner/project';
import { PlanBoardView } from './PlanBoardView';
import { PlanProvider, type PlanContextValue } from './PlanContext';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';

const counts = vi.hoisted(() => ({ face: 0, project: 0, due: 0, points: 0 }));
vi.mock('./PlanCardFace', async (orig) => {
  const m = await orig<typeof import('./PlanCardFace')>();
  const Face = m.PlanCardFace;
  return {
    ...m,
    PlanCardFace: (p: Parameters<typeof Face>[0]) => {
      counts.face++;
      return Face(p);
    },
  };
});
vi.mock('@liveplanner/items', async (orig) => {
  const m = await orig<typeof import('@liveplanner/items')>();
  return {
    ...m,
    projectBoard: (...args: Parameters<typeof m.projectBoard>) => {
      counts.project++;
      return m.projectBoard(...args);
    },
  };
});
vi.mock('@liveplanner/plan-art', async (orig) => {
  const m = await orig<typeof import('@liveplanner/plan-art')>();
  return {
    ...m,
    dueCounts: (...args: Parameters<typeof m.dueCounts>) => {
      counts.due++;
      return m.dueCounts(...args);
    },
    boardPoints: (...args: Parameters<typeof m.boardPoints>) => {
      counts.points++;
      return m.boardPoints(...args);
    },
  };
});

afterEach(cleanup);

const STATUSES = ['todo', 'doing', 'review', 'done'];
const PEOPLE = ['Sam', 'Ana', 'Lee', 'Kim', 'Raj'];
function items(n: number): Map<string, Item> {
  const m = new Map<string, Item>();
  for (let i = 0; i < n; i++) {
    const p = PEOPLE[i % PEOPLE.length]!;
    m.set(`i${i}`, {
      id: `i${i}`,
      key: i + 1,
      type: 'task',
      fields: {
        title: `Card number ${i + 1} with a reasonably long title`,
        status: STATUSES[i % STATUSES.length],
        assignee: { id: p, name: p, color: '#7c3aed' },
        priority: ['low', 'medium', 'high'][i % 3],
        estimate: (i % 8) + 1,
        due: '2026-12-01',
      },
      rank: `a${String(i).padStart(5, '0')}`,
      createdAt: 0,
      updatedAt: 0,
      createdBy: { id: 'Sam', name: 'Sam', color: '#7c3aed' },
    } as unknown as Item);
  }
  return m;
}

const plan = (n: number): PlanContextValue =>
  ({
    items: items(n),
    types: ITEM_TYPES,
    status: 'ready',
    self: { id: 'Sam', name: 'Sam', color: '#7c3aed' },
    people: [],
    canEdit: true,
    canEditCards: true,
    canVote: true,
    presence: new Map(),
    statusNames: new Map(),
    statusBoards: new Map(),
    openItemId: null,
    retry: vi.fn(),
    openItem: vi.fn(),
    openNewItem: vi.fn(),
    addItem: vi.fn(),
    moveItem: vi.fn(),
    updateBoard: vi.fn(),
    setBoardFilter: vi.fn(),
    createTypeForBoard: vi.fn(),
    announce: vi.fn(),
    setDragging: vi.fn(),
  }) as unknown as PlanContextValue;

// The board as a teammate's change delivers it: a fresh set-up object parsed off the wire, only its filter different.
const element = (filter?: BoardFilter): ShapeElement =>
  JSON.parse(
    JSON.stringify({
      id: 'b1',
      type: 'shape',
      shape: 'plan-board',
      x: 0,
      y: 0,
      width: 1400,
      height: 600,
      planBoard: {
        ...presetSetup('kanban'),
        widgets: ['count', 'due', 'points', 'priorities', 'unassigned'],
        ...(filter ? { filter } : {}),
      },
    }),
  ) as ShapeElement;

const BUSY_CARDS = ITEMS_MAX;
// Measured locally on this machine: see board-widgets blueprint "Performance and limits" for the numbers. jsdom draws
// every card a change shows (1,667 faces at 5,000 cards, 1.3 to 1.9 s; 667 at 2,000, 540 to 760 ms), where a browser
// draws only the runs near the view, so the budget follows the faces drawn; the counts above catch a second projection.
const FILTER_BUDGET_MS = 3000;

describe('A remote filter change on a busy board', () => {
  it(`projects once, recounts no widget and keeps the unfiltered cards (${BUSY_CARDS} cards)`, () => {
    const value = plan(BUSY_CARDS);
    const tree = (el: ShapeElement) => (
      <SelectionStoreProvider store={createSelectionStore()}>
        <PlanProvider value={value}>
          <PlanBoardView element={el} />
        </PlanProvider>
      </SelectionStoreProvider>
    );
    const r = render(tree(element({ priority: 'high' })));
    const change = (filter?: BoardFilter) => {
      counts.face = 0;
      counts.project = 0;
      counts.due = 0;
      counts.points = 0;
      const ms = cpuMsOf(() => act(() => r.rerender(tree(element(filter)))));
      return { ms, ...counts };
    };
    change({ priority: 'medium' }); // warm up
    const runs = [
      change({ priority: 'low' }),
      change({ priority: 'high' }),
      change({ priority: 'medium' }),
    ];
    // A change that leaves the same cards shown (every card is a Task) draws no card again.
    const same = change({ priority: 'medium', type: 'task' });
    // Read by `FILTER_PERF=1 vitest run …` to record the numbers in the blueprint.
    if (process.env['FILTER_PERF']) console.log('filter change', JSON.stringify({ runs, same }));
    expect(same.face).toBe(0);
    expect(same.project).toBe(1);
    for (const run of runs) {
      // One projection: the filtered one. The unfiltered one the widgets count is kept.
      expect(run.project).toBe(1);
      // No widget recounts: the cards they count are the same list.
      expect(run.due).toBe(0);
      expect(run.points).toBe(0);
      expect(run.ms).toBeLessThan(cpuBudgetMs(FILTER_BUDGET_MS));
    }
  }, 120_000);
});
