// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHIPS_GAP_PX, chipsMode, chipsRoom, useChipsFit } from './use-chips-fit';

// docs/specs/026-plan/plan-board.md "Card type chips" (Work Tracker 1086): the chips never shrink or clip; short of
// room they drop their names, then step out, the widgets giving way first.
describe('the chips mode', () => {
  it('names them when they may be named and fit, else their little cards, else none', () => {
    expect(chipsMode(206, 206, 72, true)).toBe('named');
    expect(chipsMode(205, 206, 72, true)).toBe('compact');
    expect(chipsMode(400, 206, 72, false)).toBe('compact');
    expect(chipsMode(71, 206, 72, true)).toBe('none');
  });

  it('counts the room to the zone, its surplus (or its shortfall) and the strip', () => {
    expect(chipsRoom({ rowLeft: 100, targetLeft: 400, surplus: 50, cap: Infinity })).toBe(
      300 - CHIPS_GAP_PX + 50,
    );
    expect(chipsRoom({ rowLeft: 100, targetLeft: 400, surplus: -40, cap: Infinity })).toBe(
      300 - CHIPS_GAP_PX - 40,
    );
    expect(chipsRoom({ rowLeft: 100, targetLeft: 400, surplus: 50, cap: 120 })).toBe(120);
  });
});

// Boxes by data attribute: the chips start at 100, the zone's part of the header at `zoneAt`.
let zoneAt = 500;
const rect = (left: number, width = 10) =>
  ({ left, right: left + width, top: 0, bottom: 40, width, height: 40, x: left, y: 0 }) as DOMRect;
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.hasAttribute('data-chips-row')) return rect(100);
    if (this.hasAttribute('data-zone-part')) return rect(zoneAt);
    if (this.hasAttribute('data-board-header')) return rect(0, 1000);
    return rect(0, 0);
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.hasAttribute('data-chips-named-ghost')) return 206;
    if (this.hasAttribute('data-chips-compact-ghost')) return 72;
    return 0;
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.hasAttribute('data-widget-zone-min') ? 300 : 0;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Chips({ canName = true, zone = true }: { canName?: boolean; zone?: boolean }) {
  const row = useRef<HTMLDivElement>(null);
  const mode = useChipsFit(row, canName, 'a,b');
  return (
    <div data-board-header="">
      <div data-chips-row="" ref={row}>
        <span data-chips-named-ghost="" />
        <span data-chips-compact-ghost="" />
      </div>
      {zone ? (
        <div data-zone-part="">
          <div data-widget-zone-min="250" />
        </div>
      ) : (
        <div data-band-controls="" data-zone-part="" />
      )}
      <output>{mode}</output>
    </div>
  );
}

describe('useChipsFit', () => {
  it('names them with room to the zone', () => {
    // 400 - 12 + (300 - 250).
    zoneAt = 500;
    render(<Chips />);
    expect(screen.getByRole('status').textContent).toBe('named');
  });

  it('drops the names, then the chips, as the room goes', () => {
    zoneAt = 230;
    render(<Chips />);
    expect(screen.getByRole('status').textContent).toBe('compact');
    cleanup();
    zoneAt = 120;
    render(<Chips />);
    expect(screen.getByRole('status').textContent).toBe('none');
  });

  it('keeps the little cards for more than three types, and measures to the controls with no zone', () => {
    zoneAt = 500;
    render(<Chips canName={false} />);
    expect(screen.getByRole('status').textContent).toBe('compact');
    cleanup();
    render(<Chips zone={false} />);
    expect(screen.getByRole('status').textContent).toBe('named');
  });
});
