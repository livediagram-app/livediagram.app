// @vitest-environment jsdom
// The strip's animated rail (spec/148): tiles pop in only on a real category
// switch, and the outgoing set leaves on an inert layer.
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ToolbarStripRail } from './ToolbarStripRail';

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
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
});
