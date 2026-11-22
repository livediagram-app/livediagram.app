// A page's Title is always there (owner, 2026-11-21: "Don't let me remove the title field from a page, its always meant
// to be there"; docs/specs/030-knowledgebase/editing.md "Title and writing keys"). Backspace at its start keeps it a
// Title (article-key-commands.ts), and whatever else an edit does (a selection across it deleted, a paste over it),
// a writing that had a Title first keeps one: the first block goes back to the Title style when it is still a
// paragraph, or an empty Title is put back in front.
import { Plugin } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { PARAGRAPH } from './article-block-commands';

const isTitle = (node: PMNode | null | undefined): boolean =>
  !!node && node.type === PARAGRAPH && node.attrs.style === 'title';

export function keepTitlePlugin(): Plugin {
  return new Plugin({
    appendTransaction(trs, before, after) {
      if (!trs.some((tr) => tr.docChanged)) return null;
      const had = before.doc.firstChild;
      if (!isTitle(had) || isTitle(after.doc.firstChild)) return null;
      const first = after.doc.firstChild;
      const tr = after.tr;
      // The Title's own block, its style lost (its words kept): it becomes the Title again.
      if (first && first.type === PARAGRAPH && first.attrs.id === had!.attrs.id)
        return tr.setNodeMarkup(0, undefined, { ...first.attrs, style: 'title' });
      return tr.insert(0, PARAGRAPH.create({ ...had!.attrs, style: 'title' }));
    },
  });
}
