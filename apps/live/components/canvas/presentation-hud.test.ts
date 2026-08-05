import { describe, expect, it } from 'vitest';
import { formatElapsed } from './PresentationHud';

// The presenter's clock (spec/31). It is read at a glance, off a laptop, while
// talking — so the format is fixed here rather than left to a locale.
describe('formatElapsed', () => {
  it('counts m:ss with a padded seconds field', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(4_000)).toBe('0:04');
    expect(formatElapsed(64_000)).toBe('1:04');
  });

  it('does not pad the minutes, because a talk is 7:04 rather than 07:04', () => {
    expect(formatElapsed(7 * 60_000 + 4_000)).toBe('7:04');
  });

  it('lets the minutes run past an hour rather than wrapping to zero', () => {
    // A deck left running all afternoon should read 90:00, not 30:00. Wrapping
    // would be the one output that actively misleads.
    expect(formatElapsed(90 * 60_000)).toBe('90:00');
  });

  it('floors part-seconds and never goes negative', () => {
    expect(formatElapsed(1_999)).toBe('0:01');
    expect(formatElapsed(-5_000)).toBe('0:00');
  });
});
