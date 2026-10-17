import { describe, expect, it } from 'vitest';
import { TEMPLATES, buildTemplate, templateCanvasOverrides } from '@livediagram/templates';
import {
  THEMES,
  canvasSurface,
  contrastRatio,
  defaultFillColor,
  defaultTextColor,
  mixHex,
  type Appearance,
  type Element,
} from '@livediagram/document';
import { withThemeApplied } from './tab-theme-apply';
import { tabAsSeen } from './export-as-seen';

// docs/specs/011-theme/light-and-dark.md "What a viewer sees": every template reads in both halves of every theme, picked
// in either half and seen in either ("A theme never sinks a label into what is behind it", #819). template-theme-contrast.test.ts holds each box's own text to its own fill; this holds every label to
// what is actually drawn behind it: its own fill when it has one, else the topmost filled element it sits on (a
// panel, a lane, a card), else the canvas. A label with no colour of its own takes the half's ink, so a pale panel
// under it sank its text on a dark canvas (the Flowchart's key, the Journey's row names, the Gantt's tasks).
// Illustrate templates are left out: their words sit on pages with their own paper.

/** The floor for a label against what is behind it: WCAG's large-text and non-text minimum. Below it a label is
 *  unreadable, not just quiet; quieter captions above it are a design choice. */
const OVERLAY_TEXT_CONTRAST = 3;

/** The fields of an element this test reads: a box with a label, fill and ink (an arrow reads as none of them). */
type Drawn = {
  type: Element['type'];
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
  fillColor?: string;
  textColor?: string;
  shape?: string;
  opacity?: number;
};

const HEX = /^#[0-9a-f]{6}$/i;
const isOpaque = (colour: string): boolean => HEX.test(colour);

/** True when `inner`'s centre lies inside `outer` and `outer` is the larger: `outer` is drawn behind `inner`. */
const sitsOn = (inner: Drawn, outer: Drawn): boolean => {
  const cx = inner.x + (inner.width ?? 0) / 2;
  const cy = inner.y + (inner.height ?? 0) / 2;
  return (
    cx > outer.x &&
    cx < outer.x + (outer.width ?? 0) &&
    cy > outer.y &&
    cy < outer.y + (outer.height ?? 0) &&
    (outer.width ?? 0) * (outer.height ?? 0) > (inner.width ?? 0) * (inner.height ?? 0)
  );
};

/** The colour drawn behind element `i`'s label: its own fill, else what lies under it. */
function backdropOf(drawn: Drawn[], i: number, canvas: string, viewer: CanvasSurface): string {
  const el = drawn[i]!;
  // A cycle writes its own label at its centre, between the discs, on whatever is behind the element.
  if (el.type === 'shape' && el.shape !== 'cycle') {
    const own = el.fillColor ?? defaultFillColor(el as never, viewer);
    if (isOpaque(own)) return own;
  }
  return under(drawn, el, i - 1, canvas, viewer);
}

/** The colour showing through at `el`'s centre from element `from` down: the topmost filled element it sits on,
 *  a translucent one (a 10% wash) mixed over whatever is below it, else the canvas. */
function under(
  drawn: Drawn[],
  el: Drawn,
  from: number,
  canvas: string,
  viewer: CanvasSurface,
): string {
  for (let j = from; j >= 0; j--) {
    const below = drawn[j]!;
    if (below.type !== 'shape' && below.type !== 'sticky') continue;
    if (!sitsOn(el, below)) continue;
    const fill = below.fillColor ?? defaultFillColor(below as never, viewer);
    if (!isOpaque(fill)) continue;
    const opacity = below.opacity ?? 1;
    return opacity >= 1 ? fill : mixHex(fill, under(drawn, el, j - 1, canvas, viewer), opacity);
  }
  return canvas;
}

const APPEARANCES: Appearance[] = ['light', 'dark'];
type CanvasSurface = ReturnType<typeof canvasSurface>;

describe('template labels read against what is drawn behind them under every theme', () => {
  for (const { kind } of TEMPLATES) {
    if (templateCanvasOverrides(kind).pages) continue;
    it(kind, () => {
      const elements = buildTemplate(kind, 0, 0);
      const problems: string[] = [];
      for (const theme of THEMES)
        for (const picker of APPEARANCES) {
          const tab = withThemeApplied({ id: 't', name: 't', elements }, theme.id, picker);
          for (const viewer of APPEARANCES) {
            // Drawn as the canvas and the exports draw it.
            const seen = tabAsSeen(tab, viewer);
            const canvas = seen.backgroundColor ?? '#fbfaf7';
            const surface = canvasSurface(canvas);
            const drawn = seen.elements as unknown as Drawn[];
            drawn.forEach((el, i) => {
              if ((el.type !== 'text' && el.type !== 'shape') || !el.label?.trim()) return;
              const ink = el.textColor ?? defaultTextColor(el as never, surface);
              const behind = backdropOf(drawn, i, canvas, surface);
              if (!HEX.test(ink)) return;
              const ratio = contrastRatio(ink, behind);
              if (ratio < OVERLAY_TEXT_CONTRAST)
                problems.push(
                  `${theme.id} picked ${picker}, seen ${viewer}: "${el.label.slice(0, 40)}" ${ink} on ${behind} (${ratio.toFixed(2)})`,
                );
            });
          }
        }
      expect([...new Set(problems)]).toEqual([]);
    });
  }
});
