// Deciding suggestions in the writing (docs/specs/007-editor/suggestions.md "Reviewing"): each accepted or rejected
// as the stored form resolves it (resolveArticleSuggestions), as one transaction and one undo step. An insertion
// accepted keeps its words, rejected drops them; a deletion accepted drops its words, rejected keeps them; a format
// change accepted keeps the new format, rejected puts the old back; a break put in and rejected, or taken out and
// accepted, joins its paragraph onto the one before. Blocks a collaborator holds are left, and counted as waiting.
import type { Mark, Node as PMNode } from 'prosemirror-model';
import { TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import { MAX_ARTICLE_BLOCK_TEXT, type ArticleRunFormat } from '@livedocuments/document';
import { heldBlockIds } from './article-holds';
import { articleSchema } from './article-schema';
import { SUGGEST_PASS, canJoinAt, setFormat } from './article-suggest';

const S = articleSchema;
const sgType = S.marks.suggestion;

/** A suggestion's fields, as its mark or block attribute holds them. */
export type SuggestionAttrs = {
  id: string;
  k: 'ins' | 'del' | 'fmt';
  by: string;
  n: string;
  c: string | null;
  at: number;
  ai: boolean;
  g: string | null;
  was: ArticleRunFormat | null;
};

export type Decide = (s: SuggestionAttrs) => 'accept' | 'reject' | null;

const sgOf = (node: PMNode): Mark | undefined => node.marks.find((m) => m.type === sgType);

type Found =
  | { kind: 'run'; from: number; to: number; attrs: SuggestionAttrs }
  | { kind: 'break'; pos: number; attrs: SuggestionAttrs };

// Every suggestion in the writing, in order, with whether its top-level block is held.
function found(doc: PMNode, held: ReadonlySet<string>): { list: Found[]; waiting: Found[] } {
  const list: Found[] = [];
  const waiting: Found[] = [];
  doc.forEach((block, offset) => {
    const into = held.has(block.attrs.id as string) ? waiting : list;
    if (block.attrs.sg)
      into.push({ kind: 'break', pos: offset, attrs: block.attrs.sg as SuggestionAttrs });
    block.descendants((node, pos) => {
      if (!node.isInline) return true;
      const m = sgOf(node);
      if (m) {
        const from = offset + 1 + pos;
        into.push({
          kind: 'run',
          from,
          to: from + node.nodeSize,
          attrs: m.attrs as SuggestionAttrs,
        });
      }
      return false;
    });
  });
  return { list, waiting };
}

/** The suggestions `decide` names, decided, as one transaction; how many runs and breaks were decided, and how many
 *  suggestions `decide` named wait in held paragraphs (counted once each by id). */
export function resolveSuggestionsTr(
  state: EditorState,
  decide: Decide,
): { tr: Transaction; decided: number; waiting: number } {
  const tr = state.tr;
  const { list, waiting } = found(state.doc, heldBlockIds(state));
  let decided = 0;
  // Last first: each change then leaves every earlier position as it was.
  for (const f of [...list].reverse()) {
    const d = decide(f.attrs);
    if (!d) continue;
    decided++;
    if (f.kind === 'run') {
      const keep = (f.attrs.k === 'ins') === (d === 'accept') || f.attrs.k === 'fmt';
      if (!keep) {
        tr.delete(f.from, f.to);
        continue;
      }
      if (f.attrs.k === 'fmt' && d === 'reject') setFormat(tr, f.from, f.to, f.attrs.was ?? {});
      tr.removeMark(f.from, f.to, sgType);
      continue;
    }
    tr.setNodeAttribute(f.pos, 'sg', null);
    const joins = (f.attrs.k === 'ins') === (d === 'reject');
    if (!joins) continue;
    const $pos = tr.doc.resolve(f.pos);
    const prev = $pos.nodeBefore;
    const node = $pos.nodeAfter;
    if (!node) continue;
    if (
      prev?.isTextblock &&
      prev.type.name !== 'table' &&
      prev.textContent.length + node.textContent.length <= MAX_ARTICLE_BLOCK_TEXT &&
      canJoinAt(tr.doc, f.pos)
    ) {
      tr.join(f.pos);
    } else if (node.content.size === 0) {
      tr.delete(f.pos, f.pos + node.nodeSize);
    }
  }
  const named = new Set(waiting.filter((f) => decide(f.attrs) !== null).map((f) => f.attrs.id));
  tr.setMeta(SUGGEST_PASS, true);
  return { tr, decided, waiting: named.size };
}

/** One suggestion as the card shows it: its fields, what it covers and its words. */
export type SuggestionAtPos = {
  attrs: SuggestionAttrs;
  from: number;
  to: number;
  text: string;
  isBreak: boolean;
};

/** The suggestion at `pos`: a run's whole stretch (every run of its id in the block), or the break of the block
 *  `pos` starts. Null when there is none. */
export function suggestionAt(state: EditorState, pos: number): SuggestionAtPos | null {
  const $pos = state.doc.resolve(pos);
  const candidates = [$pos.nodeAfter, $pos.nodeBefore];
  const node = candidates.find((n) => n && sgOf(n));
  const block = $pos.parent;
  if (node) {
    const mark = sgOf(node)!;
    const id = mark.attrs.id as string;
    const start = $pos.start();
    let from = -1;
    let to = -1;
    let text = '';
    block.forEach((child, offset) => {
      if (sgOf(child)?.attrs.id !== id) return;
      if (from < 0) from = start + offset;
      to = start + offset + child.nodeSize;
      text += child.isText ? child.text : child.type === S.nodes.hard_break ? ' ' : '';
    });
    return { attrs: mark.attrs as SuggestionAttrs, from, to, text, isBreak: false };
  }
  if ($pos.depth === 1 && $pos.parentOffset === 0 && block.attrs.sg) {
    const at = $pos.before();
    return {
      attrs: block.attrs.sg as SuggestionAttrs,
      from: at,
      to: at + 1,
      text: '',
      isBreak: true,
    };
  }
  return null;
}

/** The suggestion `id`: a break's block, or the first stretch of runs carrying it. Null when it is gone. */
export function suggestionById(state: EditorState, id: string): SuggestionAtPos | null {
  let hit: SuggestionAtPos | null = null;
  state.doc.forEach((block, offset) => {
    if (hit) return;
    const sg = block.attrs.sg as SuggestionAttrs | null;
    if (sg?.id === id) {
      hit = { attrs: sg, from: offset, to: offset + 1, text: '', isBreak: true };
      return;
    }
    block.descendants((node, pos) => {
      if (hit || !node.isInline) return !hit;
      if (sgOf(node)?.attrs.id === id) hit = suggestionAt(state, offset + 1 + pos + 1);
      return false;
    });
  });
  return hit;
}

/** How many suggestions change `g` holds (one per id). */
export function changeSize(state: EditorState, g: string): number {
  return listSuggestions(state).filter((s) => s.g === g).length;
}

/** Every suggestion in the writing, one per id, in order. */
export function listSuggestions(state: EditorState): SuggestionAttrs[] {
  const seen = new Set<string>();
  const out: SuggestionAttrs[] = [];
  const { list, waiting } = found(state.doc, new Set());
  void waiting;
  for (const f of list) {
    const key = `${f.kind}:${f.attrs.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f.attrs);
  }
  return out;
}

/** The transaction that puts the caret inside the first suggestion of change `g` (or the first of any). */
export function selectFirstSuggestion(state: EditorState, g: string | null): Transaction | null {
  const { list } = found(state.doc, new Set());
  const f = list.find((x) => g === null || x.attrs.g === g);
  if (!f) return null;
  const pos = f.kind === 'run' ? f.from + Math.min(1, f.to - f.from) : f.pos + 1;
  return state.tr.setSelection(TextSelection.create(state.doc, pos)).scrollIntoView();
}
