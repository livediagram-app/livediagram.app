// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PLAN_TYPE_COLOURS } from '@livediagram/items';
import { ColourDot, ColourSwatches, swatchFocusTarget } from './ColourSwatches';

afterEach(cleanup);

// docs/specs/026-plan/items.md "Colour".
describe('ColourSwatches', () => {
  it('offers the twelve swatches by name, the picked one checked', () => {
    const onChange = vi.fn();
    render(<ColourSwatches value="#16a34a" onChange={onChange} />);
    expect(screen.getAllByRole('radio')).toHaveLength(PLAN_TYPE_COLOURS.length);
    expect(screen.getByRole('radio', { name: 'Green' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByRole('radio', { name: 'None' })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Pink' }));
    expect(onChange).toHaveBeenCalledWith('#db2777');
  });

  it('offers None first when it may be cleared, checked when there is no colour', () => {
    const onChange = vi.fn();
    render(<ColourSwatches value={undefined} onChange={onChange} allowNone label="Colour" />);
    const none = screen.getByRole('radio', { name: 'None' });
    expect(screen.getAllByRole('radio')[0]).toBe(none);
    expect(none.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Blue' }));
    fireEvent.click(none);
    expect(onChange.mock.calls).toEqual([['#2563eb'], [undefined]]);
  });

  it('changes nothing for someone who may not edit', () => {
    const onChange = vi.fn();
    render(<ColourSwatches value="#2563eb" onChange={onChange} allowNone disabled />);
    fireEvent.click(screen.getByRole('radio', { name: 'Red' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is one Tab stop, the picked swatch, and the arrows move focus along it (the type editor too)', () => {
    const onChange = vi.fn();
    render(<ColourSwatches value="#2563eb" onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    const blue = screen.getByRole('radio', { name: 'Blue' });
    expect(radios.filter((r) => r.tabIndex === 0)).toEqual([blue]);
    blue.focus();
    fireEvent.keyDown(blue, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Yellow' }));
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(radios[radios.length - 1]);
    // Moving focus picks nothing.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('makes the first swatch the Tab stop when none is picked', () => {
    render(<ColourSwatches value={undefined} onChange={vi.fn()} />);
    expect(screen.getAllByRole('radio').filter((r) => r.tabIndex === 0)).toEqual([
      screen.getByRole('radio', { name: 'Black' }),
    ]);
  });

  it('steps focus by arrow (wrapping), Home and End, and ignores any other key', () => {
    expect(swatchFocusTarget('ArrowRight', 12, 13)).toBe(0);
    expect(swatchFocusTarget('ArrowLeft', 0, 13)).toBe(12);
    expect(swatchFocusTarget('ArrowUp', 5, 13)).toBe(4);
    expect(swatchFocusTarget('Home', 5, 13)).toBe(0);
    expect(swatchFocusTarget('End', 5, 13)).toBe(12);
    expect(swatchFocusTarget('a', 5, 13)).toBe(-1);
    expect(swatchFocusTarget('ArrowRight', -1, 13)).toBe(-1);
    expect(swatchFocusTarget('ArrowRight', 0, 0)).toBe(-1);
  });

  it('names a colour dot by its swatch', () => {
    render(<ColourDot colour="#0d9488" />);
    expect(screen.getByRole('img', { name: 'Teal colour' })).toBeTruthy();
  });
});
