// A table row split above a page's notes, drawn ending there (docs/specs/007-editor/article-pages.md "Footnotes").
// A box broken inside fills the rest of its page (CSS Fragmentation), so a split row's part reaches the page's foot
// under the notes, and with it its cells' side rules. So the split row's rules (and a header row's tint) are drawn
// as backgrounds instead, stopping where its cells' kept lines end, a closing rule there, and going on with the rest
// on the next page. A broken box's background spans its parts as one strip (box-decoration-break: slice): a part's
// place on the strip is the height of the parts before it. Masks and clip paths are not drawn on a broken box, and
// an opaque cover would hide a page's own background.
import type { EditorView } from 'prosemirror-view';
import { columnAt, type flowFrame } from './article-flow-geometry';
import { footnoteKey, setSplitRowLooks, type SplitRowLook } from './article-footnotes';
import type { FootSplit } from './article-footnote-layout';

/** One part of a broken row as laid out (layout px): its page (column), its top and its height. */
export type RowPart = { col: number; top: number; height: number };
/** Where a split row's part on `page` ends (layout px from the text area's top). */
export type RowEnd = { page: number; end: number };

// Layout px kept to a half, so a look is redrawn only when the row's end really moves.
const half = (n: number) => Math.round(n * 2) / 2;

/** The stretches of a row's strip to leave undrawn: on each page it ends early, from that end to its part's foot.
 *  With each, the part's index and how much of it is kept (for an export, which reads the parts). */
export function hiddenSpans(
  parts: readonly RowPart[],
  ends: readonly RowEnd[],
): { from: number; to: number; part: number; keep: number }[] {
  const out: { from: number; to: number; part: number; keep: number }[] = [];
  let start = 0;
  parts.forEach((p, i) => {
    const e = ends.find((x) => x.page === p.col);
    const keep = e ? half(Math.max(0, Math.min(p.height, e.end - p.top))) : p.height;
    if (keep < p.height)
      out.push({ from: half(start + keep), to: half(start + p.height), part: i, keep });
    start += p.height;
  });
  return out;
}

const RULE = 'linear-gradient(var(--article-table-rule), var(--article-table-rule))';
const TINT =
  'linear-gradient(color-mix(in srgb, var(--article-accent) 9%, transparent), color-mix(in srgb, var(--article-accent) 9%, transparent))';

/** A split row's decoration attributes: its class; its cells' side rules, its closing rules and a header row's tint
 *  as background layers over the strip's drawn stretches; and each kept part (`index:keep`) for an export. */
export function splitLookAttrs(
  hidden: readonly { from: number; to: number; part: number; keep: number }[],
): Record<string, string> {
  // The drawn stretches: between the hidden ones, the last to the strip's end.
  const shown: { from: number; to: number | null }[] = [];
  let at = 0;
  for (const h of hidden) {
    shown.push({ from: at, to: h.from });
    at = h.to;
  }
  shown.push({ from: at, to: null });
  const size = (s: { from: number; to: number | null }) =>
    s.to === null ? `calc(100% - ${s.from}px)` : `${s.to - s.from}px`;
  const side = (edge: 'left' | 'right') =>
    shown.map((s) => `${RULE} ${edge} 0 top ${s.from}px / 1px ${size(s)} no-repeat`);
  const closing = hidden.map((h) => `${RULE} 0 ${h.from - 1}px / 100% 1px no-repeat`);
  const tint = shown.map((s) => `${TINT} 0 ${s.from}px / 100% ${size(s)} no-repeat`);
  return {
    class: 'article-foot-split',
    style: [
      `--article-foot-cell: ${[...closing, ...side('right')].join(', ')}`,
      `--article-foot-first: ${side('left').join(', ')}`,
      `--article-foot-tint: ${tint.join(', ')}`,
    ].join('; '),
    'data-foot-keep': hidden.map((h) => `${h.part}:${h.keep}`).join(','),
  };
}

const sameLooks = (a: readonly SplitRowLook[], b: readonly SplitRowLook[]) =>
  a.length === b.length &&
  a.every(
    (l, i) =>
      l.row === b[i]!.row &&
      l.attrs.style === b[i]!.attrs.style &&
      l.attrs['data-foot-keep'] === b[i]!.attrs['data-foot-keep'],
  );

/**
 * Draws each split row ending above its page's notes: reads the row's parts where they landed, and dispatches the
 * looks (meta only) when they changed. A look only paints, never moves a line. O(split rows).
 */
export function measureSplitRows(
  view: EditorView,
  splits: readonly FootSplit[],
  at: { frame: ReturnType<typeof flowFrame>; root: DOMRect; z: number },
): void {
  const byRow = new Map<number, FootSplit[]>();
  for (const s of splits) byRow.set(s.row, [...(byRow.get(s.row) ?? []), s]);
  const looks: SplitRowLook[] = [];
  for (const [row, own] of byRow) {
    const dom = view.nodeDOM(row);
    if (!(dom instanceof HTMLElement)) continue;
    const cell = dom.firstElementChild;
    const cs = cell ? getComputedStyle(cell) : null;
    // The part ends under its cells' kept lines, their padding and the closing rule; never past the notes' top.
    const below = (parseFloat(cs?.paddingBottom ?? '') || 0) + 1;
    const parts = Array.from(dom.getClientRects())
      .filter((r) => r.height > 0)
      .map((r) => ({
        col: columnAt(at.frame, (r.left - at.root.left) / at.z),
        top: (r.top - at.root.top) / at.z,
        height: r.height / at.z,
      }));
    const hidden = hiddenSpans(
      parts,
      own.map((s) => ({ page: s.page, end: Math.min(s.bottom + below, s.limit) })),
    );
    if (hidden.length > 0) looks.push({ row, attrs: splitLookAttrs(hidden) });
  }
  if (!sameLooks(footnoteKey.getState(view.state)?.looks ?? [], looks))
    setSplitRowLooks(view, looks);
}

/** A box as an export reads it (screen px). */
export type PartRect = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;
const rectOf = (r: PartRect): PartRect => ({
  left: r.left,
  top: r.top,
  right: r.right,
  bottom: r.bottom,
  width: r.width,
  height: r.height,
});

/** For an export: a split row's parts (an element's client rects, one a part) cut where each ends, in screen px
 *  (`scale`: screen px per layout px). Null for an element not in a split row. */
export function splitPartsOf(
  el: HTMLElement,
  rects: readonly PartRect[],
  scale: number,
): { rects: PartRect[]; cut: PartRect[] } | null {
  const row = el.closest<HTMLElement>('tr.article-foot-split');
  if (!row || (el !== row && el.parentElement !== row)) return null;
  const keeps = new Map(
    (row.dataset.footKeep ?? '')
      .split(',')
      .filter(Boolean)
      .map((k) => k.split(':').map(Number) as [number, number]),
  );
  const cut: PartRect[] = [];
  const out = rects.map((r, i): PartRect => {
    const keep = keeps.get(i);
    if (keep === undefined || r.top + keep * scale >= r.bottom) return r;
    const c = { ...rectOf(r), bottom: r.top + keep * scale, height: keep * scale };
    cut.push(c);
    return c;
  });
  return { rects: out, cut };
}
