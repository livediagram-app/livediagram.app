// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaletteTabBar } from './PaletteTabBar';

// docs/specs/026-plan/plan-board.md "Maximised board": while a board covers the canvas the palette offers only Cards
// and opens it; the category the person had comes back when the board is restored.
vi.mock('@/components/palette/PaletteDropdown', () => ({
  PaletteDropdown: ({ value }: { value: string }) => <span data-testid="picked">{value}</span>,
}));
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  },
);
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const tab = (id: string) => ({
  id,
  label: id,
  description: id,
  icon: null,
  content: <p>{`${id} tiles`}</p>,
});
const all = [tab('plan-cards'), tab('plan-boards'), tab('plan-content')];

describe('PaletteTabBar while the canvas is covered', () => {
  it('shows Cards, then the category chosen before', () => {
    localStorage.setItem('k', 'plan-boards');
    const { rerender } = render(<PaletteTabBar tabs={all} storageKey="k" />);
    expect(screen.getByText('plan-boards tiles')).toBeTruthy();
    rerender(<PaletteTabBar tabs={[tab('plan-cards')]} storageKey="k" />);
    expect(screen.getByText('plan-cards tiles')).toBeTruthy();
    expect(screen.getByTestId('picked').textContent).toBe('plan-cards');
    // The choice is kept, not overwritten by Cards.
    expect(localStorage.getItem('k')).toBe('plan-boards');
    rerender(<PaletteTabBar tabs={all} storageKey="k" />);
    expect(screen.getByText('plan-boards tiles')).toBeTruthy();
  });
});
