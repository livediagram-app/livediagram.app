import { describe, expect, it } from 'vitest';
import { CANVAS_TOOL_GROUP_LABELS, buildCanvasToolOptions } from './canvas-tool-options';

// docs/specs/010-palette/palette-top-level-categories.md "The Selection Mode picker" and
// docs/specs/008-canvas/avatar-mode.md "Where it lives".
describe('buildCanvasToolOptions', () => {
  const bands = (canvasEmpty = false) => {
    const out: Record<string, string[]> = {};
    for (const o of buildCanvasToolOptions({ canvasEmpty })) {
      const band = CANVAS_TOOL_GROUP_LABELS[o.group!]!;
      (out[band] ??= []).push(o.label);
    }
    return out;
  };

  it('offers exactly Build (Select, Hand), Edit (Eraser, Format) and Interact (Avatar), in that order', () => {
    expect(Object.entries(bands())).toEqual([
      ['Build', ['Select', 'Hand']],
      ['Edit', ['Eraser', 'Format']],
      ['Interact', ['Avatar']],
    ]);
  });

  it('keeps Avatar with no key, never disabled, even on an empty canvas', () => {
    const avatar = buildCanvasToolOptions({ canvasEmpty: true }).find((o) => o.id === 'avatar');
    expect(avatar?.shortcut).toBeUndefined();
    expect(avatar?.disabled).toBeFalsy();
  });

  it('greys the Edit tools on an empty canvas', () => {
    const options = buildCanvasToolOptions({ canvasEmpty: true });
    expect(options.filter((o) => o.disabled).map((o) => o.id)).toEqual(['eraser', 'format']);
  });
});
