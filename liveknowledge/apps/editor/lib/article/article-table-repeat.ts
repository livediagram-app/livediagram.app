// A table's header row repeated on every page it continues onto (docs/specs/007-editor/article-pages.md
// "Flowing onto pages"). The writing is laid out in columns, one a page, and a table's rows are ordinary
// blocks in them; so the rows that start a page are worked out from the rows' heights (repeatBreaks),
// and before each a copy of the header row is drawn as a widget that starts a new column. Never
// stored, never edited: a view of the layout, measured one frame after a change (ArticleEditor).
import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { DOMSerializer, type Node as PMNode } from 'prosemirror-model';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { articleSchema } from './article-schema';

const S = articleSchema;
// How far short of a page's foot a row may end before it moves on with the header (DEFAULTS D100): a
// break is never left to the browser alone, which would put the row there without its header.
export const REPEAT_SLACK = 1;

export type RepeatInput = {
  // A page's text height, and the first row's top in the column it starts in (layout px).
  columnHeight: number;
  firstTop: number;
  // Each row's height, the header row first.
  rowHeights: readonly number[];
  // A page's text height when it is less than `columnHeight` (its footnotes take its foot), by the page's place
  // from the one the table starts on (0).
  heightAt?: (page: number) => number | undefined;
  // Where the table would start on the page the writing above it ends on (layout px): that writing's foot plus the
  // table's top margin. Absent when nothing is above the table, so it already starts its page. Read from the writing
  // above, never the table, so it holds whether or not the table has moved.
  aboveFoot?: number;
};

/** The indexes of the rows (after the header row) that start a new page, each to follow a copy of the
 *  header row. A row is never moved on when nothing but a repeated header is above it on its page (a
 *  row taller than a page breaks inside instead). Index 0 first when the header row and the first row
 *  under it do not fit below the writing above the table on a page without notes: the whole table starts
 *  the next page, so the header row is never left alone at a page's foot (`keepsHeader`). O(rows). */
export function repeatBreaks({
  columnHeight,
  firstTop,
  rowHeights,
  heightAt,
  aboveFoot,
}: RepeatInput): number[] {
  const header = rowHeights[0] ?? 0;
  const breaks: number[] = [];
  let page = 0;
  const foot = () => heightAt?.(page) ?? columnHeight;
  let y = firstTop + header;
  if (keepsHeader({ columnHeight, rowHeights, heightAt, aboveFoot })) {
    breaks.push(0);
    y = header;
  }
  // Whether a row of the table's own sits above `y` on this page.
  let ownAbove = false;
  for (let i = 1; i < rowHeights.length; i++) {
    const h = rowHeights[i]!;
    if (ownAbove && y + h > foot() - REPEAT_SLACK) {
      breaks.push(i);
      page++;
      y = header;
    }
    y += h;
    ownAbove = true;
  }
  return breaks;
}

/** Whether a table moves to the next page whole, so its header row goes with its first row: something is above it,
 *  the two rows do not fit below that writing, and they fit on a page of their own (a first row taller than a page
 *  breaks inside, under its header). A page with notes is left to the footnote layout, which keeps the two together
 *  there (article-footnote-rows.ts). */
export function keepsHeader({
  columnHeight,
  rowHeights,
  heightAt,
  aboveFoot,
}: Pick<RepeatInput, 'columnHeight' | 'rowHeights' | 'heightAt' | 'aboveFoot'>): boolean {
  if (aboveFoot === undefined || rowHeights.length < 2 || heightAt?.(0) !== undefined) return false;
  const pair = rowHeights[0]! + rowHeights[1]!;
  return aboveFoot + pair > columnHeight - REPEAT_SLACK && pair <= columnHeight;
}

/** Each table's rows (by id) that a repeated header row goes before; the header row's own id first when the whole
 *  table starts the next page (keepsHeader). */
export type RepeatBreaks = ReadonlyMap<string, readonly string[]>;

export const repeatHeaderKey = new PluginKey<RepeatBreaks>('article-table-repeat');

const sameBreaks = (a: RepeatBreaks, b: RepeatBreaks): boolean =>
  a.size === b.size &&
  [...a].every(([id, rows]) => {
    const other = b.get(id);
    return !!other && other.length === rows.length && rows.every((r, i) => r === other[i]);
  });

const headerRowOf = (table: PMNode): PMNode | null => {
  const first = table.firstChild;
  if (!first || first.childCount === 0) return null;
  let all = true;
  first.forEach((c) => {
    if (c.type !== S.nodes.table_header) all = false;
  });
  return all ? first : null;
};

