// The ¶ a suggested paragraph break shows at its paragraph's start (docs/specs/007-editor/suggestions.md "What a
// suggestion is"): underlined when the break was put in, struck when it was taken out, in its author's colour. A
// widget, so the block's own ::before and ::after (a list's marker, a placeholder) stay theirs; redrawn only when the
// writing changes.
import type { Node as PMNode } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { isArticleHex } from '@livedocuments/document';

const key = new PluginKey<DecorationSet>('article-suggest-breaks');

type BreakSg = { id?: unknown; k?: unknown; c?: unknown; n?: unknown };

function pilcrow(sg: BreakSg): HTMLElement {
  const span = document.createElement('span');
  span.className = `article-sg-pilcrow article-sg-pilcrow-${sg.k === 'del' ? 'del' : 'ins'}`;
  span.textContent = '¶';
  span.contentEditable = 'false';
  span.setAttribute('aria-hidden', 'true');
  if (typeof sg.id === 'string') span.dataset.sgId = sg.id;
  if (isArticleHex(sg.c)) span.style.setProperty('--sg-c', sg.c);
  return span;
}

/** A widget at the start of each block that carries a break suggestion. */
export function breakDecorations(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  doc.forEach((block, offset) => {
    const sg = block.attrs.sg as BreakSg | null | undefined;
    if (!sg || typeof sg.id !== 'string') return;
    decos.push(
      Decoration.widget(offset + 1, () => pilcrow(sg), {
        key: `sg:${sg.id}:${String(sg.k)}:${String(sg.c)}`,
        side: -1,
        marks: [],
        ignoreSelection: true,
      }),
    );
  });
  return decos.length > 0 ? DecorationSet.create(doc, decos) : DecorationSet.empty;
}

export const suggestBreaksPlugin = new Plugin<DecorationSet>({
  key,
  state: {
    init: (_config, state) => breakDecorations(state.doc),
    apply: (tr, value, _old, state) => (tr.docChanged ? breakDecorations(state.doc) : value),
  },
  props: { decorations: (state) => key.getState(state) },
});
