// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type ItemTypeDef } from '@liveplanner/items';
import { ItemTypeCardColour, cardColourOptions } from './ItemTypeCardColour';

// docs/specs/026-plan/item-types.md "Fields by role": Card Colour picks the Colour field that tints a type's cards.
afterEach(cleanup);

const task = ITEM_TYPES.find((t) => t.id === 'task')!;
const tinted: ItemTypeDef = {
  ...task,
  fields: [...task.fields, 'color', 'f-tint'],
  custom: [{ id: 'f-tint', label: 'Tint', kind: 'colour' }],
};

describe('ItemTypeCardColour', () => {
  it('lists the built-in Colour, then the type’s own Colour fields', () => {
    expect(cardColourOptions(tinted).map((o) => o.label)).toEqual(['Colour', 'Tint']);
    // Without the built-in, its row reads No Colour, so a pick can always be undone.
    expect(
      cardColourOptions({ ...tinted, fields: ['title', 'f-tint'] }).map((o) => o.label),
    ).toEqual(['No Colour', 'Tint']);
  });

  it('shows nothing while the type has no Colour field of its own', () => {
    const { container } = render(<ItemTypeCardColour type={task} onChange={vi.fn()} />);
    expect(container.textContent).toBe('');
  });

  it('picks a field, and the built-in as no pick', () => {
    const onChange = vi.fn();
    render(<ItemTypeCardColour type={tinted} onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Colour' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Tint' }));
    expect(onChange).toHaveBeenLastCalledWith('f-tint');
    cleanup();
    render(<ItemTypeCardColour type={{ ...tinted, colourField: 'f-tint' }} onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Tint' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Colour' }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});
