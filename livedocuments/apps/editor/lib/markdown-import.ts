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
// Linear: the alt text stops at a `[` and the address at a `(`, so no start rescans what a later one will.
const IMAGE = /!\[([^[\]\n]*)\]\(([^()\s]+)\)/y;

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
      return lineImagesAsLinks(line);
    })
    .join('\n');
}

// One line's images as links, its code spans as written. A code span is CommonMark's: a backtick run closed by the
// next run of exactly as many (so a double-backtick span may hold a single one); a run with no closer is plain text.
// Linear: every run's closer is found in one right-to-left pass over the runs.
function lineImagesAsLinks(line: string): string {
  if (!line.includes('![')) return line;
  const runs: { at: number; end: number }[] = [];
  for (let i = line.indexOf('`'); i !== -1; i = line.indexOf('`', i)) {
    const at = i;
    while (line[i] === '`') i++;
    runs.push({ at, end: i });
  }
  const closer = new Array<number>(runs.length);
  const nextOfLength = new Map<number, number>();
  for (let k = runs.length - 1; k >= 0; k--) {
    const length = runs[k]!.end - runs[k]!.at;
    closer[k] = nextOfLength.get(length) ?? -1;
    nextOfLength.set(length, k);
  }
  let out = '';
  let from = 0;
  let run = 0;
  for (let i = line.indexOf('!['); i !== -1; i = line.indexOf('![', i)) {
    // Skip past every code span that opens before this image.
    while (run < runs.length && runs[run]!.at < i) {
      const close = closer[run]!;
      if (close === -1) run++;
      else {
        i = Math.max(i, runs[close]!.end);
        run = close + 1;
      }
    }
    if (line.startsWith('![', i)) {
      IMAGE.lastIndex = i;
      const image = IMAGE.exec(line);
      const end = image ? i + image[0].length : i;
      // A code span opening inside the image wins over it, as CommonMark's code spans bind tighter than links.
      let inner = run;
      while (inner < runs.length && runs[inner]!.at < end && closer[inner] === -1) inner++;
      if (image && !(inner < runs.length && runs[inner]!.at < end)) {
        const [, alt, href] = image as unknown as [string, string, string];
        out += `${line.slice(from, i)}[${alt.trim() || href}](${href})`;
        from = end;
        run = inner;
        i = from;
        continue;
      }
    }
    i++;
  }
  return out + line.slice(from);
}
