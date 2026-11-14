import type { CSSProperties } from 'react';
import {
  LANE_TITLE_MAX_LINES,
  acrossTitleStrip,
  estimatedLabelMeasure,
  fitWholeWordLines,
  wholeWordFontPx,
  type LaneLike,
  type LaneTitleStrip,
  type UprightTitleStrip,
} from '@livediagram/document';
import { uprightTitleFrame } from '@/components/canvas/upright-title';

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

let measureCtx: CanvasRenderingContext2D | null | undefined;

// A measure in the face the label draws in (FixedSizeLabel: medium weight, 600 when bold), from a 2D canvas, so the
// whole-word layout matches the text the strip shows. Without a canvas (a test, a server render) a rough
// per-character estimate stands in.
function drawnMeasure(
  px: number,
  bold: boolean,
  italic: boolean,
  fontFamily: string | undefined,
): (s: string) => number {
  if (measureCtx === undefined) {
    measureCtx =
      typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined'
        ? (() => {
            try {
              return document.createElement('canvas').getContext('2d');
            } catch {
              return null;
            }
          })()
        : null;
  }
  const ctx = measureCtx;
  if (!ctx) return estimatedLabelMeasure(px);
  const family = fontFamily ?? (getComputedStyle(document.body).fontFamily || 'system-ui');
  const font = `${italic ? 'italic ' : ''}${bold ? 600 : 500} ${px}px ${family}`;
  return (s) => {
    ctx.font = font;
    return ctx.measureText(s).width;
  };
}

/**
 * A plain across title as its strip shows it at rest: in whole words, stepping down a size or two when a word is too
 * wide for the gutter (wholeWordFontPx), a word still too wide at the small size ending in an ellipsis rather than
 * splitting, at most LANE_TITLE_MAX_LINES lines (fitWholeWordLines), as every export lays it out. One pixel is held
 * back so a rounding difference between the measure and the page never wraps a line again.
 */
export function laneTitleText(
  label: string,
  strip: LaneTitleStrip,
  padding: number,
  text: { px: number; bold: boolean; italic: boolean; fontFamily: string | undefined },
  measureAt: (px: number) => (s: string) => number = (px) =>
    drawnMeasure(px, text.bold, text.italic, text.fontFamily),
): { text: string; px: number } {
  const room = Math.max(0, strip.width - 2 * padding - 1);
  const px = wholeWordFontPx(label, room, text.px, measureAt);
  return {
    text: fitWholeWordLines(label, room, LANE_TITLE_MAX_LINES, measureAt(px)).join('\n'),
    px,
  };
}
