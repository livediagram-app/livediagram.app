import { describe, expect, it } from 'vitest';
import {
  DISPLAY_FONTS,
  fontSizeFor,
  labelRoom,
  labelTextScale,
  type BoxedElement,
  type Element,
} from '@livedesign/design';
import { buildTemplateTab, TEMPLATES } from '@livedesign/templates';
import { DISPLAY_FACE_WIDTHS, displayFaceMeasure } from './display-face-widths';

// docs/specs/007-editor/logo-pages.md "Display faces": a template's text set in a display face fits its box as that
// face draws it. The lint's estimate takes one share of the size a character, which a wide face outgrows: the Brand
// Board's "Tandem" in Syne Bold wrapped to "Tande / m" while the estimate called it fitting.
type Faced = BoxedElement & {
  label: string;
  font?: string;
  fontWeight?: number;
  textBold?: boolean;
  textCase?: string;
  letterSpacing?: number;
};

const facedTexts = (els: readonly Element[]): Faced[] =>
  els.filter(
    (el): el is Element & Faced =>
      'label' in el &&
      typeof el.label === 'string' &&
      el.label.trim() !== '' &&
      typeof (el as Faced).font === 'string' &&
      !!DISPLAY_FACE_WIDTHS[(el as Faced).font!] &&
      (el as { textSize?: unknown }).textSize !== 'scale',
  );

// Each word of the text wider than its box's room, as its face draws it.
function brokenWords(t: Faced): string[] {
  const px = fontSizeFor(t.textSize) * labelTextScale(t);
  const weight = t.fontWeight ?? (t.textBold ? 700 : 400);
  const face = displayFaceMeasure(t.font, weight, px)!;
  // Tracking (in em) adds to every letter; a text set in capitals is measured as drawn.
  const measure = (w: string) => face(w) + [...w].length * (t.letterSpacing ?? 0) * px;
  const label = t.textCase === 'upper' ? t.label.toUpperCase() : t.label;
  const room = labelRoom(t).width;
  return label.split(/\s+/).filter((w) => w && measure(w) > room + 1);
}

describe('display faces in templates', () => {
  it('knows every face of the display library', () => {
    expect(Object.keys(DISPLAY_FACE_WIDTHS).sort()).toEqual(DISPLAY_FONTS.map((f) => f.id).sort());
  });

  it.each(TEMPLATES.map((t) => t.kind))('%s breaks no word in a display face', (kind) => {
    const broken = facedTexts(buildTemplateTab('t', 'T', kind).elements).flatMap((t) =>
      brokenWords(t).map((w) => `${t.font}: ${w}`),
    );
    expect(broken).toEqual([]);
  });

  it('catches the wrap the estimate missed: Tandem in Syne Bold in a box too narrow for it', () => {
    const t = {
      id: 'x',
      type: 'text',
      x: 0,
      y: 0,
      width: 600,
      height: 120,
      label: 'Tandem',
      textSize: 'lg',
      textScale: 3,
      font: 'syne',
      fontWeight: 700,
    } as unknown as Faced;
    const px = fontSizeFor('lg') * 3;
    // Wide enough for the estimate (six characters at 0.55 em), too narrow for Syne Bold.
    const narrow = { ...t, width: Math.ceil(6 * 0.55 * px) + 24 };
    expect(brokenWords(narrow)).toEqual(['Tandem']);
    expect(brokenWords(t)).toEqual([]);
  });
});
