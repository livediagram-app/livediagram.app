// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TableElement } from '@livediagram/document';
import { TableView } from './TableView';

const table = (extra: Partial<TableElement> = {}) =>
  ({
    id: 't',
    type: 'table',
    x: 0,
    y: 0,
    width: 200,
    height: 80,
    headerRow: true,
    cells: [
      ['Owner', 'A rather long heading that wraps'],
      ['Ada', ''],
    ],
    ...extra,
  }) as TableElement;

const cellOf = (text: string) => screen.getByText(text).parentElement!;

// docs/specs/008-canvas/canvas-and-palette.md "Table": a cell at rest aligns its text as its editor does, every
// wrapped line included. Centred only by flex, a wrapped header's lines sat on the left until it was edited.
describe('TableView cell alignment', () => {
  it('aligns a cell’s lines with the table, centred by default', () => {
    render(
      <TableView
        element={table()}
        isSelected={false}
        readOnly
        tabSummaries={[]}
        onCommitTable={vi.fn()}
      />,
    );
    expect(cellOf('A rather long heading that wraps').style.textAlign).toBe('center');
    expect(cellOf('Ada').style.textAlign).toBe('center');
  });

  it('follows the table’s alignment and a cell’s own', () => {
    render(
      <TableView
        element={table({ textAlignX: 'right', cellStyles: [[{ alignX: 'left' }]] })}
        isSelected={false}
        readOnly
        tabSummaries={[]}
        onCommitTable={vi.fn()}
      />,
    );
    expect(cellOf('Owner').style.textAlign).toBe('left');
    expect(cellOf('A rather long heading that wraps').style.textAlign).toBe('right');
  });
});
