// Suggesting in the writing (docs/specs/007-editor/suggestions.md "What a suggestion is", "Suggesting"): a person's
// own transaction remade so its changes are kept beside the text. Words put in carry an insertion; words taken out
// stay, struck, as a deletion (their author's own insertion goes for real: it was never text); formatting on words
// becomes a format change that remembers the format before; Enter puts in a paragraph break, and deleting across a
// paragraph's start takes one out. What has no suggestion form (a block's style, alignment, ticks, a table's shape,
// footnotes, zones...) refuses the whole transaction. Deciding suggestions lives in article-suggest-resolve.ts.
import type { Mark, Node as PMNode, Slice } from 'prosemirror-model';
import { Fragment, Slice as PMSlice } from 'prosemirror-model';
import { TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import type { ArticleRunFormat } from '@livedocuments/document';
import { marksOf } from './article-convert';
import { articleSchema } from './article-schema';
import type { SuggestAuthor } from './article-suggest-store';

const S = articleSchema;
const sgType = S.marks.suggestion;

/** A transaction that is a decision on suggestions, or otherwise not a person's writing: it passes as it is. */
export const SUGGEST_PASS = 'article-suggest-pass';

export type SuggestRefusal = 'structure';

const FORMAT_MARKS = new Set([
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'sup',
  'sub',
  'link',
  'color',
  'highlight',
]);
const TEXT_BLOCKS = new Set(['paragraph', 'list_item']);
const FORMAT_KEYS = ['b', 'i', 'u', 's', 'code', 'sup', 'sub', 'href', 'color', 'hl'] as const;
const FLAG_OF: Record<string, (typeof FORMAT_KEYS)[number]> = {
  bold: 'b',
  italic: 'i',
  underline: 'u',
  strike: 's',
  code: 'code',
  sup: 'sup',
  sub: 'sub',
};

/** The formatting a set of marks gives text, as a stored run's (ArticleRunFormat). */
export function formatOf(marks: readonly Mark[]): ArticleRunFormat {
  const out: Record<string, unknown> = {};
  for (const m of marks) {
    const name = m.type.name;
    if (name === 'link') out.href = m.attrs.href;
    else if (name === 'color') out.color = m.attrs.color;
    else if (name === 'highlight') out.hl = m.attrs.color;
    else if (FLAG_OF[name]) out[FLAG_OF[name]] = true;
  }
  return out;
}

export function sameFormat(a: ArticleRunFormat, b: ArticleRunFormat): boolean {
  return FORMAT_KEYS.every((k) => (a[k] ?? null) === (b[k] ?? null));
}

/** The range's formatting set to `format`: every format mark taken off, then `format`'s put on. */
export function setFormat(tr: Transaction, from: number, to: number, format: ArticleRunFormat) {
  for (const name of FORMAT_MARKS) tr.removeMark(from, to, S.marks[name]);
  for (const mark of marksOf({ text: '', ...format })) tr.addMark(from, to, mark);
}

/** Whether the blocks either side of `pos` can be joined into one (prosemirror-transform's canJoin, for top-level
 *  text blocks). */
export function canJoinAt(doc: PMNode, pos: number): boolean {
  const $pos = doc.resolve(pos);
  const a = $pos.nodeBefore;
  const b = $pos.nodeAfter;
  return !!a && !!b && a.isTextblock && b.isTextblock && a.canAppend(b);
}

const sgOf = (node: PMNode | null | undefined): Mark | undefined =>
  node?.marks.find((m) => m.type === sgType);

type Ctx = { author: SuggestAuthor; now: number; newId: () => string };

const attrsFor = (ctx: Ctx, k: 'ins' | 'del' | 'fmt', id: string, was?: ArticleRunFormat) => ({
  id,
  k,
  by: ctx.author.by,
  n: ctx.author.n,
  c: ctx.author.c ?? null,
  at: ctx.now,
  ai: false,
  g: null,
  was: was ?? null,
});

/** A slice with no suggestion on it: a paste (or a copy within the writing) never brings marks or breaks. */
function withoutSuggestions(slice: Slice): Slice {
  const clean = (frag: Fragment): Fragment => {
    const nodes: PMNode[] = [];
    frag.forEach((node) => {
      if (node.isText) nodes.push(node.mark(sgType.removeFromSet(node.marks)));
      else if (node.isInline) nodes.push(node.mark(sgType.removeFromSet(node.marks)));
      else {
        const attrs = 'sg' in node.attrs ? { ...node.attrs, sg: null } : node.attrs;
        nodes.push(node.type.create(attrs, clean(node.content), node.marks));
      }
    });
    return Fragment.from(nodes);
  };
  return new PMSlice(clean(slice.content), slice.openStart, slice.openEnd);
}

/** Whether a slice holds only what can be suggested: words, line breaks, and paragraphs or list items. */
function suggestable(slice: Slice): boolean {
  let ok = true;
  slice.content.descendants((node) => {
    if (node.type === S.nodes.footnote) ok = false;
    else if (node.isBlock && !TEXT_BLOCKS.has(node.type.name)) ok = false;
    return ok;
  });
  return ok;
}

// The author's own suggestion of `k` touching `pos`, before it or after it: typing beside one joins it.
function ownBeside(doc: PMNode, pos: number, k: 'ins' | 'del', by: string): Mark | undefined {
  const $pos = doc.resolve(pos);
  for (const node of [$pos.nodeBefore, $pos.nodeAfter]) {
    const m = sgOf(node);
    if (m && m.attrs.k === k && m.attrs.by === by) return m;
  }
  return undefined;
}

/** [from, to) taken out as a suggestion. False when the range holds what cannot be suggested. */
function deleteSuggested(out: Transaction, from: number, to: number, ctx: Ctx): boolean {
  if (from >= to) return true;
  const doc = out.doc;
  const $from = doc.resolve(from);
  const $to = doc.resolve(to);
  if ($from.sameParent($to)) {
    if (!$from.parent.isTextblock) return false;
  } else {
    // Across blocks only between top-level paragraphs and list items.
    if ($from.depth !== 1 || $to.depth !== 1) return false;
    let ok = true;
    doc.forEach((node, pos) => {
      if (pos + node.nodeSize > from && pos < to && !TEXT_BLOCKS.has(node.type.name)) ok = false;
    });
    if (!ok) return false;
  }
  const segments: { from: number; to: number; mark: Mark | undefined }[] = [];
  const breaks: { pos: number; sg: Record<string, unknown> | null }[] = [];
  let footnote = false;
  doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock) {
      if (pos >= from && pos + 1 <= to)
        breaks.push({ pos, sg: node.attrs.sg as Record<string, unknown> | null });
      return true;
    }
    if (node.isInline) {
      if (node.type === S.nodes.footnote) footnote = true;
      else
        segments.push({
          from: Math.max(pos, from),
          to: Math.min(pos + node.nodeSize, to),
          mark: sgOf(node),
        });
      return false;
    }
    return true;
  });
  if (footnote) return false;
  const by = ctx.author.by;
  const joined = ownBeside(doc, from, 'del', by) ?? ownBeside(doc, to, 'del', by);
  const del = joined ?? sgType.create(attrsFor(ctx, 'del', ctx.newId()));
  const start = out.mapping.maps.length;
  const map = (p: number, assoc: number) => out.mapping.slice(start).map(p, assoc);
  for (const s of segments.reverse()) {
    const a = map(s.from, 1);
    const b = map(s.to, -1);
    if (a >= b) continue;
    const m = s.mark;
    if (m && m.attrs.by !== by) continue;
    if (m?.attrs.k === 'ins') {
      out.delete(a, b);
      continue;
    }
    if (m?.attrs.k === 'del') continue;
    // The author's own format change on words now taken out: their format goes back first, so rejecting the
    // deletion leaves the words as they were.
    if (m?.attrs.k === 'fmt') {
      setFormat(out, a, b, (m.attrs.was as ArticleRunFormat | null) ?? {});
      out.removeMark(a, b, sgType);
    }
    out.addMark(a, b, del);
  }
  for (const br of breaks.reverse()) {
    const p = map(br.pos, 1);
    const sg = br.sg;
    if (sg?.k === 'ins' && sg.by === by) {
      // The author's own break: it was never there.
      out.setNodeAttribute(p, 'sg', null);
      if (canJoinAt(out.doc, p)) out.join(p);
      continue;
    }
    if (sg) continue;
    out.setNodeAttribute(p, 'sg', attrsFor(ctx, 'del', ctx.newId()));
  }
  return true;
}

