// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES } from '@livediagram/items';
import { AddCardPopover } from './AddCardPopover';

// docs/specs/026-plan/plan-board.md "Working on a board": Add a card closes on a press anywhere else (the canvas
// cancels its own pointerdown, so no mousedown ever comes) and on a wheel or trackpad pan outside it.
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({ useIsMobileViewport: () => false }));
afterEach(cleanup);

function menu() {
  const onClose = vi.fn();
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  render(<AddCardPopover anchor={anchor} types={ITEM_TYPES} onAdd={() => {}} onClose={onClose} />);
  return onClose;
}

describe('closing Add a card', () => {
  it('closes on a press elsewhere, even one the canvas cancels', () => {
    const onClose = menu();
    const canvas = document.createElement('div');
    canvas.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.body.appendChild(canvas);
    fireEvent.pointerDown(screen.getByRole('menuitem', { name: 'Task' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(canvas);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on a wheel outside it, not on one inside', () => {
    const onClose = menu();
    fireEvent.wheel(screen.getByRole('menuitem', { name: 'Task' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.wheel(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
