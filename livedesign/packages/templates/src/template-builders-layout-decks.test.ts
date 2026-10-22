import { describe, expect, it } from 'vitest';
import { layOutPages, newSlidePage } from '@livedesign/document';
import { buildPageLayout } from './page-layout-build';
import {
  buildLayoutDeck,
  LAYOUT_DECKS,
  layoutDeckPages,
  type LayoutDeckKind,
} from './template-builders-layout-decks';

// docs/specs/007-editor/templates-by-mode.md "Slide deck templates".
const kinds = Object.keys(LAYOUT_DECKS) as LayoutDeckKind[];
const [page] = layOutPages([newSlidePage('s', 'slide')]);

describe('the slide deck templates built from layouts', () => {
  for (const kind of kinds) {
    it(`${kind}: every slide's text matches its layout, one for one`, () => {
      for (const slide of LAYOUT_DECKS[kind].slides) {
        const written = buildPageLayout(slide.layout, page!).filter(
          (e) =>
            typeof (e as { label?: string }).label === 'string' && (e as { label: string }).label,
        );
        expect(slide.labels, `${kind} ${slide.name}`).toHaveLength(written.length);
      }
    });

    it(`${kind}: opens and closes on its animated background, the rest still`, () => {
      const pages = layoutDeckPages(kind);
      expect(pages.every((p) => p.kind === 'slide')).toBe(true);
      const motion = pages.map((p) =>
        p.background?.fill?.kind === 'gradient' ? p.background.fill.motion : undefined,
      );
      expect(motion[0]).toBe(LAYOUT_DECKS[kind].motion);
      expect(motion[motion.length - 1]).toBe(LAYOUT_DECKS[kind].motion);
      expect(motion.slice(1, -1).every((m) => m === undefined)).toBe(true);
    });

    it(`${kind}: writes its own text, none of the layouts' samples, and no element notes`, () => {
      const els = buildLayoutDeck(kind);
      const labels = els.map((e) => (e as { label?: string }).label).filter(Boolean);
      for (const sample of ['Alex Morgan', 'The next ten years', 'Three reasons it works']) {
        expect(labels).not.toContain(sample);
      }
      const notes = els.filter((e) => (e as { note?: string }).note);
      expect(notes).toHaveLength(0);
    });
  }
});
