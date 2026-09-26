// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BoxedElement } from '@livediagram/diagram';
import { useBoxedElementAnimation } from './useBoxedElementAnimation';

// Canvas motion is out of the chrome budget (docs/specs/004-interface-design/motion.md):
// a newly added element keeps its own 360ms spring (app/canvas-motion.test.ts)
// even though the chrome pop-in runs at the 150ms micro token.
const square = {
  id: 'a',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 60,
} as unknown as BoxedElement;

describe('canvas element entry', () => {
  it('pops a new element in with the canvas token, not the chrome one', () => {
    const { result } = renderHook(() => useBoxedElementAnimation(square, '#000'));
    expect(result.current.wrapperAnimClass).toBe('animate-element-pop-in');
  });
});
