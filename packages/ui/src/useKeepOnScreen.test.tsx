// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { onScreenTranslate, useKeepOnScreen, type KeepOnScreenOptions } from './useKeepOnScreen';

// Every rect read in a test: the overlay's natural box (its translate is not drawn by jsdom, so the hook's own
// subtraction is what is tested) and its anchor's.
const rects = new Map<string, { left: number; top: number; width: number; height: number }>();
const asRect = ({
  left,
  top,
  width,
  height,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
}) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
  }) as DOMRect;
let reads = 0;

beforeEach(() => {
  reads = 0;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    reads += 1;
    const id = this.dataset.box ?? '';
    const r = rects.get(id) ?? { left: 0, top: 0, width: 0, height: 0 };
    // The overlay as drawn: its natural box moved by the translate it carries.
    const t = /translate\((-?[\d.]+)px(?:, (-?[\d.]+)px)?\)/.exec(this.style.transform);
    const zoom = Number(this.dataset.zoom ?? 1);
    return asRect({
      ...r,
      left: r.left + (t ? Number(t[1]) * zoom : 0),
      top: r.top + (t ? Number(t[2] ?? 0) * zoom : 0),
    });
  });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
});

afterEach(() => {
  vi.restoreAllMocks();
  rects.clear();
});

function Overlay({
  open,
  options,
  zoom = 1,
}: {
  open: unknown;
  options?: KeepOnScreenOptions;
  zoom?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const shift = useKeepOnScreen(ref, open, options);
  return (
    <div data-box="anchor" data-testid="anchor">
      <div
        ref={ref}
        data-box="overlay"
        data-zoom={zoom}
        data-testid="overlay"
        style={{ transform: onScreenTranslate(shift) }}
      />
    </div>
  );
}

const transformOf = (el: HTMLElement) => el.style.transform;

describe('useKeepOnScreen', () => {
  it('leaves an overlay that fits where it is', () => {
    rects.set('overlay', { left: 20, top: 100, width: 200, height: 20 });
    const { getByTestId } = render(<Overlay open />);
    expect(transformOf(getByTestId('overlay'))).toBe('');
  });

  it('right edge: slides an overlay hung near the right of a phone left, once as it opens', () => {
    rects.set('overlay', { left: 300, top: 100, width: 200, height: 20 });
    const { getByTestId } = render(<Overlay open />);
    expect(transformOf(getByTestId('overlay'))).toBe('translate(-118px)');
  });

  it('left edge: slides one past the left back on', () => {
    rects.set('overlay', { left: -30, top: 100, width: 100, height: 20 });
    const { getByTestId } = render(<Overlay open="a" />);
    expect(transformOf(getByTestId('overlay'))).toBe('translate(38px)');
  });

  it('bottom edge: flips above its anchor', () => {
    rects.set('anchor', { left: 20, top: 780, width: 100, height: 20 });
    rects.set('overlay', { left: 20, top: 806, width: 200, height: 120 });
    const { getByTestId } = render(
      <Overlay open options={{ anchor: () => document.querySelector('[data-testid="anchor"]') }} />,
    );
    expect(transformOf(getByTestId('overlay'))).toBe('translate(0px, -152px)');
  });

  it('top edge: flips under an anchor given as its top and bottom', () => {
    rects.set('overlay', { left: 20, top: -14, width: 200, height: 30 });
    const { getByTestId } = render(
      <Overlay open options={{ anchor: () => ({ top: 20, bottom: 40 }) }} />,
    );
    expect(transformOf(getByTestId('overlay'))).toBe('translate(0px, 58px)');
  });

  it('a missing anchor slides it in instead', () => {
    rects.set('overlay', { left: 20, top: -14, width: 200, height: 30 });
    const { getByTestId } = render(<Overlay open options={{ anchor: () => null }} />);
    expect(transformOf(getByTestId('overlay'))).toBe('translate(0px, 22px)');
  });

  it('measures nothing while closed, and returns to no shift once the room is back', () => {
    rects.set('overlay', { left: 300, top: 100, width: 200, height: 20 });
    const { getByTestId, rerender } = render(<Overlay open={null} />);
    expect(reads).toBe(0);
    expect(transformOf(getByTestId('overlay'))).toBe('');
    rerender(<Overlay open="first" />);
    expect(transformOf(getByTestId('overlay'))).toBe('translate(-118px)');
    rects.set('overlay', { left: 20, top: 100, width: 200, height: 20 });
    rerender(<Overlay open="second" />);
    expect(transformOf(getByTestId('overlay'))).toBe('');
  });

  it('measures once per open, not per render', () => {
    rects.set('overlay', { left: 300, top: 100, width: 200, height: 20 });
    const { rerender } = render(<Overlay open="same" />);
    const after = reads;
    rerender(<Overlay open="same" />);
    rerender(<Overlay open="same" />);
    expect(reads).toBe(after);
  });

  it('gives the shift in the units of a zoomed canvas, and a zoom alone never re-measures', () => {
    rects.set('overlay', { left: 300, top: 100, width: 200, height: 20 });
    const { getByTestId, rerender } = render(<Overlay open zoom={2} options={{ scale: 2 }} />);
    expect(transformOf(getByTestId('overlay'))).toBe('translate(-59px)');
    const after = reads;
    rerender(<Overlay open zoom={4} options={{ scale: 4 }} />);
    expect(reads).toBe(after);
  });

  it('revealOn parent: an always-mounted hover line measures as the pointer or focus enters its parent', () => {
    rects.set('overlay', { left: 300, top: 100, width: 200, height: 20 });
    const { getByTestId, unmount } = render(
      <Overlay open={false} options={{ revealOn: 'parent' }} />,
    );
    expect(reads).toBe(0);
    act(() => {
      fireEvent.pointerEnter(getByTestId('anchor'));
    });
    expect(transformOf(getByTestId('overlay'))).toBe('translate(-118px)');
    rects.set('overlay', { left: 10, top: 100, width: 200, height: 20 });
    act(() => {
      fireEvent.focusIn(getByTestId('anchor'));
    });
    expect(transformOf(getByTestId('overlay'))).toBe('');
    const anchor = getByTestId('anchor');
    unmount();
    const before = reads;
    fireEvent.pointerEnter(anchor);
    expect(reads).toBe(before);
  });

  it('does nothing with no element to measure', () => {
    function Empty() {
      const ref = useRef<HTMLDivElement>(null);
      const shift = useKeepOnScreen(ref, true);
      return <span>{onScreenTranslate(shift) ?? 'none'}</span>;
    }
    const { getByText } = render(<Empty />);
    expect(getByText('none')).toBeTruthy();
    expect(reads).toBe(0);
  });
});
