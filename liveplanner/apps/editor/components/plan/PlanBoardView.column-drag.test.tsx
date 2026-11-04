// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, presetSetup, type Item, type PlanBoardSetup } from '@liveplanner/items';
import type { ShapeElement } from '@liveplanner/project';
import { PlanBoardView } from './PlanBoardView';
import { PlanProvider, type PlanContextValue } from './PlanContext';
import { DashboardContext, type DashboardContextValue } from './dashboard/dashboard-context';
import { SlotSettings, type SlotSettingsValue } from './dashboard/slot-menu';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { COLUMN_DRAG_SHIELD_ATTR } from './useColumnDrag';
import { track } from '@/lib/telemetry';

// docs/specs/026-plan/plan-board.md "Drag a column": an Editor drags a column head, or presses Alt+Shift+Left/Right on
// it, to reorder the board's columns (one set-up change, announced); a Participant and a Viewer get no handle; a
// finger, a slot board, Escape and a let-go outside the board change nothing.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(async () => {
  // The click a let-go swallows is let go on the next task (useColumnDrag), as a browser's click would come.
  await new Promise((r) => setTimeout(r, 0));
  cleanup();
  vi.unstubAllGlobals();
  vi.mocked(track).mockClear();
  localStorage.clear();
});

const card = (id: string, key: number, status: string): Item =>
  ({
    id,
    key,
    type: 'task',
    fields: { title: `Card ${key}`, status },
    rank: `a${key}`,
    createdAt: 0,
    updatedAt: 0,
  }) as unknown as Item;
const CARDS = [card('i1', 1, 'todo'), card('i2', 2, 'doing')];

const plan = (over: Partial<PlanContextValue> = {}): PlanContextValue =>
  ({
    items: new Map(CARDS.map((c) => [c.id, c])),
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
    ...over,
  }) as unknown as PlanContextValue;

const KANBAN = presetSetup('kanban');
const IDS = KANBAN.columns.map((c) => c.id);
const NAMES = KANBAN.columns.map((c) => c.name);

const element = (setup: PlanBoardSetup = KANBAN): ShapeElement =>
  ({
    id: 'b-drag',
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 1400,
    height: 600,
    planBoard: { ...setup, widgets: [] },
  }) as unknown as ShapeElement;

const SLOT: SlotSettingsValue = { sections: () => null, cog: null, toolbar: () => null };

const draw = (value = plan(), opts: { dashboard?: boolean; setup?: PlanBoardSetup } = {}) => {
  const wrap = (children: ReactNode) =>
    opts.dashboard ? (
      <DashboardContext.Provider value={{} as DashboardContextValue}>
        <SlotSettings.Provider value={SLOT}>{children}</SlotSettings.Provider>
      </DashboardContext.Provider>
    ) : (
      children
    );
  render(
    <SelectionStoreProvider store={createSelectionStore()}>
      <PlanProvider value={value}>
        {wrap(<PlanBoardView element={element(opts.setup)} />)}
      </PlanProvider>
    </SelectionStoreProvider>,
  );
  layOut();
  return value;
};

// jsdom lays nothing out: each column 200 px wide with 12 px between, the board a 1400 by 600 box at the origin.
const WIDTH = 200;
const PITCH = 212;
function layOut() {
  const grid = document.querySelector<HTMLElement>('[data-plan-board] .grid')!;
  Object.defineProperty(grid, 'offsetWidth', { configurable: true, value: PITCH * IDS.length });
  grid.style.columnGap = `${PITCH - WIDTH}px`;
  for (const el of document.querySelectorAll<HTMLElement>('[data-plan-column]')) {
    const i = IDS.indexOf(el.getAttribute('data-plan-column')!);
    Object.defineProperty(el, 'offsetLeft', { configurable: true, value: i * PITCH });
    Object.defineProperty(el, 'offsetWidth', { configurable: true, value: WIDTH });
  }
  const board = document.querySelector<HTMLElement>('[data-plan-board]')!;
  board.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 1400, bottom: 600, width: 1400, height: 600 }) as DOMRect;
}

const head = (name: string) => screen.getByRole('group', { name: new RegExp(`^${name} column`) });
// Carried: the closed-hand layer is up over the page.
const carried = () => !!document.querySelector(`[${COLUMN_DRAG_SHIELD_ATTR}]`);
const heads = () => document.querySelectorAll('[data-plan-column-head]');

// A pointer event on the window (jsdom has no PointerEvent): a mouse's, pointer 1.
const pointer = (type: string, clientX: number, clientY = 20) => {
  const e = new MouseEvent(type, { clientX, clientY, bubbles: true });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  act(() => {
    window.dispatchEvent(e);
  });
};
const press = (el: HTMLElement, clientX: number, pointerType = 'mouse') =>
  fireEvent.pointerDown(el, { button: 0, clientX, clientY: 20, pointerId: 1, pointerType });

