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
  chevronLayout,
} from '@livediagram/document';
import { ConceptFace } from './ConceptFace';
import { BAR_MIN_SCALE, barScale, barWidthPx } from './ConceptRowBar';
import { HOVER_GRACE_MS } from '@/hooks/ui/useGraceHover';
import { track } from '@/lib/telemetry';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

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

// A media query answered: `on` for the phone query, `touch` for "no hover" (a phone or a tablet).
const media = ({ on = false, touch = on }: { on?: boolean; touch?: boolean }) =>
  vi.stubGlobal(
    'matchMedia',
    (q: string) =>
      ({
        matches: q === '(hover: none)' ? touch : on,
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
const phone = (on: boolean) => media({ on });

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

  it('keeps the controls while the pointer is on a stage name, which lies over its zone', () => {
    vi.useFakeTimers();
    const { zone } = show();
    const at = { left: 100, right: 200, top: 0, bottom: 80 };
    zone(1).getBoundingClientRect = () =>
      ({ ...at, x: 100, y: 0, width: 100, height: 80 }) as DOMRect;
    fireEvent.pointerEnter(zone(1));
    // Onto the name: the zone sees the pointer leave, the names see it move over stage 2.
    fireEvent.pointerLeave(zone(1));
    // A node of the stages drawn over the zones (whatever wraps them).
    const drawn = zone(1).parentElement!.querySelector(':scope > :not([data-concept-row-zone])')!;
    const name = drawn.querySelector('*') ?? drawn;
    fireEvent.pointerMove(name, { clientX: 150, clientY: 40 });
    act(() => vi.advanceTimersByTime(HOVER_GRACE_MS * 2));
    expect(screen.getAllByRole('toolbar').map((t) => t.getAttribute('aria-label'))).toEqual([
      'Stage 2',
    ]);
    // Off the names altogether: gone after the grace.
    fireEvent.pointerLeave(name);
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

  it('records a stage edit as the menu row editor did', () => {
    vi.mocked(track).mockClear();
    const { zone } = show();
    fireEvent.pointerEnter(zone(1));
    fireEvent.click(screen.getByRole('button', { name: 'Move stage left' }));
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'ConceptRows');
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

  it("shows every stage's controls on a tablet too, which is wide but has no hover", () => {
    media({ touch: true });
    show();
    expect(screen.getAllByRole('toolbar')).toHaveLength(chevrons().conceptRows!.length);
  });

  it('keeps a full bar within its stage, clear of the next one', () => {
    phone(true);
    // Three stages 400 wide: a later stage's words are 63 wide, under a full bar's 82, though its step is 120.
    const rows = [{ label: 'A' }, { label: 'B' }, { label: 'C' }];
    show({ ...chevrons(rows), width: 400, height: 200 });
    const { stages } = chevronLayout(400, 200, rows.length, false);
    screen.getAllByRole('toolbar').forEach((bar, i) => {
      const scale = Number(/scale\(([\d.]+)\)/.exec(bar.style.transform)![1]);
      const width = scale * barWidthPx(bar.querySelectorAll('button').length);
      expect(width).toBeLessThanOrEqual(stages[i]!.label.width + 0.5);
    });
  });

  it('shows none unless the element is selected and editable', () => {
    phone(true);
    const { zone } = show(chevrons(), false);
    expect(zone(0)).toBeNull();
    expect(screen.queryAllByRole('toolbar')).toHaveLength(0);
  });
});

describe('barScale', () => {
  const tall = 1000;
  it('keeps a constant screen size while the stage has room', () => {
    expect(barScale({ width: 200, height: tall }, 3, 1)).toBe(1);
    expect(barScale({ width: 400, height: tall }, 3, 2)).toBe(2);
  });

  it('shrinks to fit a narrow or short stage, and gives up below the smallest pressable size', () => {
    const w = barWidthPx(3);
    expect(barScale({ width: w * 0.8, height: tall }, 3, 1)).toBeCloseTo(0.8);
    expect(barScale({ width: w * (BAR_MIN_SCALE - 0.05), height: tall }, 3, 1)).toBeNull();
    // A bar is 30px tall at full size and sits 6px down: it needs 36px above the stage's name.
    expect(barScale({ width: 1000, height: 36 }, 3, 1)).toBeCloseTo(1);
    expect(barScale({ width: 1000, height: 36 * (BAR_MIN_SCALE - 0.05) }, 3, 1)).toBeNull();
  });
});
