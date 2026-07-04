// Pure layout geometry for arrow labels, split out of ArrowView so the
// sizing / placement / collision math can be reasoned about (and tested)
// on its own, away from the SVG rendering. The ArrowLabel component reads
// `labelSize` + `arrowLabelFontSize`; ArrowView reads `placeLabel` to pick
// a non-overlapping slot. All stateless; nothing here touches React.

import { isBoxed, type ElementIndex, type TextSize } from '@livediagram/diagram';

const LABEL_HEIGHT_PX = 16;
const LABEL_CHAR_WIDTH_PX = 7;
const LABEL_GAP_PX = 8;

// Approximate label dimensions for collision avoidance. The rendered
// SVG <text> doesn't have a stable width until paint, so we estimate
// from the text length. The numbers are conservative — slightly
// overshooting means the placement leaves a comfortable gap rather
// than colliding.
export function labelSize(text: string, fontSize = 12): { width: number; height: number } {
  const trimmed = text || ' ';
  const scale = fontSize / 12;
  return {
    width: Math.max(24, trimmed.length * LABEL_CHAR_WIDTH_PX * scale) + 8,
    height: LABEL_HEIGHT_PX * scale + 4,
  };
}

// Choose a label position that sits OFF the arrow line and doesn't overlap any
// boxed element. When the arrow's direction is known, the first two candidates
// are offset PERPENDICULAR to the line (one each side) by enough to clear it —
// so a label never sits on top of a horizontal / diagonal / vertical arrow
// (spec/09 quality bar). The four cardinal slots remain as fallbacks for the
// box-dodging case. If everything collides, falls back to the first candidate
// rather than hiding the label.
export function placeLabel(
  midpoint: { x: number; y: number },
  text: string,
  elements: ElementIndex,
  selfId: string,
  fontSize = 12,
  dir?: { dx: number; dy: number },
): { x: number; y: number } {
  const size = labelSize(text, fontSize);
  const halfH = size.height / 2;
  const halfW = size.width / 2;
  const candidates: { x: number; y: number }[] = [];
  if (dir && (dir.dx !== 0 || dir.dy !== 0)) {
    const len = Math.hypot(dir.dx, dir.dy);
    // Unit perpendicular to the arrow.
    const px = -dir.dy / len;
    const py = dir.dx / len;
    // Distance that clears the label's own half-extent along the perpendicular,
    // so the line never crosses the text box.
    const clear = Math.abs(px) * halfW + Math.abs(py) * halfH + LABEL_GAP_PX;
    candidates.push(
      { x: midpoint.x + px * clear, y: midpoint.y + py * clear },
      { x: midpoint.x - px * clear, y: midpoint.y - py * clear },
    );
  }
  candidates.push(
    { x: midpoint.x + halfW + LABEL_GAP_PX, y: midpoint.y }, // right
    { x: midpoint.x, y: midpoint.y + halfH + LABEL_GAP_PX }, // below
    { x: midpoint.x - halfW - LABEL_GAP_PX, y: midpoint.y }, // left
    { x: midpoint.x, y: midpoint.y - halfH - LABEL_GAP_PX }, // above
  );
  for (const c of candidates) {
    const rect = { x: c.x - halfW, y: c.y - halfH, width: size.width, height: size.height };
    if (!collidesWithBoxed(rect, elements, selfId)) return c;
  }
  return candidates[0]!;
}

function collidesWithBoxed(
  rect: { x: number; y: number; width: number; height: number },
  elements: ElementIndex,
  selfId: string,
): boolean {
  for (const el of elements.values()) {
    if (el.id === selfId || !isBoxed(el)) continue;
    if (
      rect.x < el.x + el.width &&
      rect.x + rect.width > el.x &&
      rect.y < el.y + el.height &&
      rect.y + rect.height > el.y
    ) {
      return true;
    }
  }
  return false;
}

// Arrow-label font size by preset, mirroring the boxed-label scale
// (sm 12 / md 14 / lg 20 / scale 18). Default 'sm' keeps the historic
// 12px label size for arrows authored before the field existed.
export function arrowLabelFontSize(size: TextSize | undefined): number {
  switch (size) {
    case 'lg':
      return 20;
    case 'md':
      return 14;
    case 'scale':
      return 18;
    default:
      return 12;
  }
}
