// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartHover, type ChartHoverProps } from './ChartHover';
import { createEmphasis, emphasisProps } from './emphasis';
import type { HoverSeries } from './hover-model';

// The shared hover overlay (liveworkspace/docs/specs/008-telemetry/telemetry.md "Tooltips"): snapping, the markers
// at the hovered bucket, the tooltip and its placement, pinning, touch scrubbing, the keyboard and the live region.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
let frames: FrameRequestCallback[] = [];

// The plot is 500 px wide from x = 100, 200 px tall from y = 300, in a 1200 by 800 viewport.
const PLOT = {
  left: 100,
  top: 300,
  width: 500,
  height: 200,
  right: 600,
  bottom: 500,
  x: 100,
  y: 300,
};

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return { ...PLOT, toJSON: () => PLOT };
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => 200,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => 100,
  });
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: 1200,
  });
  vi.stubGlobal('innerHeight', 800);
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const flushFrames = () =>
  act(() => {
    const run = frames;
    frames = [];
    for (const cb of run) cb(0);
  });

const SERIES: HoverSeries[] = [
  {
    key: 'livediagram.app',
    label: 'livediagram.app',
    app: 'livediagram.app',
    color: 'red',
    values: [100, 120, 90, 3000, 10],
    y: [50, 40, 55, 0, 95],
  },
  {
    key: 'liveplanner.app',
    label: 'liveplanner.app',
    color: 'blue',
    values: [5, 200, 9, 1500, 2],
    y: [90, 20, 88, 50, 99],
  },
  {
    key: 'total',
    label: 'Total',
    color: 'currentColor',
    values: [105, 320, 99, 4500, 12],
    total: true,
  },
];

function mount(props: Partial<ChartHoverProps> = {}, wrap?: (el: HTMLElement) => HTMLElement) {
  host = document.createElement('div');
  host.setAttribute('data-app', 'liveplanner.app');
  document.body.appendChild(host);
  const parent = wrap ? wrap(host) : host;
  const mountAt = document.createElement('div');
  parent.appendChild(mountAt);
  root = createRoot(mountAt);
  act(() =>
    root!.render(
      <ChartHover
        n={5}
        series={SERIES}
        heading={(i) => `Day ${i + 1}`}
        label="Events per day"
        {...props}
      />,
    ),
  );
  return host.querySelector<HTMLElement>('[data-chart-hover]')!;
}

function pointer(el: Element, type: string, clientX: number, pointerType = 'mouse') {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX });
  Object.defineProperty(e, 'pointerType', { value: pointerType });
  act(() => {
    el.dispatchEvent(e);
  });
}
const key = (el: Element, k: string) =>
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  });

// jsdom matches :focus-visible on every focus, with no pointer heuristic: pin it to the kind of focus a test means.
function focusAs(el: HTMLElement, visible: boolean) {
  const matches = Element.prototype.matches;
  vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, sel: string) {
    return sel === ':focus-visible' ? visible : matches.call(this, sel);
  });
  act(() => el.focus());
}
const keyboardFocus = (el: HTMLElement) => focusAs(el, true);
const mouseFocus = (el: HTMLElement) => focusAs(el, false);

const tooltip = () => document.querySelector<HTMLElement>('[data-chart-tooltip]');
const rowKeys = () =>
  [...(tooltip()?.querySelectorAll('[data-row]') ?? [])].map((r) => r.getAttribute('data-row'));

