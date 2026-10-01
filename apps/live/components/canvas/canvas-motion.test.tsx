// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BoxedElement } from '@livediagram/document';
import { createElement, type ReactNode } from 'react';
import { useBoxedElementAnimation } from './useBoxedElementAnimation';
import { CanvasStillProvider } from './CanvasStillContext';

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

describe('a still canvas (a whiteboard, docs/specs/023-whiteboard/whiteboard.md)', () => {
  it('lets a new element appear as drawn, with no entry animation', () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(CanvasStillProvider, { still: true, children });
    const { result } = renderHook(() => useBoxedElementAnimation(square, '#000'), { wrapper });
    expect(result.current.wrapperAnimClass).toBe('');
  });
});
