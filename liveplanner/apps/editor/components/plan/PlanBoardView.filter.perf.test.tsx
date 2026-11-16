// @vitest-environment jsdom
// docs/specs/026-plan/board-widgets.md "The board's filter" (Work Tracker 881, 882): a filter change arriving from a
// teammate re-projects every open copy of the board, so on a full board (ITEMS_MAX) it must cost one filtered projection:
// the unfiltered projection the widgets count is kept, the widgets do not recount, and only the cards the filter
// shows or hides are drawn. Inside a CPU budget (not wall-clock: docs/specs/003-system-architecture/testing.md).
import { Profiler } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
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
import { stubBoardLayout } from '../../test/board-layout';

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

// The board is laid out as a browser lays it out (test/board-layout.ts): a busy board draws the runs near the view and
// a placeholder for each far one, where jsdom's zero-sized boxes would draw every card a change shows.
beforeEach(stubBoardLayout);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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
// Measured locally, CPU time: with every card drawn (jsdom's zero-sized boxes put every run near the view) a change drew
// 1,667 faces in 1.6 to 2.1 s at 5,000 cards; laid out as a browser lays it out (test/board-layout.ts) it draws the near
// runs' 66 to 78 faces in 110 to 260 ms, as a browser would. The budget still fails a change that draws every card (a
// run's far cards built again is 20x the faces); the counts catch a second projection or a widget recounting.
const FILTER_BUDGET_MS = 1000;
// A change redraws the near runs' cards, not the board's: far above the measured 78, far below the 1,667 of every card.
const NEAR_FACES_MAX = 400;

describe('A remote filter change on a busy board', () => {
  it(`projects once, recounts no widget and keeps the unfiltered cards (${BUSY_CARDS} cards)`, async () => {
    const value = plan(BUSY_CARDS);
    const tree = (el: ShapeElement) => (
      <SelectionStoreProvider store={createSelectionStore()}>
        <PlanProvider value={value}>
          <PlanBoardView element={el} />
        </PlanProvider>
      </SelectionStoreProvider>
    );
    const r = render(tree(element({ priority: 'high' })));
    await act(async () => {}); // the near runs' cards are drawn after the board's own commit
    const change = async (filter?: BoardFilter) => {
      counts.face = 0;
      counts.project = 0;
      counts.due = 0;
      counts.points = 0;
      // The change and the transition that draws the near runs' cards after it (mount.perf's "A big board's first draw").
      const ms = await cpuMsOfAsync(() =>
        act(async () => {
          r.rerender(tree(element(filter)));
        }),
      );
      return { ms, ...counts };
    };
    await change({ priority: 'medium' }); // warm up
    const runs = [
      await change({ priority: 'low' }),
      await change({ priority: 'high' }),
      await change({ priority: 'medium' }),
    ];
    // A change that leaves the same cards shown (every card is a Task) draws no card again.
    const same = await change({ priority: 'medium', type: 'task' });
    // Read by `FILTER_PERF=1 vitest run …` to record the numbers in the blueprint.
    if (process.env['FILTER_PERF']) console.log('filter change', JSON.stringify({ runs, same }));
    expect(same.face).toBe(0);
    expect(same.project).toBe(1);
    for (const run of runs) {
      // One projection: the filtered one. The unfiltered one the widgets count is kept.
      expect(run.project).toBe(1);
      // Only the cards a browser would draw: some (the near runs are redrawn), never the whole filtered board.
      expect(run.face).toBeGreaterThan(0);
      expect(run.face).toBeLessThan(NEAR_FACES_MAX);
      // No widget recounts: the cards they count are the same list.
      expect(run.due).toBe(0);
      expect(run.points).toBe(0);
      expect(run.ms).toBeLessThan(cpuBudgetMs(FILTER_BUDGET_MS));
    }
  }, 120_000);
});

// Work Tracker 909: on a production build at 4x CPU, narrowing 2,000 cards to 667 was one 51 to 80 ms task. The
// projection reads a deferred copy of the filter, so the change first commits with the cards as they were (the filter
// bar's own render), then commits the narrowed cards as a render React may yield in.
describe('A filter change on a board', () => {
  it('draws the narrowed cards in a later, deferred commit', () => {
    const value = plan(40);
    // The cards on the board at each commit.
    const drawn: number[] = [];
    const tree = (el: ShapeElement) => (
      <Profiler
        id="board"
        onRender={() => drawn.push(document.querySelectorAll('[data-plan-card]').length)}
      >
        <SelectionStoreProvider store={createSelectionStore()}>
          <PlanProvider value={value}>
            <PlanBoardView element={el} />
          </PlanProvider>
        </SelectionStoreProvider>
      </Profiler>
    );
    const r = render(tree(element()));
    const all = document.querySelectorAll('[data-plan-card]').length;
    drawn.length = 0;
    counts.project = 0;
    act(() => r.rerender(tree(element({ priority: 'high' }))));
    const narrowed = document.querySelectorAll('[data-plan-card]').length;
    expect(narrowed).toBeLessThan(all);
    expect(drawn[0]).toBe(all);
    expect(drawn.at(-1)).toBe(narrowed);
    expect(counts.project).toBe(1);
  });
});
