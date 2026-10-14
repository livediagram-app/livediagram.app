// @vitest-environment jsdom

// A chevron process's on-canvas stage controls (docs/specs/009-elements/concept-graphics.md "Editing"): the hovered
// stage's Move Left, Move Right and Delete (every stage's on a phone), Add Note while no stage has one, and none at
// all unless the element is selected and editable.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createShape,
  type ConceptRow,
  type ConceptShape,
  type ShapeElement,
  type WebRows,
} from '@livediagram/document';
import { ConceptFace } from './ConceptFace';
import { HOVER_GRACE_MS } from '@/hooks/ui/useGraceHover';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const chevrons = (rows?: ConceptRow[]) => {
  const el = createShape('chevrons', 0, 0) as ShapeElement & { shape: ConceptShape };
  return rows ? { ...el, conceptRows: rows } : el;
};

function show(element = chevrons(), editable = true) {
  const onSetRows = vi.fn<(rows: WebRows) => void>();
  const { container } = render(
    <ConceptFace
      element={element}
      labelNode={null}
      accent="#1d4ed8"
      fill="#ffffff"
      ink="#0f172a"
      fontFamily={undefined}
      editable={editable}
      onSetRows={onSetRows}
    />,
  );
  const zone = (i: number) => container.querySelector(`[data-concept-row-zone="${i}"]`)!;
  const rows = () => onSetRows.mock.calls.at(-1)![0].conceptRows!;
  return { onSetRows, zone, rows, element };
}

const phone = (on: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: on, media: q }) as MediaQueryList);

describe('chevron stage controls', () => {
  it('shows only the hovered stage its controls, and keeps them a moment after the pointer leaves', () => {
    vi.useFakeTimers();
    const { zone } = show();
    expect(screen.queryAllByRole('toolbar')).toHaveLength(0);
    fireEvent.pointerEnter(zone(1));
    expect(screen.getAllByRole('toolbar').map((t) => t.getAttribute('aria-label'))).toEqual([
      'Stage 2',
    ]);
    fireEvent.pointerLeave(zone(1));
    expect(screen.queryAllByRole('toolbar')).toHaveLength(1);
    act(() => vi.advanceTimersByTime(HOVER_GRACE_MS));
    expect(screen.queryAllByRole('toolbar')).toHaveLength(0);
  });

  it('moves a stage either way, with its note', () => {
    const { zone, rows, element } = show();
    const [a, b, c] = element.conceptRows!;
    fireEvent.pointerEnter(zone(1));
    fireEvent.click(screen.getByRole('button', { name: 'Move stage left' }));
    expect(rows().slice(0, 3)).toEqual([b, a, c]);
    fireEvent.pointerEnter(zone(1));
    fireEvent.click(screen.getByRole('button', { name: 'Move stage right' }));
    expect(rows().slice(0, 3)).toEqual([a, c, b]);
  });

  it('turns off a move past either end, and Delete at the fewest stages', () => {
    const { zone } = show(chevrons([{ label: 'One' }, { label: 'Two' }]));
    fireEvent.pointerEnter(zone(0));
    expect(screen.getByRole('button', { name: 'Move stage left' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Delete stage' })).toHaveProperty('disabled', true);
  });

  it('deletes a stage', () => {
    const { zone, rows, element } = show();
    fireEvent.pointerEnter(zone(0));
    fireEvent.click(screen.getByRole('button', { name: 'Delete stage' }));
    expect(rows()).toEqual(element.conceptRows!.slice(1));
  });

  it('offers Add Note only while no stage has a note', () => {
    const { zone } = show();
    fireEvent.pointerEnter(zone(0));
    expect(screen.queryByRole('button', { name: 'Add note' })).toBeNull();
    cleanup();
    const bare = show(chevrons([{ label: 'One' }, { label: 'Two' }]));
    fireEvent.pointerEnter(bare.zone(1));
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    expect(bare.rows()).toEqual([{ label: 'One' }, { label: 'Two', note: 'Note' }]);
  });

  it("shows every stage's controls on a phone", () => {
    phone(true);
    show();
    expect(screen.getAllByRole('toolbar')).toHaveLength(chevrons().conceptRows!.length);
  });

  it('shows none unless the element is selected and editable', () => {
    phone(true);
    const { zone } = show(chevrons(), false);
    expect(zone(0)).toBeNull();
    expect(screen.queryAllByRole('toolbar')).toHaveLength(0);
  });
});
