// @vitest-environment jsdom

// docs/specs/007-editor/pages-mode.md "The layout gallery" (livedesign, livedocuments): the shared
// layout tile draws its preview once near view, previews on hover and focus, places on a press,
// and marks the layout last placed.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DRAW_AHEAD_PX, LayoutCard, type LayoutCardProps } from './LayoutCard';

const tile = () => document.querySelector('[data-layout-tile]') as HTMLButtonElement;

function card(over: Partial<LayoutCardProps<'hero'>> = {}) {
  return (
    <LayoutCard
      id="hero"
      label="Hero"
      description="A big headline over a picture"
      width={160}
      height={90}
      described={false}
      scrollRoot={{ current: null }}
      thumb={() => <svg data-testid="thumb" />}
      onPick={vi.fn()}
      onPreview={vi.fn()}
      {...over}
    />
  );
}

describe('LayoutCard', () => {
  const prior = globalThis.IntersectionObserver;
  afterEach(() => {
    globalThis.IntersectionObserver = prior;
  });

  it('draws its preview only once it comes near view, watching that far ahead', () => {
    const hits: ((hit: boolean) => void)[] = [];
    const margins: (string | undefined)[] = [];
    const stop = vi.fn();
    globalThis.IntersectionObserver = class {
      constructor(cb: (e: { isIntersecting: boolean }[]) => void, opts?: IntersectionObserverInit) {
        hits.push((hit) => cb([{ isIntersecting: hit }]));
        margins.push(opts?.rootMargin);
      }
      observe() {}
      disconnect = stop;
    } as unknown as typeof IntersectionObserver;
    render(card());
    expect(screen.queryByTestId('thumb')).toBeNull();
    expect(margins[0]).toBe(`${DRAW_AHEAD_PX}px`);
    act(() => hits[0]!(false));
    expect(screen.queryByTestId('thumb')).toBeNull();
    act(() => hits[0]!(true));
    expect(screen.getByTestId('thumb')).not.toBeNull();
    expect(stop).toHaveBeenCalled();
  });

  it('previews on hover and focus, places on a press, and names itself in full', () => {
    const onPick = vi.fn();
    const onPreview = vi.fn();
    render(card({ onPick, onPreview }));
    fireEvent.pointerEnter(tile());
    expect(onPreview).toHaveBeenLastCalledWith('hero');
    onPreview.mockClear();
    fireEvent.focus(tile());
    expect(onPreview).toHaveBeenLastCalledWith('hero');
    fireEvent.click(tile());
    expect(onPick).toHaveBeenCalledWith('hero');
    expect(tile().getAttribute('aria-label')).toBe('Hero: A big headline over a picture');
    expect(screen.getByTestId('thumb')).not.toBeNull();
  });

  it('shows its description only where the gallery has room', () => {
    const { rerender } = render(card());
    expect(screen.queryByText('A big headline over a picture')).toBeNull();
    rerender(card({ described: true }));
    expect(screen.getByText('A big headline over a picture')).not.toBeNull();
    // Placed where the browser cannot scroll an element into view (jsdom): marked all the same.
    rerender(card({ described: true, current: true }));
    expect(screen.getByText('Placed')).not.toBeNull();
  });

  it('offers Use at rest, and once placed wears Placed instead and comes into view', () => {
    const scrollIntoView = vi.fn();
    const proto = HTMLElement.prototype as { scrollIntoView?: unknown };
    const had = proto.scrollIntoView;
    proto.scrollIntoView = scrollIntoView;
    const { rerender } = render(card());
    expect(screen.getByText('Use')).not.toBeNull();
    expect(tile().getAttribute('aria-current')).toBeNull();
    expect(tile().hasAttribute('data-placed')).toBe(false);
    expect(scrollIntoView).not.toHaveBeenCalled();
    rerender(card({ current: true }));
    expect(screen.queryByText('Use')).toBeNull();
    expect(screen.getByText('Placed')).not.toBeNull();
    expect(tile().getAttribute('aria-current')).toBe('true');
    expect(tile().hasAttribute('data-placed')).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    proto.scrollIntoView = had;
  });

  it('keeps its hover and focus states to opacity and transform, behind reduced motion', () => {
    render(card());
    const classes = [...tile().querySelectorAll('*'), tile()]
      .map((el) => el.getAttribute('class') ?? '')
      .join(' ');
    // No animated shadow or filter: the raised shadow is a layer faded in.
    expect(classes).not.toMatch(/group-hover:shadow|hover:shadow|filter|blur/);
    expect(classes).not.toMatch(/group-hover:ring-2/);
    expect(classes).toContain('motion-reduce:transition-none');
    expect(classes).toContain('motion-reduce:group-hover:translate-y-0');
  });
});
