import { describe, expect, it } from 'vitest';
import { lookPreviewSvg, lookPreviewTab } from './look-preview';
import { TAB_LOOKS, activeLookId } from './tab-looks';

// A look's card preview (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks").
describe('lookPreviewSvg', () => {
  it('draws the sample in each look, on a tab that reads as that look', () => {
    for (const look of TAB_LOOKS) {
      expect(activeLookId(lookPreviewTab(look)), look.id).toBe(look.id);
      const svg = lookPreviewSvg(look);
      expect(svg, look.id).toContain('Plan the work');
    }
  });

  it('scopes the pattern id to the look, so cards on one page never share a pattern', () => {
    const graph = lookPreviewSvg(TAB_LOOKS.find((l) => l.id === 'graph-paper')!);
    expect(graph).toContain('lvd-look-graph-paper-bg');
    expect(graph).not.toContain('lvd-export-bg');
  });

  it('draws the Sketch looks sketched', () => {
    expect(lookPreviewSvg(TAB_LOOKS.find((l) => l.id === 'whiteboard')!)).toContain(
      'data-finish="sketch"',
    );
  });
});
