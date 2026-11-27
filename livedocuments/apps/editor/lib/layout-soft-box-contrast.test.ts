import { describe, expect, it } from 'vitest';
import {
  THEMES,
  canvasSurface,
  contrastRatio,
  defaultTextColor,
  layOutPages,
  mixHex,
  newSlidePage,
  pageIsDark,
  themedForTab,
  type Element,
  type LaidOutPage,
  type Page,
} from '@livedocuments/document';
import {
  buildPageLayout,
  PAGE_LAYOUTS,
  SLIDE_LAYOUTS,
  SOFT_BOX_OPACITY,
  SOFT_BOX_PRESET,
} from '@livedocuments/templates';

// docs/specs/007-editor/pages-mode.md "Layouts", "Soft boxes" (Work Tracker 1501): a layout's soft boxes are drawn
// part see-through, so a box takes on the page it sits on. Its words must still read: every word a layout sets on a
// soft box, placed in every theme on a plain page and on a dark one, against the box as drawn (its fill at
// SOFT_BOX_OPACITY over the page), holds the floor wherever it held it on the solid box and on the page alike.
// Translucency mixes the two, so between two grounds the words read on, they still read.

// WCAG AA for body text; a layout's words are body sized or larger.
const FLOOR = 4.5;
// A dark page: a deep navy fill, as a dark page design or a dark solid paints it.
const DARK_PAGE = '#0f172a';
const PLAIN_PAPER = '#ffffff';

type Drawn = Element & {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  fillColor?: string;
  textColor?: string;
  colorPreset?: string;
  opacity?: number;
};

const sitsOn = (inner: Drawn, outer: Drawn) => {
  const cx = inner.x + inner.width / 2;
  const cy = inner.y + inner.height / 2;
  return cx > outer.x && cx < outer.x + outer.width && cy > outer.y && cy < outer.y + outer.height;
};

function problemsOn(id: string, page: LaidOutPage, els: Element[]): string[] {
  const out: string[] = [];
  const tone = page.background?.fill?.kind === 'solid' ? page.background.fill.color : PLAIN_PAPER;
  for (const theme of THEMES) {
    const placed = themedForTab(els, theme.id, { dark: pageIsDark(page) }) as Drawn[];
    const surface = canvasSurface(tone);
    placed.forEach((el, i) => {
      if (el.type !== 'text' || !el.label?.trim()) return;
      const box = placed
        .slice(0, i)
        .reverse()
        .find(
          (b) =>
            b.type === 'shape' &&
            b.colorPreset === SOFT_BOX_PRESET &&
            b.opacity === SOFT_BOX_OPACITY &&
            sitsOn(el, b),
        );
      if (!box?.fillColor || !/^#[0-9a-f]{6}$/i.test(box.fillColor)) return;
      const ink = el.textColor ?? defaultTextColor(el as never, surface);
      if (!/^#[0-9a-f]{6}$/i.test(ink)) return;
      const drawn = contrastRatio(ink, mixHex(box.fillColor, tone, SOFT_BOX_OPACITY));
      const solid = contrastRatio(ink, box.fillColor);
      const bare = contrastRatio(ink, tone);
      if (drawn < FLOOR && solid >= FLOOR && bare >= FLOOR)
        out.push(
          `${id} ${theme.id} on ${tone}: "${el.label.slice(0, 30)}" ${ink} ${drawn.toFixed(2)}`,
        );
    });
  }
  return out;
}

const a4 = (fill?: string): Page => ({
  id: 'p',
  orientation: 'portrait',
  size: 'a4',
  kind: 'infographic',
  ...(fill ? { background: { fill: { kind: 'solid', color: fill } } } : {}),
});

describe('words on a see-through soft box keep reading in every theme', () => {
  for (const fill of [undefined, DARK_PAGE]) {
    it(`every infographic layout, ${fill ? 'dark' : 'plain'} page`, () => {
      const [page] = layOutPages([a4(fill)]);
      const found = PAGE_LAYOUTS.flatMap((l) =>
        problemsOn(l.id, page!, buildPageLayout(l.id, page!)),
      );
      expect(found).toEqual([]);
    });

    it(`every slide layout, ${fill ? 'dark' : 'plain'} page`, () => {
      const slide = newSlidePage('p');
      const [page] = layOutPages([
        fill ? { ...slide, background: { fill: { kind: 'solid', color: fill } } } : slide,
      ]);
      const found = SLIDE_LAYOUTS.flatMap((l) =>
        problemsOn(l.id, page!, buildPageLayout(l.id, page!)),
      );
      expect(found).toEqual([]);
    });
  }

  it('finds words on soft boxes to check (the test is not vacuous)', () => {
    const [page] = layOutPages([a4()]);
    const onBoxes = PAGE_LAYOUTS.flatMap((l) => {
      const els = themedForTab(buildPageLayout(l.id, page!), 'ocean', {
        dark: false,
      }) as Drawn[];
      return els.filter(
        (el, i) =>
          el.type === 'text' &&
          els
            .slice(0, i)
            .some(
              (b) =>
                b.type === 'shape' &&
                b.opacity === SOFT_BOX_OPACITY &&
                /^#[0-9a-f]{6}$/i.test(b.fillColor ?? '') &&
                sitsOn(el, b),
            ),
      );
    });
    expect(onBoxes.length).toBeGreaterThan(50);
  });
});
