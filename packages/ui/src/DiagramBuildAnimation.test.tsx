// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DiagramBuildAnimation } from './DiagramBuildAnimation';

describe('DiagramBuildAnimation', () => {
  it('names the picture, or hides it when it is decoration', () => {
    const named = render(<DiagramBuildAnimation label="Building a diagram" />).container;
    expect(named.querySelector('svg')!.getAttribute('role')).toBe('img');
    expect(named.querySelector('svg')!.getAttribute('aria-label')).toBe('Building a diagram');
    const plain = render(<DiagramBuildAnimation label="" />).container;
    expect(plain.querySelector('svg')!.getAttribute('role')).toBeNull();
    expect(plain.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });
});
