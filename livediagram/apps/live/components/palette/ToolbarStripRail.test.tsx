// @vitest-environment jsdom
// The strip's animated rail (docs/specs/007-editor/toolbar-layout.md): tiles pop in only on a real category
// switch, and the outgoing set leaves on an inert layer.
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MOTION_MS } from '@livediagram/tailwind-config/motion';
import { RAIL_LEAVE_MS, ToolbarStripRail } from './ToolbarStripRail';

// The observers made, so a test can report a resize of the rail's content.
const observers: (() => void)[] = [];
beforeAll(() => {
  globalThis.ResizeObserver = class {
    readonly cb: () => void;
    constructor(cb: () => void) {
      this.cb = cb;
    }
    observe() {
      observers.push(this.cb);
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

const items = (...labels: string[]) => labels.map((l) => <button key={l}>{l}</button>);
const wrappers = (container: HTMLElement) =>
  [...container.querySelectorAll('button')]
    .filter((b) => !b.closest('[aria-hidden]'))
    .map((b) => b.parentElement!);

describe('ToolbarStripRail', () => {
  it('shows the first set without animating it in', () => {
    const { container } = render(
      <ToolbarStripRail railKey="a" items={items('one', 'two')} leavingItems={null} />,
    );
    for (const w of wrappers(container)) expect(w.className).not.toContain('animate-pop-in');
  });

  it('pops the new set in, one beat apart, after a switch', () => {
    const view = render(<ToolbarStripRail railKey="a" items={items('one')} leavingItems={null} />);
    view.rerender(
      <ToolbarStripRail railKey="b" items={items('two', 'three')} leavingItems={null} />,
    );
    const ws = wrappers(view.container);
    expect(ws.map((w) => w.textContent)).toEqual(['two', 'three']);
    for (const w of ws) expect(w.className).toContain('stagger-enter animate-pop-in');
    expect(ws.map((w) => w.style.getPropertyValue('--stagger-i'))).toEqual(['0', '1']);
    // The beat is the shared cascade step (docs/specs/004-interface-design/motion.md), not a
    // local override, so the whole switch settles within the motion budget.
    for (const w of ws) expect(w.style.getPropertyValue('--stagger-step')).toBe('');
  });

  it('holds the outgoing layer exactly as long as its pop-out runs', () => {
    const { container } = render(
      <ToolbarStripRail railKey="b" items={items('two')} leavingItems={items('one')} />,
    );
    const leaving = container.querySelector('[aria-hidden] .animate-pop-out') as HTMLElement;
    expect(RAIL_LEAVE_MS).toBe(MOTION_MS.micro);
    expect(leaving.style.animationDuration).toBe(`${MOTION_MS.micro}ms`);
  });

  it('lays the outgoing set over the top, inert and hidden from assistive tech', () => {
    const { container } = render(
      <ToolbarStripRail railKey="b" items={items('two')} leavingItems={items('one')} />,
    );
    const layer = container.querySelector('[aria-hidden]') as HTMLElement;
    expect(layer).not.toBeNull();
    expect(layer.hasAttribute('inert')).toBe(true);
    expect(layer.textContent).toBe('one');
    expect(layer.querySelector('.animate-pop-out')).not.toBeNull();
  });

  it("keeps a reordered tile's node and pops in only the tile new to the rail", () => {
    const view = render(
      <ToolbarStripRail railKey="a" items={items('one', 'two', 'three')} leavingItems={null} />,
    );
    const two = view.getByText('two');
    view.rerender(
      <ToolbarStripRail railKey="a" items={items('four', 'one', 'two')} leavingItems={null} />,
    );
    expect(view.getByText('two')).toBe(two);
    const byLabel = (l: string) => view.getByText(l).parentElement!.className;
    expect(byLabel('four')).toContain('animate-pop-in');
    expect(byLabel('one')).not.toContain('animate-pop-in');
    // The tile pushed off the end leaves on an inert layer.
    const leaving = [...view.container.querySelectorAll('[aria-hidden] button')].map(
      (b) => b.textContent,
    );
    expect(leaving).toEqual(['three']);
  });

  // A tile sliding to its new slot (fewer card types) overflows sideways while it slides: the rail takes the
  // content's laid-out width, never that overflow, so no gap is left after the last tile.
  it('sizes itself to the tiles as laid out, not to a tile caught mid-slide', () => {
    const { container } = render(
      <ToolbarStripRail railKey="a" items={items('one', 'two')} leavingItems={null} />,
    );
    const rail = container.querySelector('[data-strip-rail]') as HTMLElement;
    const content = rail.firstElementChild as HTMLElement;
    Object.defineProperty(content, 'offsetWidth', { configurable: true, value: 80 });
    Object.defineProperty(content, 'scrollWidth', { configurable: true, value: 115 });
    act(() => observers.forEach((cb) => cb()));
    expect(rail.style.width).toBe('80px');
  });
});
