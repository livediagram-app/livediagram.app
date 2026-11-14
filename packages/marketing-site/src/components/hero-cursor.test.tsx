// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CursorMark } from './hero-cursor';

describe('CursorMark', () => {
  it('draws the arrow and a badge sized to its label', () => {
    const { container } = render(
      <svg>
        <CursorMark colour="#f00" label="AB" />
        <CursorMark colour="#00f" label="Ada" badge="wide-name" />
      </svg>,
    );
    const widths = [...container.querySelectorAll('rect')].map((r) => r.getAttribute('width'));
    expect(widths).toEqual(['20', '24']);
    expect([...container.querySelectorAll('text')].map((t) => t.textContent)).toEqual([
      'AB',
      'Ada',
    ]);
    expect(container.querySelector('path')?.getAttribute('fill')).toBe('#f00');
  });
});
