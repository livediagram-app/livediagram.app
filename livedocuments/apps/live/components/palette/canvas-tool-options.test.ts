import { describe, expect, it } from 'vitest';
import { buildCanvasToolOptions } from './canvas-tool-options';

describe('buildCanvasToolOptions', () => {
  const ids = (extra: Parameters<typeof buildCanvasToolOptions>[0] = { isMobile: false }) =>
    buildCanvasToolOptions(extra).map((o) => o.id);

  it('offers the editing and presenter tools', () => {
    expect(ids()).toEqual(expect.arrayContaining(['select', 'pan', 'laser', 'spotlight']));
  });
});
