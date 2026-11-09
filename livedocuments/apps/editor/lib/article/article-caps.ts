// How much an article holds, kept while writing (docs/specs/007-editor/article-pages.md "Blocks", How much an
// article holds): a local edit that would take the writing past a block, a block's text or a cell's text
// cap is refused before it lands, rather than cut by the stored form's reading a commit later.
import { Plugin, PluginKey, type Transaction } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import {
  ARTICLE_FOOTNOTE_REF,
  MAX_ARTICLE_BLOCK_TEXT,
  MAX_ARTICLE_BLOCKS,
  MAX_ARTICLE_CELL_TEXT,
} from '@livedocuments/document';

import type { ArticleCap } from './article-caps-notice';

// The notice and its toast live in the light module the editor imports as it mounts.
export {
  ARTICLE_CAP_NOTICE,
  announceArticleCap,
  setArticleCapsToast,
  type ArticleCap,
} from './article-caps-notice';

const isCell = (n: PMNode) => n.type.name === 'table_cell' || n.type.name === 'table_header';

/** What a textblock spends of its cap, counted as the stored form's reading counts it (normaliseRuns): each
 *  run's text, its link's address and its footnote's text; a line break takes the link before it. */
export function textblockSize(node: PMNode): number {
  if (node.type.name === 'code_block') return node.textContent.length;
  let size = 0;
  let href = 0;
  node.forEach((child) => {
    if (child.type.name === 'hard_break') {
      size += 1 + href;
      return;
    }
    if (child.type.name === 'footnote') {
      size += ARTICLE_FOOTNOTE_REF.length + String(child.attrs.text ?? '').length;
      href = 0;
      return;
    }
    if (!child.isText) return;
    const link = child.marks.find((m) => m.type.name === 'link');
    href = link ? String(link.attrs.href ?? '').length : 0;
    size += (child.text?.length ?? 0) + href;
  });
  return size;
}

// How far the textblocks in [from, to] of `doc` go past their caps, by cap.
function excessIn(doc: PMNode, from: number, to: number, out: Record<'text' | 'cell', number>) {
  const lo = Math.max(0, Math.min(from, doc.content.size));
  const hi = Math.max(lo, Math.min(to, doc.content.size));
  doc.nodesBetween(lo, hi, (node) => {
    if (!node.isTextblock) return true;
    const cell = isCell(node);
    const over = textblockSize(node) - (cell ? MAX_ARTICLE_CELL_TEXT : MAX_ARTICLE_BLOCK_TEXT);
    if (over > 0) out[cell ? 'cell' : 'text'] += over;
    return false;
  });
}

/** The cap a transaction would take the writing past, or null. Only growth counts: an article or block
 *  already past a cap may still be shortened. Reads only the ranges the transaction touched. */
export function capPassed(tr: Transaction): ArticleCap | null {
  if (!tr.docChanged) return null;
  const before = tr.before;
  const after = tr.doc;
  if (after.childCount > MAX_ARTICLE_BLOCKS && after.childCount > before.childCount)
    return 'blocks';
  const now = { text: 0, cell: 0 };
  const was = { text: 0, cell: 0 };
  const back = tr.mapping.invert();
  tr.steps.forEach((step, i) => {
    const s = step as unknown as { from?: number; to?: number };
    if (typeof s.from !== 'number' || typeof s.to !== 'number') return;
    // The step's range in the final doc, then back in the first.
    const rest = tr.mapping.slice(i);
    const from = rest.map(s.from, -1);
    const to = rest.map(s.to, 1);
    excessIn(after, from, to, now);
    excessIn(before, back.map(from, -1), back.map(to, 1), was);
  });
  if (now.text > was.text) return 'text';
  if (now.cell > was.cell) return 'cell';
  return null;
}

/** Refuses a local edit past a cap, telling `onRefused`. A peer's writing (`article-remote`) and the
 *  editor's own replacing of the content from the stored form are never refused. */
export function articleCapsPlugin(onRefused: (cap: ArticleCap, tr: Transaction) => void): Plugin {
  return new Plugin({
    key: new PluginKey('article-caps'),
    filterTransaction(tr) {
      if (!tr.docChanged || tr.getMeta('article-remote')) return true;
      const cap = capPassed(tr);
      if (!cap) return true;
      onRefused(cap, tr);
      return false;
    },
  });
}
