// Pasted text in the writing, as the writing's ProseMirror view props (ArticleEditor). What is not
// text (an image, copied canvas elements) is the canvas's (articlePasteIsCanvas).
import { Selection } from 'prosemirror-state';
import { Slice, type Node as PMNode } from 'prosemirror-model';
import type { DirectEditorProps, EditorView } from 'prosemirror-view';
import { track } from '@/lib/telemetry';
import { blocksToDoc } from './article-convert';
import { looksLikeMarkdown, parseMarkdownBlocks, plainTextBlocks } from '@livedocuments/document';

// Pasted HTML into an empty paragraph: when it opens with a block of its own kind (a heading, a quote,
// a list item, code, a divider), the empty paragraph gives it its place, as pasted text does, rather than
// taking its text and losing its style. A plain paragraph pastes as ProseMirror places it, into the
// block, which keeps its style (a paragraph pasted into an empty title stays the title).
const pasteBlocksWhole = (v: EditorView, slice: Slice): boolean => {
  const first = slice.content.firstChild;
  if (!first?.isBlock) return false;
  let blocks = true;
  slice.content.forEach((n) => {
    if (!n.isBlock) blocks = false;
  });
  if (!blocks) return false;
  if (first.type.name === 'paragraph' && first.attrs.style === 'body') return false;
  const { $from } = v.state.selection;
  // Only a body paragraph gives its place: an empty title, heading or list item keeps its kind and
  // takes the first pasted block's text (a heading pasted into the empty title is the title).
  if ($from.parent.type.name !== 'paragraph' || $from.parent.attrs.style !== 'body') return false;
  const start = $from.before(1);
  const tr = v.state.tr.replaceWith(start, $from.after(1), slice.content);
  tr.setSelection(Selection.near(tr.doc.resolve(start + slice.content.size), -1)).setMeta(
    'uiEvent',
    'paste',
  );
  v.dispatch(tr.scrollIntoView());
  return true;
};

export const articlePasteProps: Pick<DirectEditorProps, 'clipboardTextParser' | 'handlePaste'> = {
  // Pasted text (docs/specs/007-editor/article-pages.md "Writing", Paste): Markdown becomes
  // the blocks it means, several lines of plain text a paragraph each, its first and last
  // joining the text around the caret. Into code, or a single plain line: as typed.
  clipboardTextParser: (text, $context) => {
    if ($context.parent.type.spec.code) return undefined as unknown as Slice;
    const markdown = looksLikeMarkdown(text);
    if (!markdown && !text.includes('\n')) return undefined as unknown as Slice;
    const blocks = markdown ? parseMarkdownBlocks(text) : plainTextBlocks(text);
    if (blocks.length === 0) return undefined as unknown as Slice;
    if (markdown) track('Element', 'Changed', 'ArticlePaste');
    const doc = blocksToDoc(blocks);
    const first = doc.firstChild!;
    const last = doc.lastChild!;
    return new Slice(doc.content, first.isTextblock ? 1 : 0, last.isTextblock ? 1 : 0);
  },
  // Into an empty block, pasted text comes whole: the block gives its place to the pasted
  // blocks, the first keeping its own style (a heading stays a heading).
  handlePaste: (v, event, slice) => {
    const data = event.clipboardData;
    if (!data) return false;
    const { $from, empty } = v.state.selection;
    if (!empty || $from.depth < 1 || $from.parent.content.size > 0) return false;
    if ($from.parent.type.spec.code) return false;
    if (data.types.includes('text/html')) return pasteBlocksWhole(v, slice);
    const text = data.getData('text/plain');
    const markdown = looksLikeMarkdown(text);
    if (!markdown && !text.includes('\n')) return false;
    const blocks = markdown ? parseMarkdownBlocks(text) : plainTextBlocks(text);
    if (blocks.length === 0) return false;
    // Taken here, the text parser above never runs: counted here instead.
    if (markdown) track('Element', 'Changed', 'ArticlePaste');
    const nodes: PMNode[] = [];
    blocksToDoc(blocks).forEach((n) => nodes.push(n));
    const start = $from.before(1);
    const tr = v.state.tr.replaceWith(start, $from.after(1), nodes);
    const end = start + nodes.reduce((n, node) => n + node.nodeSize, 0);
    tr.setSelection(Selection.near(tr.doc.resolve(end), -1)).setMeta('uiEvent', 'paste');
    v.dispatch(tr.scrollIntoView());
    return true;
  },
};
