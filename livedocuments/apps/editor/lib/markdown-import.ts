// Markdown → article import (docs/specs/020-import-export/markdown-import.md). A Markdown file becomes
// an article: the tab's content is replaced by one article page whose writing is the Markdown, read
// the way write_article and an article's Markdown paste read it (articleFromMarkdown), and the
// editor flows it onto as many pages as it takes.
//
// Dynamically imported by useTabImport so the reading stays out of the editor's initial bundle.

import {
  ARTICLE_MARKDOWN_MAX,
  MAX_ARTICLE_BLOCK_TEXT,
  MAX_ARTICLE_BLOCKS,
  articleFromMarkdown,
  nextArticleBlockId,
  nextArticleFlowId,
  pagesOf,
  withArticleFlow,
  withPageKindChosen,
  type ArticleBlock,
  type Tab,
} from '@livedocuments/document';

export type MarkdownImportResult = { ok: true; tab: Tab } | { ok: false; error: string };

/** The tab a Markdown file imports as: one article holding its writing. */
export function buildTabFromMarkdown(
  markdown: string,
  opts: { tabName?: string } = {},
): MarkdownImportResult {
  if (markdown.length > ARTICLE_MARKDOWN_MAX) {
    return {
      ok: false,
      error: `This Markdown is longer than an article takes (${ARTICLE_MARKDOWN_MAX.toLocaleString('en-GB')} characters).`,
    };
  }
  const read = articleFromMarkdown(imagesAsLinks(markdown));
  if ('tooLong' in read) {
    return {
      ok: false,
      error: `A paragraph holds at most ${MAX_ARTICLE_BLOCK_TEXT.toLocaleString('en-GB')} characters: split the long one with a blank line.`,
    };
  }
  // A fresh article has no zones, so a `[zone …]` line names none of its own.
  if ('unknownZone' in read) {
    return {
      ok: false,
      error: `This Markdown names a zone ("${read.unknownZone}") a new article has none of.`,
    };
  }
  if (read.blocks.length > MAX_ARTICLE_BLOCKS) {
    return {
      ok: false,
      error: `This Markdown makes ${read.blocks.length.toLocaleString('en-GB')} blocks; an article holds at most ${MAX_ARTICLE_BLOCKS.toLocaleString('en-GB')}.`,
    };
  }
  // An article always has a block to write in.
  const blocks: ArticleBlock[] =
    read.blocks.length > 0
      ? read.blocks
      : [{ id: nextArticleBlockId(), type: 'paragraph', runs: [] }];
  const flow = nextArticleFlowId();
  const blank: Tab = {
    id: crypto.randomUUID(),
    name: (opts.tabName ?? '').trim() || 'Imported',
    elements: [],
    templateChosen: true,
  };
  // A blank tab's one page always offers the choice, so the article takes it.
  const chosen = withPageKindChosen(blank, pagesOf(blank)[0]!.id, 'article', flow)!;
  return { ok: true, tab: withArticleFlow(chosen, flow, { blocks }) };
}

// An image (`![alt](address)`) read as a link named by its alt text, the address when it has none
// (docs/specs/020-import-export/markdown-import.md "What it reads"): the reader takes `!` as text, which left a
// stray `!` before a link. Code (a fence, or an inline span) is left as written. Only the import reads it so.
// Linear: a backtick run is taken whole (the lookahead), the alt text stops at a `[` and the address at a `(`, so
// no start rescans what a later one will.
const IMAGE_OR_CODE = /(?=(`+))\1[^`]*\1|!\[([^[\]\n]*)\]\(([^()\s]+)\)/g;

export function imagesAsLinks(markdown: string): string {
  if (!markdown.includes('![')) return markdown;
  let fence = 0;
  return markdown
    .split('\n')
    .map((line) => {
      const open = /^\s*(`{3,})/.exec(line);
      if (fence) {
        if (open && open[1]!.length >= fence && line.trim() === open[1]) fence = 0;
        return line;
      }
      if (open) {
        fence = open[1]!.length;
        return line;
      }
      return line.replace(IMAGE_OR_CODE, (whole, tick?: string, alt?: string, href?: string) =>
        tick !== undefined || href === undefined ? whole : `[${alt?.trim() || href}](${href})`,
      );
    })
    .join('\n');
}
