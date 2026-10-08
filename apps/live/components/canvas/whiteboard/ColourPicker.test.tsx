// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { penColourHex, readablePenColour, type PenColour } from '@livediagram/document';
import { ColourPicker } from './ColourPicker';

// docs/specs/023-draw-mode/draw-mode.md "The colour picker".
const INK = '#e2e8f0';
function setup(value: PenColour | null = 'blue', yours: string[] = ['#ff6b00', '#00a39b']) {
  const onPick = vi.fn();
  const onRemove = vi.fn();
  const view = render(
    <ColourPicker
      value={value}
      board="dark"
      ink={INK}
      yours={yours}
      onPick={onPick}
      onRemove={onRemove}
    />,
  );
  const rerender = (next: string[]) =>
    view.rerender(
      <ColourPicker
        value={value}
        board="dark"
        ink={INK}
        yours={next}
        onPick={onPick}
        onRemove={onRemove}
      />,
    );
  return { onPick, onRemove, rerender, stock: () => screen.getByTestId('stock-colours') };
}

const chip = (button: HTMLElement) =>
  (button.querySelector('span') as HTMLElement).style.backgroundColor;
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

describe('ColourPicker', () => {
  it('shows the nine stock colours, Ink first, each named and tuned for the board', () => {
    const { stock } = setup();
    const swatches = within(stock()).getAllByRole('button');
    expect(swatches.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Ink',
      'Blue',
      'Red',
      'Orange',
      'Yellow',
      'Green',
      'Teal',
      'Violet',
      'Pink',
    ]);
    expect(chip(swatches[0]!)).toBe(rgb(INK));
    const blue = within(stock()).getByRole('button', { name: 'Blue' });
    expect(blue.getAttribute('aria-pressed')).toBe('true');
    expect(chip(blue)).toBe(rgb(penColourHex('blue', 'dark')));
  });

  it('picks a stock colour by name, and the ink as null', () => {
    const { onPick, stock } = setup();
    fireEvent.click(within(stock()).getByRole('button', { name: 'Teal' }));
    expect(onPick).toHaveBeenCalledWith('teal');
    fireEvent.click(within(stock()).getByRole('button', { name: 'Ink' }));
    expect(onPick).toHaveBeenLastCalledWith(null);
  });

  it('shows the ink as chosen for a marker that holds it', () => {
    const { stock } = setup(null);
    expect(within(stock()).getByRole('button', { name: 'Ink' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('moves along a row with the arrow keys, held at its ends; Enter picks', () => {
    const { stock } = setup();
    const at = (name: string) => within(stock()).getByRole('button', { name });
    const blue = at('Blue');
    expect(blue.tabIndex).toBe(0);
    blue.focus();
    fireEvent.keyDown(blue, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(at('Red'));
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(at('Pink'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(at('Pink'));
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement).toBe(at('Ink'));
  });

  it('shows Your colours, newest first, and picks one again with one press', () => {
    const { onPick } = setup('#00a39b');
    const row = screen.getByTestId('your-colours');
    const custom = within(row).getAllByRole('button', { name: /^Custom/ });
    expect(custom.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Custom #ff6b00',
      'Custom #00a39b',
    ]);
    expect(custom[1]!.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(custom[0]!);
    expect(onPick).toHaveBeenCalledWith('#ff6b00');
  });

  it('removes a custom colour from its menu, and moves the focus to the next one', () => {
    // docs/specs/023-draw-mode/draw-mode.md "The colour picker": Removing one.
    const { onRemove, rerender } = setup('blue', ['#ff6b00', '#00a39b']);
    const orange = screen.getByRole('button', { name: 'Custom #ff6b00' });
    fireEvent.contextMenu(orange);
    const remove = screen.getByRole('menuitem', { name: 'Remove' });
    expect(document.activeElement).toBe(remove);
    fireEvent.click(remove);
    expect(onRemove).toHaveBeenCalledWith('#ff6b00');
    expect(screen.queryByRole('menuitem', { name: 'Remove' })).toBeNull();
    rerender(['#00a39b']);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Custom #00a39b' }));
  });

  it('opens the menu from the keyboard, and Escape closes it back to the swatch', () => {
    const { onRemove, rerender } = setup('blue', ['#00a39b']);
    const teal = screen.getByRole('button', { name: 'Custom #00a39b' });
    teal.focus();
    fireEvent.keyDown(teal, { key: 'F10', shiftKey: true });
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Remove' }), { key: 'Escape' });
    expect(screen.queryByRole('menuitem', { name: 'Remove' })).toBeNull();
    expect(document.activeElement).toBe(teal);
    fireEvent.keyDown(teal, { key: 'ContextMenu' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledWith('#00a39b');
    // The last one gone: the focus goes to +.
    rerender([]);
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Add a custom colour' }),
    );
  });

  it('offers no menu on a stock colour', () => {
    const { stock } = setup();
    fireEvent.contextMenu(within(stock()).getByRole('button', { name: 'Blue' }));
    expect(screen.queryByRole('menuitem', { name: 'Remove' })).toBeNull();
  });

  it('opens the custom picker in place with +, and Use applies the hex', () => {
    const { onPick } = setup('blue', []);
    fireEvent.click(screen.getByRole('button', { name: 'Add a custom colour' }));
    expect(screen.getByRole('slider', { name: 'Saturation and brightness' })).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Hue' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Hex' }), {
      target: { value: '#d9480f' },
    });
    // The warning's line is there, and empty.
    expect(screen.getByTestId('custom-colour-note').textContent).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Use' }));
    expect(onPick).toHaveBeenCalledWith('#d9480f');
    expect(screen.queryByTestId('custom-colour')).toBeNull();
  });

  it('warns which board a custom colour is hard to see on, on its reserved line, with a fix to press', () => {
    const { onPick } = setup('blue', []);
    fireEvent.click(screen.getByRole('button', { name: 'Add a custom colour' }));
    const note = screen.getByTestId('custom-colour-note');
    fireEvent.change(screen.getByRole('textbox', { name: 'Hex' }), {
      target: { value: '#ffff00' },
    });
    expect(screen.getByTestId('custom-colour-note')).toBe(note);
    expect(note.textContent).toContain('Hard to see on the light board.');
    expect(note.className).toContain('text-amber-800');
    expect(note.querySelector('svg')).toBeTruthy();
    const fixed = readablePenColour('#ffff00');
    fireEvent.click(
      within(note).getByRole('button', { name: `Use ${fixed}, readable on both boards` }),
    );
    expect(onPick).toHaveBeenCalledWith(fixed);
  });

  it('moves the square with the arrow keys', () => {
    setup('blue', []);
    fireEvent.click(screen.getByRole('button', { name: 'Add a custom colour' }));
    const square = screen.getByRole('slider', { name: 'Saturation and brightness' });
    const before = square.getAttribute('aria-valuetext');
    fireEvent.keyDown(square, { key: 'ArrowLeft', shiftKey: true });
    expect(square.getAttribute('aria-valuetext')).not.toBe(before);
  });
});
