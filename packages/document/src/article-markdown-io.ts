// An article's writing as the Markdown agents read and write (docs/specs/024-agents/
// illustrate-for-agents.md "write_article", "Reading: the pages view"): the editor's paste reading
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
import { parseMarkdownBlocks } from './article-markdown';

// The most Markdown one write takes: 5,000 blocks of ~80 characters, far inside a tab's row.
export const ARTICLE_MARKDOWN_MAX = 400_000;

const FRONT_MATTER = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/;
const ZONE_LINE = /^\[zone ([^\]\s]{1,64})\]$/;
const PAGE_BREAK_LINE = /^\\pagebreak$/;

export type ArticleFromMarkdown =
  | {
      blocks: ArticleBlock[];
      // Zones of `current` the text keeps, and those it leaves out (to be removed with their elements).
      keptZones: string[];
      droppedZones: string[];
      // Markdown tables read as lists: an article's text holds no tables.
      tables: number;
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

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const cellsOf = (row: string) =>
  row
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

/** A Markdown table (a header row, a rule, rows) as a list: the header in bold, then a row an item,
 *  cells joined with ` · `. Lines in a code fence stay as they are. `found` is told of each table. */
function tablesAsLists(lines: readonly string[], found: () => void): string[] {
  const out: string[] = [];
  let fenced = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^```/.test(line.trim())) fenced = !fenced;
    if (fenced || !TABLE_ROW.test(line) || !TABLE_RULE.test(lines[i + 1] ?? '')) {
      out.push(line);
      continue;
    }
    found();
    out.push('', `**${cellsOf(line).filter(Boolean).join(' · ')}**`, '');
    for (i += 2; i < lines.length && TABLE_ROW.test(lines[i]!); i++)
      out.push(`- ${cellsOf(lines[i]!).join(' · ')}`);
    out.push('');
    i -= 1;
  }
  return out;
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
  let fenced = false;
  const flush = () => {
    if (stretch.length === 0) return;
    for (const b of parseMarkdownBlocks(stretch.join('\n'))) blocks.push({ ...b, id: fresh() });
    stretch = [];
  };
  let paragraph = 0;
  let tables = 0;
  for (const line of tablesAsLists(body.split('\n'), () => tables++)) {
    paragraph = line.trim() ? paragraph + line.length + 1 : 0;
    if (paragraph > MAX_ARTICLE_BLOCK_TEXT) return { tooLong: true };
    if (/^```/.test(line.trim())) fenced = !fenced;
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
    tables,
  };
}

// Markdown's own characters in plain text, escaped so the text reads back as written.
const escapeText = (text: string) => text.replace(/([\\`*_~[\]])/g, '\\$1');

// A block's text that would open a line as a heading, quote, list item or divider is escaped there.
const escapeLineStart = (line: string) =>
  line.replace(/^(\s*)([#>+-]|\d+(?=[.)]))/, (_, space: string, mark: string) =>
    /\d/.test(mark) ? `${space}${mark}\\` : `${space}\\${mark}`,
  );

function runMarkdown(run: ArticleRun): string {
  if (run.code) return '`' + run.text.replace(/`/g, '') + '`';
  // A line break inside a block reads back as a space: Markdown paragraphs join their lines.
  let out = escapeText(run.text).replace(/\n/g, ' ');
  if (run.s) out = `~~${out}~~`;
  if (run.i) out = `*${out}*`;
  if (run.b) out = `**${out}**`;
  if (run.href) out = `[${out}](${run.href})`;
  return out;
}

// Emphasis markers wrap the run's own text, so a run whose text starts or ends in a space keeps the
// space outside them (`**bold** text`, never `**bold **text`).
function runsMarkdown(runs: readonly ArticleRun[]): string {
  return runs
    .map((run) => {
      if (!run.b && !run.i && !run.s && !run.href) return runMarkdown(run);
      const lead = /^\s*/.exec(run.text)![0];
      const tail = /\s*$/.exec(run.text)![0];
      const inner = run.text.slice(lead.length, run.text.length - tail.length);
      return inner ? lead + runMarkdown({ ...run, text: inner }) + tail : run.text;
    })
    .join('');
}

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
    if (text.trim()) front.push(`${style}: ${text.replace(/\n/g, ' ').trim()}`);
  }
  const lines: string[] = front.length ? ['---', ...front, '---', ''] : [];
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
      case 'code':
        lines.push('```', b.text, '```', '');
        break;
      case 'divider':
        lines.push('---', '');
        break;
      case 'pageBreak':
        lines.push('\\pagebreak', '');
        break;
      case 'zone':
        lines.push(`[zone ${b.id}]`, '');
        break;
    }
    prevList = isList;
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n') + (lines.length ? '\n' : '');
}

/** The words of an article's writing (its runs and code), as the answers count them. */
export function articleWordCount(flow: ArticleFlow): number {
  let words = 0;
  for (const b of flow.blocks) {
    const text = 'runs' in b ? b.runs.map((r) => r.text).join('') : b.type === 'code' ? b.text : '';
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
