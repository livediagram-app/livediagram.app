// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { filterSquare, startApplying } from '@/lib/photo-editor/apply-ops';
import { harness, photoOf, solid } from '@/lib/photo-editor/photo-test-utils';
import { FilterPointPicker, FilterPreviewSquare, squareAt } from './FilterPreview';
import { photoView } from './photo-view-test-utils';

// docs/specs/031-photo/photo-adjustments.md "Filters": the square at 100%, and a filter's centre placed on
// the photo.
afterEach(cleanup);

describe('the filter square at 100%', () => {
  it('sits within the photo, a photo px a CSS px', () => {
    expect(squareAt({ x: 500, y: 300 }, { width: 1000, height: 600 })).toEqual({
      x: 420,
      y: 220,
      width: 160,
      height: 160,
    });
    expect(squareAt({ x: 10, y: 590 }, { width: 1000, height: 600 })).toMatchObject({
      x: 0,
      y: 440,
    });
    expect(squareAt({ x: 50, y: 50 }, { width: 100, height: 40 })).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 40,
    });
  });

  it('works the filter on its own px from the pixels before', async () => {
    const r = solid(40, 40, [0, 0, 0, 255]);
    for (let y = 0; y < 40; y++)
      for (let x = 20; x < 40; x++) r.data.set([255, 255, 255, 255], (y * 40 + x) * 4);
    const h = harness(photoOf(40, 40), { a: r });
    const a = startApplying(h.s);
    if (typeof a === 'string') throw new Error(a);
    const run = filterSquare(
      h.s,
      a,
      'gaussian-blur',
      { radius: 3 },
      { foreground: '#000000', background: '#ffffff' },
      {
        x: 10,
        y: 10,
        width: 20,
        height: 20,
      },
    );
    const out = await run.done;
    expect(out?.width).toBe(20);
    // At the edge (x 20 is the square's 10th px) the blur mixes black and white.
    const mid = out!.data[(10 * 20 + 10) * 4]!;
    expect(mid).toBeGreaterThan(10);
    expect(mid).toBeLessThan(245);
  });

  it('draws as a canvas that the pointer drags around', () => {
    const { view, s } = photoView();
    const a = startApplying(s);
    if (typeof a === 'string') throw new Error(a);
    render(
      <FilterPreviewSquare photo={view} applying={a} id="gaussian-blur" params={{ radius: 1 }} />,
    );
    const square = screen.getByRole('img', { name: 'Preview at 100%: drag to look around' });
    fireEvent.pointerDown(square, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(square, { clientX: 40, clientY: 45, pointerId: 1 });
    fireEvent.pointerUp(square, { pointerId: 1 });
    expect(square).toBeTruthy();
  });
});

describe('a filter’s centre', () => {
  it('is placed by a press on the photo, and moved by the arrows', () => {
    const { view } = photoView();
    const onChange = vi.fn();
    render(
      <FilterPointPicker
        photo={view}
        name="Centre"
        value={{ x: 0.5, y: 0.5 }}
        onChange={onChange}
      />,
    );
    const picker = screen.getByRole('slider', { name: 'Centre: press the photo to place it' });
    vi.spyOn(picker, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 150,
      right: 200,
      bottom: 150,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(picker, { clientX: 50, clientY: 30, pointerId: 1 });
    expect(onChange).toHaveBeenLastCalledWith({ x: 0.25, y: 0.2 });
    fireEvent.keyDown(picker, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith({ x: 0.51, y: 0.5 });
    fireEvent.keyDown(picker, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith({ x: 0.5, y: 0.49 });
  });
});
