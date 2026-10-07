// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livediagram/document';
import { ITEM_TYPES, presetSetup } from '@livediagram/items';
import { BoardSettingsButton } from './BoardSettingsButton';
import { planPalette } from './plan-palette';

// docs/specs/026-plan/plan-board.md "The board set-up": a board's own settings cog.
const plan: Record<string, unknown> = {};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(cleanup);

const element = {
  ...createShape('plan-board', 0, 0),
  planBoard: presetSetup('kanban'),
} as ShapeElement;

describe('a board’s settings cog', () => {
  it('opens on Board, one section at a time, and closes on Escape', () => {
    Object.assign(plan, {
      canEdit: true,
      types: ITEM_TYPES,
      updateBoard: vi.fn(),
      announce: vi.fn(),
    });
    render(<BoardSettingsButton element={element} palette={planPalette('light')} />);
    const cog = screen.getByRole('button', { name: 'Board Settings' });
    fireEvent.click(cog);
    expect(screen.getByLabelText('Board title')).toBeTruthy();
    expect(screen.queryByText('Card Size')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cards', expanded: false }));
    expect(screen.getByText('Card Size')).toBeTruthy();
    expect(screen.queryByLabelText('Board title')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Board', expanded: false }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByLabelText('Board title')).toBeNull();
  });
});
