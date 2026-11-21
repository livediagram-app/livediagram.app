// Room in the writing for what a knowledgebase page shows beside its words (docs/specs/030-knowledgebase/
// verification.md "the page's meta row under the title", links-and-embeds.md "Backlinks", page-surface.md "The page
// icon"): one host element over the Title block (the page's icon), one under it and one at the foot of the
// writing, each a ProseMirror widget, so the writing flows round them and they scale with the page. The hosts are made once per article and reused; React draws into them through
// portals (PageKnowledgeSlots). Nothing here is part of the document: no block, no step, no sync.
import { Plugin, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export type PageSlots = {
  plugin: Plugin<DecorationSet>;
  /** Over the Title block: the page's icon. */
  head: HTMLElement;
  /** Under the Title block. */
  meta: HTMLElement;
  /** After the writing's last block. */
  foot: HTMLElement;
};

function host(name: string): HTMLElement {
  const el = document.createElement('div');
  el.contentEditable = 'false';
  el.dataset.pageSlot = name;
  el.className = `article-page-slot article-page-slot-${name}`;
  return el;
}

export function createPageSlots(): PageSlots {
  const head = host('head');
  const meta = host('meta');
  const foot = host('foot');
  // Three widgets, placed by the first block's size and the document's: constant work, whatever the page's length.
  const build = (doc: EditorState['doc']): DecorationSet => {
    const first = doc.firstChild;
    const widget = (pos: number, el: HTMLElement, side: number) =>
      Decoration.widget(pos, el, {
        side,
        key: el.dataset.pageSlot ?? '',
        ignoreSelection: true,
        // What is pressed or typed in a slot is the slot's own (a button, a chip), never the writing's.
        stopEvent: () => true,
      });
    const decorations = [widget(doc.content.size, foot, 1)];
    if (first && first.attrs.style === 'title')
      decorations.push(widget(0, head, -1), widget(first.nodeSize, meta, -1));
    return DecorationSet.create(doc, decorations);
  };
  const plugin: Plugin<DecorationSet> = new Plugin<DecorationSet>({
    state: {
      init: (_config, state) => build(state.doc),
      // Typing inside a block moves neither widget unless the title or the document's size changed: the set is
      // mapped, and rebuilt only when a widget's place would differ.
      apply: (tr, set) => (tr.docChanged ? build(tr.doc) : set),
    },
    props: {
      decorations(state) {
        return plugin.getState(state);
      },
    },
  });
  return { plugin, head, meta, foot };
}
