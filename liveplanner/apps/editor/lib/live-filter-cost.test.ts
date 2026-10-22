// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { liveFiltersRedrawOnRepaint } from './live-filter-cost';

// docs/specs/008-canvas/finish.md "In WebKit": WebKit is told by its own GestureEvent, not by navigator.vendor
// (which jsdom, like Safari, answers "Apple Computer, Inc.").

afterEach(() => {
  delete (window as { GestureEvent?: unknown }).GestureEvent;
});

describe('liveFiltersRedrawOnRepaint', () => {
  it('is true in WebKit', () => {
    (window as { GestureEvent?: unknown }).GestureEvent = class {};
    expect(liveFiltersRedrawOnRepaint()).toBe(true);
  });

  it('is false elsewhere, Apple vendor string or not', () => {
    expect(navigator.vendor).toBe('Apple Computer, Inc.');
    expect(liveFiltersRedrawOnRepaint()).toBe(false);
  });
});
