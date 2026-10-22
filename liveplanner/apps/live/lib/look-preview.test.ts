import { describe, expect, it } from 'vitest';
import type { Element } from '@liveplanner/project';
import {
  LOOK_PREVIEW_ELEMENTS,
  firstSelfClosingRect,
  lookPreviewSvg,
  lookPreviewTab,
} from './look-preview';
import { TAB_LOOKS, activeLookId, tabLookById } from './tab-looks';

// A look's card preview (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks").
describe('lookPreviewSvg', () => {
  it('draws the sample board in each look, on a tab that reads as that look', () => {
    for (const look of TAB_LOOKS) {
      expect(activeLookId(lookPreviewTab(look)), look.id).toBe(look.id);
      const svg = lookPreviewSvg(look);
      for (const text of ['To do', 'Doing', 'Done', 'Plan work', 'Write brief', 'Ship it'])
        expect(svg, `${look.id}: ${text}`).toContain(text);
    }
  });

  it('scopes the pattern id to the look, so cards on one page never share a pattern', () => {
    const graph = lookPreviewSvg(TAB_LOOKS.find((l) => l.id === 'graph-paper')!);
    expect(graph).toContain('lvd-look-graph-paper-bg');
    expect(graph).not.toContain('lvd-export-bg');
  });

  it("colours the cards from a multi-colour look's palette, keeping every card", () => {
    for (const id of ['spectrum', 'doodle', 'daydream', 'lagoon', 'poster']) {
      const els = lookPreviewTab(tabLookById(id)!).elements as Array<
        Element & { fillColor?: string }
      >;
      expect(els.map((el) => el.id)).toEqual(LOOK_PREVIEW_ELEMENTS.map((el) => el.id));
      const fills = els.filter((el) => el.type === 'shape').map((el) => el.fillColor);
      expect(fills.every(Boolean), id).toBe(true);
      expect(new Set(fills).size, id).toBeGreaterThan(1);
    }
  });

  it('draws the Sketch looks sketched, and the Marker looks in marker', () => {
    expect(lookPreviewSvg(TAB_LOOKS.find((l) => l.id === 'notebook')!)).toContain(
      'data-finish="sketch"',
    );
    expect(lookPreviewSvg(TAB_LOOKS.find((l) => l.id === 'whiteboard')!)).toContain(
      'data-finish="marker"',
    );
  });
});

describe('firstSelfClosingRect', () => {
  it('finds the first self-closing rect, skipping an open one', () => {
    const svg = '<svg><rect width="1"><rect x="0" /><rect y="1"/></svg>';
    const hit = firstSelfClosingRect(svg)!;
    expect(svg.slice(hit.index, hit.index + hit.length)).toBe('<rect x="0" />');
  });

  it('returns null when none closes itself', () => {
    expect(firstSelfClosingRect('<svg><rect >')).toBeNull();
    expect(firstSelfClosingRect('<rect x="1"')).toBeNull();
    expect(firstSelfClosingRect('<svg/>')).toBeNull();
  });

  it('stays linear on a run of unclosed rects', () => {
    const svg = '<rect '.repeat(200_000);
    const t0 = performance.now();
    expect(firstSelfClosingRect(svg)).toBeNull();
    expect(performance.now() - t0).toBeLessThan(200);
  });
});
