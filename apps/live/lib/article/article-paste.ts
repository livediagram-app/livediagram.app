// Pasted text in the writing, as the writing's ProseMirror view props (ArticleEditor). What is not
// text (an image, copied canvas elements) is the canvas's (articlePasteIsCanvas).
import { Selection } from 'prosemirror-state';
import { Slice, type Node as PMNode } from 'prosemirror-model';
import type { DirectEditorProps } from 'prosemirror-view';
import { track } from '@/lib/telemetry';
import { blocksToDoc } from './article-convert';
import { looksLikeMarkdown, parseMarkdownBlocks, plainTextBlocks } from '@livediagram/document';

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
  handlePaste: (v, event) => {
    const data = event.clipboardData;
    if (!data || data.types.includes('text/html')) return false;
    const text = data.getData('text/plain');
    const { $from, empty } = v.state.selection;
    if (!empty || $from.depth < 1 || $from.parent.content.size > 0) return false;
    if ($from.parent.type.spec.code) return false;
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
