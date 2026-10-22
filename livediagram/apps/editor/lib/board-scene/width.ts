// Width mapping for a landed board scene (docs/specs/020-import-export/board-scene.md "Widths"):
// ink takes the nearest marker width, shapes, lines and arrows the nearest border preset.
import { ARROW_THICKNESS_PX, nearestBorderStroke, type BorderStroke } from '@livediagram/document';
import { WHITEBOARD_PEN_WIDTHS } from '@/lib/whiteboard-prefs';

const MEDIUM_MARKER_PX = WHITEBOARD_PEN_WIDTHS.find((w) => w.id === 'medium')!.px;

/** The marker width (px) nearest a drawn ink width, by ratio; ties go to the thicker. */
export function markerWidthPx(px: number): number {
  if (!Number.isFinite(px) || px <= 0) return MEDIUM_MARKER_PX;
  let best = MEDIUM_MARKER_PX;
  let bestDistance = Infinity;
  for (const { px: preset } of WHITEBOARD_PEN_WIDTHS) {
    const d = Math.abs(Math.log(px / preset));
    if (d < bestDistance - 1e-9 || (Math.abs(d - bestDistance) <= 1e-9 && preset > best)) {
      best = preset;
      bestDistance = d;
    }
  }
  return best;
}

/** The border preset nearest a line width; no width is no border. */
export function borderStrokeOf(px: number): BorderStroke {
  if (!Number.isFinite(px) || px <= 0) return 'none';
  return nearestBorderStroke(px);
}

/** An arrow's stored px: its nearest preset's, a line always drawing at least thin. */
export function arrowWidthPx(px: number): number {
  const stroke = borderStrokeOf(px);
  return ARROW_THICKNESS_PX[stroke === 'none' ? 'thin' : stroke];
}
