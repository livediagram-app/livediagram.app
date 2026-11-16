// @vitest-environment jsdom
// docs/specs/026-plan/plan-board.md "A busy board": a Tab Style pick on a full board (ITEMS_MAX) redraws no card unless
// it changes what a card shows (a theme: each card once), inside a CPU budget (not wall-clock: a busy runner
// stretches wall time, not CPU; docs/specs/003-system-architecture/testing.md).
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { ITEMS_MAX, ITEM_TYPES, presetSetup, type Item } from '@liveplanner/items';
import type { Finish, ShapeElement } from '@liveplanner/project';
import { PlanBoardView } from './PlanBoardView';
import { CARD_RUN_MAX } from './card-runs';
import { PlanProvider, type PlanContextValue } from './PlanContext';
import { PlanTextScaleProvider } from './PlanTextScaleContext';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { stubBoardLayout } from '../../test/board-layout';
import { CanvasSurfaceProvider } from '@/components/canvas/CanvasSurfaceContext';
import { FaceFinishProvider } from '@liveworkspace/workbench/components/canvas/CanvasFinishContext';
import { markResponseOpened, resetFreshResponses } from '@/components/forms/fresh-responses';
import { FROM_FORM_FIELD } from '@liveplanner/forms';

const counts = vi.hoisted(() => ({ face: 0 }));
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

// The board is laid out as a browser lays it out (test/board-layout.ts): a busy board draws the runs near the view and
// a placeholder for each far one, where jsdom's zero-sized boxes would draw all 5,000 cards in every test.
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

const BUSY_CARDS = ITEMS_MAX;
// Measured locally, CPU time, at 5,000 cards (ITEMS_MAX). With every card drawn (jsdom's zero-sized boxes put every run
// near the view) a pick that redraws no card took 11-80 ms and a theme 2,010-2,470 ms alone, 4,170 ms inside the whole
// editor suite on a loaded machine, and each test mounted all 5,000 faces (5.7 to 9.5 s a test, 61 s under coverage).
// Laid out as a browser lays it out (test/board-layout.ts) the board mounts the near runs' faces alone: see the PR and
// the item-store blueprint for the numbers. The face counts catch any extra redraw; the budgets catch a redraw that
// costs far more per face or draws far runs.
const NO_CARD_BUDGET_MS = 250;
const THEME_BUDGET_MS = 1500;
// Far above the near runs' faces a browser draws (measured below), far below the 5,000 of every card.
const NEAR_FACES_MAX = 600;

