// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BoardBuildAnimation } from './BoardBuildAnimation';

describe('BoardBuildAnimation', () => {
  it('names the picture, or hides it when it is decoration', () => {
    const named = render(<BoardBuildAnimation label="Moving cards along a board" />).container;
    expect(named.querySelector('svg')!.getAttribute('role')).toBe('img');
    expect(named.querySelector('svg')!.getAttribute('aria-label')).toBe(
      'Moving cards along a board',
    );
    const plain = render(<BoardBuildAnimation label="" />).container;
    expect(plain.querySelector('svg')!.getAttribute('role')).toBeNull();
    expect(plain.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps every keyframe stop inside the loop', () => {
    const css = render(<BoardBuildAnimation />).container.querySelector('style')!.textContent!;
    const stops = [...css.matchAll(/(-?[\d.]+)%\s*[{,]/g)].map((m) => Number(m[1]));
    expect(stops.length).toBeGreaterThan(50);
    expect(stops.every((t) => t >= 0 && t <= 100)).toBe(true);
  });
});
