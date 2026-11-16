import { describe, expect, it } from 'vitest';
import {
  layOutPages,
  newSlidePage,
  pageAt,
  slideBuildOrders,
  type Element,
  type ElementBuild,
} from '@livedocuments/document';
import { buildPageLayout } from './page-layout-build';
import {
  BUILD_FOOT,
  BUILD_TOP,
  buildLayoutDeck,
  LAYOUT_DECKS,
  layoutDeckPages,
  type LayoutDeckKind,
} from './template-builders-layout-decks';

// docs/specs/008-canvas/canvas-and-palette.md "Templates on pages".
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

  // docs/specs/008-canvas/blueprints/template-content.md "Builds".
  it('builds its points one column at a time, the heading and the source there from the start', () => {
    let built = 0;
    for (const kind of kinds) {
      const pages = layOutPages(layoutDeckPages(kind));
      const els = buildLayoutDeck(kind);
      // An arrow follows its ends: never a build of its own.
      expect(els.filter((e) => e.type === 'arrow' && 'build' in e)).toEqual([]);
      LAYOUT_DECKS[kind].slides.forEach((slide, i) => {
        const page = pages[i]!;
        const on = els.filter((e) => pageAt(pages, centre(e)) === page);
        if (!slide.build) {
          expect(slideBuildOrders(on), `${kind} ${slide.name}`).toEqual([]);
          return;
        }
        built += 1;
        expect(slideBuildOrders(on), `${kind} ${slide.name}`).toEqual(
          Array.from({ length: slide.build }, (_, n) => n + 1),
        );
        for (const e of on) {
          const y = (centre(e).y - page.rect.y) / page.rect.height;
          const inBand = y >= BUILD_TOP && y <= BUILD_FOOT;
          expect(buildOf(e) !== undefined, `${kind} ${slide.name} ${e.label}`).toBe(inBand);
          if (buildOf(e)) expect(buildOf(e)!.effect).toBe('rise');
        }
        // The slide's heading is never built.
        const heading = on.find((e) => e.label === slide.labels[0]);
        expect(heading && buildOf(heading), `${kind} ${slide.name}`).toBeUndefined();
      });
    }
    expect(built).toBeGreaterThanOrEqual(9);
  });

  it('charts its own figures, and fills each ring to the figure written on it', () => {
    const quarter = slideElements('quarterly-review', 'The Quarter');
    const bars = quarter.find((e) => e.type === 'shape' && e.shape === 'bar-chart');
    expect(bars?.type === 'shape' && bars.pieSlices?.map((s) => s.value)).toEqual([
      1840, 2010, 2260, 2390, 2650, 2980,
    ]);
    // +62% from April to September, as the slide says.
    expect(Math.round((2980 / 1840 - 1) * 100)).toBe(62);
    const revenue = slideElements('board-update', 'Revenue');
    const line = revenue.find((e) => e.type === 'shape' && e.shape === 'line-chart');
    expect(line?.type === 'shape' && line.lineSeries?.map((s) => s.name)).toEqual([
      'Actual, £k',
      'Plan, £k',
    ]);
    expect(line?.type === 'shape' && line.chartLegend).toBe(true);
    const rings = slideElements('board-update', 'Against the Plan').filter(
      (e) => e.type === 'shape' && e.shape === 'progress-ring',
    );
    expect(rings.map((r) => (r.type === 'shape' ? r.progress : null))).toEqual([63, 80, 75]);
    // A deck that names no figures keeps its layout's own.
    const goals = slideElements('quarterly-review', 'Goals').filter(
      (e) => e.type === 'shape' && e.shape === 'progress-ring',
    );
    expect(goals.map((r) => (r.type === 'shape' ? r.progress : null))).toEqual([72, 45, 90]);
  });
});

function buildOf(e: Element): ElementBuild | undefined {
  return 'build' in e ? e.build : undefined;
}

function centre(e: Element): { x: number; y: number } {
  if (e.type === 'arrow') return { x: Number.NaN, y: Number.NaN };
  return { x: e.x + e.width / 2, y: e.y + e.height / 2 };
}

function slideElements(kind: LayoutDeckKind, name: string): Element[] {
  const pages = layOutPages(layoutDeckPages(kind));
  const i = LAYOUT_DECKS[kind].slides.findIndex((s) => s.name === name);
  return buildLayoutDeck(kind).filter((e) => pageAt(pages, centre(e)) === pages[i]);
}
