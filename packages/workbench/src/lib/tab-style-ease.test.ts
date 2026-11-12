// @vitest-environment jsdom
// Eased Tab Style changes (docs/specs/011-theme/canvas-and-theme-dialog.md "Eased changes") and the busy gate
// (docs/specs/008-canvas/canvas-performance.md "A Tab Style change on a busy canvas eases the canvas, not its parts").
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUSY_CANVAS_ELEMENTS, canvasIsBusy, easeNextStyleChange } from './tab-style-ease';

const easing = () => document.documentElement.classList.contains('lvd-style-transition');

describe('canvasIsBusy', () => {
  it('is busy above 20 elements only', () => {
    expect(BUSY_CANVAS_ELEMENTS).toBe(20);
    expect(canvasIsBusy(0)).toBe(false);
    expect(canvasIsBusy(20)).toBe(false);
    expect(canvasIsBusy(21)).toBe(true);
    expect(canvasIsBusy(2000)).toBe(true);
  });
});

describe('easeNextStyleChange', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does nothing without a document (a server render)', () => {
    vi.stubGlobal('document', undefined);
    expect(() => easeNextStyleChange()).not.toThrow();
  });

  it('turns the ease on for the moment of the change, a second pick extending it', () => {
    vi.useFakeTimers();
    easeNextStyleChange();
    expect(easing()).toBe(true);
    vi.advanceTimersByTime(200);
    easeNextStyleChange();
    vi.advanceTimersByTime(200);
    expect(easing()).toBe(true);
    vi.advanceTimersByTime(100);
    expect(easing()).toBe(false);
  });
});
