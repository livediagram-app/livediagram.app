// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_FIELD_KINDS } from '@livediagram/items';
import { NewFieldForm } from './ItemTypeFieldForms';

// docs/specs/026-plan/item-types.md "Editing a type": Add Field's New Custom Field, its kind tiles and preview.
vi.mock('./PlanContext', () => ({ usePlan: () => null }));
afterEach(cleanup);

function form() {
  const onAddCustom = vi.fn();
  render(
    <NewFieldForm
      missing={[]}
      canAddCustom
      onAddBuiltIn={vi.fn()}
      onAddCustom={onAddCustom}
      onCancel={vi.fn()}
    />,
  );
  return onAddCustom;
}
const preview = () => within(screen.getByRole('figure', { name: 'Preview' }));

describe('New Custom Field', () => {
  it('offers every kind as a tile, Text first and picked, Card named Link to Card', () => {
    form();
    const tiles = within(screen.getByRole('radiogroup', { name: "New field's kind" })).getAllByRole(
      'radio',
    );
    expect(tiles).toHaveLength(CUSTOM_FIELD_KINDS.length);
    expect(tiles[0]!.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Link to Card' })).toBeTruthy();
  });

  it('previews the field by its name and kind as they change', () => {
    form();
    expect(preview().getByText('Field name')).toBeTruthy();
    expect(preview().getByText('Some text')).toBeTruthy();
    fireEvent.change(screen.getByLabelText("New field's name"), { target: { value: 'Size' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Number' }));
    expect(preview().getByText('Size')).toBeTruthy();
    expect(preview().getByText('42')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Choice' }));
    fireEvent.change(screen.getByLabelText('Options, one a line'), { target: { value: 'S\nM' } });
    expect(preview().getByText('S')).toBeTruthy();
  });

  it('adds the field with the picked kind', () => {
    const onAddCustom = form();
    fireEvent.change(screen.getByLabelText("New field's name"), { target: { value: 'Due' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Date' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Custom Field' }));
    expect(onAddCustom).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Due', kind: 'date' }),
    );
  });
});
