// Where footnotes sit (docs/specs/007-editor/article-pages.md "Footnotes"): each page's notes at its foot, and the
// writing on that page ending above them. The writing is laid out in columns, one a page, all one height; so a
// page's text is ended early by a break (a block-level box that starts the next column, or a block, row or object
// that starts it), worked out page by page from the first: the notes of the references above the break are the
// page's, and a reference whose line would run under its own note goes on with that line. Measured after every
// change (ArticleEditor), the breaks dispatched only when they move: typing that moves no line moves none.
import { Selection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { LaidOutPage } from '@livedocuments/document';
import { columnAt, type flowFrame } from './article-flow-geometry';
import { footnoteKey, sameFootBreaks, setFootBreaks, type FootBreak } from './article-footnotes';
import type { FootnoteNotes, NotePage } from './article-footnote-notes';
import { articleSchema } from './article-schema';

const S = articleSchema;
// The most of a page's text height its notes take (the spec's two thirds): a reference's line always fits above.
export const FOOTNOTE_MAX_SHARE = 2 / 3;
// How far short of its notes a page's text must end, past the line after its break, before that break is taken away:
// a break never moves back and forth by a pixel's rounding.
const SETTLE_SLACK = 2;

type Frame = ReturnType<typeof flowFrame>;
type Line = { col: number; top: number; bottom: number };

/**
 * How many of a page's references keep their notes on it: the most, `keep`, whose last reference ends above the
 * page's text foot with that many notes. `endsAbove(j, limit)`: whether reference j (1 first) ends above `limit`.
 * `heightOf(j)`: the notes' height with the first j. Then `limit`, where the page's text must end. The notes take at
 * most FOOTNOTE_MAX_SHARE of the page. O(references) reads.
 */
export function footCut(
  count: number,
  columnHeight: number,
  heightOf: (j: number) => number,
  endsAbove: (j: number, limit: number) => boolean,
): { keep: number; limit: number } {
  const limitOf = (j: number) => columnHeight - notesHeight(columnHeight, heightOf(j));
  for (let j = count; j > 0; j--)
    if (endsAbove(j, limitOf(j))) return { keep: j, limit: limitOf(j) };
  return { keep: 0, limit: columnHeight };
}

/** The room a page's notes take: their height, at most FOOTNOTE_MAX_SHARE of the page's text height. */
export const notesHeight = (columnHeight: number, height: number): number =>
  Math.min(columnHeight * FOOTNOTE_MAX_SHARE, height);

/** Whether the line after a page's break would end above `limit` on that page: `end`, the foot of the page's text
 *  now; `gap`, the space a block break left out (the block before's margin, cut at the page's end); `next`, that
 *  line's foot at the top of the next page. */
export const fitsAfter = (end: number, gap: number, next: number, limit: number): boolean =>
  end + gap + next + SETTLE_SLACK <= limit;

type Reader = { view: EditorView; frame: Frame; root: DOMRect; z: number };

// The margin under the block before `pos` (and over the one at it), which a page's end leaves out (layout px).
function gapBefore(view: EditorView, pos: number): number {
  const $p = view.state.doc.resolve(pos);
  const before = $p.nodeBefore;
  const after = $p.nodeAfter;
  const dom = (at: number) => view.nodeDOM(at);
  const below = before ? dom(pos - before.nodeSize) : null;
  const above = after ? dom(pos) : null;
  const margin = (el: unknown, side: 'marginBottom' | 'marginTop') =>
    el instanceof HTMLElement ? parseFloat(getComputedStyle(el)[side]) || 0 : 0;
  // Margins between blocks collapse into the larger.
  return Math.max(margin(below, 'marginBottom'), margin(above, 'marginTop'));
}

const isRef = (n: PMNode | null | undefined) => !!n && n.type === S.nodes.footnote;

// A place's line as laid out: its column, its top and foot (layout px from the writing's top). Read off the text
// beside it, never a reference's raised number, whose box ends above its line's foot. A place between blocks (or
// rows) has no line of its own: it reads as the first line after it.
function lineAt(r: Reader, at: number): Line {
  const doc = r.view.state.doc;
  const $at = doc.resolve(at);
  const pos = $at.parent.inlineContent ? at : (Selection.findFrom($at, 1, true)?.from ?? at);
  const $p = pos === at ? $at : doc.resolve(pos);
  const side = isRef($p.nodeAfter) && !isRef($p.nodeBefore) && $p.parentOffset > 0 ? -1 : 1;
  const c = r.view.coordsAtPos(pos, side);
  return {
    col: columnAt(r.frame, (c.left - r.root.left) / r.z),
    top: (c.top - r.root.top) / r.z,
    bottom: (c.bottom - r.root.top) / r.z,
  };
}

// The first place in the writing on a page after `col`, or on page `col` with its line's foot below `limit`.
// The writing's order is its pages' order, top to bottom: a binary search, O(log size) reads.
function firstPast(r: Reader, col: number, limit: number): number {
  let lo = 0;
  let hi = r.view.state.doc.content.size;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const at = lineAt(r, mid);
    if (at.col > col || (at.col === col && at.bottom > limit)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** The break that ends a page's text before `pos`: inside a block's lines a box there; at a block's start, or in a
 *  table, the block itself (the row, or the table at its first row). */
export function breakAt(doc: PMNode, page: number, pos: number): FootBreak {
  const $p = doc.resolve(pos);
  for (let d = $p.depth; d > 0; d--) {
    if ($p.node(d).type !== S.nodes.table_row) continue;
    return { page, pos: $p.index(d - 1) === 0 ? $p.before(d - 1) : $p.before(d), block: true };
  }
  if ($p.depth === 0) return { page, pos, block: true };
  if ($p.parentOffset === 0) return { page, pos: $p.before(), block: true };
  return { page, pos, block: false };
}

export type FootLayout = {
  // Whether the breaks moved (the writing's layout changed: what follows is measured again).
  changed: boolean;
  // Each page's text foot above its notes, by page index (layout px from the text area's top).
  limits: ReadonlyMap<number, number>;
};

/**
 * Lays the footnotes out: the breaks above each page's notes, then the notes drawn at each page's foot. `pages`: the
 * article's pages; `notes`: the boxes they are drawn in.
 */
export function layoutFootnotes(
  view: EditorView,
  ctx: {
    frame: Frame;
    root: DOMRect;
    z: number;
    pages: readonly LaidOutPage[];
    notes: FootnoteNotes;
  },
): FootLayout {
  const { frame, pages, notes } = ctx;
  const r: Reader = { view, frame, root: ctx.root, z: ctx.z };
  const initial = footnoteKey.getState(view.state);
  const limits = new Map<number, number>();
  if (!initial || initial.refs.length === 0) {
    notes.render([]);
    if (!initial || initial.breaks.length === 0) return { changed: false, limits };
    setFootBreaks(view, []);
    return { changed: true, limits };
  }
  notes.setVars(view.dom);
  const columnHeight = frame.height;
  const typing = notes.editing();
  const refsNow = () => footnoteKey.getState(view.state)!.refs;
  const textOf = (i: number) => {
    if (typing?.n === i + 1) return typing.text;
    const node = view.state.doc.nodeAt(refsNow()[i]!);
    return typeof node?.attrs.text === 'string' ? node.attrs.text : '';
  };
  const heightOfNotes = (indexes: readonly number[]) => {
    const { head, notes: each } = notes.heightsOf(indexes.map(textOf), frame.columnWidth);
    return (j: number) => head + each.slice(0, j).reduce((a, b) => a + b, 0);
  };
  let breaks = [...initial.breaks];
  // Each change lays the writing out again; a guard against a layout that never settles.
  let budget = 2 * pages.length + 4;
  // Where every reference and break landed, read once per layout (a pass reads each once, not once a page).
  let landed: { lines: Line[]; breakCols: number[] } | null = null;
  const apply = (next: FootBreak[]) => {
    breaks = next.sort((a, b) => a.page - b.page);
    setFootBreaks(view, breaks);
    landed = null;
    budget--;
  };
  const drawn: NotePage[] = [];
  for (let page = 0; page < pages.length && budget > 0; page++) {
    const refs = refsNow();
    landed ??= {
      lines: refs.map((pos) => lineAt(r, pos)),
      breakCols: breaks.map((b) => (b.pos > 0 ? lineAt(r, b.pos - 1).col : -1)),
    };
    const { lines, breakCols } = landed;
    // This page's references, by their index through the article.
    const here = refs.flatMap((_p, i) => (lines[i]!.col === page ? [i] : []));
    // The break that ends this page, by where the text before it landed (a break moves with the writing), and any
    // other on it, which is spare.
    const mine = breaks.filter((_b, i) => breakCols[i] === page);
    const own = mine[0];
    const others = breaks.filter((b) => !mine.includes(b));
    if (mine.length > 1) {
      apply([...others, { ...own!, page }]);
      page--;
      continue;
    }
    // No notes and no break: nothing to do. A break on a page left with no notes (its references went on with their
    // lines) stays until the line after it fits.
    if (here.length === 0 && !own) continue;
    const heightOf = heightOfNotes(here);
    const { keep, limit } = footCut(
      here.length,
      columnHeight,
      heightOf,
      (j, lim) => lines[here[j - 1]!]!.bottom <= lim,
    );
    // A reference that would sit under its own note goes on with its line: the page ends at that line's start.
    const moving = keep < here.length ? here[keep]! : null;
    const footOf = moving === null ? limit : Math.min(limit, lines[moving]!.bottom - 0.5);
    const cut = firstPast(r, page, footOf);
    const cutLine = cut < view.state.doc.content.size ? lineAt(r, cut) : null;
    // Where the page's text should end: nowhere early when it ends above the notes as it is (or nothing is above).
    const wanted =
      cutLine && cutLine.col === page && cutLine.top > 1
        ? breakAt(view.state.doc, page, cut)
        : null;
    if (wanted && (own?.pos !== wanted.pos || own.block !== wanted.block)) {
      debugLog('[article-footnotes] page ends earlier', { page, at: wanted.pos, was: own?.pos });
      apply([...others, wanted]);
      page--;
      continue;
    }
    if (!wanted && own && own.pos > 1 && own.pos < view.state.doc.content.size) {
      // The page's text ended early: the line after its break, with its references' notes, may fit now.
      const next = lineAt(r, own.pos);
      const end = lineAt(r, own.pos - 1);
      const along = refs.flatMap((_p, i) =>
        lines[i]!.col === page ||
        (lines[i]!.col === page + 1 && Math.abs(lines[i]!.bottom - next.bottom) < 1)
          ? [i]
          : [],
      );
      const footWith = columnHeight - notesHeight(columnHeight, heightOfNotes(along)(along.length));
      if (
        next.col === page + 1 &&
        end.col === page &&
        fitsAfter(end.bottom, own.block ? gapBefore(view, own.pos) : 0, next.bottom, footWith)
      ) {
        debugLog(
          '[article-footnotes] page ends later',
          JSON.stringify(JSON.stringify({ page, end: end.bottom, next, footWith })),
        );
        apply(others);
        page--;
        continue;
      }
    }
    if (here.length === 0) continue;
    limits.set(page, columnHeight - notesHeight(columnHeight, heightOf(here.length)));
    drawn.push({
      index: page,
      x: pages[page]!.rect.x + frame.margin,
      bottom: pages[page]!.rect.y + frame.top + columnHeight,
      width: frame.columnWidth,
      maxHeight: columnHeight * FOOTNOTE_MAX_SHARE,
      notes: here.map((i) => ({ n: i + 1, text: textOf(i) })),
    });
  }
  if (budget <= 0) debugLog('[article-footnotes] layout did not settle', { breaks });
  notes.render(drawn);
  return { changed: !sameFootBreaks(initial.breaks, breaks), limits };
}