describe('A Tab Style pick on a busy board', () => {
  it(`redraws only the cards it changes, inside its budget (${BUSY_CARDS} cards)`, async () => {
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
    await act(async () => {}); // the near runs' cards are drawn after the board's own commit
    const mounted = counts.face;
    // The cards a browser draws: the runs near the view, some but nowhere near all 5,000.
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(NEAR_FACES_MAX);
    const pick = async (next: Style) => {
      counts.face = 0;
      s = next;
      const ms = await cpuMsOfAsync(() =>
        act(async () => {
          r.rerender(tree(s));
        }),
      );
      return { ms, faces: counts.face };
    };
    await pick({ ...s, el: element() }); // warm up
    for (const next of [
      { ...s, el: element() }, // a backdrop or pattern: a new element, the same colours
      { ...s, finish: 'marker' as const },
      { ...s, finish: 'professional' as const },
      { ...s, finish: 'flexible' as const },
      { ...s, size: 'large' as const },
    ]) {
      const { ms, faces } = await pick(next);
      // Read by `BUSY_PERF=1 vitest run …` to record the numbers in the blueprint.
      if (process.env['BUSY_PERF']) console.log('pick', JSON.stringify({ ms, faces }));
      expect(faces).toBe(0);
      expect(ms).toBeLessThan(cpuBudgetMs(NO_CARD_BUDGET_MS));
    }
    for (const colours of [
      { strokeColor: '#0ea5e9', fillColor: '#f0f9ff' },
      { strokeColor: '#e11d48', fillColor: '#fff1f2' },
    ]) {
      const { ms, faces } = await pick({ ...s, el: element(colours) });
      if (process.env['BUSY_PERF']) console.log('theme', JSON.stringify({ ms, faces, mounted }));
      expect(faces).toBe(mounted);
      expect(ms).toBeLessThan(cpuBudgetMs(THEME_BUDGET_MS));
    }
  }, 120_000);

  // docs/specs/026-plan/plan-board.md "A drag stays smooth": picking a card up (the plan's dragging card, this person's
  // presence on it) changes nothing a card draws, so no card redraws; every card did.
  it('redraws no card as a card is picked up', async () => {
    const value = plan(BUSY_CARDS);
    const tree = (v: PlanContextValue) => (
      <SelectionStoreProvider store={createSelectionStore()}>
        <PlanProvider value={v}>
          <PlanBoardView element={element()} />
        </PlanProvider>
      </SelectionStoreProvider>
    );
    const r = render(tree(value));
    await act(async () => {});
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

  // docs/specs/026-plan/plan-board.md "A drag stays smooth": letting a card go in another column changes that card
  // alone (the store keeps every other card's object), so only it and the cards of the runs it leaves and joins
  // (card-runs.ts, CARD_RUN_MAX each) are drawn again; every card on the board was.
  it('redraws only the moved card and its runs as a card is dropped', async () => {
    const value = plan(BUSY_CARDS);
    const tree = (v: PlanContextValue) => (
      <SelectionStoreProvider store={createSelectionStore()}>
        <PlanProvider value={v}>
          <PlanBoardView element={element()} />
        </PlanProvider>
      </SelectionStoreProvider>
    );
    const r = render(tree(value));
    await act(async () => {});
    const moved = new Map(value.items);
    const card = moved.get('i1')!;
    moved.set('i1', { ...card, fields: { ...card.fields, status: 'review' } });
    counts.face = 0;
    await act(async () => {
      r.rerender(tree({ ...value, items: moved }));
    });
    expect(counts.face).toBeGreaterThan(0);
    expect(counts.face).toBeLessThanOrEqual(1 + 2 * CARD_RUN_MAX);
  }, 120_000);

  // docs/specs/030-forms/forms.md "Hearing about responses": opening a response's card takes its New mark off that
  // card alone; every card's face redrew (730 to 930 ms on 2,000 cards).
  it('redraws only the opened response’s card as a response is opened', async () => {
    resetFreshResponses();
    const value = plan(BUSY_CARDS);
    const now = Date.now();
    const all = value.items as Map<string, Item>;
    for (const [id, card] of all)
      if (Number(id.slice(1)) % 2 === 0)
        all.set(id, {
          ...card,
          createdAt: now,
          fields: { ...card.fields, [FROM_FORM_FIELD]: 'tab:3' },
        });
    render(
      <SelectionStoreProvider store={createSelectionStore()}>
        <PlanProvider value={value}>
          <PlanBoardView element={element()} />
        </PlanProvider>
      </SelectionStoreProvider>,
    );
    await act(async () => {});
    counts.face = 0;
    act(() => markResponseOpened(value.items.get('i2')!));
    expect(counts.face).toBeLessThanOrEqual(1);
    counts.face = 0;
    // A card no form made has no mark to change.
    act(() => markResponseOpened(value.items.get('i3')!));
    expect(counts.face).toBe(0);
  }, 120_000);

  // docs/specs/026-plan/plan-board.md "Cards out of view wait": a busy board's cards sit in runs the browser skips out
  // of view (card-runs.ts); a quiet board draws its cards straight in their lists.
  it('draws a busy board in runs, a quiet one without', () => {
    // No layout stand-in: every run reads as near in jsdom, so every card of the 400 is drawn, each inside its run.
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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
