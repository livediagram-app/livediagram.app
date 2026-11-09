import {
  handDrawnInk,
  markerFacePart,
  spendFaceBudget,
  type MarkerFaceBudget,
} from '@liveplanner/project';
import { builtMarkup, setHtml } from '@liveplanner/ui';
import { INK_ATTR, RULES_ATTR, SVG_NS } from './face-finish-marks';

/** A part's ink and marks going in, after every read of the face (useFaceFinishPass); returns the element whose own
 *  look it changed, if any. */
export type Write = () => Element | null;

// A grid's rules (a table's cell borders, inside `[data-marker-grid]`): each cell draws only its right and bottom
// border, so a row or column line is many short pieces. They are joined into whole rules, one per line, each
// drawn in one marker stroke in an <svg> over the face, and the pieces hidden. Only reads: the marks and the ink go in
// through `writes`. Returns how many rules it drew.
export function readGridRules(
  root: HTMLElement,
  face: { width: number; height: number },
  seed: number,
  writes: Write[],
  budget: MarkerFaceBudget,
): number {
  type Piece = { at: number; from: number; to: number; colour: string; px: number };
  const vertical = new Map<string, Piece[]>();
  const horizontal = new Map<string, Piece[]>();
  for (const grid of root.querySelectorAll<HTMLElement>('[data-marker-grid]')) {
    for (const cell of grid.querySelectorAll<HTMLElement>('*')) {
      const at = offsetIn(cell, root);
      if (!at) continue;
      const css = getComputedStyle(cell);
      const sides: string[] = [];
      const see = (
        side: 'right' | 'bottom',
        map: Map<string, Piece[]>,
        piece: Omit<Piece, 'colour' | 'px'>,
      ) => {
        const px = parseFloat(css.getPropertyValue(`border-${side}-width`)) || 0;
        const colour = css.getPropertyValue(`border-${side}-color`);
        if (px <= 0 || css.getPropertyValue(`border-${side}-style`) === 'none') return;
        const key = `${Math.round(piece.at)}|${colour}`;
        map.set(key, [...(map.get(key) ?? []), { ...piece, colour, px }]);
        sides.push(side[0]!);
      };
      see('right', vertical, {
        at: at.x + cell.offsetWidth,
        from: at.y,
        to: at.y + cell.offsetHeight,
      });
      see('bottom', horizontal, {
        at: at.y + cell.offsetHeight,
        from: at.x,
        to: at.x + cell.offsetWidth,
      });
      if (sides.length > 0)
        writes.push(() => {
          cell.setAttribute(RULES_ATTR, sides.join(' '));
          return cell;
        });
    }
  }
  const ink: string[] = [];
  let drawn = 0;
  const rule = (pieces: Piece[], vertical: boolean) => {
    pieces.sort((a, b) => a.from - b.from);
    const draw = (run: Piece) => {
      const a = vertical ? { x: run.at, y: run.from } : { x: run.from, y: run.at };
      const b = vertical ? { x: run.at, y: run.to } : { x: run.to, y: run.at };
      const part = markerFacePart(
        { kind: 'polyline', points: [a, b] },
        { fill: null, stroke: handDrawnInk(run.colour, null), strokePx: run.px },
        face,
        seed,
        drawn,
        budget,
      );
      if (part) {
        ink.push(part.svg);
        spendFaceBudget(budget, part.role);
        drawn += 1;
      }
    };
    // Pieces that touch (within 2 px) are one rule.
    let run: Piece | undefined;
    for (const p of pieces) {
      if (run && p.from <= run.to + 2) run.to = Math.max(run.to, p.to);
      else {
        if (run) draw(run);
        run = { ...p };
      }
    }
    if (run) draw(run);
  };
  for (const pieces of vertical.values()) rule(pieces, true);
  for (const pieces of horizontal.values()) rule(pieces, false);
  if (ink.length === 0) return 0;
  writes.push(() => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute(INK_ATTR, '');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', String(face.width));
    svg.setAttribute('height', String(face.height));
    svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;pointer-events:none';
    setHtml(svg, builtMarkup(ink.join('')));
    root.appendChild(svg);
    return null;
  });
  return drawn;
}

// An element's place in `root`, through its offset parents (layout px, so a zoom or a rotation of the element does
// not move it); null when `root` is not among them.
function offsetIn(el: HTMLElement, root: HTMLElement): { x: number; y: number } | null {
  let x = 0;
  let y = 0;
  let at: HTMLElement | null = el;
  while (at && at !== root) {
    x += at.offsetLeft;
    y += at.offsetTop;
    const parent: Element | null = at.offsetParent;
    if (parent === root) return { x, y };
    at = parent instanceof HTMLElement && root.contains(parent) ? parent : null;
  }
  return at === root ? { x, y } : null;
}
