// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ESTIMATE_POINTS } from '@livediagram/items';
import { EstimateSelect } from './item-field-editors';

// docs/specs/026-plan/items.md "Fields": an Estimate is picked from the story-point sizes, or None.
afterEach(cleanup);

const options = () => screen.getAllByRole('option').map((o) => o.textContent);

describe('the Estimate dropdown', () => {
  it('offers None and the sizes, and saves the one picked as a number', () => {
    const onSave = vi.fn();
    render(<EstimateSelect id="e" value={undefined} disabled={false} onSave={onSave} />);
    expect(options()).toEqual(['None', ...ESTIMATE_POINTS.map(String)]);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '5' } });
    expect(onSave).toHaveBeenLastCalledWith(5);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    expect(onSave).toHaveBeenLastCalledWith(undefined);
  });

  it('keeps an odd value a card already holds, in its place among the sizes', () => {
    render(<EstimateSelect id="e" value={4} disabled={false} onSave={vi.fn()} />);
    expect(options()).toEqual(['None', '1', '2', '3', '4', '5', '8', '13', '21']);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('4');
    cleanup();
    render(<EstimateSelect id="e" value={40} disabled={false} onSave={vi.fn()} />);
    expect(options().at(-1)).toBe('40');
  });
});
