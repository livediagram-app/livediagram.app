// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, presetSetup } from '@liveplanner/items';
import { planPalette, type ShapeElement } from '@liveplanner/project';
import { PlanBoardView } from './PlanBoardView';
import { PlanProvider, type PlanContextValue } from './PlanContext';
import { CollapsedColumnHead } from './CollapsedColumn';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';

// docs/specs/026-plan/plan-board.md "Column heads stand clear" and "Column heads stick flush": the heads rest 12 px
// below the board's header, a gap that scrolls away, so a stuck head sits flush at the top of the scroll box; and a
// head is solid (its colour on the board's paper), so no card shows through it.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(cleanup);

const plan = {
  items: new Map(),
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
} as unknown as PlanContextValue;

const element = {
  id: 'b-sticky',
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y: 0,
  width: 1400,
  height: 600,
  planBoard: { ...presetSetup('kanban'), widgets: [] },
} as unknown as ShapeElement;

const draw = () =>
  render(
    <SelectionStoreProvider store={createSelectionStore()}>
      <PlanProvider value={plan}>
        <PlanBoardView element={element} />
      </PlanProvider>
    </SelectionStoreProvider>,
  );

const classes = (el: Element) => el.className.toString().split(/\s+/);

describe('a board’s column heads', () => {
  it('rest 12 px clear of the header in a gap that scrolls away, sticking flush at the top', () => {
    draw();
    const body = document.querySelector('.plan-scroll')!;
    // The scroll box has no top padding, which would inset where the heads stick.
    expect(classes(body).filter((c) => /^(p|pt|py)-/.test(c))).toEqual([]);
    // The grid inside it carries the gap, so it scrolls away with the cards.
    const grid = body.querySelector('.grid')!;
    expect(classes(grid)).toContain('pt-3');
    const heads = [...grid.querySelectorAll('[data-plan-column].sticky')];
    expect(heads.length).toBeGreaterThan(0);
    for (const head of heads) expect(classes(head)).toContain('top-0');
  });

  it('are solid on the board’s paper, while the cells keep their see-through colour', () => {
    draw();
    const paper = planPalette('light').surface;
    const heads = [...document.querySelectorAll<HTMLElement>('[data-plan-column].sticky')];
    for (const head of heads) expect(head.style.getPropertyValue('--plan-col-under')).toBe(paper);
    const cell = document.querySelector<HTMLElement>('[data-plan-status]:not(.sticky)')!;
    expect(cell.style.getPropertyValue('--plan-col-under')).toBe('');
  });

  it('a collapsed column’s head is solid too', () => {
    const palette = planPalette('dark');
    const { container } = render(
      <CollapsedColumnHead
        column={{ id: 'c', name: 'Done' }}
        palette={palette}
        onExpand={vi.fn()}
      />,
    );
    const head = container.querySelector<HTMLElement>('.sticky')!;
    expect(head.style.getPropertyValue('--plan-col-under')).toBe(palette.surface);
  });

  it('mix their colour into that paper (globals.css .plan-col), never into what is behind them', () => {
    const css = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8');
    const rule = css.slice(css.indexOf('@utility plan-col {'));
    const body = rule.slice(0, rule.indexOf('\n}\n'));
    // Both of its fills (resting and hovered) mix 85% of the colour into the head's paper, none into transparent.
    expect(body.match(/85%,\s*var\(--plan-col-under, transparent\)/g)).toHaveLength(2);
    expect(body).not.toMatch(/85%,\s*transparent/);
  });
});
