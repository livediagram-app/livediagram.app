import { describe, expect, it } from 'vitest';
import { PEN_SIMPLIFY_SCREEN_PX, simplifyPenStroke } from './pen-smoothing';

describe('simplifyPenStroke', () => {
  const jitter = Array.from({ length: 20 }, (_, i) => ({ x: i * 10, y: i % 2 === 0 ? 0 : 0.5 }));

  it('smooths away jitter under the screen tolerance', () => {
    expect(simplifyPenStroke(jitter, 1)).toHaveLength(2);
  });

  it('keeps it zoomed in, where the same jitter is bigger on screen', () => {
    // At zoom 4 the 0.5 px wobble is 2 screen px, over the 1.2 px tolerance.
    expect(PEN_SIMPLIFY_SCREEN_PX).toBe(1.2);
    expect(simplifyPenStroke(jitter, 4).length).toBeGreaterThan(2);
  });
});
