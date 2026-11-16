// Collaborators' holds in the writing (docs/specs/007-editor/article-pages.md "Holding a paragraph"): each held block
// (or table cell) outlined in its writer's colour with a chip naming them, and typing into it refused. Drawn as
// decorations, never stored: the holds arrive by a meta transaction (setArticleHolds), which changes no text, so it
// never reaches the history or a commit. Also where our own hold is: holdSpotOf, the block or cell at the caret.
import type { Node as PMNode } from 'prosemirror-model';
import {
  NodeSelection,
  Plugin,
  PluginKey,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { ArticleHoldSpot, ArticlePeerHold } from './article-holds-store';

type HoldsState = { holds: readonly ArticlePeerHold[]; decorations: DecorationSet };

export const articleHoldsKey = new PluginKey<HoldsState>('article-holds');

/** The top-level blocks collaborators hold (a held cell holds its table): a decision on a suggestion leaves them
 *  until their writers let go (docs/specs/007-editor/suggestions.md "Reviewing"). */
export function heldBlockIds(state: EditorState): Set<string> {
  return new Set((articleHoldsKey.getState(state)?.holds ?? []).map((h) => h.blockId));
}

/** Where a hold at the caret would be: the top-level block at the selection's head, and in a table cell that
 *  cell's row id and column id. Null between blocks, or in a block without an id. */
export function holdSpotOf(state: EditorState): ArticleHoldSpot | null {
  const { doc, selection } = state;
  const head = selection instanceof NodeSelection ? selection.from : selection.head;
  const $head = doc.resolve(head);
  if ($head.depth < 1) return null;
  const block = $head.node(1);
  const blockId = block.attrs.id as string | undefined;
  if (!blockId) return null;
  if (block.type.name !== 'table' || $head.depth < 3) return { blockId };
  const row = $head.node(2).attrs.id as string | undefined;
  const cols = block.attrs.cols as readonly { id?: string }[] | undefined;
  const col = cols?.[$head.index(2)]?.id;
  return row && col ? { blockId, row, col } : { blockId };
}

/** A held stretch of the writing: the held node's range, and for a cell its table's. */
type HeldRange = {
  hold: ArticlePeerHold;
  from: number;
  to: number;
  table?: { from: number; to: number };
};

/** Where each hold falls in `doc`; a hold whose block (or cell) went is not there. */
function heldRanges(doc: PMNode, holds: readonly ArticlePeerHold[]): HeldRange[] {
  const out: HeldRange[] = [];
  doc.forEach((block, pos) => {
    const id = block.attrs.id as string | undefined;
    for (const hold of holds) {
      if (hold.blockId !== id) continue;
      const end = pos + block.nodeSize;
      if (hold.row === undefined) {
        out.push({ hold, from: pos, to: end });
        continue;
      }
      if (block.type.name !== 'table') continue;
      const cols = (block.attrs.cols as readonly { id?: string }[] | undefined) ?? [];
      const colAt = cols.findIndex((c) => c.id === hold.col);
      block.forEach((row, rowOffset) => {
        if (row.attrs.id !== hold.row || colAt < 0 || colAt >= row.childCount) return;
        let cellPos = pos + 1 + rowOffset + 1;
        for (let i = 0; i < colAt; i += 1) cellPos += row.child(i).nodeSize;
        const cell = row.child(colAt);
        out.push({
          hold,
          from: cellPos,
          to: cellPos + cell.nodeSize,
          table: { from: pos, to: end },
        });
      });
    }
  });
  return out;
}

/** Whether a step's range [a, b] reaches inside [from, to]: overlapping it, or put inside it. */
const reaches = (a: number, b: number, from: number, to: number): boolean =>
  a === b ? from < a && a < to : a < to && b > from;

/** Whether a range in a table sits inside one cell's text: a cell's own edit, never a change of the table's shape. */
function insideOneCell(doc: PMNode, a: number, b: number): boolean {
  const $a = doc.resolve(a);
  return $a.depth >= 3 && b <= $a.end(3);
}

/** The hold a step meets in `doc` (the document before it), if any. */
function heldBy(
  doc: PMNode,
  ranges: readonly HeldRange[],
  step: Transaction['steps'][number],
): ArticlePeerHold | null {
  const s = step as unknown as { from?: number; to?: number; pos?: number };
  const a = typeof s.from === 'number' ? s.from : s.pos;
  const b = typeof s.to === 'number' ? s.to : typeof s.pos === 'number' ? s.pos + 1 : undefined;
  if (a === undefined || b === undefined) return null;
  for (const r of ranges) {
    if (reaches(a, b, r.from, r.to)) return r.hold;
    // A cell held holds its table's shape too: a change in the table but in no one cell's text.
    if (r.table && reaches(a, b, r.table.from, r.table.to) && !insideOneCell(doc, a, b))
      return r.hold;
  }
  return null;
}

function chipDom(hold: ArticlePeerHold): HTMLElement {
  const span = document.createElement('span');
  span.className = 'article-held-chip';
  span.style.setProperty('--article-held', hold.color);
  span.dataset.name = hold.name;
  span.setAttribute('aria-hidden', 'true');
  span.contentEditable = 'false';
  return span;
}

function holdDecorations(doc: PMNode, holds: readonly ArticlePeerHold[]): DecorationSet {
  if (holds.length === 0) return DecorationSet.empty;
  const decos: Decoration[] = [];
  for (const r of heldRanges(doc, holds)) {
    const { hold } = r;
    decos.push(
      Decoration.node(r.from, r.to, {
        'data-held': '',
        style: `--article-held: ${hold.color}`,
        title: `${hold.name} is writing here`,
      }),
      Decoration.widget(r.from + 1, () => chipDom(hold), {
        key: `held:${hold.id}:${hold.color}:${hold.name}`,
        side: -1,
        marks: [],
        ignoreSelection: true,
      }),
    );
  }
  return DecorationSet.create(doc, decos);
}

/** The holds plugin: draws collaborators' holds and refuses our edits into them, telling `onRefused` whose hold it
 *  met. A collaborator's change (`article-remote`) and what a plugin appends always pass. */
export function articleHoldsPlugin(onRefused: (hold: ArticlePeerHold) => void): Plugin<HoldsState> {
  return new Plugin<HoldsState>({
    key: articleHoldsKey,
    state: {
      init: () => ({ holds: [], decorations: DecorationSet.empty }),
      apply(tr, value, _old, state) {
        const holds = tr.getMeta(articleHoldsKey) as readonly ArticlePeerHold[] | undefined;
        if (holds) return { holds, decorations: holdDecorations(state.doc, holds) };
        if (!tr.docChanged || value.holds.length === 0) return value;
        return { holds: value.holds, decorations: holdDecorations(state.doc, value.holds) };
      },
    },
    filterTransaction(tr, state) {
      if (!tr.docChanged || tr.getMeta('article-remote') || tr.getMeta('appendedTransaction'))
        return true;
      const holds = articleHoldsKey.getState(state)?.holds;
      if (!holds || holds.length === 0) return true;
      for (let i = 0; i < tr.steps.length; i += 1) {
        const doc = tr.docs[i]!;
        const hit = heldBy(doc, heldRanges(doc, holds), tr.steps[i]!);
        if (hit) {
          onRefused(hit);
          return false;
        }
      }
      return true;
    },
    props: {
      decorations: (state) => articleHoldsKey.getState(state)?.decorations,
    },
  });
}

/** The transaction that puts collaborators' holds in the writing: no text changes, nothing to undo or commit. */
export function setArticleHolds(
  state: EditorState,
  holds: readonly ArticlePeerHold[],
): Transaction {
  return state.tr.setMeta(articleHoldsKey, holds).setMeta('addToHistory', false);
}

/** Whether a transaction only brought collaborators' holds. */
export function onlyHolds(tr: Transaction): boolean {
  return !!tr.getMeta(articleHoldsKey) && !tr.docChanged && !tr.selectionSet;
}
