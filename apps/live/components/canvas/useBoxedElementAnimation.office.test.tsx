// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createShape, type BoxedElement } from '@liveplanner/document';
import { useBoxedElementAnimation } from './useBoxedElementAnimation';

// docs/specs/009-elements/office.md: office furniture, rooms and rugs animate on their drawing, as a chair does.
describe('an office piece’s animation', () => {
  it('reaches the drawing for every office kind, as it does a chair’s', () => {
    for (const kind of ['chair', 'plant', 'water-cooler', 'room', 'rug'] as const) {
      const el = { ...createShape(kind, 0, 0), animation: 'glow' } as BoxedElement;
      const { result } = renderHook(() => useBoxedElementAnimation(el, '#0f172a'));
      expect(result.current.artAnimClass, kind).toBe('lvd-anim-text-glow');
    }
  });
});
