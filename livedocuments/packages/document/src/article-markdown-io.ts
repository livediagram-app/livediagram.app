// An article's writing as the Markdown agents read and write (docs/specs/024-agents/
// pages-for-agents.md "write_article", "Reading: the pages view"): the editor's paste reading
// (article-markdown) plus what only an agent's text carries, front matter for the title and
// subtitle, `\pagebreak` lines and `[zone <id>]` lines standing for the article's zones. Both ways
// are pure; reading back what was written keeps every block's type, style, list, level, check and
// text (underline, colours, highlights, superscript and subscript have no Markdown and read as
// plain text).
import {
  MAX_ARTICLE_BLOCK_TEXT,
  nextArticleBlockId,
  type ArticleBlock,
  type ArticleFlow,
  type ArticleRun,
} from './article-flow';
import {
  closesFence,
  fenceOpening,
  isTableRow,
  parseMarkdownBlocks,
  spaceWrapped,
} from './article-markdown';
import { articleTableText, type ArticleTableBlock } from './article-table';

// The most Markdown one write takes: 5,000 blocks of ~80 characters, far inside a tab's row.
export const ARTICLE_MARKDOWN_MAX = 400_000;

const FRONT_MATTER = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/;
const ZONE_LINE = /^\[zone ([^\]\s]{1,64})\]$/;
const PAGE_BREAK_LINE = /^\\pagebreak$/;

type ArticleFromMarkdown =
  | {
      blocks: ArticleBlock[];
      // Zones of `current` the text keeps, and those it leaves out (to be removed with their elements).
      keptZones: string[];
      droppedZones: string[];
    }
  | { unknownZone: string }
  // A paragraph (a run of lines with no blank line between) longer than a block holds: refused
  // rather than cut, as the editor's reading would cut it.
  | { tooLong: true };

