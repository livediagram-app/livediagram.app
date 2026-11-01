// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES } from '@liveplanner/items';
import { AddCardPopover } from './AddCardPopover';

// docs/specs/026-plan/plan-board.md "Working on a board": on a phone Add a card is a bottom sheet, closed as every
// menu is, by Escape or a tap outside it, starting on its first choice.
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => true,
}));
afterEach(cleanup);

function sheet() {
  const onClose = vi.fn();
  const anchor = document.createElement('button');
  anchor.setAttribute('data-add-card-trigger', '');
  document.body.appendChild(anchor);
  render(<AddCardPopover anchor={anchor} types={ITEM_TYPES} onAdd={() => {}} onClose={onClose} />);
  return { onClose, anchor };
}

describe('Add a card on a phone', () => {
  it('starts on its first choice and closes on Escape, focus back on its button', () => {
    const { onClose, anchor } = sheet();
    expect(screen.getByRole('dialog', { name: 'Add a card' })).toBeTruthy();
    const first = screen.getByRole('dialog', { name: 'Add a card' }).querySelector('[data-option]');
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(anchor);
  });

  it('closes on a tap outside, not on one inside or on its own button', () => {
    const { onClose, anchor } = sheet();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Task' }));
    fireEvent.pointerDown(anchor);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