const written = (value: PlanContextValue) =>
  vi.mocked(value.updateBoard).mock.calls.map(([, next]) => next.columns.map((c) => c.id));

describe('dragging a column head', () => {
  it('moves the column to where it is let go, as one set-up change, announced', () => {
    const value = draw();
    // The first column's head carried past the second and third columns' middles.
    press(head(NAMES[0]!), 100);
    pointer('pointermove', 102);
    expect(carried()).toBe(false);
    pointer('pointermove', 110);
    expect(carried()).toBe(true);
    pointer('pointermove', 100 + PITCH * 2 + 10);
    pointer('pointerup', 100 + PITCH * 2 + 10);
    expect(written(value)).toEqual([[IDS[1], IDS[2], IDS[0], ...IDS.slice(3)]]);
    expect(value.announce).toHaveBeenCalledWith(`Moved ${NAMES[0]} to position 3 of ${IDS.length}`);
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'ColumnReordered');
    expect(carried()).toBe(false);
  });

  it('moves a column left too', () => {
    const value = draw();
    const last = IDS.length - 1;
    press(head(NAMES[last]!), 1000);
    pointer('pointermove', 1000 - PITCH - 10);
    pointer('pointerup', 1000 - PITCH - 10);
    expect(written(value)).toEqual([[...IDS.slice(0, last - 1), IDS[last], IDS[last - 1]]]);
  });

  it('stays a press under 4 px, and writes nothing let go where it started', () => {
    const value = draw();
    press(head(NAMES[1]!), 300);
    pointer('pointermove', 302);
    pointer('pointerup', 302);
    press(head(NAMES[1]!), 300);
    pointer('pointermove', 330);
    pointer('pointermove', 300);
    pointer('pointerup', 300);
    expect(value.updateBoard).not.toHaveBeenCalled();
    expect(value.announce).not.toHaveBeenCalled();
  });

  it('puts the column back on Escape, and the Escape goes no further', () => {
    const value = draw();
    const outer = vi.fn();
    window.addEventListener('keydown', outer);
    press(head(NAMES[0]!), 100);
    pointer('pointermove', 100 + PITCH * 2);
    fireEvent.keyDown(window, { key: 'Escape' });
    pointer('pointerup', 100 + PITCH * 2);
    window.removeEventListener('keydown', outer);
    expect(outer).not.toHaveBeenCalled();
    expect(value.updateBoard).not.toHaveBeenCalled();
    expect(carried()).toBe(false);
  });

  it('puts it back when let go outside the board, or when the pointer is lost', () => {
    const value = draw();
    press(head(NAMES[0]!), 100);
    pointer('pointermove', 100 + PITCH * 2);
    pointer('pointerup', 100 + PITCH * 2, 900);
    press(head(NAMES[0]!), 100);
    pointer('pointermove', 100 + PITCH * 2);
    pointer('pointercancel', 100 + PITCH * 2);
    pointer('pointerup', 100 + PITCH * 2);
    expect(value.updateBoard).not.toHaveBeenCalled();
  });

  it('never picks a column up by its buttons or by a finger', () => {
    const value = draw();
    press(screen.getByRole('button', { name: `${NAMES[0]} column settings` }), 100);
    pointer('pointermove', 100 + PITCH * 2);
    pointer('pointerup', 100 + PITCH * 2);
    press(head(NAMES[0]!), 100, 'touch');
    pointer('pointermove', 100 + PITCH * 2);
    pointer('pointerup', 100 + PITCH * 2);
    expect(value.updateBoard).not.toHaveBeenCalled();
  });

  it('moves the columns by animation alone while carried: no style written, the others aside once', () => {
    // Web Animations stand-ins: each records its keyframes; a cancelled one is gone.
    const made: { el: Element; frames: Keyframe[]; cancelled: boolean }[] = [];
    const animate = vi.fn(function (this: Element, frames: Keyframe[]) {
      const rec = { el: this, frames, cancelled: false };
      made.push(rec);
      return {
        effect: { setKeyframes: (next: Keyframe[]) => (rec.frames = next) },
        cancel: () => (rec.cancelled = true),
      } as unknown as Animation;
    });
    const was = HTMLElement.prototype.animate;
    HTMLElement.prototype.animate = animate;
    try {
      const value = draw();
      const parts = (id: string) =>
        [...document.querySelectorAll(`[data-plan-column="${id}"]`)].map((el) =>
          el.getAttribute('style'),
        );
      const before = IDS.map(parts);
      press(head(NAMES[0]!), 100);
      pointer('pointermove', 110);
      pointer('pointermove', 100 + PITCH + 20);
      pointer('pointerup', 100 + PITCH + 20);
      // The carried column's parts (its head and its cell) lift and follow, sideways only.
      const lifted = made.filter((m) => m.el.getAttribute('data-plan-column') === IDS[0]);
      expect(lifted.length).toBeGreaterThanOrEqual(2);
      expect(String(lifted[0]!.frames[0]!.transform)).toMatch(
        /^translate3d\(\d+(\.\d+)?px, -2px, 0\)/,
      );
      // The column passed glides aside once, by the carried column's width and a gap.
      const aside = made.filter((m) => m.el.getAttribute('data-plan-column') === IDS[1]);
      expect(aside.map((m) => m.frames[1]!.transform)).toEqual(
        aside.map(() => `translateX(${-PITCH}px)`),
      );
      // No other column moved, no style attribute changed, and every drag animation was let go.
      expect(
        made.every((m) => [IDS[0], IDS[1]].includes(m.el.getAttribute('data-plan-column')!)),
      ).toBe(true);
      expect(IDS.map(parts)).toEqual(before);
      expect(made.every((m) => m.cancelled || m.frames.length === 2)).toBe(true);
      expect(written(value)).toEqual([[IDS[1], IDS[0], ...IDS.slice(2)]]);
    } finally {
      HTMLElement.prototype.animate = was;
    }
  });

  it('is off on a Dashboard slot’s compact board', () => {
    draw(plan(), { dashboard: true });
    expect(heads()).toHaveLength(0);
  });
});

