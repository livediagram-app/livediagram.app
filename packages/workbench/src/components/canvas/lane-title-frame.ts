// A lane title's frame and whole-word layout on the canvas (docs/specs/009-elements/lane.md "A title wraps in its
// gutter", "Upright titles", in livediagram and liveplanner): one copy, so both editors' canvases lay a title out as
// their exports do, from the same shared helpers (@liveworkspace/element-model).
import type { CSSProperties } from 'react';
import {
  LANE_TITLE_MAX_LINES,
  acrossTitleStrip,
  type LaneLike,
  type LaneTitleStrip,
  type UprightTitleStrip,
} from '@liveworkspace/element-model/lane-gutter';
import {
  fitWholeWordLines,
  laneTitleMeasure,
  laneTitleRoom,
  wholeWordFontPx,
} from '@liveworkspace/element-model/svg-render-primitives';
import { uprightTitleFrame } from './upright-title';

/** A lane title's frame in its side strip: where the label (and its editor) lay out, and how it clips. */
export type LabelFrame = { style: CSSProperties; className?: string };

/**
 * The frame a lane's title renders in (docs/specs/009-elements/lane.md): turned in its strip for an upright title
 * ("Upright titles"), and for a title reading across a side gutter, the strip itself ("A title wraps in its gutter"),
 * so a title longer than the gutter is wide wraps there instead of running on into the lane's body. Null for a band
 * across the top or bottom, whose title has the lane's width.
 *
 * At rest a plain title arrives already laid out in whole words (laneTitleText), so the text block keeps its lines
 * as given (`whitespace-pre`) and never breaks inside a word; a formatted one is clamped by CSS, its words kept whole.
 * While editing nothing clips: the editor hangs from the strip's top and grows down past the lane if it must, so
 * the whole title is in view and every word reachable.
 */
export function laneTitleFrame(
  el: LaneLike & { width: number; height: number },
  upright: UprightTitleStrip | null,
  isEditing: boolean,
  fitted: boolean,
): LabelFrame | null {
  if (upright) return { style: uprightTitleFrame(upright) };
  const strip = acrossTitleStrip(el, el.width, el.height);
  if (!strip) return null;
  const style: CSSProperties = {
    position: 'absolute',
    left: strip.x,
    top: strip.y,
    width: strip.width,
    height: strip.height,
    overflow: isEditing ? 'visible' : 'hidden',
  };
  if (isEditing) return { style };
  // Three is LANE_TITLE_MAX_LINES, spelled out because Tailwind compiles only whole class names it can read.
  return {
    style,
    className: fitted
      ? '[&>div>div]:whitespace-pre'
      : '[&>div>div]:line-clamp-3 [&_*]:[overflow-wrap:normal]',
  };
}

// The face the label draws in: the one given, else the page's own (FixedSizeLabel inherits it). Measured with the one
// lane-title measure every export uses (laneTitleMeasure: the label's weight, a 2D canvas, the estimate without one),
// so the canvas and the export cut an overlong word at the same letter (Work Tracker 910).
function drawnMeasure(
  px: number,
  bold: boolean,
  italic: boolean,
  fontFamily: string | undefined,
): (s: string) => number {
  const family =
    fontFamily ??
    ((typeof document !== 'undefined' && getComputedStyle(document.body).fontFamily) ||
      undefined);
  return laneTitleMeasure(px, bold, italic, family);
}

/**
 * A plain across title as its strip shows it at rest: in whole words, stepping down a size or two when a word is too
 * wide for the gutter (wholeWordFontPx), a word still too wide at the small size ending in an ellipsis rather than
 * splitting, at most LANE_TITLE_MAX_LINES lines (fitWholeWordLines), as every export lays it out. One pixel is held
 * back (laneTitleRoom) so a rounding difference between the measure and the page never wraps a line again.
 */
// Laid-out titles by (title, font, room): a lane re-renders on every drag, select and remote edit, and measuring a
// title in canvas text is the costly part, so a title already laid out at this font and width is reused. Bounded,
// oldest out first, so a long session's edits never grow it.
const LAID_OUT_CAP = 256;
const laidOut = new Map<string, { text: string; px: number }>();

/** Test hook: empties the laid-out title cache. */
export function clearLaneTitleCache(): void {
  laidOut.clear();
}

export function laneTitleText(
  label: string,
  strip: LaneTitleStrip,
  padding: number,
  text: { px: number; bold: boolean; italic: boolean; fontFamily: string | undefined },
  measureAt?: (px: number) => (s: string) => number,
): { text: string; px: number } {
  const room = laneTitleRoom(strip.width - 2 * padding);
  // Only the page's own measure is cached; a measure handed in (a test's) always lays out afresh.
  const key = measureAt
    ? null
    : `${room}\u0000${text.px}\u0000${text.bold ? 1 : 0}${text.italic ? 1 : 0}\u0000${text.fontFamily ?? ''}\u0000${label}`;
  const hit = key === null ? undefined : laidOut.get(key);
  if (hit) return hit;
  const measure =
    measureAt ?? ((px: number) => drawnMeasure(px, text.bold, text.italic, text.fontFamily));
  const px = wholeWordFontPx(label, room, text.px, measure);
  const result = {
    text: fitWholeWordLines(label, room, LANE_TITLE_MAX_LINES, measure(px)).join('\n'),
    px,
  };
  if (key !== null) {
    if (laidOut.size >= LAID_OUT_CAP) laidOut.delete(laidOut.keys().next().value as string);
    laidOut.set(key, result);
  }
  return result;
}
