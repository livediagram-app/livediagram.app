// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EntityField, FieldRemap } from '@livediagram/document';
import { EntityFieldsEditor } from './EntityFieldsEditor';
import { CardinalityButton } from '@/components/canvas/entity/CardinalityButton';

// docs/specs/009-elements/entity.md "The Fields menu" and "Cardinality ends".

describe('EntityFieldsEditor', () => {
  it('cycles a key at once, reading a legacy key from the type', () => {
    const onChange = vi.fn();
    render(<EntityFieldsEditor fields={[{ name: 'id', type: 'uuid PK' }]} onChange={onChange} />);
    expect(screen.getByLabelText<HTMLInputElement>('Field 1 type').value).toBe('uuid');
    fireEvent.click(screen.getByRole('button', { name: 'Field 1 key: PK. Change key' }));
    expect(onChange).toHaveBeenCalledWith([{ name: 'id', type: 'uuid', key: 'fk' }]);
  });

  it('removes a field with the remap that lets go of ends on it', () => {
    const onChange = vi.fn();
    render(<EntityFieldsEditor fields={[{ name: 'a' }, { name: 'b' }]} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove field' })[0]!);
    const [fields, remap] = onChange.mock.calls[0] as [EntityField[], FieldRemap];
    expect(fields).toEqual([{ name: 'b' }]);
    expect(remap(0)).toBeNull();
    expect(remap(1)).toBe(0);
  });
});

describe('CardinalityButton', () => {
  it('names the pair now and sets a preset', () => {
    const onPick = vi.fn();
    render(<CardinalityButton current="1 : N" onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /Cardinality/ }));
    const manyToMany = screen.getByRole('option', { name: /^Many to Many/ });
    expect(screen.getByRole('option', { name: /^One to Many/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
    fireEvent.click(manyToMany);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'many-to-many' }));
  });
});
