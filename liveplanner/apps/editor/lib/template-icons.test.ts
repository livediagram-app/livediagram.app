import { describe, expect, it } from 'vitest';
import { resolveIconExportArt, resolveStickerArt } from '@liveplanner/icons/resolve';
import { buildTemplateTabs, TEMPLATES } from '@liveplanner/templates';

// Every icon and sticker a template places must exist in the catalogues: an unknown id renders the
// placeholder glyph (a boxed "?") on the canvas, which reads as broken in a template meant to show
// the product at its best (docs/specs/008-canvas/canvas-and-palette.md "Templates").
describe('template icons', () => {
  it('every iconId and stickerId a template places resolves', () => {
    const unknown: string[] = [];
    let n = 0;
    for (const { kind } of TEMPLATES) {
      const tabs = buildTemplateTabs({ id: 't0', name: kind }, kind, () => `t${++n}`);
      for (const tab of tabs) {
        for (const el of tab.elements) {
          const { iconId, stickerId } = el as { iconId?: string; stickerId?: string };
          if (iconId && !resolveIconExportArt(iconId)) unknown.push(`${kind}: icon ${iconId}`);
          if (stickerId && !resolveStickerArt(stickerId))
            unknown.push(`${kind}: sticker ${stickerId}`);
        }
      }
    }
    expect(unknown).toEqual([]);
  });
});
