// @vitest-environment jsdom

// The diagram key's face (docs/specs/009-elements/diagram-key.md): its title, a swatch and a meaning per stored row,
// meanings edited in place once selected, and a hint when there is nothing to list.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type KeyRow, type ShapeElement, type WebRows } from '@liveplanner/document';
import { DiagramKeyFace } from './DiagramKeyFace';

afterEach(cleanup);

const rows: KeyRow[] = [
  { id: 'line:solid', kind: 'line', style: 'solid' },
  { id: 'line:dashed', kind: 'line', style: 'dashed' },
  { id: 'tag:payments', kind: 'tag', tag: 'Payments', color: '#d97706' },
];
const key = (over: Partial<ShapeElement> = {}) =>
  ({
    ...createShape('diagram-key', 0, 0),
    keyRows: rows,
    ...over,
  }) as ShapeElement;

function show(element: ShapeElement, editable = true) {
  const onSetRows = vi.fn<(r: WebRows) => void>();
  const { container } = render(
    <DiagramKeyFace
      element={element}
      labelNode={<span>Key</span>}
      accent="#0284c7"
      paper="#1e293b"
      ink="#0f172a"
      fontFamily={undefined}
      editable={editable}
      onSetRows={onSetRows}
    />,
  );
  return { onSetRows, container };
}

describe('DiagramKeyFace', () => {
  it('draws the title and each row with its starting meaning and swatch', () => {
    const { container } = show(key());
    expect(screen.getByText('Key')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Dashed line meaning' }).textContent).toBe(
      'Dashed line',
    );
    expect(screen.getByRole('textbox', { name: 'Payments meaning' }).textContent).toBe('Payments');
    expect(
      container
        .querySelector('[data-key-row="line:dashed"] line')!
        .getAttribute('stroke-dasharray'),
    ).toBeTruthy();
    expect(
      container
        .querySelector('[data-key-row="tag:payments"] rect:last-child')!
        .getAttribute('fill'),
    ).toBe('#d97706');
    // The card swatch is drawn on the key's own paper, never a fixed white.
    expect(
      container
        .querySelector('[data-key-row="tag:payments"] rect:first-child')!
        .getAttribute('fill'),
    ).toBe('#1e293b');
  });

  it('commits an edited meaning for its row', () => {
    const { onSetRows } = show(key());
    const line = screen.getByRole('textbox', { name: 'Dashed line meaning' });
    fireEvent.focus(line);
    line.textContent = 'Event, fire and forget';
    fireEvent.keyDown(line, { key: 'Enter' });
    fireEvent.blur(line);
    expect(onSetRows).toHaveBeenCalledWith({
      keyMeaning: { rowId: 'line:dashed', text: 'Event, fire and forget' },
    });
  });

  it('shows a hint with no rows', () => {
    show(key({ keyRows: [] }), false);
    expect(screen.getByText('Your line styles show here')).toBeTruthy();
  });
});
