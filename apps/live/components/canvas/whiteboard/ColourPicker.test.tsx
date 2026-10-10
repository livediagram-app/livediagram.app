// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { penColourHex, standardColours, type PenColour } from '@livediagram/document';
import { ColourPicker } from './ColourPicker';

// docs/specs/023-draw-mode/draw-mode.md "The colour picker", on the one colour picker
// (docs/specs/004-interface-design/colour-picker.md).
function setup(value: PenColour | null = 'blue') {
  const onPick = vi.fn();
  render(<ColourPicker value={value} board="dark" onPick={onPick} />);
  return { onPick };
}
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

describe('the marker colour picker', () => {
  it('offers the strong standard colours by name, drawn for the board', () => {
    setup();
    const colours = within(screen.getByRole('group', { name: 'Standard Colours' })).getAllByRole(
      'button',
    );
    expect(colours.map((b) => b.getAttribute('aria-label'))).toEqual(
      standardColours('strong', 'dark').map((c) => c.label),
    );
    const blue = screen.getByRole('button', { name: 'Blue' });
    expect(blue.getAttribute('aria-pressed')).toBe('true');
    expect((blue.querySelector('[data-swatch-chip]') as HTMLElement).style.backgroundColor).toBe(
      rgb(penColourHex('blue', 'dark')),
    );
  });

  it('marks Ink for the null colour and picks it back as null', () => {
    const { onPick } = setup(null);
    expect(screen.getByRole('button', { name: 'Ink' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Ink' }));
    expect(onPick).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: 'Grey' }));
    expect(onPick).toHaveBeenLastCalledWith('grey');
  });

  it('shows a custom colour in force in Custom colours, and warns about a hard-to-see one', () => {
    setup('#ff6b00');
    const yours = within(screen.getByRole('group', { name: 'Custom Colours' })).getAllByRole(
      'button',
    );
    expect(yours[0]!.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Add a custom colour' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Hex' }), {
      target: { value: '#111111' },
    });
    expect(screen.getByTestId('custom-colour-note').textContent).toContain(
      'Hard to see on the dark board',
    );
  });
});
