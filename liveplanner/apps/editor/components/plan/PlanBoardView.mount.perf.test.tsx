// @vitest-environment jsdom
// docs/specs/026-plan/plan-board.md "Cards out of view wait": opening a busy board builds only the cards near the
// view. A 2,000-card board's tab switch built every card's DOM (2.5 to 3.0 s in jsdom, the far ones then hidden);
// it now builds the runs near the view and a placeholder for each far run, inside a CPU budget (not wall-clock:
// docs/specs/003-system-architecture/testing.md).
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { ITEM_TYPES, presetSetup, type Item } from '@liveplanner/items';
import type { ShapeElement } from '@liveplanner/project';
import { PlanBoardView } from './PlanBoardView';
import { CARD_RUN_MAX } from './card-runs';
import { PlanProvider, type PlanContextValue } from './PlanContext';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';

const counts = vi.hoisted(() => ({ face: 0 }));
vi.mock('./PlanCardFace', async (orig) => {
  const m = (await orig()) as typeof import('./PlanCardFace');
  const Face = m.PlanCardFace;
  return {
    ...m,
    PlanCardFace: (p: Parameters<typeof Face>[0]) => {
      counts.face++;
      return Face(p);
    },
  };
});

const STATUSES = ['todo', 'doing', 'review', 'done'];
function items(n: number): Map<string, Item> {
  const m = new Map<string, Item>();
  for (let i = 0; i < n; i++)
    m.set(`i${i}`, {
      id: `i${i}`,
      key: i + 1,
      type: 'task',
      fields: {
        title: `Card number ${i + 1} with a reasonably long title`,
        status: STATUSES[i % STATUSES.length],
        priority: ['low', 'medium', 'high'][i % 3],
        labels: ['ui', 'api', 'bug'].slice(0, (i % 3) + 1),
        estimate: (i % 8) + 1,
        due: '2026-12-01',
      },
      rank: `a${String(i).padStart(5, '0')}`,
      createdAt: 0,
      updatedAt: 0,
      createdBy: { id: 'Sam', name: 'Sam', color: '#7c3aed' },
    } as unknown as Item);
  return m;
}

const plan = (n: number): PlanContextValue =>
  ({
    items: items(n),
    types: ITEM_TYPES,
    status: 'ready',
    self: null,
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
    createTypeForBoard: vi.fn(),
    announce: vi.fn(),
    setDragging: vi.fn(),
  }) as unknown as PlanContextValue;

const element = {
  id: 'b1',
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y: 0,
  width: 1400,
  height: 600,
  planBoard: { ...presetSetup('kanban'), widgets: [] },
} as unknown as ShapeElement;

const box = (top: number, height: number) =>
  ({ top, bottom: top + height, left: 0, right: 300, width: 300, height, x: 0, y: top }) as DOMRect;

// A browser's IntersectionObserver that never reports (the board's own first pass decides what is near), and runs
// laid one under another by the order they are first read: the first few sit in the body's 800 px view.
beforeEach(() => {
  class QuietIO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('IntersectionObserver', QuietIO);
  const tops = new WeakMap<Element, number>();
  let next = 0;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (!this.hasAttribute('data-plan-run')) return box(0, 800);
    let top = tops.get(this);
    if (top === undefined) {
      top = next;
      next += 400;
      tops.set(this, top);
    }
    return box(top, 400);
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const BUSY_CARDS = 2000;
// Measured locally: the mount built every card, 2,000 faces in 2.5 to 3.0 s of CPU; it now builds the near runs'
// cards (a few dozen) and a placeholder per far run. The budget still fails a mount that builds every card.
const MOUNT_BUDGET_MS = 1000;

describe('Opening a busy board', () => {
  it(`builds only the cards near the view (${BUSY_CARDS} cards)`, () => {
    const tree = (
      <SelectionStoreProvider store={createSelectionStore()}>
        <PlanProvider value={plan(BUSY_CARDS)}>
          <PlanBoardView element={element} />
        </PlanProvider>
      </SelectionStoreProvider>
    );
    counts.face = 0;
    let r: ReturnType<typeof render> | undefined;
    const ms = cpuMsOf(() => {
      r = render(tree);
    });
    const runs = r!.container.querySelectorAll('[data-plan-run]');
    const near = r!.container.querySelectorAll('[data-plan-run][data-plan-run-near]');
    const cards = r!.container.querySelectorAll('[data-plan-card]').length;
    console.info(
      `[mount] ${ms.toFixed(0)} ms, ${counts.face} faces, ${cards} cards, ${runs.length} runs`,
    );
    expect(runs.length).toBeGreaterThan(BUSY_CARDS / CARD_RUN_MAX);
    // The first runs, within a view's length of the 800 px view: each holds at most CARD_RUN_MAX cards.
    expect(near.length).toBeGreaterThan(0);
    expect(cards).toBeLessThanOrEqual(near.length * CARD_RUN_MAX);
    expect(counts.face).toBeLessThanOrEqual(near.length * CARD_RUN_MAX);
    // A far run keeps its card count for its held height, and names its cards so a card can be found and drawn.
    const far = r!.container.querySelector<HTMLElement>(
      '[data-plan-run]:not([data-plan-run-near])',
    )!;
    expect(far.children.length).toBe(0);
    expect(Number(far.style.getPropertyValue('--run-cards'))).toBeGreaterThan(0);
    expect(far.dataset.planRunIds?.split(' ').length).toBe(
      Number(far.style.getPropertyValue('--run-cards')),
    );
    expect(ms).toBeLessThan(cpuBudgetMs(MOUNT_BUDGET_MS));
  }, 120_000);
});
