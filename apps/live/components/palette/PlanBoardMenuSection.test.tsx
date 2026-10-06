// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livediagram/document';
import { presetSetup } from '@livediagram/items';
import { PlanBoardMenuSection } from './PlanBoardMenuSection';

// docs/specs/012-collaboration/presentation-mode.md "Board slides": the Board flyout adds the whole board
// to the slides.
const plan: Record<string, unknown> = {};
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@/components/primitives/MenuFlyoutSection', () => ({
  MenuFlyoutSection: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

afterEach(cleanup);

const board = {
  ...createShape('plan-board', 0, 0),
  id: 'board',
  planBoard: presetSetup('kanban'),
} as ShapeElement;

function show(overrides: Record<string, unknown>) {
  for (const key of Object.keys(plan)) delete plan[key];
  Object.assign(plan, { canEdit: true, updateBoard: vi.fn(), announce: vi.fn() }, overrides);
  render(<PlanBoardMenuSection element={board} flyoutProps={{} as never} />);
}

describe('PlanBoardMenuSection', () => {
  it('adds the board to the slides and says so', () => {
    const addBoardSlide = vi.fn();
    show({ addBoardSlide });
    fireEvent.click(screen.getByRole('button', { name: 'Add to Slides' }));
    expect(addBoardSlide).toHaveBeenCalledWith('board');
    expect(plan['announce']).toHaveBeenCalledWith('Board added to the slides');
  });

  it('offers no slide where there is no deck to add to', () => {
    show({});
    expect(screen.queryByRole('button', { name: 'Add to Slides' })).toBeNull();
  });
});
