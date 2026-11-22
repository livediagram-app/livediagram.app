// An answer's Markdown as the page draws it (docs/specs/030-knowledgebase/search-and-ask.md "What an answer shows").
// The model writes Markdown; drawn as characters it read as "**Thursdays**" and "- one". It is read by the article's
// own Markdown reader (`parseMarkdownBlocks`, the one a pasted or imported page goes through) into blocks, and those
// are cut down here to what an answer may show: paragraphs, headings, quotes, lists, code, rules and tables, with
// bold, italic, struck and code text. Nothing is ever HTML: a tag the model wrote stays the characters it was, and no
// link the model writes is pressable (search-and-ask.md "No outside links in an answer": a page could carry a prompt
// injection that writes a phishing link). An `http` or `https` link is drawn as its words and then its address in
// brackets, as text; any other is its words alone. Citation markers
// become chips as before (`answerParts`). Pure, and linear in the answer.
import {
  parseMarkdownBlocks,
  type ArticleBlock,
  type ArticleListKind,
  type ArticleRun,
} from '@liveknowledge/document';
import { answerParts } from './answer-parts';

export type AnswerInline =
  | { kind: 'text'; text: string; b?: true; i?: true; s?: true; code?: true }
  | { kind: 'cite'; number: number };

export type AnswerListItem = {
  list: ArticleListKind;
  checked: boolean;
  inline: AnswerInline[];
  // The items indented under this one.
  items: AnswerListItem[];
};

export type AnswerBlock =
  | { kind: 'paragraph'; inline: AnswerInline[] }
  | { kind: 'heading'; level: 1 | 2 | 3; inline: AnswerInline[] }
  | { kind: 'quote'; inline: AnswerInline[] }
  | { kind: 'list'; items: AnswerListItem[] }
  | { kind: 'code'; text: string }
  | { kind: 'rule' }
  | { kind: 'table'; header: boolean; rows: AnswerInline[][][] };

/** The address a link names, shown as text after its words: `http` or `https`, whole. Undefined for anything else
 *  (`javascript:`, `data:`, a relative path, `mailto:`), whose words are then drawn alone. */
export function safeHref(href: string | undefined): string | undefined {
  if (!href || !/^https?:\/\//i.test(href)) return undefined;
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function inlineOf(runs: readonly ArticleRun[], cited: ReadonlySet<number>): AnswerInline[] {
  const inline: AnswerInline[] = [];
  runs.forEach((run, at) => {
    const href = safeHref(run.href);
    const marks = {
      ...(run.b ? { b: true as const } : {}),
      ...(run.i ? { i: true as const } : {}),
      ...(run.s ? { s: true as const } : {}),
      ...(run.code ? { code: true as const } : {}),
    };
    // Code is the characters it is: `[1]` inside it names no passage.
    const parts = run.code
      ? [{ kind: 'text' as const, text: run.text }]
      : answerParts(run.text, cited);
    for (const part of parts)
      inline.push(part.kind === 'cite' ? part : { kind: 'text', text: part.text, ...marks });
    // A link's address, once after its last run, as plain text; not again when its words are the address.
    if (href && runs[at + 1]?.href !== run.href && run.text.trim() !== run.href)
      inline.push({ kind: 'text', text: ` (${href})` });
  });
  return inline;
}

const HEADING_LEVEL = { title: 1, h1: 1, subtitle: 2, h2: 2, h3: 3 } as const;

/** Flat list blocks, each with its level, as a tree: an item holds the items indented under it. */
function listTree(
  blocks: readonly Extract<ArticleBlock, { type: 'list' }>[],
  cited: ReadonlySet<number>,
): AnswerListItem[] {
  const top: AnswerListItem[] = [];
  // The open item at each level; an item's parent is the nearest open item above its level.
  const open: AnswerListItem[] = [];
  for (const block of blocks) {
    const level = Math.max(0, Math.min(block.level ?? 0, open.length));
    const item: AnswerListItem = {
      list: block.list,
      checked: block.checked === true,
      inline: inlineOf(block.runs, cited),
      items: [],
    };
    (level === 0 ? top : open[level - 1]!.items).push(item);
    open.length = level;
    open.push(item);
  }
  return top;
}

/** The answer as blocks to draw. `cited` are the passage numbers the answer came with: only those become chips. */
export function answerBlocks(text: string, cited: ReadonlySet<number>): AnswerBlock[] {
  const out: AnswerBlock[] = [];
  let list: Extract<ArticleBlock, { type: 'list' }>[] = [];
  const endList = () => {
    if (list.length === 0) return;
    out.push({ kind: 'list', items: listTree(list, cited) });
    list = [];
  };
  for (const block of parseMarkdownBlocks(text)) {
    if (block.type === 'list') {
      list.push(block);
      continue;
    }
    endList();
    if (block.type === 'paragraph') {
      const inline = inlineOf(block.runs, cited);
      // A blank paragraph is the gap between two blocks, which their own spacing already is.
      if (!inline.some((part) => part.kind === 'cite' || part.text.trim() !== '')) continue;
      const style = block.style ?? 'body';
      if (style === 'quote') out.push({ kind: 'quote', inline });
      else if (style === 'body') out.push({ kind: 'paragraph', inline });
      else out.push({ kind: 'heading', level: HEADING_LEVEL[style], inline });
    } else if (block.type === 'code') {
      out.push({ kind: 'code', text: block.text });
    } else if (block.type === 'divider') {
      out.push({ kind: 'rule' });
    } else if (block.type === 'table') {
      out.push({
        kind: 'table',
        header: block.header === true,
        rows: block.rows.map((row) => row.cells.map((cell) => inlineOf(cell, cited))),
      });
    }
    // A page break, a contents block or a zone has no place in an answer: left out.
  }
  endList();
  return out;
}
