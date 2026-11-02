// @vitest-environment jsdom

// The element-menu row editors (docs/specs/009-elements/pie-chart.md, entity.md, checklist.md): each
// keeps a local draft while typing, and follows the element's rows when they change.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import type { ChecklistItem, EntityField, LegendItem, PieSlice } from '@livehuddle/document';
import { ChecklistRowsEditor, LegendDataEditor, PieDataEditor } from './context-menu-data-editors';
import { EntityFieldsEditor } from './EntityFieldsEditor';

afterEach(() => cleanup());

type Case<T> = {
  name: string;
  editor: (rows: T[]) => ReactElement;
  rows: T[];
  changed: T[];
  input: () => HTMLInputElement;
  valueOf: (rows: T[]) => string;
};

const cases = [
  {
    name: 'PieDataEditor',
    editor: (rows: PieSlice[]) => <PieDataEditor slices={rows} onChange={vi.fn()} />,
    rows: [{ label: 'Cats', value: 3 }],
    changed: [{ label: 'Dogs', value: 3 }],
    input: () => screen.getByLabelText('Slice 1 label'),
    valueOf: (rows: PieSlice[]) => rows[0]!.label,
  } satisfies Case<PieSlice>,
  {
    name: 'LegendDataEditor',
    editor: (rows: LegendItem[]) => <LegendDataEditor items={rows} onChange={vi.fn()} />,
    rows: [{ label: 'Cats' }],
    changed: [{ label: 'Dogs' }],
    input: () => screen.getByLabelText('Legend row 1 label'),
    valueOf: (rows: LegendItem[]) => rows[0]!.label,
  } satisfies Case<LegendItem>,
  {
    name: 'EntityFieldsEditor',
    editor: (rows: EntityField[]) => <EntityFieldsEditor fields={rows} onChange={vi.fn()} />,
    rows: [{ name: 'id', type: 'uuid' }],
    changed: [{ name: 'email', type: 'text' }],
    input: () => screen.getByLabelText('Field 1 name'),
    valueOf: (rows: EntityField[]) => rows[0]!.name,
  } satisfies Case<EntityField>,
  {
    name: 'ChecklistRowsEditor',
    editor: (rows: ChecklistItem[]) => <ChecklistRowsEditor items={rows} onChange={vi.fn()} />,
    rows: [{ text: 'Plan', done: false }],
    changed: [{ text: 'Ship', done: false }],
    input: () => screen.getByLabelText('Row 1 task'),
    valueOf: (rows: ChecklistItem[]) => rows[0]!.text,
  } satisfies Case<ChecklistItem>,
] as const;

describe.each(cases)('$name', (c) => {
  const editor = c.editor as (rows: unknown[]) => ReactElement;

  it('keeps a typed draft through a re-render with the same rows', () => {
    const { rerender } = render(editor(c.rows));
    fireEvent.change(c.input(), { target: { value: 'typed' } });
    rerender(editor(c.rows));
    expect(c.input().value).toBe('typed');
  });

  it('follows the element when its rows change', () => {
    const { rerender } = render(editor(c.rows));
    fireEvent.change(c.input(), { target: { value: 'typed' } });
    rerender(editor(c.changed));
    expect(c.input().value).toBe((c.valueOf as (rows: unknown[]) => string)(c.changed));
  });
});

describe('row names', () => {
  it('names every pie slice control after its row', () => {
    render(
      <PieDataEditor
        slices={[
          { label: 'Cats', value: 3 },
          { label: 'Dogs', value: 2 },
        ]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Slice 2 value')).toHaveProperty('value', '2');
    expect(screen.getByRole('button', { name: 'Remove slice 2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Slice 2 colour' })).toBeTruthy();
  });

  it('names every legend and checklist remove button after its row', () => {
    render(<LegendDataEditor items={[{ label: 'A' }, { label: 'B' }]} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Remove legend row 2' })).toBeTruthy();
    cleanup();
    render(
      <ChecklistRowsEditor
        items={[
          { text: 'Plan', done: false },
          { text: 'Ship', done: false },
        ]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Remove row 2' })).toBeTruthy();
  });
});
