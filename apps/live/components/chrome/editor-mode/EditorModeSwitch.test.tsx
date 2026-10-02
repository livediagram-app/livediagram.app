// @vitest-environment jsdom

// The mode switch's four prototype variants (docs/specs/007-editor/editor-modes.md
// "The mode switch"): each exposes its state to assistive technology through its
// own ARIA pattern and is fully operable by keyboard.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorModeSwitch } from './EditorModeSwitch';
import type { EditorMode } from '@livediagram/document';
import type { ModeSwitchVariant } from './mode-switch-variant';

afterEach(cleanup);

function renderSwitch(variant: ModeSwitchVariant, mode: EditorMode, hidden = false) {
  const onChange = vi.fn<(mode: EditorMode) => void>();
  const view = render(
    <EditorModeSwitch variant={variant} mode={mode} onChange={onChange} hidden={hidden} />,
  );
  return { onChange, ...view };
}

describe('EditorModeSwitch variant A (segmented pill)', () => {
  it('exposes a radiogroup named Editor mode with one checked radio per mode', () => {
    renderSwitch('a', 'diagram');
    const group = screen.getByRole('radiogroup', { name: 'Editor mode' });
    const diagram = screen.getByRole('radio', { name: 'Diagram' });
    const draw = screen.getByRole('radio', { name: 'Draw' });
    expect(group.contains(diagram) && group.contains(draw)).toBe(true);
    expect(diagram.getAttribute('aria-checked')).toBe('true');
    expect(draw.getAttribute('aria-checked')).toBe('false');
  });

  it('keeps one tab stop on the checked radio (roving tabindex)', () => {
    renderSwitch('a', 'draw');
    expect(screen.getByRole('radio', { name: 'Draw' }).tabIndex).toBe(0);
    expect(screen.getByRole('radio', { name: 'Diagram' }).tabIndex).toBe(-1);
  });

  it('selects the other mode on click and ignores a click on the checked one', () => {
    const { onChange } = renderSwitch('a', 'diagram');
    fireEvent.click(screen.getByRole('radio', { name: 'Diagram' }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: 'Draw' }));
    expect(onChange).toHaveBeenCalledWith('draw');
  });

  it.each([
    ['ArrowRight', 'diagram', 'draw'],
    ['ArrowDown', 'diagram', 'draw'],
    ['ArrowLeft', 'draw', 'diagram'],
    ['ArrowUp', 'draw', 'diagram'],
    ['ArrowRight', 'draw', 'diagram'],
  ] as const)('moves focus and selection with %s from %s', (key, from, to) => {
    const { onChange } = renderSwitch('a', from);
    const current = screen.getByRole('radio', { checked: true });
    current.focus();
    fireEvent.keyDown(current, { key });
    expect(onChange).toHaveBeenCalledWith(to);
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      to === 'draw' ? 'Draw' : 'Diagram',
    );
  });

  it('ignores keys that are not arrows', () => {
    const { onChange } = renderSwitch('a', 'diagram');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Diagram' }), { key: 'x' });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('EditorModeSwitch variant B (icon toggle)', () => {
  it('is a toggle button with a constant name and aria-pressed for Draw', () => {
    const { rerender, onChange } = renderSwitch('b', 'diagram');
    const button = screen.getByRole('button', { name: 'Draw mode' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    rerender(<EditorModeSwitch variant="b" mode="draw" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Draw mode' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('toggles to the other mode on press', () => {
    const { onChange } = renderSwitch('b', 'draw');
    fireEvent.click(screen.getByRole('button', { name: 'Draw mode' }));
    expect(onChange).toHaveBeenCalledWith('diagram');
  });
});

describe('EditorModeSwitch variant C (dropdown chip)', () => {
  const chip = () => screen.getByRole('button', { name: /^Editor mode:/ });

  it('is a collapsed menu button named after the current mode', () => {
    renderSwitch('c', 'draw');
    expect(chip().getAttribute('aria-label')).toBe('Editor mode: Draw');
    expect(chip().getAttribute('aria-haspopup')).toBe('menu');
    expect(chip().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens a menu of menuitemradio rows and focuses the checked one', () => {
    renderSwitch('c', 'draw');
    fireEvent.click(chip());
    expect(chip().getAttribute('aria-expanded')).toBe('true');
    screen.getByRole('menu', { name: 'Editor mode' });
    const draw = screen.getByRole('menuitemradio', { name: /^Draw/ });
    const diagram = screen.getByRole('menuitemradio', { name: /^Diagram/ });
    expect(draw.getAttribute('aria-checked')).toBe('true');
    expect(diagram.getAttribute('aria-checked')).toBe('false');
    expect(document.activeElement).toBe(draw);
  });

  it('opens from the keyboard with ArrowUp', () => {
    renderSwitch('c', 'diagram');
    fireEvent.keyDown(chip(), { key: 'ArrowUp' });
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('moves focus with ArrowDown, ArrowUp, Home and End, wrapping around', () => {
    renderSwitch('c', 'diagram');
    fireEvent.click(chip());
    const menu = screen.getByRole('menu');
    const [diagram, draw] = screen.getAllByRole('menuitemradio');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(draw);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(diagram);
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(draw);
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(document.activeElement).toBe(diagram);
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(draw);
  });

  it('chooses a row, closes the menu and returns focus to the chip', () => {
    const { onChange } = renderSwitch('c', 'diagram');
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Draw/ }));
    expect(onChange).toHaveBeenCalledWith('draw');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(chip());
  });

  it('closes without choosing on the current row', () => {
    const { onChange } = renderSwitch('c', 'diagram');
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Diagram/ }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape and returns focus to the chip', () => {
    renderSwitch('c', 'diagram');
    fireEvent.click(chip());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(chip());
  });

  it('closes on a press outside', () => {
    renderSwitch('c', 'diagram');
    fireEvent.click(chip());
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('EditorModeSwitch variant D (sliding switch)', () => {
  it('is a switch named Draw, checked in Draw mode', () => {
    const { rerender, onChange } = renderSwitch('d', 'diagram');
    expect(screen.getByRole('switch', { name: 'Draw' }).getAttribute('aria-checked')).toBe('false');
    rerender(<EditorModeSwitch variant="d" mode="draw" onChange={onChange} />);
    expect(screen.getByRole('switch', { name: 'Draw' }).getAttribute('aria-checked')).toBe('true');
  });

  it('flips the mode on press', () => {
    const { onChange } = renderSwitch('d', 'diagram');
    fireEvent.click(screen.getByRole('switch', { name: 'Draw' }));
    expect(onChange).toHaveBeenCalledWith('draw');
  });
});

describe('EditorModeSwitch slot', () => {
  it.each(['a', 'b', 'c', 'd'] as const)(
    'variant %s keeps the same slot width in both modes',
    (variant) => {
      const { container, rerender, onChange } = renderSwitch(variant, 'diagram');
      const slot = () => container.querySelector('[data-editor-mode-switch]')!;
      const before = slot().className;
      rerender(<EditorModeSwitch variant={variant} mode="draw" onChange={onChange} />);
      expect(slot().className).toBe(before);
    },
  );

  it.each(['a', 'b', 'c', 'd'] as const)(
    'variant %s hidden keeps its slot but offers no control',
    (variant) => {
      const shown = renderSwitch(variant, 'diagram');
      const width = shown.container.querySelector('[data-editor-mode-switch]')!.className;
      cleanup();
      const { container } = renderSwitch(variant, 'diagram', true);
      const slot = container.querySelector('[data-editor-mode-switch]')!;
      expect(slot.className).toBe(width);
      expect(slot.getAttribute('aria-hidden')).toBe('true');
      expect(slot.childElementCount).toBe(0);
    },
  );
});