describe('ChartHover', () => {
  it('snaps a pointer anywhere over the plot to the nearest day, once per frame', () => {
    const chart = mount();
    // x = 100 + 0.7 * 500: between day 3 (0.5) and day 4 (0.75), nearer day 4.
    pointer(chart, 'pointermove', 451);
    expect(tooltip()).toBeNull();
    pointer(chart, 'pointermove', 460);
    expect(frames).toHaveLength(1);
    flushFrames();
    expect(tooltip()?.textContent).toContain('Day 4');
  });

  it('marks the hovered day: a crosshair at its x and a dot on every line at its value', () => {
    const chart = mount();
    pointer(chart, 'pointermove', 100 + 0.25 * 500);
    flushFrames();
    const cross = chart.querySelector<HTMLElement>('[data-crosshair]')!;
    expect(cross.getAttribute('data-crosshair')).toBe('1');
    expect(cross.style.transform).toBe('translateX(25%)');
    const dots = [...chart.querySelectorAll<HTMLElement>('[data-marker]')];
    // The Total has no y, so no dot; each line's dot sits at its own value that day.
    expect(dots.map((d) => [d.dataset.marker, d.style.transform])).toEqual([
      ['livediagram.app', 'translateY(40%)'],
      ['liveplanner.app', 'translateY(20%)'],
    ]);
    // The dot wears its line's app accent.
    expect(dots[0]!.querySelector('[data-app]')?.getAttribute('data-app')).toBe('livediagram.app');
  });

  it('lists every line largest first with its change, the Total under them, with separators', () => {
    const chart = mount();
    pointer(chart, 'pointermove', 100 + 0.75 * 500);
    flushFrames();
    expect(rowKeys()).toEqual(['livediagram.app', 'liveplanner.app', 'total']);
    const text = tooltip()!.textContent;
    expect(text).toContain('Day 4');
    expect(text).toContain('3,000');
    expect(text).toContain('+3,233%');
    expect(text).toContain('4,500');
    // Portalled, it copies the page's accent scope.
    expect(tooltip()!.getAttribute('data-app')).toBe('liveplanner.app');
  });

  it('places the tooltip right of the crosshair, and flips it left near the edge', () => {
    const chart = mount();
    pointer(chart, 'pointermove', 100 + 0.25 * 500);
    flushFrames();
    // Crosshair at 225 px: the tooltip starts 14 px right of it, level with the plot's top.
    expect(tooltip()!.style.transform).toBe('translate3d(239px, 300px, 0px)');
    expect(tooltip()!.dataset.side).toBe('right');
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 700,
    });
    pointer(chart, 'pointermove', 600);
    flushFrames();
    // Crosshair at 600 px in a 700 px viewport: the tooltip ends 14 px left of it.
    expect(tooltip()!.style.transform).toBe('translate3d(386px, 300px, 0px)');
    expect(tooltip()!.dataset.side).toBe('left');
  });

  it('closes when the mouse leaves, and stays when pinned by a click until a click elsewhere', () => {
    const chart = mount();
    pointer(chart, 'pointermove', 100);
    flushFrames();
    expect(tooltip()?.textContent).toContain('Click to Pin');
    act(() => {
      chart.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100 }));
    });
    expect(tooltip()?.textContent).toContain('Pinned');
    expect(tooltip()!.className).toContain('pointer-events-auto');
    // Pinned: moving and leaving change nothing.
    pointer(chart, 'pointermove', 600);
    flushFrames();
    pointer(chart, 'pointerout', 600);
    expect(tooltip()?.textContent).toContain('Day 1');
    pointer(document.body, 'pointerdown', 0);
    expect(tooltip()).toBeNull();
  });

  it('unpins on Escape wherever focus is', () => {
    const chart = mount();
    pointer(chart, 'pointermove', 100);
    flushFrames();
    act(() => {
      chart.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100 }));
    });
    key(document.body, 'Escape');
    expect(tooltip()).toBeNull();
  });

  it('is no tab stop and never pins inside a card that opens on a click', () => {
    const chart = mount({}, (el) => {
      const card = document.createElement('div');
      card.setAttribute('role', 'button');
      el.appendChild(card);
      return card;
    });
    expect(chart.hasAttribute('tabindex')).toBe(false);
    pointer(chart, 'pointermove', 100);
    flushFrames();
    act(() => {
      chart.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100 }));
    });
    expect(tooltip()?.textContent).not.toContain('Pinned');
  });

  it('scrubs with a finger: a tap shows the day, a drag follows, the tooltip stays until a tap elsewhere', () => {
    const chart = mount();
    pointer(chart, 'pointerdown', 100, 'touch');
    expect(tooltip()?.textContent).toContain('Day 1');
    pointer(chart, 'pointermove', 350, 'touch');
    flushFrames();
    expect(tooltip()?.textContent).toContain('Day 3');
    pointer(chart, 'pointerup', 350, 'touch');
    pointer(chart, 'pointerout', 350, 'touch');
    expect(tooltip()?.textContent).toContain('Day 3');
    expect(tooltip()?.textContent).not.toContain('Click to Pin');
    pointer(document.body, 'pointerdown', 0, 'touch');
    expect(tooltip()).toBeNull();
  });

  it('reads with the keyboard: focus shows the latest day, arrows step, Escape closes, the live region speaks', () => {
    const chart = mount();
    expect(chart.tabIndex).toBe(0);
    expect(chart.getAttribute('aria-label')).toBe(
      'Events per day. Left and Right arrows read each day.',
    );
    keyboardFocus(chart);
    expect(tooltip()?.textContent).toContain('Day 5');
    const live = chart.querySelector('[aria-live="polite"]')!;
    expect(live.textContent).toBe(
      'Day 5. livediagram.app 10, down 100%. liveplanner.app 2, down 100%. Total 12, down 100%.',
    );
    key(chart, 'ArrowLeft');
    expect(live.textContent).toMatch(/^Day 4\. livediagram\.app 3,000, up 3,233%\./);
    key(chart, 'Home');
    expect(live.textContent).toMatch(/^Day 1\./);
    key(chart, 'ArrowLeft');
    expect(live.textContent).toMatch(/^Day 1\./);
    key(chart, 'End');
    expect(live.textContent).toMatch(/^Day 5\./);
    key(chart, 'Escape');
    expect(tooltip()).toBeNull();
    expect(live.textContent).toBe('');
  });

  it('keeps the live region quiet for a mouse, and shows nothing on a mouse focus', () => {
    const chart = mount();
    mouseFocus(chart);
    expect(tooltip()).toBeNull();
    pointer(chart, 'pointermove', 100);
    flushFrames();
    expect(chart.querySelector('[aria-live="polite"]')!.textContent).toBe('');
  });

  it('emphasises a line from its legend entry, from Up and Down, and from a pinned row', () => {
    const emphasis = createEmphasis();
    const chart = mount({ emphasis });
    keyboardFocus(chart);
    const dot = (k: string) => chart.querySelector(`[data-marker="${k}"] span`)!;
    expect(dot('liveplanner.app').className).not.toContain('scale-150');
    act(() => emphasisProps(emphasis, 'liveplanner.app').onPointerEnter());
    expect(dot('liveplanner.app').className).toContain('scale-150');
    expect(tooltip()!.querySelector('[data-row="liveplanner.app"]')!.className).toContain(
      'font-semibold',
    );
    act(() => emphasisProps(emphasis, 'liveplanner.app').onPointerLeave());
    expect(dot('liveplanner.app').className).not.toContain('scale-150');
    key(chart, 'ArrowDown');
    expect(emphasis.get()).toBe('livediagram.app');
    key(chart, 'ArrowUp');
    expect(emphasis.get()).toBe('total');
    act(() => {
      tooltip()!
        .querySelector('[data-row="liveplanner.app"]')!
        .dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    });
    expect(emphasis.get()).toBe('liveplanner.app');
  });

  it('tints a bar chart’s hovered band and veils the others', () => {
    const chart = mount({
      mode: 'bands',
      n: 4,
      change: false,
      series: [{ key: 'timings', label: 'Timings', color: 'red', values: [1, 2, 3, 4] }],
    });
    // 0.3 of the way across: the second of four bands.
    pointer(chart, 'pointermove', 100 + 0.3 * 500);
    flushFrames();
    const band = chart.querySelector<HTMLElement>('[data-band]')!;
    expect(band.dataset.band).toBe('1');
    expect(band.style.width).toBe('25%');
    expect(band.style.transform).toBe('translateX(100%)');
    expect(tooltip()!.textContent).not.toMatch(/New|Flat|%/);
  });
});
