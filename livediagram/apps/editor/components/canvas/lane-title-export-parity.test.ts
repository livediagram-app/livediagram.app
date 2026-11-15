// A lane title on the canvas and in the export (docs/specs/009-elements/lane.md "A title wraps in its gutter"; Work
// Tracker 910): both lay an across title out with one measure (laneTitleMeasure, weight 500, the 1 px reserve), so a
// word too long for the gutter even at the small size is cut at the same letter in each. Measured with a real-font
// stand-in, whose widths follow the weight, since the estimate alone hid the difference.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  acrossTitlePadding,
  acrossTitleStrip,
  createShape,
  labelFontPx,
  PADDING_PX,
  renderElementsToSvg,
  type ShapeElement,
  type Tab,
} from '@livediagram/document';
import { resetLabelMeasureContext } from '@liveworkspace/element-model/svg-render-primitives';
import { standInDocument } from '@liveworkspace/element-model/testing/font-stand-in';
import {
  clearLaneTitleCache,
  laneTitleText,
} from '@liveworkspace/workbench/components/canvas/lane-title-frame';

const lane = (label: string): ShapeElement => ({
  ...createShape('lane', 0, 0),
  id: 'l1',
  label,
  textSize: 'lg',
  textAlignX: 'left',
  textAlignY: 'middle',
  padding: 'sm',
});

// The lines the canvas shows, as boxed-element-label lays a plain across title out.
function canvasLines(el: ShapeElement): string[] {
  const strip = acrossTitleStrip(el, el.width, el.height)!;
  const padding = acrossTitlePadding(PADDING_PX.sm);
  return laneTitleText(el.label!, strip, padding, {
    px: labelFontPx(el.textSize),
    bold: false,
    italic: false,
    fontFamily: undefined,
  }).text.split('\n');
}

function exportedLines(el: ShapeElement): string[] {
  const svg = renderElementsToSvg({ id: 't', name: 'T', elements: [el] } as unknown as Tab);
  return [...svg.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]!);
}

describe('a word too long for the gutter, measured with a real font', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetLabelMeasureContext();
    clearLaneTitleCache();
  });

  it('is cut at the same letter on the canvas and in the export', () => {
    const stand = standInDocument();
    vi.stubGlobal('document', stand.document);
    vi.stubGlobal('getComputedStyle', stand.getComputedStyle);
    resetLabelMeasureContext();
    clearLaneTitleCache();
    for (const label of ['Supercalifragilisticexpialidocious', 'Internationalisation Wonderworks']) {
      const el = lane(label);
      const canvas = canvasLines(el);
      expect(canvas).toEqual(exportedLines(el));
      expect(canvas.some((line) => line.endsWith('…'))).toBe(true);
    }
  });
});