/** `slice` put in at `at` as a suggestion. Answers where it ends, or null when it cannot be suggested. */
function insertSuggested(out: Transaction, at: number, slice: Slice, ctx: Ctx): number | null {
  if (!suggestable(slice)) return null;
  const $at = out.doc.resolve(at);
  if (!$at.parent.isTextblock) return null;
  const blocks = slice.openStart > 0 || slice.content.firstChild?.isBlock === true;
  if (blocks && $at.depth !== 1) return null;
  const ins =
    ownBeside(out.doc, at, 'ins', ctx.author.by) ??
    sgType.create(attrsFor(ctx, 'ins', ctx.newId()));
  const before = out.doc.content.size;
  out.replace(at, at, withoutSuggestions(slice));
  const end = at + (out.doc.content.size - before);
  if (end <= at) return at;
  out.addMark(at, end, ins);
  out.doc.nodesBetween(at, end, (node, pos) => {
    if (!node.isTextblock) return true;
    if (pos >= at && pos < end) out.setNodeAttribute(pos, 'sg', attrsFor(ctx, 'ins', ctx.newId()));
    return false;
  });
  return end;
}

/** A format mark put on or taken off [from, to) as a format change. */
function formatSuggested(
  out: Transaction,
  from: number,
  to: number,
  mark: Mark,
  add: boolean,
  ctx: Ctx,
): void {
  const segments: { from: number; to: number; node: PMNode }[] = [];
  out.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isInline) return true;
    if (node.type !== S.nodes.footnote)
      segments.push({ from: Math.max(pos, from), to: Math.min(pos + node.nodeSize, to), node });
    return false;
  });
  const by = ctx.author.by;
  const id = ctx.newId();
  for (const s of segments) {
    const sg = sgOf(s.node);
    if (sg && (sg.attrs.by !== by || sg.attrs.k === 'del')) continue;
    if (add) out.addMark(s.from, s.to, mark);
    else out.removeMark(s.from, s.to, mark);
    // The author's own insertion is not text yet: its format simply changes.
    if (sg?.attrs.k === 'ins') continue;
    const was =
      sg?.attrs.k === 'fmt'
        ? ((sg.attrs.was as ArticleRunFormat | null) ?? {})
        : formatOf(s.node.marks);
    const now = formatOf(add ? mark.addToSet(s.node.marks) : mark.removeFromSet(s.node.marks));
    if (sg) out.removeMark(s.from, s.to, sgType);
    if (!sameFormat(was, now))
      out.addMark(
        s.from,
        s.to,
        sgType.create(attrsFor(ctx, 'fmt', sg ? (sg.attrs.id as string) : id, was)),
      );
  }
}

