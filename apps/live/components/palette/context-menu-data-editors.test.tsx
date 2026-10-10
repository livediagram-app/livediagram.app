// @vitest-environment jsdom

// The element-menu row editors (docs/specs/009-elements/pie-chart.md, entity.md, checklist.md): each
// keeps a local draft while typing, and follows the element's rows when they change.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import type { ChecklistItem, EntityField, LegendItem, PieSlice } from '@livediagram/document';
import {
  ChecklistRowsEditor,
  EntityFieldsEditor,
  LegendDataEditor,
  LinkedChartData,
  PieDataEditor,
} from './context-menu-data-editors';

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
    input: () => screen.getByPlaceholderText('Label') as HTMLInputElement,
    valueOf: (rows: PieSlice[]) => rows[0]!.label,
  } satisfies Case<PieSlice>,
  {
    name: 'LegendDataEditor',
    editor: (rows: LegendItem[]) => <LegendDataEditor items={rows} onChange={vi.fn()} />,
    rows: [{ label: 'Cats' }],
    changed: [{ label: 'Dogs' }],
    input: () => screen.getByPlaceholderText('Label') as HTMLInputElement,
    valueOf: (rows: LegendItem[]) => rows[0]!.label,
  } satisfies Case<LegendItem>,
  {
    name: 'EntityFieldsEditor',
    editor: (rows: EntityField[]) => <EntityFieldsEditor fields={rows} onChange={vi.fn()} />,
    rows: [{ name: 'id', type: 'uuid' }],
    changed: [{ name: 'email', type: 'text' }],
    input: () => screen.getByLabelText('Field 1 name') as HTMLInputElement,
    valueOf: (rows: EntityField[]) => rows[0]!.name,
  } satisfies Case<EntityField>,
  {
    name: 'ChecklistRowsEditor',
    editor: (rows: ChecklistItem[]) => <ChecklistRowsEditor items={rows} onChange={vi.fn()} />,
    rows: [{ text: 'Plan', done: false }],
    changed: [{ text: 'Ship', done: false }],
    input: () => screen.getByPlaceholderText('Task') as HTMLInputElement,
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

describe('a chart drawn from a sheet', () => {
  it('says where its data comes from and unlinks', () => {
    const onUnlink = vi.fn();
    render(<LinkedChartData onUnlink={onUnlink} />);
    expect(screen.getByText(/Drawn live from a Sheet/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Unlink From Sheet' }));
    expect(onUnlink).toHaveBeenCalledOnce();
  });
});
