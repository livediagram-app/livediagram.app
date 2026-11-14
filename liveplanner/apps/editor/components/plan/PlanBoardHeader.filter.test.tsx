// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, presetSetup, projectBoard, type BoardWidgetId } from '@liveplanner/items';
import { PlanBoardHeader } from './PlanBoardHeader';
import { planPalette } from './plan-palette';

// docs/specs/026-plan/board-widgets.md "The board's filter": taking a widget off takes its narrowing off the board's
// filter for everyone, in the same set-up write as the widgets (so neither write undoes the other).
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
afterEach(cleanup);

function header(widgets: BoardWidgetId[]) {
  const setup = { ...presetSetup('kanban'), widgets };
  const onWidgets = vi.fn();
  const onQuick = vi.fn();
  render(
    <PlanBoardHeader
      setup={setup}
      projection={projectBoard(setup, new Map())}
      items={[]}
      types={ITEM_TYPES}
      palette={planPalette('light', {})}
      quick={{ mine: 'p', type: 'task' }}
      onQuick={onQuick}
      canFilterMine="p"
      canEdit
      selected
      loadFailed={false}
      onWidgets={onWidgets}
      onSetup={vi.fn()}
      onOpenItem={vi.fn()}
      onRetry={vi.fn()}
      onReveal={vi.fn()}
      onMoveUnplaced={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit Widgets' }));
  return { onWidgets, onQuick };
}

describe('taking a widget off the board', () => {
  it('hands the filter without its narrowing along with the widgets, in one write', () => {
    const { onWidgets, onQuick } = header(['mine', 'types', 'count']);
    fireEvent.click(screen.getByRole('button', { name: /^Remove Only Mine/ }));
    expect(onWidgets).toHaveBeenCalledWith(['types', 'count'], { type: 'task' });
    expect(onQuick).not.toHaveBeenCalled();
  });

  it('leaves the filter alone when the widget narrowed nothing', () => {
    const { onWidgets } = header(['mine', 'types', 'count']);
    fireEvent.click(screen.getByRole('button', { name: /^Remove Item Count/ }));
    expect(onWidgets).toHaveBeenCalledWith(['mine', 'types'], undefined);
  });
});