// A copy of the header row: its cells as drawn, never editable, hidden from a screen reader (the
// header is read once, where it is).
function repeatRow(header: PMNode): HTMLElement {
  const tr = document.createElement('tr');
  tr.className = 'article-table-repeat';
  tr.setAttribute('contenteditable', 'false');
  tr.setAttribute('aria-hidden', 'true');
  tr.appendChild(DOMSerializer.fromSchema(S).serializeFragment(header.content));
  return tr;
}

function decorationsOf(state: EditorState, breaks: RepeatBreaks): DecorationSet {
  if (breaks.size === 0) return DecorationSet.empty;
  const decos: Decoration[] = [];
  state.doc.forEach((node, pos) => {
    if (node.type !== S.nodes.table) return;
    const rows = breaks.get(node.attrs.id as string);
    const header = rows?.length ? headerRowOf(node) : null;
    if (!rows || !header) return;
    const want = new Set(rows);
    // The whole table starts the next page: a column break before it, and no copy before its own header row.
    if (want.has(header.attrs.id as string))
      decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'article-table-keep' }));
    // Keyed by the header's text and the row it goes before, so an unchanged copy is kept as it is.
    const key = `${node.attrs.id as string}:${header.textContent}`;
    let at = pos + 1;
    node.forEach((row) => {
      if (row !== header && want.has(row.attrs.id as string))
        decos.push(
          Decoration.widget(at, () => repeatRow(header), {
            key: `${key}:${row.attrs.id as string}`,
            side: -1,
            ignoreSelection: true,
          }),
        );
      at += row.nodeSize;
    });
  });
  return DecorationSet.create(state.doc, decos);
}

/** The repeated header rows: its state the breaks last measured, set by setRepeatBreaks. */
export const repeatHeaderPlugin = new Plugin<RepeatBreaks>({
  key: repeatHeaderKey,
  state: {
    init: () => new Map(),
    apply: (tr, value) => (tr.getMeta(repeatHeaderKey) as RepeatBreaks | undefined) ?? value,
  },
  props: {
    decorations(state) {
      return decorationsOf(state, repeatHeaderKey.getState(state) ?? new Map());
    },
  },
});

/**
 * The header-row breaks as the writing is laid out now, for every table with a header row: each row's
 * height, the first row's top in its column, against the page's text height. Dispatches them when they
 * changed (meta only, never committed) and says whether it did, so the caller measures again once the
 * copies are drawn.
 */
export function measureRepeats(
  view: EditorView,
  rootTop: number,
  z: number,
  // The pages whose footnotes end their text early: a page's column from a screen x, and its text's foot.
  foot?: { colOf: (x: number) => number; limit: (col: number) => number | undefined },
): boolean {
  const columnHeight = view.dom.clientHeight;
  const next = new Map<string, string[]>();
  view.dom
    .querySelectorAll<HTMLElement>(':scope > table.article-table[data-header]')
    .forEach((t) => {
      const rows = Array.from(
        t.querySelectorAll<HTMLElement>(':scope > tbody > tr:not(.article-table-repeat)'),
      );
      const first = rows[0];
      if (!first || rows.length < 2) return;
      const box = first.getBoundingClientRect();
      const start = foot?.colOf(box.left) ?? 0;
      const aboveFoot = writingAboveFoot(t, rootTop, z);
      const breaks = repeatBreaks({
        columnHeight,
        firstTop: (box.top - rootTop) / z,
        rowHeights: rows.map((r) => r.offsetHeight),
        ...(foot ? { heightAt: (page: number) => foot.limit(start + page) } : {}),
        ...(aboveFoot === undefined ? {} : { aboveFoot }),
      });
      const id = t.dataset.blockId;
      if (id && breaks.length > 0)
        next.set(
          id,
          breaks.map((i) => rows[i]!.dataset.rowId ?? ''),
        );
    });
  const was = repeatHeaderKey.getState(view.state) ?? new Map();
  if (sameBreaks(was, next)) return false;
  debugLog('[article-table] repeat breaks', Object.fromEntries(next));
  view.dispatch(view.state.tr.setMeta(repeatHeaderKey, next).setMeta('addToHistory', false));
  return true;
}

// Where a table would start below the writing above it (layout px from its page's top): the block before it's last
// line box's foot, plus the table's top margin. Undefined when the table is the first block. The block's last client
// rect is its part on the page it ends on, wherever the table itself has gone.
function writingAboveFoot(table: HTMLElement, rootTop: number, z: number): number | undefined {
  const prev = table.previousElementSibling;
  if (!prev) return undefined;
  const rects = prev.getClientRects();
  const last = rects[rects.length - 1];
  if (!last) return undefined;
  const marginTop = parseFloat(getComputedStyle(table).marginTop) || 0;
  return (last.bottom - rootTop) / z + marginTop;
}
