// Footnotes in the writing (docs/specs/007-editor/article-pages.md "Footnotes"): each reference's number, through the
// whole article in the writing's order; the breaks that end a page's text above its notes (set by the layout pass,
// article-footnote-layout.ts); the reference as drawn; and putting one in. The numbers and breaks are a view of the
// writing, never stored: a reference holds its note's text and nothing else.
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Command,
  type Transaction,
} from 'prosemirror-state';
import {
  Decoration,
  DecorationSet,
  type EditorView,
  type NodeView,
  type NodeViewConstructor,
} from 'prosemirror-view';
import type { Fragment, Node as PMNode } from 'prosemirror-model';
import { articleSchema } from './article-schema';

const S = articleSchema;

/** Where a page's text ends above its notes: before the text at `pos` (`block` false, a break inside a block's
 *  lines), or before the block, table row or object at `pos` (`block` true). `page`: the page (column) it ends.
 *  `also`: a table row split above the notes breaks in each of its cells, `pos` in one and the rest here. */
export type FootBreak = { page: number; pos: number; block: boolean; also?: readonly number[] };

export type FootState = {
  // Every reference's position, in the writing's order: number n is refs[n - 1].
  refs: readonly number[];
  breaks: readonly FootBreak[];
  // A reference just put in, whose note takes the caret once it is laid out.
  pending: number | null;
  decorations: DecorationSet;
};

type FootMeta = { breaks?: readonly FootBreak[]; pending?: number | null };

export const footnoteKey = new PluginKey<FootState>('article-footnotes');

const isRef = (n: PMNode) => n.type === S.nodes.footnote;

/** Every reference's position in `doc`, in order. O(doc). */
export function footnoteRefs(doc: PMNode): number[] {
  const out: number[] = [];
  doc.descendants((n, pos) => {
    if (isRef(n)) out.push(pos);
    return !n.isInline;
  });
  return out;
}

const holdsRef = (f: Fragment): boolean => {
  let found = false;
  f.descendants((n) => {
    if (isRef(n)) found = true;
    return !found && !n.isInline;
  });
  return found;
};

/** Whether a change may have put in or taken out a reference (so the numbers are counted again): a step bringing
 *  one in, or one of `refs` gone. Otherwise the references only moved. O(steps + refs), never the whole writing. */
export function touchesRefs(tr: Transaction, refs: readonly number[]): boolean {
  for (const step of tr.steps) {
    const slice: unknown = Reflect.get(step, 'slice');
    if (
      slice &&
      typeof slice === 'object' &&
      'content' in slice &&
      holdsRef(slice.content as Fragment)
    )
      return true;
  }
  // A reference gone: the change deleted the place after its position (the reference itself). Never read through the
  // writing per reference, which would make each keystroke cost references x blocks.
  return refs.some((pos) => tr.mapping.mapResult(pos, 1).deleted);
}

// A page's end above its notes, inside a block's lines: a block-level box that starts a new column. Hidden from a
// screen reader and never part of the text.
function breakBox(): HTMLElement {
  const el = document.createElement('span');
  el.className = 'article-foot-break';
  el.setAttribute('contenteditable', 'false');
  el.setAttribute('aria-hidden', 'true');
  return el;
}

function decorationsOf(doc: PMNode, refs: readonly number[], breaks: readonly FootBreak[]) {
  const decos: Decoration[] = refs.map((pos, i) =>
    Decoration.node(pos, pos + 1, { 'data-n': String(i + 1) }, { footnote: i + 1 }),
  );
  for (const b of breaks) {
    if (b.pos < 0 || b.pos > doc.content.size) continue;
    const node = b.block ? doc.nodeAt(b.pos) : null;
    if (b.block && node)
      decos.push(
        Decoration.node(b.pos, b.pos + node.nodeSize, { class: 'article-foot-break-before' }),
      );
    else if (!b.block)
      [b.pos, ...(b.also ?? [])].forEach((at, i) => {
        if (at < 0 || at > doc.content.size) return;
        decos.push(
          Decoration.widget(at, breakBox, {
            key: i === 0 ? `foot-break:${b.page}` : `foot-break:${b.page}:${i}`,
            side: -1,
            ignoreSelection: true,
          }),
        );
      });
  }
  return DecorationSet.create(doc, decos);
}

/** The stretches of `tr.doc` a change wrote, in its own positions. */
export function changedRanges(tr: Transaction): [number, number][] {
  const out: [number, number][] = [];
  tr.mapping.maps.forEach((map, i) => {
    const rest = tr.mapping.slice(i + 1);
    map.forEach((_s, _e, from, to) => out.push([rest.map(from, -1), rest.map(to, 1)]));
  });
  return out;
}

/** The breaks carried through a change. A break inside a block's lines goes when that block changed (its lines wrap
 *  anew, so the place would no longer start one): the layout puts it back where its line now starts. */
export function mapBreaks(tr: Transaction, breaks: readonly FootBreak[]): FootBreak[] {
  const out: FootBreak[] = [];
  // Each change widened to the blocks of lines it touched: a few places resolved, never one per break.
  const changed = !breaks.some((b) => !b.block)
    ? []
    : changedRanges(tr).map(([from, to]) => {
        const $from = tr.doc.resolve(from);
        const $to = tr.doc.resolve(to);
        return [
          $from.parent.inlineContent ? $from.start() : from,
          $to.parent.inlineContent ? $to.end() : to,
        ] as const;
      });
  const inChanged = (pos: number) => changed.some(([from, to]) => from <= pos && pos <= to);
  for (const b of breaks) {
    const r = tr.mapping.mapResult(b.pos, b.block ? 1 : -1);
    if (r.deleted) continue;
    if (!b.block && inChanged(r.pos)) continue;
    if (!b.also) {
      out.push({ ...b, pos: r.pos });
      continue;
    }
    // A split row's other cells: each kept while its cell did not change.
    const also = b.also.flatMap((at) => {
      const m = tr.mapping.mapResult(at, -1);
      return m.deleted || inChanged(m.pos) ? [] : [m.pos];
    });
    out.push({ ...b, pos: r.pos, also });
  }
  return out;
}

