// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TableElement } from '@livediagram/document';
import { TableView } from './TableView';

// Touch keeps the ⋯ triggers on screen without a hover (TableAxisTriggers).
vi.mock('@liveworkspace/workbench/lib/responsive', async (load) => ({
  ...(await load<object>()),
  isMobileViewportSync: () => true,
}));

const table = {
  id: 't',
  type: 'table',
  x: 0,
  y: 0,
  width: 200,
  height: 80,
  cells: [
    ['a', 'b'],
    ['c', 'd'],
  ],
} as TableElement;

// docs/specs/004-interface-design/menus.md: the column / row ⋯ menu is a command menu.
describe('TableView column and row menu', () => {
  it('opens as a menu of items, takes focus, and closes on Escape back to its trigger', async () => {
    render(
      <TableView
        element={table}
        isSelected
        readOnly={false}
        tabSummaries={[]}
        onCommitTable={vi.fn()}
      />,
    );
    const trigger = screen.getAllByRole('button', { name: 'Column options' })[0]!;
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    trigger.focus();
    act(() => {
      fireEvent.click(trigger);
    });
    const menu = await screen.findByRole('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const items = screen.getAllByRole('menuitem').map((i) => i.textContent);
    expect(items).toEqual(['Insert Left', 'Insert Right', 'Move Left', 'Move Right', 'Delete Column']);
    // The first column cannot move left: still an item (the arrow keys reach it), marked disabled.
    expect(screen.getByRole('menuitem', { name: 'Move Left' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(menu.contains(document.activeElement)).toBe(true);
    act(() => {
      fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
