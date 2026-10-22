// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TableElement } from '@livediagram/document';
import { TableView } from './TableView';

const table = (animation?: string): TableElement =>
  ({
    id: 't',
    type: 'table',
    x: 0,
    y: 0,
    width: 200,
    height: 80,
    cells: [
      ['a', 'b'],
      ['c', 'd'],
    ],
    ...(animation ? { animation } : {}),
  }) as TableElement;

const view = (element: TableElement) => (
  <TableView
    element={element}
    isSelected
    readOnly={false}
    tabSummaries={[]}
    onCommitTable={vi.fn()}
  />
);

// docs/specs/028-animation/element-animations.md: the Table animation restarts by remounting the
// grid, but never while a cell is being edited (the editor's draft would be lost).
describe('TableView while a cell is edited', () => {
  it('keeps the cell editor mounted when the Table animation changes', () => {
    const { container, rerender } = render(view(table('rows')));
    const cell = container.querySelector('[role="cell"]')!;
    act(() => {
      fireEvent.doubleClick(cell);
    });
    const editor = container.querySelector('[contenteditable]');
    expect(editor).not.toBeNull();
    rerender(view(table('columns')));
    expect(container.querySelector('[contenteditable]')).toBe(editor);
  });
});
