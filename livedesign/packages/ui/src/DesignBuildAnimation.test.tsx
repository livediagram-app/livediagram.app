// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesignBuildAnimation } from './DesignBuildAnimation';

describe('DesignBuildAnimation', () => {
  it('names the picture, or hides it when it is decoration', () => {
    const named = render(<DesignBuildAnimation label="Designing a logo" />).container;
    expect(named.querySelector('svg')!.getAttribute('role')).toBe('img');
    expect(named.querySelector('svg')!.getAttribute('aria-label')).toBe('Designing a logo');
    const plain = render(<DesignBuildAnimation label="" />).container;
    expect(plain.querySelector('svg')!.getAttribute('role')).toBeNull();
    expect(plain.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps every keyframe stop inside the loop', () => {
    const css = render(<DesignBuildAnimation />).container.querySelector('style')!.textContent ?? '';
    const stops = [...css.matchAll(/(-?[\d.]+)%\s*[{,]/g)].map((m) => Number(m[1]));
    expect(stops.length).toBeGreaterThan(50);
    expect(stops.every((t) => t >= 0 && t <= 100)).toBe(true);
  });
});
