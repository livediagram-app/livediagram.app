// Copied list items keep their list (docs/specs/030-knowledgebase/editing.md "Selecting and copying"). The writing's
// list items are flat blocks (`list_item`, a kind and a level each) rendered as bare `<li>`s, so ProseMirror's copy
// put `<li>`s with no `<ul>` or `<ol>` round them on the clipboard, and a rich editor pasted them without bullets
// or numbers. The clipboard's serializer wraps each run of items in its list, a deeper level in a list inside the
// item before it, as any web page's list copies. Pasting back here reads them as before: an item's own kind and
// level attributes win over the lists round it (article-schema.ts).
import { DOMSerializer, type Fragment } from 'prosemirror-model';
import { articleSchema } from './article-schema';

const ITEM = 'data-article-list';

type Open = { list: HTMLElement; level: number; tag: 'ul' | 'ol' };

/** Wraps each run of the writing's list items among `parent`'s children in its `<ul>` or `<ol>`, nested by level. */
export function wrapListItems(parent: Element | DocumentFragment): void {
  // The clipboard's own detached document, never the page's.
  const doc = parent.ownerDocument;
  let open: Open[] = [];
  for (const child of [...parent.children]) {
    const kind = child.tagName === 'LI' ? child.getAttribute(ITEM) : null;
    if (kind === null) {
      open = [];
      continue;
    }
    const level = Math.max(0, Number(child.getAttribute('data-level')) || 0);
    const tag = kind === 'numbered' ? 'ol' : 'ul';
    // Close the lists deeper than this item, and one at its level of another kind.
    while (open.length > 0) {
      const top = open[open.length - 1]!;
      if (top.level > level || (top.level === level && top.tag !== tag)) open.pop();
      else break;
    }
    let top = open[open.length - 1];
    if (!top || top.level < level) {
      const list = doc.createElement(tag);
      // A deeper item's list sits inside the item before it; with none open, in the item's own place.
      const host = top?.list.lastElementChild;
      if (host) host.appendChild(list);
      else parent.insertBefore(list, child);
      top = { list, level, tag };
      open.push(top);
    }
    top.list.appendChild(child);
  }
}

class ListWrappingSerializer extends DOMSerializer {
  override serializeFragment(
    fragment: Fragment,
    options?: { document?: Document },
    target?: HTMLElement | DocumentFragment,
  ): HTMLElement | DocumentFragment {
    const out = super.serializeFragment(fragment, options, target);
    wrapListItems(out);
    return out;
  }
}

const base = DOMSerializer.fromSchema(articleSchema);

/** The writing's clipboard serializer (the view's `clipboardSerializer`): the schema's own, its list items in lists. */
export const articleClipboardSerializer: DOMSerializer = new ListWrappingSerializer(
  base.nodes,
  base.marks,
);
