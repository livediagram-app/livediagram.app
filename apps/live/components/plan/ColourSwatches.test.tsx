// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { penColourHex, standardColours } from '@livediagram/document';
import { ColourDot, TypeColourButton, planColourName } from './ColourSwatches';

afterEach(cleanup);

// docs/specs/026-plan/items.md "Colour", on the one colour picker (docs/specs/004-interface-design/colour-picker.md).
describe('a card type colour', () => {
  it('is a swatch of the colour, opening the picker in a popover that a pick closes', () => {
    const onChange = vi.fn();
    render(<TypeColourButton value={penColourHex('green', 'light')} onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: 'Colour' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Pink' }));
    expect(onChange).toHaveBeenCalledWith(penColourHex('pink', 'light'));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('offers the strong standard colours for light paper, picked by hex, and no None', () => {
    const onChange = vi.fn();
    render(<TypeColourButton value={penColourHex('green', 'light')} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Colour' }));
    const colours = within(screen.getByRole('group', { name: 'Standard Colours' })).getAllByRole(
      'button',
    );
    expect(colours.map((b) => b.getAttribute('aria-label'))).toEqual(
      standardColours('strong', 'light').map((c) => c.label),
    );
    expect(screen.getByRole('button', { name: 'Green' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'None' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pink' }));
    expect(onChange).toHaveBeenCalledWith(penColourHex('pink', 'light'));
  });

  it('keeps an earlier Plan colour as the colour in force, and + picks a custom one lower-cased', () => {
    const onChange = vi.fn();
    render(<TypeColourButton value="#16A34A" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Colour' }));
    const yours = within(screen.getByRole('group', { name: 'Custom Colours' })).getAllByRole(
      'button',
    );
    expect(yours[0]!.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Add a custom colour' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Hex' }), {
      target: { value: '#ABCDEF' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use' }));
    expect(onChange).toHaveBeenCalledWith('#abcdef');
  });
});

describe('Plan colour names', () => {
  it('name a standard colour, an earlier Plan swatch, or a custom colour', () => {
    expect(planColourName(penColourHex('teal', 'light'))).toBe('Teal');
    expect(planColourName('#0D9488')).toBe('Teal');
    expect(planColourName('#123456')).toBe('#123456');
  });

  it('name a colour dot', () => {
    render(<ColourDot colour="#0d9488" />);
    expect(screen.getByRole('img', { name: 'Teal colour' })).toBeTruthy();
  });
});
