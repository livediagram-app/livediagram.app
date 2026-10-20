// A self-loop, an edge from a node back to itself (Mermaid's `B --> B`), drawn as a loop off the node's top-right
// corner: out of its right side, up past its top, across, and down into its top (docs/specs/020-import-export/
// mermaid.md "Self-loops"). Laid out like any other edge, both ends fell back to the same bottom-to-top anchors and
// the line ran straight up through the node and its label. Graph input only (graph-input.ts `layoutGraph`), so the
// editor's Mermaid import and an agent's graph draw it alike.
import { isBoxed, type ArrowElement, type Element } from './index';

// How far the loop stands off the node's right side and above its top, in canvas px: clear of the box's outline and
// its selection handles, close enough to read as the node's own.
export const SELF_LOOP_REACH = 32;

const isSelfLoop = (el: Element): el is ArrowElement =>
  el.type === 'arrow' &&
  el.from.kind === 'pinned' &&
  el.to.kind === 'pinned' &&
  el.from.elementId === el.to.elementId;

export function withSelfLoops(elements: Element[]): Element[] {
  if (!elements.some(isSelfLoop)) return elements;
  const boxes = new Map(elements.filter(isBoxed).map((b) => [b.id, b] as const));
  return elements.map((el) => {
    if (!isSelfLoop(el) || el.from.kind !== 'pinned' || el.to.kind !== 'pinned') return el;
    const box = boxes.get(el.from.elementId);
    if (!box) return el;
    // The corners, as deltas from the chord between the right side's middle and the top's middle (arrow-path.ts
    // curveAnchorPoints): right of the side, above the top-right corner, above the top's middle.
    const w = box.width / 4;
    const h = box.height / 4;
    const r = SELF_LOOP_REACH;
    const { curveOffset: _curve, elbowOffset: _elbow, ...rest } = el;
    void _curve;
    void _elbow;
    return {
      ...rest,
      from: { ...el.from, anchor: 'e' },
      to: { ...el.to, anchor: 'n' },
      arrowStyle: 'angled',
      curvePoints: [
        { dx: w + r, dy: h },
        { dx: w + r, dy: -h - r },
        { dx: -w, dy: -h - r },
      ],
    };
  });
}
