import { describe, expect, it } from 'vitest';
import { buildCanvasToolOptions } from './canvas-tool-options';

describe('buildCanvasToolOptions', () => {
  const ids = (extra: Parameters<typeof buildCanvasToolOptions>[0] = {}) =>
    buildCanvasToolOptions(extra).map((o) => o.id);

  it('offers the selection modes, and leaves Eraser and Format out in Plan mode', () => {
    expect(ids()).toEqual(['select', 'pan', 'eraser', 'format', 'isometric']);
    expect(ids({ planMode: true })).toEqual(['select', 'pan', 'isometric']);
    expect(ids({ includeZen: true })).toContain('zen');
  });
});
