// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageBuildAnimation } from './PageBuildAnimation';

describe('PageBuildAnimation', () => {
  it('names the picture, or hides it when it is decoration', () => {
    const named = render(<PageBuildAnimation label="Writing a document" />).container;
    expect(named.querySelector('svg')!.getAttribute('role')).toBe('img');
    expect(named.querySelector('svg')!.getAttribute('aria-label')).toBe('Writing a document');
    const plain = render(<PageBuildAnimation label="" />).container;
    expect(plain.querySelector('svg')!.getAttribute('role')).toBeNull();
    expect(plain.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps every keyframe stop inside the loop', () => {
    const css = render(<PageBuildAnimation />).container.querySelector('style')!.textContent ?? '';
    const stops = [...css.matchAll(/(-?[\d.]+)%\s*[{,]/g)].map((m) => Number(m[1]));
    expect(stops.length).toBeGreaterThan(50);
    expect(stops.every((t) => t >= 0 && t <= 100)).toBe(true);
  });
});
