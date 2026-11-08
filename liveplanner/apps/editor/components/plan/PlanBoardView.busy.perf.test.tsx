// @vitest-environment jsdom
// docs/specs/026-plan/plan-board.md "A busy board": a Tab Style pick on a 2,000-card board redraws no card unless
// it changes what a card shows (a theme: each card once), inside a CPU budget (not wall-clock: a busy runner
// stretches wall time, not CPU; docs/specs/003-system-architecture/testing.md).
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { ITEM_TYPES, presetSetup, type Item } from '@liveplanner/items';
import type { Finish, ShapeElement } from '@liveplanner/project';
import { PlanBoardView } from './PlanBoardView';
import { PlanProvider, type PlanContextValue } from './PlanContext';
import { PlanTextScaleProvider } from './PlanTextScaleContext';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { CanvasSurfaceProvider } from '@/components/canvas/CanvasSurfaceContext';
import { FaceFinishProvider } from '@/components/canvas/CanvasFinishContext';

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
        labels: ['ui', 'api', 'bug'].slice(0, (i % 3) + 1),
        estimate: (i % 8) + 1,
        due: '2026-12-01',
        description: 'Some words',
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

const element = (over: Partial<ShapeElement> = {}): ShapeElement =>
  ({
    id: 'b1',
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 1400,
    height: 600,
    planBoard: { ...presetSetup('kanban'), widgets: [], swimlaneBy: 'assignee' },
    ...over,
  }) as unknown as ShapeElement;

type Style = {
  el: ShapeElement;
  finish: Finish;
  size: 'small' | 'medium' | 'large';
  surface: 'light' | 'dark';
};

const BUSY_CARDS = 2000;
// Measured locally: a pick that redraws no card 15-60 ms (it was 1,100-2,300 ms, redrawing every card), a theme
// 730-930 ms (every card once, as it must). CI's coverage run measured a theme at 6,906 ms of CPU, past the old 2,000
// (scaled to 6,000 there); 3,000 still fails a theme that redraws the board several times over.
const NO_CARD_BUDGET_MS = 250;
const THEME_BUDGET_MS = 3000;

describe('A Tab Style pick on a busy board', () => {
  it(`redraws only the cards it changes, inside its budget (${BUSY_CARDS} cards)`, () => {
    const value = plan(BUSY_CARDS);
    const store = createSelectionStore();
    const tree = (s: Style) => (
      <SelectionStoreProvider store={store}>
        <PlanProvider value={value}>
          <CanvasSurfaceProvider surface={s.surface}>
            <FaceFinishProvider finish={s.finish}>
              <PlanTextScaleProvider size={s.size as never}>
                <PlanBoardView element={s.el} />
              </PlanTextScaleProvider>
            </FaceFinishProvider>
          </CanvasSurfaceProvider>
        </PlanProvider>
      </SelectionStoreProvider>
    );
    let s: Style = { el: element(), finish: 'flexible', size: 'medium', surface: 'light' };
    const r = render(tree(s));
    const mounted = counts.face;
    expect(mounted).toBeGreaterThan(BUSY_CARDS / 2);
    const pick = (next: Style) => {
      counts.face = 0;
      s = next;
      const ms = cpuMsOf(() => act(() => r.rerender(tree(s))));
      return { ms, faces: counts.face };
    };
    pick({ ...s, el: element() }); // warm up
    for (const next of [
      { ...s, el: element() }, // a backdrop or pattern: a new element, the same colours
      { ...s, finish: 'marker' as const },
      { ...s, finish: 'professional' as const },
      { ...s, finish: 'flexible' as const },
      { ...s, size: 'large' as const },
    ]) {
      const { ms, faces } = pick(next);
      expect(faces).toBe(0);
      expect(ms).toBeLessThan(cpuBudgetMs(NO_CARD_BUDGET_MS));
    }
    for (const colours of [
      { strokeColor: '#0ea5e9', fillColor: '#f0f9ff' },
      { strokeColor: '#e11d48', fillColor: '#fff1f2' },
    ]) {
      const { ms, faces } = pick({ ...s, el: element(colours) });
      expect(faces).toBe(mounted);
      expect(ms).toBeLessThan(cpuBudgetMs(THEME_BUDGET_MS));
    }
  }, 120_000);

  // docs/specs/026-plan/plan-board.md "A drag stays smooth": picking a card up (the plan's dragging card, this person's
  // presence on it) changes nothing a card draws, so no card redraws; every card did.
  it('redraws no card as a card is picked up', () => {
    const value = plan(BUSY_CARDS);
    const tree = (v: PlanContextValue) => (
      <SelectionStoreProvider store={createSelectionStore()}>
        <PlanProvider value={v}>
          <PlanBoardView element={element()} />
        </PlanProvider>
      </SelectionStoreProvider>
    );
    const r = render(tree(value));
    counts.face = 0;
    r.rerender(
      tree({
        ...value,
        draggingItemId: 'i1',
        presence: new Map([['i1', { name: 'Sam', color: '#7c3aed' }]]),
      } as unknown as PlanContextValue),
    );
    // Only the card the presence ring is on.
    expect(counts.face).toBeLessThanOrEqual(1);
  }, 120_000);

  // docs/specs/026-plan/plan-board.md "Cards out of view wait": a busy board's cards sit in runs the browser skips out
  // of view (card-runs.ts); a quiet board draws its cards straight in their lists.
  it('draws a busy board in runs, a quiet one without', () => {
    const tree = (n: number) => (
      <SelectionStoreProvider store={createSelectionStore()}>
        <PlanProvider value={plan(n)}>
          <PlanBoardView element={element({ id: `b${n}` })} />
        </PlanProvider>
      </SelectionStoreProvider>
    );
    const busy = render(tree(400));
    const cards = [...busy.container.querySelectorAll('[data-plan-card]')];
    expect(cards.length).toBeGreaterThan(100);
    expect(cards.every((c) => c.parentElement?.hasAttribute('data-plan-run'))).toBe(true);
    busy.unmount();
    const quiet = render(tree(40));
    expect(quiet.container.querySelectorAll('[data-plan-card]').length).toBeGreaterThan(0);
    expect(quiet.container.querySelector('[data-plan-run]')).toBeNull();
  }, 60_000);
});
