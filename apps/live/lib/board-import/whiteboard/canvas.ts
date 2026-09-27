// A Whiteboard export's canvas (docs/specs/020-import-export/blueprints/whiteboard-import.md "Board"):
// `#canvasContent` holds one anchor per board item (`.canvasChildElement`, in
// stacking order), each positioned by `left` / `top` and a `transform` about
// its corner (docs/research/migration-readiness.md E-5).

import { readColour } from './colour';
import type { Matrix } from './matrix';
import { anchorMatrix } from './placement';

export type BoardItem = {
  /** The Whiteboard item id (`data-apikey`), or a minted `item-<n>`. */
  id: string;
  /** `data-whiteboard-type` (`Note`, `PlainText`, `Shape`, …), null when absent. */
  kind: string | null;
  anchor: Element;
  /** Anchor space to board px. */
  matrix: Matrix;
  /** CSS transform functions the reader could not apply. */
  unknownTransforms: string[];
};

export type WhiteboardBoard = {
  ok: true;
  items: BoardItem[];
  /** The board colour as a hex, when the export carries one. */
  background: string | null;
};

const ANCHOR = '.canvasChildElement';

const canvasRoot = (doc: Document): Element | null =>
  doc.getElementById('canvasContent') ?? doc.querySelector('.canvasContent');

/** True when `doc` is a Whiteboard canvas: a canvas root holding anchors. */
export function isWhiteboardCanvas(doc: Document): boolean {
  const root = canvasRoot(doc);
  return root !== null && (root.querySelector(ANCHOR) !== null || root.children.length === 0);
}

function boardBackground(doc: Document): string | null {
  const svg = doc.querySelector('svg.canvasBackground');
  const filled = svg?.querySelector('[fill]');
  return readColour(filled?.getAttribute('fill'))?.hex ?? null;
}

/** The board's items and background, or a named refusal. */
export function readBoard(
  doc: Document,
): WhiteboardBoard | { ok: false; refusal: 'not-whiteboard' | 'empty-board' } {
  const root = canvasRoot(doc);
  if (!root) return { ok: false, refusal: 'not-whiteboard' };
  const anchors = [...root.querySelectorAll(ANCHOR)].filter(
    // A nested anchor belongs to its parent item (a note grid's notes).
    (el) => el.parentElement?.closest(ANCHOR) === null,
  );
  if (anchors.length === 0) return { ok: false, refusal: 'empty-board' };
  const items = anchors.map((el, i): BoardItem => {
    const { matrix, unknown } = anchorMatrix(el);
    return {
      id:
        el.getAttribute('data-apikey') ??
        el.querySelector('.canvasChild')?.getAttribute('id') ??
        `item-${i + 1}`,
      kind: el.getAttribute('data-whiteboard-type'),
      anchor: el,
      matrix,
      unknownTransforms: unknown,
    };
  });
  return { ok: true, items, background: boardBackground(doc) };
}
