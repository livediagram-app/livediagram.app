import { describe, expect, it } from 'vitest';
import { requestBarFocus, takeBarFocus } from './lens-focus-handoff';

// docs/specs/013-workspace/explorer-filters.md "The field": typing in Home's hero field hands the focus to the
// header's field on Search results, once.

describe('lens focus handoff', () => {
  it('answers no until the hero asks', () => {
    expect(takeBarFocus()).toBe(false);
  });

  it('answers yes once after the hero asks, then no again', () => {
    requestBarFocus();
    expect(takeBarFocus()).toBe(true);
    expect(takeBarFocus()).toBe(false);
  });
});
