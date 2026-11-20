import { describe, expect, it } from 'vitest';
import { buildCanvasToolOptions } from './canvas-tool-options';

describe('buildCanvasToolOptions', () => {
  const ids = (extra: Parameters<typeof buildCanvasToolOptions>[0] = { isMobile: false }) =>
    buildCanvasToolOptions(extra).map((o) => o.id);

  it('offers the editing and presenter tools', () => {
    expect(ids()).toEqual(expect.arrayContaining(['select', 'laser', 'spotlight']));
  });

  // docs/specs/030-knowledgebase/page-surface.md "No zoom and no panning".
  it('offers no Hand tool, on any viewport or canvas', () => {
    for (const isMobile of [false, true])
      for (const canvasEmpty of [false, true])
        expect(ids({ isMobile, canvasEmpty, includeZen: true })).not.toContain('pan');
  });

  // The isometric view is livediagram's alone (docs/specs/008-canvas/canvas-and-palette.md "Retired features").
  it('offers no Isometric tool, on any viewport or canvas', () => {
    for (const isMobile of [false, true])
      for (const canvasEmpty of [false, true])
        expect(ids({ isMobile, canvasEmpty, includeZen: true })).not.toContain('isometric');
  });
});
