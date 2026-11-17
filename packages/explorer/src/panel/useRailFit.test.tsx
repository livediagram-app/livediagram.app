import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { railContent, railTight, useRailFit } from './useRailFit';

// The signed-in rail's default content, measured in the livediagram editor's popover (Work Tracker 1205): 604 px
// with the card's picture, 102 px of it the picture and its gap.
const FULL = 604;
const PICTURE = 102;

describe('railTight', () => {
  it('keeps the picture while the whole rail fits', () => {
    expect(railTight({ tight: false, content: FULL, room: 636, picture: 0 })).toBe(false);
    expect(railTight({ tight: false, content: FULL, room: FULL, picture: 0 })).toBe(false);
  });

  it('drops the picture once the rail would scroll, even by a pixel', () => {
    expect(railTight({ tight: false, content: FULL, room: 603, picture: PICTURE })).toBe(true);
  });

  it('takes the picture back only when the card fits whole', () => {
    const tight = FULL - PICTURE;
    expect(railTight({ tight: true, content: tight, room: 529, picture: PICTURE })).toBe(true);
    expect(railTight({ tight: true, content: tight, room: FULL, picture: PICTURE })).toBe(false);
  });

  it('allows half a pixel of subpixel layout', () => {
    expect(railTight({ tight: false, content: 529.4, room: 529, picture: PICTURE })).toBe(false);
  });
});

// A rail of three blocks: a picture of `pic` px over the card's lines, then entries, laid out by hand.
function stubLayout(nav: HTMLElement, room: { h: number }, pic: number) {
  const [card, mid, last] = [...nav.children] as HTMLElement[];
  const picture = nav.querySelector<HTMLElement>('[data-current-picture]')!;
  const shown = () => !nav.hasAttribute('data-rail-tight');
  const rect = (top: number, h: number) => ({ top, bottom: top + h, height: h }) as DOMRect;
  const cardH = () => 60 + (shown() ? pic + 6 : 0);
  vi.spyOn(card!, 'getBoundingClientRect').mockImplementation(() => rect(12, cardH()));
  vi.spyOn(mid!, 'getBoundingClientRect').mockImplementation(() => rect(12 + cardH(), 300));
  vi.spyOn(last!, 'getBoundingClientRect').mockImplementation(() => rect(312 + cardH(), 120));
  vi.spyOn(picture, 'getBoundingClientRect').mockImplementation(() => rect(12, pic));
  vi.spyOn(picture, 'getClientRects').mockImplementation(
    () => (shown() ? [rect(12, pic)] : []) as unknown as DOMRectList,
  );
  Object.defineProperty(nav, 'clientHeight', { configurable: true, get: () => room.h });
  nav.style.paddingTop = '12px';
  nav.style.paddingBottom = '12px';
  card!.style.rowGap = '6px';
}

let observers: { cb: ResizeObserverCallback; targets: Element[] }[] = [];
class FakeObserver {
  entry: { cb: ResizeObserverCallback; targets: Element[] };
  constructor(cb: ResizeObserverCallback) {
    this.entry = { cb, targets: [] };
    observers.push(this.entry);
  }
  observe(el: Element) {
    this.entry.targets.push(el);
  }
  disconnect() {
    observers = observers.filter((o) => o !== this.entry);
  }
  unobserve() {}
}
const resize = () =>
  act(() => {
    for (const o of observers) o.cb([], o as unknown as ResizeObserver);
  });

function Probe({ enabled = true, layoutKey = 'a' }: { enabled?: boolean; layoutKey?: string }) {
  const ref = useRef<HTMLElement>(null);
  const tight = useRailFit(ref, enabled, layoutKey);
  return (
    <nav ref={ref} data-rail-tight={tight ? '' : undefined}>
      <section style={{ display: 'flex', flexDirection: 'column' }}>
        <span data-current-picture="" />
        <span>Untitled canvas</span>
      </section>
      <div>entries</div>
      <div>more</div>
    </nav>
  );
}

describe('useRailFit', () => {
  beforeEach(() => {
    observers = [];
    vi.stubGlobal('ResizeObserver', FakeObserver);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // The rail's content (its padding included) is 12 + 60 + 102 + 6 + 300 + 120 + 12 = 612 with the picture.
  function mount(h: number, props: { enabled?: boolean; layoutKey?: string } = {}) {
    const room = { h };
    const view = render(<Probe {...props} />);
    const nav = view.container.querySelector('nav')!;
    stubLayout(nav, room, PICTURE);
    view.rerender(<Probe {...props} layoutKey={`${props.layoutKey ?? 'a'}-laid-out`} />);
    const scrollHeight = () => Math.max(railContent(nav), room.h);
    return { view, nav, room, scrollHeight };
  }

  it('shows no scrollbar while the rail fits: its scrollHeight equals its clientHeight', () => {
    const { nav, scrollHeight } = mount(636);
    expect(nav.hasAttribute('data-rail-tight')).toBe(false);
    expect(scrollHeight()).toBe(nav.clientHeight);
  });

  it('drops the picture on a short window so the rail fits without scrolling', () => {
    const { nav, scrollHeight } = mount(529);
    expect(nav.hasAttribute('data-rail-tight')).toBe(true);
    expect(scrollHeight()).toBe(nav.clientHeight);
  });

  it('still scrolls when the content really is taller than the rail', () => {
    const { nav, scrollHeight } = mount(429);
    expect(nav.hasAttribute('data-rail-tight')).toBe(true);
    expect(scrollHeight()).toBeGreaterThan(nav.clientHeight);
  });

  it('takes the picture back when the window grows, and drops it again when it shrinks', () => {
    const { nav, room } = mount(529);
    expect(nav.hasAttribute('data-rail-tight')).toBe(true);
    room.h = 612;
    resize();
    expect(nav.hasAttribute('data-rail-tight')).toBe(false);
    room.h = 611;
    resize();
    expect(nav.hasAttribute('data-rail-tight')).toBe(true);
  });

  it('measures nothing on a phone, and lets go of its observer on unmount', () => {
    const { nav, view } = mount(429, { enabled: false });
    expect(nav.hasAttribute('data-rail-tight')).toBe(false);
    expect(observers).toHaveLength(0);
    view.rerender(<Probe layoutKey="desktop" />);
    expect(observers).toHaveLength(1);
    view.unmount();
    expect(observers).toHaveLength(0);
  });

  it('keeps the picture without layout (no ResizeObserver)', () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('ResizeObserver', undefined);
    const { nav } = mount(100);
    expect(nav.hasAttribute('data-rail-tight')).toBe(false);
  });

  it('reads an empty rail as no content', () => {
    expect(railContent(document.createElement('nav'))).toBe(0);
  });
});
