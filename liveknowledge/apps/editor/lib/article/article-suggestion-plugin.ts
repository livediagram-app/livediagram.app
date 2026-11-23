// A page's suggested edits drawn in its writing (docs/specs/030-knowledgebase/insights.md "On the page"; blueprint
// suggested-edits-ui.md "In the writing"): decorations only, never stored, never a step. Reading, each passage a
// suggestion replaces is washed violet with a margin marker before it (an appended one marks the writing's end); in
// Show in Page, one suggestion's words that go are struck and the words that arrive are drawn after them. Rebuilt from
// the view store when its marks or Show in Page change (one walk over the writing's text, one search a suggestion),
// and mapped through every edit, so typing costs a mapping, never a search. After each build the plugin tells the store
// which passages it found: a passage found nowhere, or in two places, is never marked.
import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import {
  arrivingLines,
  locatePassage,
  passageWords,
  wordDiff,
} from '@/lib/knowledge/suggestion-passage';
import {
  suggestionsView,
  type SuggestionMark,
  type SuggestionsViewState,
} from '@/lib/knowledge/page-suggestions-view';

export const suggestionMarksKey = new PluginKey<SuggestionDecorations>('article-suggestions');

type SuggestionDecorations = { set: DecorationSet; found: ReadonlyMap<string, boolean> };

// The writing's text, its top-level blocks' text joined by line breaks, and where each run of it sits in the document.
type Run = { at: number; pos: number; len: number };
type Block = { at: number; end: number; offset: number; size: number };
export type WritingText = { text: string; runs: Run[]; blocks: Block[] };

/** The writing as text, with each text node's place: a block nested in a block (a table's cell, a list's paragraph)
 *  and a line break start a new line, so a passage's words are matched across them as across blocks. */
export function writingText(doc: PMNode): WritingText {
  let text = '';
  const runs: Run[] = [];
  const blocks: Block[] = [];
  doc.forEach((block, offset) => {
    if (text) text += '\n';
    const at = text.length;
    block.descendants((node, pos) => {
      if (node.isText) {
        runs.push({ at: text.length, pos: offset + 1 + pos, len: node.text!.length });
        text += node.text;
      } else if ((node.isTextblock || (node.isInline && node.isLeaf)) && text.length > at)
        text += '\n';
      return true;
    });
    blocks.push({ at, end: text.length, offset, size: block.nodeSize });
  });
  return { text, runs, blocks };
}

// The document position of a text offset: `start` the first character at or after it, else just after the last
// character before it.
function posAt(w: WritingText, offset: number, start: boolean): number | null {
  const { runs } = w;
  if (start) {
    for (const r of runs) if (r.at + r.len > offset) return r.pos + Math.max(0, offset - r.at);
    return null;
  }
  for (let i = runs.length - 1; i >= 0; i--) {
    const r = runs[i]!;
    if (r.at < offset) return r.pos + Math.min(r.len, offset - r.at);
  }
  return null;
}

// Inline decorations over a stretch of text, one a text node it crosses.
function inlineOver(w: WritingText, from: number, to: number, attrs: Record<string, string>) {
  const out: Decoration[] = [];
  for (const r of w.runs) {
    const a = Math.max(from, r.at);
    const b = Math.min(to, r.at + r.len);
    if (a < b) out.push(Decoration.inline(r.pos + (a - r.at), r.pos + (b - r.at), attrs));
  }
  return out;
}

const widgetOf = (pos: number, el: HTMLElement | (() => HTMLElement), key: string, side = -1) =>
  Decoration.widget(pos, el, { side, key, ignoreSelection: true, stopEvent: () => true });

function arriving(lines: readonly string[], block: boolean): HTMLElement {
  const el = document.createElement(block ? 'div' : 'ins');
  el.className = block ? 'suggestion-ins-block' : 'suggestion-ins';
  el.contentEditable = 'false';
  if (block) {
    for (const line of lines) {
      const p = document.createElement('ins');
      p.className = 'suggestion-ins';
      p.textContent = line;
      el.append(p);
    }
  } else el.textContent = lines.join(' ');
  return el;
}

