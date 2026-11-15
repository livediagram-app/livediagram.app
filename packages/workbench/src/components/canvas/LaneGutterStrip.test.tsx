// @vitest-environment jsdom
// A lane's title gutter on the canvas (docs/specs/009-elements/lane.md): the strip on the title's edge.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LaneGutterStrip } from './LaneGutterStrip';

const strip = (props: Partial<Parameters<typeof LaneGutterStrip>[0]> = {}) => {
  const { container } = render(
    <LaneGutterStrip stroke="#334155" edge="left" size={132} {...props} />,
  );
  return container.querySelector<HTMLElement>('[data-lane-gutter]')!;
};

describe('LaneGutterStrip', () => {
  it('washes the lane stroke at 10% down the left, with its divider', () => {
    const el = strip();
    expect(el.style.width).toBe('132px');
    expect(el.style.opacity).toBe('0.1');
    expect(el.style.borderRight).toContain('1px solid');
    expect(el.className).toContain('inset-y-0');
    expect(el.className).toContain('rounded-l-[inherit]');
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('paints a heading colour at full strength', () => {
    const el = strip({ headerFill: '#fecdd3', edge: 'right' });
    expect(el.style.opacity).toBe('');
    expect(el.style.borderLeft).toContain('1px solid');
    expect(el.className).toContain('rounded-r-[inherit]');
  });

  it('lies across a band at the top or bottom', () => {
    const top = strip({ edge: 'top', size: 64 });
    expect(top.style.height).toBe('64px');
    expect(top.style.borderBottom).toContain('1px solid');
    expect(top.className).toContain('inset-x-0');
    const bottom = strip({ edge: 'bottom', size: 64 });
    expect(bottom.style.borderTop).toContain('1px solid');
    expect(bottom.className).toContain('rounded-b-[inherit]');
  });

  it('runs down the middle with a rule on both sides', () => {
    const el = strip({ edge: 'centre-x', size: 100 });
    expect(el.style.left).toBe('calc(50% - 50px)');
    expect(el.style.borderLeft).toContain('1px solid');
    expect(el.style.borderRight).toContain('1px solid');
  });
});
