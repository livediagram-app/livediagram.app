import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RAIL_PICTURE_FULL,
  RAIL_PICTURE_RATIO,
  railContent,
  railPicture,
  useRailFit,
} from './useRailFit';

// The signed-in rail's default content, measured in the livediagram editor's popover (Work Tracker 1205): 604 px
// with the card's picture, 102 px of it the picture (then a 96 px strip) and its gap.
const FULL = 604;
const PICTURE = 102;

describe('railPicture', () => {
  // The content without the picture, and the picture with its 6 px gap as drawn.
  const BASE = FULL - PICTURE;
  const full = 96;
  it('keeps the full picture while the whole rail fits', () => {
    expect(railPicture({ content: FULL, room: 636, shown: PICTURE, gap: 6, full })).toBeNull();
    expect(railPicture({ content: BASE, room: BASE + 6 + 96, shown: 0, gap: 6, full })).toBeNull();
  });

  it('shrinks the picture to the room left before the rail would scroll', () => {
    expect(railPicture({ content: FULL, room: 597, shown: PICTURE, gap: 6, full })).toBe(88);
    const room = BASE + 6 + 49;
    expect(railPicture({ content: FULL, room, shown: PICTURE, gap: 6, full })).toBe(48);
  });

  it('drops the picture with under 48 px to spare, and takes it back once 48 fit', () => {
    const tight = BASE + 6 + 48;
    expect(railPicture({ content: FULL, room: tight, shown: PICTURE, gap: 6, full })).toBe(0);
    expect(railPicture({ content: BASE, room: BASE + 6 + 49, shown: 0, gap: 6, full })).toBe(48);
  });

  it('allows half a pixel of subpixel layout', () => {
    const room = BASE + 6 + 95.6;
    expect(railPicture({ content: BASE, room, shown: 0, gap: 6, full })).toBeNull();
  });

  it("wants the pane cards' 16:9 height, not a fixed strip (Work Tracker 1293)", () => {
    // The 240 px rail's card is 220 px wide: 16:9 of it is the 124 px the rail assumes until it measures.
    expect(Math.round(220 * RAIL_PICTURE_RATIO)).toBe(RAIL_PICTURE_FULL);
    // 100 px spare fitted the old 96 px strip; the 16:9 picture shrinks into it instead.
    expect(railPicture({ content: BASE, room: BASE + 100, shown: 0, gap: 0 })).toBe(99);
    expect(railPicture({ content: BASE, room: BASE + 124, shown: 0, gap: 0 })).toBeNull();
  });
});

// A rail of three blocks: a picture of `pic` px over the card's lines, then entries, laid out by hand.
function stubLayout(nav: HTMLElement, room: { h: number }, pic: number, width = 0) {
  const [card, mid, last] = [...nav.children] as HTMLElement[];
  const picture = nav.querySelector<HTMLElement>('[data-current-picture]')!;
  const shown = () => !nav.hasAttribute('data-rail-tight');
  const rect = (top: number, h: number) => ({ top, bottom: top + h, height: h }) as DOMRect;
  const cardH = () => 60 + (shown() ? pic + 6 : 0);
  vi.spyOn(card!, 'getBoundingClientRect').mockImplementation(() => rect(12, cardH()));
  vi.spyOn(mid!, 'getBoundingClientRect').mockImplementation(() => rect(12 + cardH(), 300));
  vi.spyOn(last!, 'getBoundingClientRect').mockImplementation(() => rect(312 + cardH(), 120));
  vi.spyOn(picture, 'getBoundingClientRect').mockImplementation(
    () => ({ ...rect(12, pic), width }) as DOMRect,
  );
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
  const picture = useRailFit(ref, enabled, layoutKey);
  return (
    <nav
      ref={ref}
      data-rail-tight={picture === 0 ? '' : undefined}
      data-rail-picture={picture ?? 'full'}
    >
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
  function mount(
    h: number,
    props: { enabled?: boolean; layoutKey?: string } = {},
    pic = { h: PICTURE, w: 0 },
  ) {
    const room = { h };
    const view = render(<Probe {...props} />);
    const nav = view.container.querySelector('nav')!;
    stubLayout(nav, room, pic.h, pic.w);
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

  it('takes the picture back when the window grows, shrinks it, then drops it as the window shrinks', () => {
    const { nav, room } = mount(529);
    expect(nav.hasAttribute('data-rail-tight')).toBe(true);
    room.h = 636;
    resize();
    expect(nav.getAttribute('data-rail-picture')).toBe('full');
    // A little short: the picture shrinks to what is left (560 less the 504 px rest, its 6 px gap and a spare pixel).
    room.h = 560;
    resize();
    expect(nav.getAttribute('data-rail-picture')).toBe('49');
    room.h = 550;
    resize();
    expect(nav.hasAttribute('data-rail-tight')).toBe(true);
  });

  it("takes the picture's full height as 16:9 of its width (Work Tracker 1293)", () => {
    // A 224 px wide picture is 126 px tall at 16:9: the rail's content is 636 px with it.
    const { nav, room } = mount(660, {}, { h: 126, w: 224 });
    expect(nav.getAttribute('data-rail-picture')).toBe('full');
    // 2 px short of the whole picture: it shrinks, where the 124 px default alone would keep it full.
    room.h = 634;
    resize();
    expect(nav.getAttribute('data-rail-picture')).toBe('123');
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
