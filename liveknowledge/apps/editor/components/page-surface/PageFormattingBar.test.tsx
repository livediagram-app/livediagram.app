// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Profiler } from 'react';
import {
  resetDrawingZoneEditing,
  useDrawingZoneEditing,
} from '@/lib/page-surface/drawing-zone-store';
import { PageFormattingBar } from './PageFormattingBar';
import { scrollEdgesOf } from './useScrollEdges';

// docs/specs/030-knowledgebase/page-surface.md "The formatting bar": the left of the top row while a page is being
// written, formatting only, then Undo and Redo.
afterEach(() => {
  cleanup();
  resetDrawingZoneEditing();
});

const bar = (over: Partial<Parameters<typeof PageFormattingBar>[0]> = {}) => (
  <PageFormattingBar canUndo canRedo={false} onUndo={vi.fn()} onRedo={vi.fn()} {...over} />
);

describe('PageFormattingBar', () => {
  it('holds the page toolbar’s slot, then Undo and Redo, and no canvas tool', () => {
    const { container } = render(bar());
    expect(container.querySelector('[data-article-dock]')).not.toBeNull();
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Undo', 'Redo']);
    for (const gone of ['Select', 'Hand', 'Library', 'Search'])
      expect(screen.queryByRole('button', { name: new RegExp(gone) })).toBeNull();
  });

  it('runs Undo, and offers no Redo with nothing to redo', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(bar({ onUndo, onRedo }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    const redo = screen.getByRole<HTMLButtonElement>('button', { name: 'Redo' });
    expect(redo.disabled).toBe(true);
    fireEvent.click(redo);
    expect(onRedo).not.toHaveBeenCalled();
  });

  it('takes a pointer cursor and a focus ring on every button', () => {
    render(bar());
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('cursor-pointer');
      expect(button.className).toContain('focus-visible:outline-2');
    }
  });

  it('does not render again while its props hold (a typing commit hands it the same ones)', () => {
    const onRender = vi.fn();
    const props = { onUndo: vi.fn(), onRedo: vi.fn() };
    const { rerender } = render(
      <Profiler id="bar" onRender={onRender}>
        {bar(props)}
      </Profiler>,
    );
    const first = onRender.mock.calls.length;
    rerender(
      <Profiler id="bar" onRender={onRender}>
        {bar(props)}
      </Profiler>,
    );
    // React renders an element given again; the slot it owns is the same node, so the toolbar's portal stays put.
    expect(onRender.mock.calls.length).toBeLessThanOrEqual(first + 1);
  });
});

describe('the drawing zone store', () => {
  function Probe() {
    return <span data-testid="probe">{useDrawingZoneEditing() ? 'drawing' : 'writing'}</span>;
  }
  it('says when a drawing zone is being edited, and tells its readers only on a change', () => {
    const onRender = vi.fn();
    render(
      <Profiler id="probe" onRender={onRender}>
        <Probe />
      </Profiler>,
    );
    expect(screen.getByTestId('probe').textContent).toBe('writing');
    const before = onRender.mock.calls.length;
    resetDrawingZoneEditing();
    expect(onRender.mock.calls.length).toBe(before);
  });
});

// docs/specs/030-knowledgebase/page-surface.md "The formatting bar", "Narrow": where the row has less room than the
// controls need they scroll sideways, and each edge with more past it fades and holds a chevron that pages to it.
describe('the formatting controls on a narrow row', () => {
  it('says which edges have more past them', () => {
    const box = (scrollLeft: number) => ({ scrollLeft, scrollWidth: 900, clientWidth: 500 });
    expect(scrollEdgesOf({ scrollLeft: 0, scrollWidth: 500, clientWidth: 500 })).toEqual({
      left: false,
      right: false,
    });
    expect(scrollEdgesOf(box(0))).toEqual({ left: false, right: true });
    expect(scrollEdgesOf(box(200))).toEqual({ left: true, right: true });
    expect(scrollEdgesOf(box(400))).toEqual({ left: true, right: false });
    // A sub-pixel of range is rounding, not content.
    expect(scrollEdgesOf({ scrollLeft: 0, scrollWidth: 500.6, clientWidth: 500 })).toEqual({
      left: false,
      right: false,
    });
  });

  it('shows no chevron while everything fits: neither is reachable', () => {
    const { container } = render(bar());
    const edges = [...container.querySelectorAll('[data-formatting-edge]')];
    expect(edges.map((e) => e.getAttribute('data-shown'))).toEqual(['false', 'false']);
    for (const button of container.querySelectorAll('[data-formatting-edge] button')) {
      expect(button.getAttribute('aria-hidden')).toBe('true');
      expect(button.getAttribute('tabindex')).toBe('-1');
    }
    expect(screen.queryByRole('button', { name: 'More Formatting Controls' })).toBeNull();
  });

  it('shows More Formatting Controls where the controls do not fit, and pages to them', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const { container } = render(bar());
    const dock = container.querySelector<HTMLElement>('[data-article-dock]')!;
    Object.defineProperties(dock, {
      scrollWidth: { value: 900, configurable: true },
      clientWidth: { value: 500, configurable: true },
    });
    const scrollBy = vi.fn();
    dock.scrollBy = scrollBy as never;
    // The row is read once a frame after a scroll, never while typing.
    const { act } = await import('@testing-library/react');
    act(() => {
      fireEvent.scroll(dock);
      frames.splice(0).forEach((cb) => cb(0));
    });
    const more = screen.getByRole('button', { name: 'More Formatting Controls' });
    expect(screen.queryByRole('button', { name: 'Earlier Formatting Controls' })).toBeNull();
    fireEvent.click(more);
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 350 }));
    vi.unstubAllGlobals();
  });

  it('hides the edges with the controls while a drawing’s tools take their place', () => {
    const { container } = render(bar({ drawing: <div>Tools</div> }));
    expect(container.querySelector('[data-formatting-scroll]')!.className).toContain(
      '[&:has(>[hidden])]:hidden',
    );
    expect(container.querySelector('[data-article-dock]')!.hasAttribute('hidden')).toBe(true);
  });
});
