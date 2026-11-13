// @vitest-environment jsdom
// Eased Tab Style changes (docs/specs/011-theme/canvas-and-theme-dialog.md "Eased changes") and the busy gate
// (docs/specs/008-canvas/canvas-performance.md "A Tab Style change on a busy canvas eases the canvas, not its parts").
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BUSY_CANVAS_ELEMENTS,
  canvasIsBusy,
  easedStyleChange,
  easeNextStyleChange,
  styleChangeInFlight,
  SURFACE_EASE_ATTR,
} from './tab-style-ease';

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

// docs/specs/008-canvas/canvas-performance.md "A theme pick on a big board": a busy canvas eases its surface alone, by an
// attribute on it, and never sets the root's class, whose parts rule restyles every node of the page.
describe('easeNextStyleChange on a busy canvas', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  const canvas = (busy: boolean) => {
    const el = document.createElement('div');
    el.setAttribute('data-canvas-root', '');
    if (busy) el.setAttribute('data-canvas-busy', '');
    document.body.append(el);
    return el;
  };

  it('eases the busy surface by its attribute, for the moment of the change', () => {
    vi.useFakeTimers();
    const surface = canvas(true);
    expect(styleChangeInFlight()).toBe(false);
    easeNextStyleChange();
    expect(surface.hasAttribute(SURFACE_EASE_ATTR)).toBe(true);
    expect(styleChangeInFlight()).toBe(true);
    expect(easing()).toBe(false);
    vi.advanceTimersByTime(200);
    easeNextStyleChange();
    vi.advanceTimersByTime(200);
    expect(surface.hasAttribute(SURFACE_EASE_ATTR)).toBe(true);
    vi.advanceTimersByTime(100);
    expect(surface.hasAttribute(SURFACE_EASE_ATTR)).toBe(false);
    expect(styleChangeInFlight()).toBe(false);
    expect(easing()).toBe(false);
  });

  it('eases a canvas that is not busy by the root class, as before', () => {
    vi.useFakeTimers();
    const surface = canvas(false);
    easeNextStyleChange();
    expect(easing()).toBe(true);
    expect(surface.hasAttribute(SURFACE_EASE_ATTR)).toBe(false);
    vi.advanceTimersByTime(300);
    expect(easing()).toBe(false);
  });
});

describe('easedStyleChange', () => {
  afterEach(() => vi.useRealTimers());

  it('eases, then makes the change as a transition', async () => {
    vi.useFakeTimers();
    const react = await import('react');
    const seen: unknown[] = [];
    const set = easedStyleChange((v: string) => seen.push(v));
    set('ocean');
    expect(seen).toEqual(['ocean']);
    expect(easing()).toBe(true);
    expect(typeof react.startTransition).toBe('function');
    vi.advanceTimersByTime(300);
    expect(easing()).toBe(false);
  });
});