describe('the keyboard on a column head', () => {
  it('moves the column with Alt+Shift+Right and Left, keeping focus on its head', () => {
    const value = draw();
    const first = head(NAMES[0]!);
    expect(first.tabIndex).toBe(0);
    expect(first.getAttribute('aria-keyshortcuts')).toBe(
      'Alt+Shift+ArrowLeft Alt+Shift+ArrowRight',
    );
    expect(first.getAttribute('aria-label')).toBe(
      `${NAMES[0]} column, position 1 of ${IDS.length}`,
    );
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight', altKey: true, shiftKey: true });
    expect(written(value)).toEqual([[IDS[1], IDS[0], ...IDS.slice(2)]]);
    expect(value.announce).toHaveBeenLastCalledWith(
      `Moved ${NAMES[0]} to position 2 of ${IDS.length}`,
    );
    expect(document.activeElement?.getAttribute('data-plan-column-head')).toBe(IDS[0]);
    // From its cog too.
    fireEvent.keyDown(screen.getByRole('button', { name: `${NAMES[1]} column settings` }), {
      key: 'ArrowLeft',
      altKey: true,
      shiftKey: true,
    });
    expect(written(value)[1]).toEqual([IDS[1], ...IDS.filter((id) => id !== IDS[1])]);
  });

  it('refuses past the ends and says so, and leaves other keys alone', () => {
    const value = draw();
    fireEvent.keyDown(head(NAMES[0]!), { key: 'ArrowLeft', altKey: true, shiftKey: true });
    expect(value.announce).toHaveBeenLastCalledWith(`${NAMES[0]} is already the first column`);
    const last = IDS.length - 1;
    fireEvent.keyDown(head(NAMES[last]!), { key: 'ArrowRight', altKey: true, shiftKey: true });
    expect(value.announce).toHaveBeenLastCalledWith(`${NAMES[last]} is already the last column`);
    fireEvent.keyDown(head(NAMES[1]!), { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(head(NAMES[1]!), { key: 'ArrowRight', altKey: true });
    expect(value.updateBoard).not.toHaveBeenCalled();
  });

  it('announces Move Left and Move Right in the column’s settings as well', () => {
    const value = draw();
    fireEvent.click(screen.getByRole('button', { name: `${NAMES[1]} column settings` }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Left (Alt+Shift+Left)' }));
    expect(written(value)).toEqual([[IDS[1], IDS[0], ...IDS.slice(2)]]);
    expect(value.announce).toHaveBeenCalledWith(`Moved ${NAMES[1]} to position 1 of ${IDS.length}`);
  });
});

describe('share roles', () => {
  it.each([
    ['a Participant', { canEdit: false, canEditCards: true }],
    ['a Viewer', { canEdit: false, canEditCards: false }],
  ])('gives %s no handle: no hand, no tab stop, no drag, no keys', (_, over) => {
    const value = draw(plan(over));
    expect(heads()).toHaveLength(0);
    const first = document.querySelector<HTMLElement>(`[data-plan-column="${IDS[0]}"]`)!;
    expect(first.className).not.toContain('cursor-grab');
    expect(first.hasAttribute('tabindex')).toBe(false);
    press(first, 100);
    pointer('pointermove', 100 + PITCH * 2);
    pointer('pointerup', 100 + PITCH * 2);
    fireEvent.keyDown(first, { key: 'ArrowRight', altKey: true, shiftKey: true });
    expect(value.updateBoard).not.toHaveBeenCalled();
    expect(carried()).toBe(false);
  });

  it('gives an Editor the open hand on every head', () => {
    draw();
    expect(heads()).toHaveLength(IDS.length);
    for (const h of heads()) expect(h.className).toContain('cursor-grab');
  });
});
