// The Find bar's matches in one article's writing (docs/specs/007-editor/find-and-replace.md "Highlights"; blueprint
// "Highlights"): inline decorations over each matched stretch, never stored. Rebuilt from the highlight store when its
// matches change (one walk over the top-level blocks), and mapped through every other change, so typing with the bar
// open costs a mapping, not a rebuild.
import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import {
  getFindHighlights,
  subscribeFindHighlights,
  type FindBlockMark,
} from '@/lib/find/find-highlight-store';

export const findHighlightKey = new PluginKey<DecorationSet>('article-find');

const CLASS = {
  match: 'find-match',
  current: 'find-match-current',
  held: 'find-match-held',
} as const;

/** The decorations of `marks` on the writing: each stretch at its block's text offsets (a block's text is its
 *  characters and line breaks, one position each), dropped when the block is gone or now shorter. */
export function findDecorations(doc: PMNode, marks: readonly FindBlockMark[]): DecorationSet {
  if (marks.length === 0) return DecorationSet.empty;
  const at = new Map<string, { offset: number; size: number }>();
  doc.forEach((node, offset) => {
    at.set(node.attrs.id as string, { offset, size: node.content.size });
  });
  const decos: Decoration[] = [];
  for (const m of marks) {
    const block = at.get(m.blockId);
    if (!block || m.to > block.size || m.from >= m.to) continue;
    const from = block.offset + 1 + m.from;
    decos.push(
      Decoration.inline(from, block.offset + 1 + m.to, {
        class: CLASS[m.mark],
        'data-find-mark': m.mark,
      }),
    );
  }
  return DecorationSet.create(doc, decos);
}

const marksOf = (flow: string) => getFindHighlights().flows.get(flow) ?? [];

/** The plugin for the writing of article `flow` (read live: an editor keeps its flow). */
export function findHighlightPlugin(flow: () => string): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: findHighlightKey,
    state: {
      init: (_config, state: EditorState) => findDecorations(state.doc, marksOf(flow())),
      apply(tr, set, _old, state) {
        if (tr.getMeta(findHighlightKey)) return findDecorations(state.doc, marksOf(flow()));
        return tr.docChanged ? set.map(tr.mapping, tr.doc) : set;
      },
    },
    props: {
      decorations: (state) => findHighlightKey.getState(state),
    },
    view(view) {
      let last = getFindHighlights().flows.get(flow());
      const unsubscribe = subscribeFindHighlights(() => {
        const next = getFindHighlights().flows.get(flow());
        // Another article's matches changing changes nothing here.
        if (next === last) return;
        last = next;
        view.dispatch(view.state.tr.setMeta(findHighlightKey, true).setMeta('addToHistory', false));
      });
      return { destroy: unsubscribe };
    },
  });
}