const unquote = (v: string) =>
  v
    .trim()
    .replace(/^(["'])(.*)\1$/, '$2')
    .trim();

function frontMatterOf(text: string): { title?: string; subtitle?: string; body: string } {
  const m = FRONT_MATTER.exec(text);
  if (!m) return { body: text };
  const out: { title?: string; subtitle?: string; body: string } = {
    body: text.slice(m[0].length),
  };
  for (const line of m[1]!.split('\n')) {
    const field = /^\s*(title|subtitle)\s*:\s*(.*)$/i.exec(line);
    if (!field) continue;
    const value = unquote(field[2]!);
    if (value) out[field[1]!.toLowerCase() as 'title' | 'subtitle'] = value;
  }
  return out;
}

/** Reads lines in order, answering true for each line that is a fence or inside one (as parseMarkdownBlocks reads
 *  them), so a line of code is never read as a table, a zone or a page break. */
function fenceTracker(): (line: string) => boolean {
  let open = 0;
  return (line) => {
    if (open) {
      if (closesFence(line, open)) open = 0;
      return true;
    }
    open = fenceOpening(line);
    return open > 0;
  };
}

/**
 * Markdown as an article's blocks. `current` is the article being written over: a `[zone <id>]`
 * line keeps that zone there; a zone id it lacks answers `unknownZone`. Block ids are fresh (never
 * one of `current`'s) except a kept zone's.
 */
export function articleFromMarkdown(text: string, current?: ArticleFlow): ArticleFromMarkdown {
  const zones = new Map(
    (current?.blocks ?? []).flatMap((b) => (b.type === 'zone' ? [[b.id, b] as const] : [])),
  );
  const { title, subtitle, body } = frontMatterOf(text.replace(/\r\n?/g, '\n'));
  // Fresh ids never meet one the article has, so appended blocks sit beside its own.
  const taken = new Set<string>((current?.blocks ?? []).map((b) => b.id));
  const fresh = () => {
    const id = nextArticleBlockId(taken);
    taken.add(id);
    return id;
  };
  const blocks: ArticleBlock[] = [];
  const heading = (style: 'title' | 'subtitle', value: string | undefined) => {
    if (value) blocks.push({ id: fresh(), type: 'paragraph', style, runs: [{ text: value }] });
  };
  heading('title', title);
  heading('subtitle', subtitle);
  const kept: string[] = [];
  let stretch: string[] = [];
  const flush = () => {
    if (stretch.length === 0) return;
    for (const b of parseMarkdownBlocks(stretch.join('\n'))) blocks.push({ ...b, id: fresh() });
    stretch = [];
  };
  let paragraph = 0;
  const fence = fenceTracker();
  for (const line of body.split('\n')) {
    // A table's rows are cells, not one paragraph: a long table is bounded by the table's own caps.
    paragraph = line.trim() && !isTableRow(line) ? paragraph + line.length + 1 : 0;
    if (paragraph > MAX_ARTICLE_BLOCK_TEXT) return { tooLong: true };
    const fenced = fence(line);
    const bare = line.trim();
    const zone = fenced ? null : ZONE_LINE.exec(bare);
    if (zone) {
      const block = zones.get(zone[1]!);
      if (!block) return { unknownZone: zone[1]! };
      flush();
      if (!kept.includes(block.id)) {
        blocks.push(block);
        kept.push(block.id);
      }
      continue;
    }
    if (!fenced && PAGE_BREAK_LINE.test(bare)) {
      flush();
      blocks.push({ id: fresh(), type: 'pageBreak' });
      continue;
    }
    stretch.push(line);
  }
  flush();
  return {
    blocks,
    keptZones: kept,
    droppedZones: [...zones.keys()].filter((id) => !kept.includes(id)),
  };
}

// Markdown's own characters in plain text, escaped so the text reads back as written.
const escapeText = (text: string) => text.replace(/([\\`*_~[\]])/g, '\\$1');

// A block's text that would open a line as a heading, quote, list item or divider is escaped there.
const escapeLineStart = (line: string) =>
  line.replace(/^(\s*)([#>+-]|\d+(?=[.)]))/, (_, space: string, mark: string) =>
    /\d/.test(mark) ? `${space}${mark}\\` : `${space}\\${mark}`,
  );

// Inline code as CommonMark writes it: fenced by one more backtick than its longest backtick run,
// and padded with a space each side when it starts or ends in a backtick, or in a space at both
// ends (the reader strips one such pair), so any text reads back as written.
function codeSpan(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((r) => r.length));
  const fence = '`'.repeat(longest + 1);
  const pad = /^`|`$/.test(text) || spaceWrapped(text) ? ' ' : '';
  return fence + pad + text + pad + fence;
}

// A link's address as the reader takes it back: its parentheses and backslashes escaped, so an address such as
// `https://en.wikipedia.org/wiki/Mercury_(planet)` is not cut at its first `)`.
const escapeHref = (href: string) => href.replace(/[\\()]/g, '\\$&');

function runMarkdown(run: ArticleRun): string {
  // Inline code keeps its other marks around it (a linked or bold `npm i`): they were dropped with the code's text
  // alone written. A line break inside a block reads back as a space: Markdown paragraphs join their lines.
  let out = run.code
    ? codeSpan(run.text.replace(/\n/g, ' '))
    : escapeText(run.text).replace(/\n/g, ' ');
  if (run.s) out = `~~${out}~~`;
  if (run.i) out = `*${out}*`;
  if (run.b) out = `**${out}**`;
  if (run.href) out = `[${out}](${escapeHref(run.href)})`;
  return out;
}

// Emphasis markers wrap the run's own text, so a run whose text starts or ends in a space keeps the
// space outside them (`**bold** text`, never `**bold **text`).
function runsMarkdown(runs: readonly ArticleRun[]): string {
  return runs
    .map((run) => {
      // Code keeps its edge spaces inside its span (codeSpan pads it so they read back).
      if (run.code || (!run.b && !run.i && !run.s && !run.href)) return runMarkdown(run);
      // trimStart/trimEnd, not `/\s*$/`: that regex retries from every offset, quadratic in spaces.
      const lead = run.text.slice(0, run.text.length - run.text.trimStart().length);
      const tail = run.text.slice(run.text.trimEnd().length);
      const inner = run.text.slice(lead.length, run.text.length - tail.length);
      return inner ? lead + runMarkdown({ ...run, text: inner }) + tail : run.text;
    })
    .join('');
}

// A line break inside a table cell, held while the cell's runs are written, then written `<br>`.
const CELL_BREAK = '\ue010';

// A cell's runs as a pipe table's cell: its bars escaped, a line break as `<br>`. Backslashes are already escaped
// (escapeText), so a bar is the one character left to escape.
const cellMarkdown = (runs: readonly ArticleRun[]) =>
  runsMarkdown(runs.map((r) => ({ ...r, text: r.text.replace(/\n/g, CELL_BREAK) })))
    .split('|')
    .join('\\|')
    .replaceAll(CELL_BREAK, '<br>');

/** A table as a pipe table: its header row the header line, or an empty header line when it has
 *  none (which reads back as no header row). */
function tableMarkdown(t: ArticleTableBlock): string[] {
  const row = (cells: string[]) => `| ${cells.join(' | ')} |`;
  const rows = t.rows.map((r) => r.cells.map(cellMarkdown));
  const head = t.header ? rows.shift()! : t.cols.map(() => '');
  return [row(head), row(t.cols.map(() => '---')), ...rows.map(row)];
}

// A title or subtitle in front matter, quoted when the reader would otherwise take its own quotes off (`unquote`):
// a title `"Quoted"` read back as `Quoted`.
const frontValue = (value: string) =>
  /^(["']).*\1$/.test(value) ? (value[0] === '"' ? `'${value}'` : `"${value}"`) : value;

const PARAGRAPH_PREFIX: Record<string, string> = { h1: '# ', h2: '## ', h3: '### ', quote: '> ' };

/** An article's writing as Markdown, in the form articleFromMarkdown reads. */
export function articleToMarkdown(flow: ArticleFlow): string {
  const blocks = [...flow.blocks];
  const front: string[] = [];
  for (const style of ['title', 'subtitle'] as const) {
    const at = blocks.findIndex((b) => b.type === 'paragraph' && b.style === style);
    if (at < 0) continue;
    const text = (blocks[at] as { runs: ArticleRun[] }).runs.map((r) => r.text).join('');
    blocks.splice(at, 1);
    const value = text.replace(/\n/g, ' ').trim();
    if (value) front.push(`${style}: ${frontValue(value)}`);
  }
  const lines: string[] = front.length ? ['---', ...front, '---', ''] : [];
  // Without front matter, an opening divider is written `***`: as `---` it read back as the start of front matter,
  // and everything up to the next divider was taken for it and lost.
  let opening = !front.length;
  let numbers: number[] = [];
  let prevList = false;
  for (const b of blocks) {
    const isList = b.type === 'list';
    // A list's items sit together; anything else is a paragraph of its own.
    if (prevList && !isList) lines.push('');
    if (!isList) numbers = [];
    switch (b.type) {
      case 'paragraph':
        lines.push(
          (PARAGRAPH_PREFIX[b.style ?? ''] ?? '') + escapeLineStart(runsMarkdown(b.runs)),
          '',
        );
        break;
      case 'list': {
        const level = b.level ?? 0;
        numbers = numbers.slice(0, level + 1);
        // A bullet or to-do at a level restarts that level's count, as the editor numbers them.
        numbers[level] = b.list === 'numbered' ? (numbers[level] ?? 0) + 1 : 0;
        const marker =
          b.list === 'numbered'
            ? `${numbers[level]}.`
            : b.list === 'todo'
              ? `- [${b.checked ? 'x' : ' '}]`
              : '-';
        lines.push(`${'  '.repeat(level)}${marker} ${escapeLineStart(runsMarkdown(b.runs))}`);
        break;
      }
      case 'code': {
        // One backtick more than the longest fence-like line of the code, so none of its lines closes the fence.
        const inner = Math.max(0, ...b.text.split('\n').map(fenceOpening));
        const fence = '`'.repeat(Math.max(3, inner + 1));
        lines.push(fence, b.text, fence, '');
        break;
      }
      case 'divider':
        lines.push(opening ? '***' : '---', '');
        break;
      case 'pageBreak':
        lines.push('\\pagebreak', '');
        break;
      case 'zone':
        lines.push(`[zone ${b.id}]`, '');
        break;
      case 'table':
        lines.push(...tableMarkdown(b), '');
        break;
      case 'toc':
        lines.push(b.depth ? `[TOC ${b.depth}]` : '[TOC]', '');
        break;
    }
    prevList = isList;
    opening = false;
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n') + (lines.length ? '\n' : '');
}

/** The words of an article's writing (its runs and code), as the answers count them. */
export function articleWordCount(flow: ArticleFlow): number {
  let words = 0;
  for (const b of flow.blocks) {
    const text =
      'runs' in b
        ? b.runs.map((r) => r.text).join('')
        : b.type === 'code'
          ? b.text
          : b.type === 'table'
            ? articleTableText(b)
            : '';
    words += text.split(/\s+/).filter(Boolean).length;
  }
  return words;
}

/** An article's title: its first title block's text, else its first heading's, else "Untitled". */
export function articleTitleOf(flow: ArticleFlow): string {
  const textOf = (b: ArticleBlock | undefined) =>
    b && 'runs' in b
      ? b.runs
          .map((r) => r.text)
          .join('')
          .trim()
      : '';
  const title = textOf(flow.blocks.find((b) => b.type === 'paragraph' && b.style === 'title'));
  if (title) return title;
  const heading = textOf(
    flow.blocks.find((b) => b.type === 'paragraph' && (b.style === 'h1' || b.style === 'h2')),
  );
  return heading || 'Untitled';
}