const newSuggestionId = () => `s-${crypto.randomUUID().slice(0, 8)}`;

/** Whether a transaction passes as it is: no change to the writing, a collaborator's, an undo or redo (which replays
 *  what was already suggested), or a decision. */
export function passesAsItIs(tr: Transaction): boolean {
  return (
    !tr.docChanged ||
    tr.getMeta('article-remote') === true ||
    tr.getMeta(SUGGEST_PASS) === true ||
    tr.getMeta('history$') !== undefined
  );
}

/**
 * `tr` (a person's own, built on `state`) remade as suggestions by `author`, or a refusal when it changes what has no
 * suggestion form. One step a time, each mapped from where `tr` had it to where the remade transaction has it.
 */
export function suggestTransaction(
  state: EditorState,
  tr: Transaction,
  author: SuggestAuthor,
  now: number = Date.now(),
  newId: () => string = newSuggestionId,
): Transaction | { refused: SuggestRefusal } {
  if (passesAsItIs(tr)) return tr;
  const ctx: Ctx = { author, now, newId };
  const out = state.tr;
  let caret: number | null = null;
  const refused = { refused: 'structure' as const };
  for (let i = 0; i < tr.steps.length; i++) {
    const step = tr.steps[i]!;
    // Back through the steps before this one (Mapping.invert ignores a slice's bounds), then on through ours.
    const back = (p: number, assoc: number) => {
      let q = p;
      for (let j = i - 1; j >= 0; j--) q = tr.mapping.maps[j]!.invert().map(q, assoc);
      return q;
    };
    const at = (p: number, assoc: number) => out.mapping.map(back(p, assoc), assoc);
    // By the step's own name, as it serialises: the step classes are prosemirror-transform's, which the writing
    // reaches only through prosemirror-state.
    const type = (step.toJSON() as { stepType?: string }).stepType;
    if (type === 'replace') {
      const s = step as unknown as { from: number; to: number; slice: Slice };
      const from = at(s.from, -1);
      const to = at(s.to, 1);
      if (!deleteSuggested(out, from, to, ctx)) return refused;
      if (s.slice.size > 0) {
        const end = insertSuggested(out, at(s.to, 1), s.slice, ctx);
        if (end === null) return refused;
        caret = end;
      } else {
        // Backspace leaves the caret before what it struck; Delete and a selection's removal, after it.
        const backspace =
          state.selection.empty && i === 0 && state.selection.head === s.to && s.to > s.from;
        caret = backspace ? at(s.from, -1) : at(s.to, 1);
      }
    } else if (type === 'addMark' || type === 'removeMark') {
      const s = step as unknown as { from: number; to: number; mark: Mark };
      const name = s.mark.type.name;
      const from = at(s.from, 1);
      const to = at(s.to, -1);
      if (name === 'suggestion' || name === 'note') {
        // A comment on words is no change to them: it goes as it is.
        if (type === 'addMark') out.addMark(from, to, s.mark);
        else out.removeMark(from, to, s.mark);
      } else if (FORMAT_MARKS.has(name)) {
        formatSuggested(out, from, to, s.mark, type === 'addMark', ctx);
      } else return refused;
    } else if (type === 'attr') {
      const s = step as unknown as { pos: number; attr: string; value: unknown };
      if (s.attr !== 'id' && s.attr !== 'sg') return refused;
      out.setNodeAttribute(at(s.pos, 1), s.attr, s.value);
    } else return refused;
  }
  const head = caret ?? out.mapping.map(tr.mapping.invert().map(tr.selection.head, 1), 1);
  const clamped = Math.max(0, Math.min(head, out.doc.content.size));
  out.setSelection(TextSelection.near(out.doc.resolve(clamped)));
  if (tr.storedMarksSet) out.setStoredMarks(tr.storedMarks);
  if (tr.scrolledIntoView) out.scrollIntoView();
  const meta = (tr as unknown as { meta?: Record<string, unknown> }).meta ?? {};
  for (const [key, value] of Object.entries(meta)) out.setMeta(key, value);
  return out;
}
