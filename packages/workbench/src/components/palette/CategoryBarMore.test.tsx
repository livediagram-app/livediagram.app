// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CategoryBarMore, MORE_CATEGORIES_LABEL } from './CategoryBarMore';

// docs/specs/007-editor/toolbar-layout.md "The strip's room": More lists the folded categories; choosing one opens its
// flyout under More.

afterEach(cleanup);

const folded = [
  { id: 'charts', label: 'Charts', icon: <svg /> },
  { id: 'icons', label: 'Icons', icon: <svg /> },
];

function setup(active = false) {
  const props = {
    register: vi.fn(),
    onOpenMenu: vi.fn(),
    onChoose: vi.fn(),
    onKeyDown: vi.fn(),
  };
  render(<CategoryBarMore folded={folded} active={active} {...props} />);
  return { ...props, button: screen.getByRole('button', { name: MORE_CATEGORIES_LABEL }) };
}

describe('CategoryBarMore', () => {
  it('registers itself with the bar and lists the folded categories on a press', () => {
    const { button, register, onOpenMenu, onChoose } = setup();
    expect(register).toHaveBeenCalledWith(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(onOpenMenu).toHaveBeenCalled();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Icons' }));
    expect(onChoose).toHaveBeenCalledWith('icons', true);
    expect(screen.queryByRole('menuitem', { name: 'Icons' })).toBeNull();
  });

  it('opens on Down, hands the other keys to the bar, and closes on a second press', () => {
    const { button, onKeyDown } = setup();
    fireEvent.keyDown(button, { key: 'ArrowLeft' });
    expect(onKeyDown).toHaveBeenCalled();
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Charts' })).toBeTruthy();
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('carries the open marker while a folded category is open', () => {
    const { button } = setup(true);
    expect(button.querySelector('.opacity-100')).toBeTruthy();
  });
});