/** The footnotes plugin: the numbers, the breaks the layout last set (setFootBreaks), and a new note to take the
 *  caret. A press on a reference calls `onRef` with its number. */
export function footnotesPlugin(onRef: (n: number) => void): Plugin<FootState> {
  return new Plugin<FootState>({
    key: footnoteKey,
    state: {
      init: (_c, state) => {
        const refs = footnoteRefs(state.doc);
        return { refs, breaks: [], pending: null, decorations: decorationsOf(state.doc, refs, []) };
      },
      apply: (tr, value) => {
        const meta = tr.getMeta(footnoteKey) as FootMeta | undefined;
        if (!tr.docChanged && !meta) return value;
        const recount = tr.docChanged && touchesRefs(tr, value.refs);
        const refs = !tr.docChanged
          ? value.refs
          : recount
            ? footnoteRefs(tr.doc)
            : value.refs.map((pos) => tr.mapping.map(pos, 1));
        const breaks = meta?.breaks ?? (tr.docChanged ? mapBreaks(tr, value.breaks) : value.breaks);
        const mapped = value.pending === null ? null : tr.mapping.mapResult(value.pending, 1);
        const pending =
          meta?.pending !== undefined
            ? meta.pending
            : mapped && !mapped.deleted
              ? mapped.pos
              : null;
        // Only moved (typing, the usual change): the drawn numbers and breaks move with the writing, never drawn anew.
        const moved = !meta?.breaks && !recount && breaks.length === value.breaks.length;
        const decorations = moved
          ? value.decorations.map(tr.mapping, tr.doc)
          : decorationsOf(tr.doc, refs, breaks);
        return { refs, breaks, pending, decorations };
      },
    },
    props: {
      decorations: (state) => footnoteKey.getState(state)?.decorations,
      handleClickOn: (view, _pos, node, nodePos) => {
        if (!isRef(node)) return false;
        const n = (footnoteKey.getState(view.state)?.refs.indexOf(nodePos) ?? -1) + 1;
        if (n > 0) onRef(n);
        return n > 0;
      },
    },
  });
}

/** The page breaks above notes as the layout worked them out (meta only, never committed). */
export const setFootBreaks = (view: EditorView, breaks: readonly FootBreak[]): void =>
  view.dispatch(view.state.tr.setMeta(footnoteKey, { breaks }).setMeta('addToHistory', false));

/** The new note has taken the caret. */
export const clearPendingNote = (view: EditorView): void =>
  view.dispatch(
    view.state.tr.setMeta(footnoteKey, { pending: null }).setMeta('addToHistory', false),
  );

/** The same breaks: the layout dispatches only a change. */
export const sameFootBreaks = (a: readonly FootBreak[], b: readonly FootBreak[]): boolean =>
  a.length === b.length && a.every((x, i) => sameFootBreak(x, b[i]!));

/** The same break: its page, place, kind and a split row's other cells. */
export function sameFootBreak(a: FootBreak, b: FootBreak): boolean {
  const x = a.also ?? [];
  const y = b.also ?? [];
  return (
    a.page === b.page &&
    a.pos === b.pos &&
    a.block === b.block &&
    x.length === y.length &&
    x.every((p, i) => p === y[i])
  );
}

/** Puts a footnote's reference in at the caret, or after the selection, its note empty, the caret after it; its
 *  note takes the caret once laid out. Not in a code block, nor anywhere text cannot go. */
export const insertFootnote: Command = (state, dispatch) => {
  const $at = state.selection.$to;
  const parent = $at.parent;
  if (!parent.inlineContent || parent.type.spec.code) return false;
  const ref = S.nodes.footnote.create({ text: '' });
  if (!parent.canReplaceWith($at.index(), $at.index(), ref.type)) return false;
  if (dispatch) {
    const tr = state.tr.insert($at.pos, ref);
    tr.setSelection(TextSelection.create(tr.doc, $at.pos + 1));
    tr.setMeta(footnoteKey, { pending: $at.pos });
    dispatch(tr.scrollIntoView());
  }
  return true;
};

// A reference as drawn: its number, raised, read out as "Footnote 3". The number is a text node, so an export draws
// it as written; the words for a screen reader are chrome an export leaves out.
class FootnoteRefView implements NodeView {
  dom: HTMLElement;
  private label: HTMLElement;
  private number: Text;
  constructor(decorations: readonly Decoration[]) {
    this.dom = document.createElement('sup');
    this.dom.className = 'article-footnote-ref';
    this.dom.setAttribute('contenteditable', 'false');
    this.label = document.createElement('span');
    this.label.className = 'article-chrome article-sr-only';
    this.label.textContent = 'Footnote ';
    this.number = document.createTextNode('');
    this.dom.append(this.label, this.number);
    this.show(decorations);
  }
  private show(decorations: readonly Decoration[]) {
    const n = decorations.map((d) => (d.spec as { footnote?: number }).footnote).find(Boolean);
    const text = n ? String(n) : '';
    if (this.number.data !== text) this.number.data = text;
  }
  update(node: PMNode, decorations: readonly Decoration[]): boolean {
    if (!isRef(node)) return false;
    this.show(decorations);
    return true;
  }
  ignoreMutation = () => true;
}

export const footnoteNodeView: NodeViewConstructor = (_node, _view, _getPos, decorations) =>
  new FootnoteRefView(decorations);
