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
};

/** The indexes of the rows (after the header row) that start a new page, each to follow a copy of the
 *  header row. A row is never moved on when nothing but a repeated header is above it on its page (a
 *  row taller than a page breaks inside instead). O(rows). */
export function repeatBreaks({ columnHeight, firstTop, rowHeights }: RepeatInput): number[] {
  const header = rowHeights[0] ?? 0;
  const breaks: number[] = [];
  let y = firstTop + header;
  // Whether a row of the table's own sits above `y` on this page.
  let ownAbove = false;
  for (let i = 1; i < rowHeights.length; i++) {
    const h = rowHeights[i]!;
    if (ownAbove && y + h > columnHeight - REPEAT_SLACK) {
      breaks.push(i);
      y = header;
    }
    y += h;
    ownAbove = true;
  }
  return breaks;
}

/** Each table's rows (by id) that a repeated header row goes before. */
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
    // Keyed by the header's text and the row it goes before, so an unchanged copy is kept as it is.
    const key = `${node.attrs.id as string}:${header.textContent}`;
    let at = pos + 1;
    node.forEach((row) => {
      if (want.has(row.attrs.id as string))
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
export function measureRepeats(view: EditorView, rootTop: number, z: number): boolean {
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
      const breaks = repeatBreaks({
        columnHeight,
        firstTop: (first.getBoundingClientRect().top - rootTop) / z,
        rowHeights: rows.map((r) => r.offsetHeight),
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
