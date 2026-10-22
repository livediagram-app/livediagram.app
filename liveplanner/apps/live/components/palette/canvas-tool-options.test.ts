import { describe, expect, it } from 'vitest';
import { buildCanvasToolOptions } from './canvas-tool-options';

describe('buildCanvasToolOptions', () => {
  const ids = (extra: Parameters<typeof buildCanvasToolOptions>[0] = {}) =>
    buildCanvasToolOptions(extra).map((o) => o.id);

  it('offers the selection modes, Format left out', () => {
    expect(ids()).toEqual(['select', 'pan', 'isometric']);
    expect(ids({ includeZen: true })).toContain('zen');
  });
});
