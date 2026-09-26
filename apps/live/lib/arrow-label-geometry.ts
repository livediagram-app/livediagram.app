// Pure PLACEMENT geometry for arrow labels, split out of ArrowView so the
// collision math can be reasoned about (and tested) on its own, away from
// the SVG rendering. All stateless; nothing here touches React.
//
// The caption's SIZE lives in @livediagram/diagram (`arrowLabelSize` /
// `arrowLabelFontSize`), because the headless renderer needs the same numbers
// to draw the same caption. Re-exported here so this module stays the one
// import an arrow view needs.

import { arrowLabelSize, isBoxed, type ElementIndex } from '@livediagram/diagram';

export { arrowLabelFontSize, arrowLabelSize as labelSize } from '@livediagram/diagram';

const LABEL_GAP_PX = 8;

// Choose a label position that sits OFF the arrow line and doesn't overlap any
// boxed element. When the arrow's direction is known, the first two candidates
// are offset PERPENDICULAR to the line (one each side) by enough to clear it —
// so a label never sits on top of a horizontal / diagonal / vertical arrow
// (docs/specs/008-canvas/canvas-and-palette.md quality bar). The four cardinal slots remain as fallbacks for the
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
  const size = arrowLabelSize(text, fontSize);
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
