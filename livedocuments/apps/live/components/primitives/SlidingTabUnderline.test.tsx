// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { SlidingTabUnderline } from './SlidingTabUnderline';

afterEach(cleanup);

function Tabs({ on }: { on: 'a' | 'b' }) {
  const list = useRef<HTMLDivElement>(null);
  return (
    <div ref={list} role="tablist">
      {(['a', 'b'] as const).map((t) => (
        <button key={t} role="tab" aria-selected={t === on} data-t={t}>
          {t}
        </button>
      ))}
      <SlidingTabUnderline list={list} selected={on} />
    </div>
  );
}

describe('SlidingTabUnderline', () => {
  it('moves to the selected tab, sized to it', () => {
    // jsdom has no layout: each tab says where it sits.
    const place = (t: string, left: number, width: number) => {
      const el = document.querySelector<HTMLElement>(`[data-t="${t}"]`)!;
      Object.defineProperty(el, 'offsetLeft', { value: left, configurable: true });
      Object.defineProperty(el, 'offsetWidth', { value: width, configurable: true });
    };
    const { rerender, container } = render(<Tabs on="a" />);
    place('a', 0, 40);
    place('b', 48, 60);
    rerender(<Tabs on="b" />);
    const bar = container.querySelector<HTMLElement>('[data-tab-underline]')!;
    expect(bar.style.transform).toBe('translateX(48px)');
    expect(bar.style.width).toBe('60px');
    expect(bar.style.opacity).toBe('1');
  });
});