// Show in Page for one replacement: the words that go struck where they stand, the words that arrive after the last
// word before them.
function shownChange(
  w: WritingText,
  mark: SuggestionMark,
  at: { from: number; to: number },
): Decoration[] {
  const old: { word: string; s: number; e: number }[] = [];
  for (const m of w.text.slice(at.from, at.to).matchAll(/\S+/g))
    old.push({ word: m[0], s: at.from + m.index, e: at.from + m.index + m[0].length });
  const next = arrivingLines(mark.after).join(' ').split(/\s+/).filter(Boolean);
  const steps = wordDiff(
    old.map((o) => o.word),
    next,
  );
  const out: Decoration[] = [];
  let after = at.from;
  let anyBefore = false;
  let gone: { s: number; e: number } | null = null;
  let arrives: string[] = [];
  let n = 0;
  const flush = () => {
    if (gone) {
      out.push(
        ...inlineOver(w, gone.s, gone.e, {
          class: 'suggestion-del',
          'data-suggestion-del': mark.id,
        }),
      );
      gone = null;
    }
    if (arrives.length > 0) {
      const pos = anyBefore ? posAt(w, after, false) : posAt(w, at.from, true);
      const words = arrives;
      if (pos !== null)
        out.push(
          widgetOf(
            pos,
            () => arriving([words.join(' ')], false),
            `ins-${mark.id}-${n++}`,
            anyBefore ? 1 : -1,
          ),
        );
      arrives = [];
    }
  };
  for (const step of steps) {
    if (step.kind === 'same') {
      flush();
      after = old[step.old]!.e;
      anyBefore = true;
    } else if (step.kind === 'gone') {
      const o = old[step.old]!;
      gone = gone ? { s: gone.s, e: o.e } : { s: o.s, e: o.e };
      after = o.e;
      anyBefore = true;
    } else arrives.push(next[step.new]!);
  }
  flush();
  return out;
}

/** The decorations of the view store's marks on `doc`, and which passages were found. */
export function suggestionDecorations(
  doc: PMNode,
  view: SuggestionsViewState,
  flow: string,
): SuggestionDecorations {
  if (!view.flows.includes(flow) || view.marks.length === 0)
    return { set: DecorationSet.empty, found: new Map() };
  const w = writingText(doc);
  const found = new Map<string, boolean>();
  const decos: Decoration[] = [];
  const markedBlocks = new Set<number>();
  let endMarked = false;
  for (const mark of view.marks) {
    const showing = view.showing === mark.id;
    // While one suggestion is shown in the page, the others step back.
    const quiet = view.showing !== null && !showing;
    if (mark.kind === 'append' || passageWords(mark.before).length === 0) {
      found.set(mark.id, true);
      if (showing)
        decos.push(
          widgetOf(
            doc.content.size,
            () => arriving(arrivingLines(mark.after), true),
            `add-${mark.id}`,
          ),
        );
      else if (!quiet && !endMarked) {
        endMarked = true;
        decos.push(widgetOf(doc.content.size, suggestionsView.hostOf(mark.id), `end-${mark.id}`));
      }
      continue;
    }
    const at = locatePassage(w.text, mark.before);
    found.set(mark.id, at !== null);
    if (!at || quiet) continue;
    if (showing) {
      decos.push(...shownChange(w, mark, at));
      continue;
    }
    const covered = w.blocks.filter((b) => b.end > at.from && b.at < at.to);
    for (const b of covered)
      decos.push(
        Decoration.node(b.offset, b.offset + b.size, {
          class: 'suggestion-wash',
          'data-suggestion-wash': mark.id,
        }),
      );
    // Two suggestions on one passage share the first's marker, the newest (the marks are newest first).
    const first = covered[0];
    if (first && !markedBlocks.has(first.offset)) {
      markedBlocks.add(first.offset);
      decos.push(widgetOf(first.offset, suggestionsView.hostOf(mark.id), `marker-${mark.id}`));
    }
  }
  return { set: DecorationSet.create(doc, decos), found };
}

// What of the view store a build reads: a change to anything else (what the plugin found, the popover) builds nothing.
const inputsOf = (s: SuggestionsViewState) => [s.flows, s.marks, s.showing] as const;

/** The plugin for the writing of article `flow` (read live: an editor keeps its flow). */
export function suggestionMarksPlugin(flow: () => string): Plugin<SuggestionDecorations> {
  return new Plugin<SuggestionDecorations>({
    key: suggestionMarksKey,
    state: {
      init: (_config, state: EditorState) =>
        suggestionDecorations(state.doc, suggestionsView.get(), flow()),
      apply(tr, held, _old, state) {
        if (tr.getMeta(suggestionMarksKey))
          return suggestionDecorations(state.doc, suggestionsView.get(), flow());
        return tr.docChanged ? { ...held, set: held.set.map(tr.mapping, tr.doc) } : held;
      },
    },
    props: {
      decorations: (state) => suggestionMarksKey.getState(state)?.set,
    },
    view(view) {
      let last = inputsOf(suggestionsView.get());
      let reported: ReadonlyMap<string, boolean> | null = null;
      const report = () => {
        const found = suggestionMarksKey.getState(view.state)?.found;
        if (!found || found === reported) return;
        reported = found;
        // After the writing's own update, never inside it: the store tells the page's chrome.
        queueMicrotask(() => suggestionsView.reportFound(flow(), found));
      };
      report();
      const unsubscribe = suggestionsView.subscribe(() => {
        const next = inputsOf(suggestionsView.get());
        if (next.every((v, i) => v === last[i])) return;
        last = next;
        view.dispatch(
          view.state.tr.setMeta(suggestionMarksKey, true).setMeta('addToHistory', false),
        );
      });
      return { update: report, destroy: unsubscribe };
    },
  });
}
