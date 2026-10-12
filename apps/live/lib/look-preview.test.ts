import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { FINISH_PREVIEW_ELEMENTS } from './finish-preview';
import { lookPreviewSvg, lookPreviewTab } from './look-preview';
import { resolveTheme } from './themes';
import { TAB_LOOKS, activeLookId, tabLookById } from './tab-looks';

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

  it('shows two palette colours on a multi-colour look, the arrow still on its pins', () => {
    for (const id of ['carnival', 'doodle', 'daydream', 'lagoon', 'poster', 'textbook']) {
      const els = lookPreviewTab(tabLookById(id)!).elements as Array<
        Element & { fillColor?: string }
      >;
      const [step, decision, arrow] = els;
      expect(step!.fillColor, id).toBeTruthy();
      expect(step!.fillColor, id).not.toBe(decision!.fillColor);
      expect(arrow!.type === 'arrow' && arrow!.from.kind, id).toBe('pinned');
      expect(els.map((el) => el.id)).toEqual(FINISH_PREVIEW_ELEMENTS.map((el) => el.id));
    }
  });

  it('takes colours from across the palette: the first and the fourth', () => {
    const fills = (id: string) =>
      (lookPreviewTab(tabLookById(id)!).elements as Array<Element & { fillColor?: string }>)
        .slice(0, 2)
        .map((el) => el.fillColor);
    const palette = (id: string) => resolveTheme(id)!.palette!.map((p) => p.fill);
    expect(fills('carnival')).toEqual([palette('rainbow')[0], palette('rainbow')[3]]);
    expect(fills('lagoon')).toEqual([palette('tropical')[0], palette('tropical')[3]]);
  });

  it('draws the Sketch looks sketched', () => {
    expect(lookPreviewSvg(TAB_LOOKS.find((l) => l.id === 'whiteboard')!)).toContain(
      'data-finish="sketch"',
    );
  });
});
