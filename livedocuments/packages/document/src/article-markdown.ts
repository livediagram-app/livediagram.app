// Pasted text read as writing (docs/specs/007-editor/article-pages.md "Writing", Paste): Markdown
// (headings, lists by indent, to-dos, quotes, code fences, dividers; bold, italic, strikethrough,
// inline code and links) becomes the blocks it means; other plain text becomes one paragraph per
// line. Pure: text in, blocks out (ids fresh).
import { tableFromGrid } from './article-table';
import { ARTICLE_FOOTNOTE_REF, cleanFootnoteText } from './article-footnotes';
import {
  isSafeArticleHref,
  nextArticleBlockId,
  normaliseRuns,
  type ArticleBlock,
  type ArticleListKind,
  type ArticleRun,
} from './article-flow';

// Something that only Markdown writes: a heading, a list, a quote, a fence, a rule, emphasis or a link. A link's text
// holds no bracket and its address no parenthesis, so each `[` or `(` scans only to the next: linear on `[[[[`.
const MARKDOWN_SIGNAL =
  /^(#{1,6}\s|\s*([-*+]|\d+[.)])\s|>\s|```|(-{3,}|\*{3,}|_{3,})\s*$|\[TOC(?: [12])?\]\s*$)|\*\*[^*]+\*\*|\[[^\][]+\]\([^()]+\)|`[^`]+`/m;

// A footnote's definition line opens a line: `[^label]: `.
const FOOTNOTE_SIGNAL = /^\[\^[^\]\s[]{1,64}\]:/m;

export function looksLikeMarkdown(text: string): boolean {
  if (MARKDOWN_SIGNAL.test(text) || FOOTNOTE_SIGNAL.test(text)) return true;
  // A pipe table: a row of cells over its rule row.
  const lines = text.split(/\r\n?|\n/);
  return lines.some((line, i) => isTableRow(line) && isTableRule(lines[i + 1] ?? ''));
}

// A pipe table's lines (docs/specs/024-agents/pages-for-agents.md "write_article"): a row is a line
// starting and ending in `|`; the rule row under the header holds `---` cells, colons allowed.
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const RULE_CELL = /^:?-{3,}:?$/;
export const isTableRow = (line: string): boolean => TABLE_ROW.test(line);
// Checked cell by cell: one regex with `\s*` on both sides of each pipe backtracks quadratically on a
// long run of spaces.
export const isTableRule = (line: string): boolean => {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => RULE_CELL.test(cell));
};

/** A table row's cells, trimmed, split on the bars that are not escaped (`\|` is a literal bar,
 *  kept escaped here for the cell's reader). */
export function tableCells(row: string): string[] {
  const inner = row.trim().replace(/^\|/, '');
  const cells: string[] = [];
  let cell = '';
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]!;
    if (c === '\\' && inner[i + 1] === '|') {
      cell += '\\|';
      i++;
    } else if (c === '|') {
      cells.push(cell.trim());
      cell = '';
    } else cell += c;
  }
  // The closing bar leaves nothing after it; text after a last bar is a cell of its own.
  if (cell.trim()) cells.push(cell.trim());
  return cells;
}

// A line break inside a cell (`<br>`), held as a private-use character while the cell is read.
const BREAK = '\ue010';

/** One cell's Markdown as runs: inline marks and links, `\|` a bar, `<br>` a line break. */
function cellRuns(cell: string, notes?: FootnoteNotes): ArticleRun[] {
  const text = cell.replace(/\\\|/g, '|').replace(/<br\s*\/?>/gi, BREAK);
  return parseInline(text, {}, notes).map((r) => ({ ...r, text: r.text.replaceAll(BREAK, '\n') }));
}

/** Footnotes' texts by the label their Markdown gives them (`[^label]: text`). */
export type FootnoteNotes = ReadonlyMap<string, string>;

// A footnote's definition line, `[^label]: text`: a label of up to 64 characters, no space or bracket in it.
const FOOTNOTE_LINE = /^\[\^([^\]\s[]{1,64})\]:[ \t]?(.*)$/;

/** The footnote definitions among `lines` (never inside a code fence), and the lines without them. The first
 *  definition of a label wins; its text is read as plain text, its marks dropped and escapes released. */
export function takeFootnoteDefinitions(lines: readonly string[]): {
  lines: string[];
  notes: FootnoteNotes;
} {
  const notes = new Map<string, string>();
  const rest: string[] = [];
  let fence = 0;
  for (const line of lines) {
    if (fence) {
      if (closesFence(line, fence)) fence = 0;
    } else fence = fenceOpening(line);
    const def = fence ? null : FOOTNOTE_LINE.exec(line);
    if (!def) {
      rest.push(line);
      continue;
    }
    if (!notes.has(def[1]!))
      notes.set(
        def[1]!,
        cleanFootnoteText(
          parseInline(def[2]!)
            .map((r) => r.text)
            .join('')
            .trim(),
        ),
      );
  }
  return { lines: rest, notes };
}

/** A run's text split at its footnote references (`[^label]` with a definition in `notes`), each one reference run.
 *  Left to right, each `]` looked for once, so a long run of `[^` with no `]` stays linear. */
function withFootnoteRefs(run: ArticleRun, notes: FootnoteNotes): ArticleRun[] {
  const { text } = run;
  const out: ArticleRun[] = [];
  let from = 0;
  let close = -1;
  for (let i = text.indexOf('[^'); i >= 0; i = text.indexOf('[^', i + 1)) {
    if (close < i + 2) close = text.indexOf(']', i + 2);
    if (close < 0) break;
    // A label is 1 to 64 characters: a longer stretch is never cut out to be looked up.
    if (close - i - 2 < 1 || close - i - 2 > 64) continue;
    const note = notes.get(releaseEscapes(text.slice(i + 2, close)));
    if (note === undefined) continue;
    if (i > from) out.push({ ...run, text: text.slice(from, i) });
    out.push({ text: ARTICLE_FOOTNOTE_REF, fn: note });
    from = close + 1;
    i = close;
  }
  if (from === 0) return [run];
  if (from < text.length) out.push({ ...run, text: text.slice(from) });
  return out;
}

const TOC_LINE = /^\[TOC(?: ([12]))?\]$/;

// Bold and italic at once (`***x***`, `___x___`) first, so the two marks are read together rather than as bold inside
// two literal stars. A link's text holds no bracket (as MARKDOWN_SIGNAL's), so each `[` scans only to the next one: a
// long run of `[^` with one `]` far after it was quadratic.
const INLINE =
  /(\*\*\*([^*]+)\*\*\*|___([^_]+)___|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|(?<!`)(`+)(?!`)([\s\S]*?[^`])\7(?!`)|\[([^\][]+)\]\(([^)\s]+)\)|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_)/;

// Markdown's backslash escapes (`\\*` is a literal `*`): held as private-use characters while the
// marks are read, so an escaped character never opens or closes one, then put back as the character.
const ESCAPABLE = '\\`*_~[]#>+-.!()';
const HELD = 0xe000;
const holdEscapes = (text: string) =>
  text.replace(/\\([\\`*_~[\]#>+\-.!()])/g, (_, c: string) =>
    String.fromCharCode(HELD + ESCAPABLE.indexOf(c)),
  );
const releaseEscapes = (text: string) =>
  text.replace(/[\ue000-\ue00f]/g, (c) => ESCAPABLE[c.charCodeAt(0) - HELD]!);

// A code span's text as CommonMark reads it: escapes stay literal (a held escape goes back to its
// backslash and character), and one space is stripped from each end when both ends have one and the
// text is not all spaces.
const releaseLiteral = (text: string) =>
  text.replace(/[\ue000-\ue00f]/g, (c) => '\\' + ESCAPABLE[c.charCodeAt(0) - HELD]!);
// A space at both ends round text that is not all spaces: the pair CommonMark strips from a code span. Checked by
// hand, not a regex: `^ .*[^ ].* $` backtracks quadratically on a long run of spaces.
export const spaceWrapped = (text: string): boolean =>
  text.length > 2 && text[0] === ' ' && text[text.length - 1] === ' ' && /[^ ]/.test(text);

function codeText(held: string): string {
  const text = releaseLiteral(held);
  return spaceWrapped(text) ? text.slice(1, -1) : text;
}

/** One line's inline Markdown as runs; with `notes`, a `[^label]` it defines is a footnote's reference. */
export function parseInline(
  text: string,
  base: Omit<ArticleRun, 'text'> = {},
  notes?: FootnoteNotes,
): ArticleRun[] {
  let runs = readInline(holdEscapes(text), base);
  if (notes?.size) runs = runs.flatMap((r) => (r.code ? [r] : withFootnoteRefs(r, notes)));
  return normaliseRuns(
    runs.map((r) => (r.fn === undefined ? { ...r, text: releaseEscapes(r.text) } : r)),
  );
}

function readInline(text: string, base: Omit<ArticleRun, 'text'>): ArticleRun[] {
  const runs: ArticleRun[] = [];
  let rest = text;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      runs.push({ ...base, text: rest });
      break;
    }
    if (m.index > 0) runs.push({ ...base, text: rest.slice(0, m.index) });
    const [, , both, both2, bold, bold2, strike, , code, linkText, href, ital, ital2] = m;
    if (both ?? both2) runs.push(...readInline((both ?? both2)!, { ...base, b: true, i: true }));
    else if (bold ?? bold2) runs.push(...readInline((bold ?? bold2)!, { ...base, b: true }));
    else if (strike) runs.push(...readInline(strike, { ...base, s: true }));
    else if (code) runs.push({ ...base, text: codeText(code), code: true });
    else if (linkText && href) {
      const safe = releaseEscapes(href);
      runs.push(...readInline(linkText, isSafeArticleHref(safe) ? { ...base, href: safe } : base));
    } else if (ital ?? ital2) runs.push(...readInline((ital ?? ital2)!, { ...base, i: true }));
    rest = rest.slice(m.index + m[0].length);
  }
  return runs;
}

// A code fence as CommonMark reads one: a line opening with three or more backticks opens it, and only a line of
// backticks alone, at least as many, closes it. Any line starting with three closed it, so code holding a line such
// as "```js" (a Markdown how-to) split into code, a paragraph and more code. The writer fences code with one more
// backtick than its own longest such line (articleToMarkdown).
/** The backticks opening a fence on `line`, or 0 when it opens none. */
export function fenceOpening(line: string): number {
  const m = /^\s*(`{3,})/.exec(line);
  return m ? m[1]!.length : 0;
}
/** True when `line` closes a fence opened with `fence` backticks. */
export function closesFence(line: string, fence: number): boolean {
  const bare = line.trim();
  return bare.length >= fence && /^`+$/.test(bare);
}

// CommonMark's hard line break: a paragraph's, a list item's or a quote's line ending in two or more spaces, or in an odd number of backslashes
// (an even run is escaped backslashes). Found by a scan back from the line's end, never a regex such as ` {2,}$`,
// which retries from every offset and is quadratic on a long run of spaces.
type HardBreak = 'spaces' | 'slash' | undefined;
function hardBreakOf(line: string): { text: string; brk: HardBreak } {
  let end = line.length;
  while (end > 0 && line[end - 1] === ' ') end--;
  if (line.length - end >= 2) return { text: line.slice(0, end).trim(), brk: 'spaces' };
  // A backslash breaks only as the line's last character (a backslash and a space is a backslash).
  let slashes = 0;
  if (end === line.length) while (slashes < end && line[end - 1 - slashes] === '\\') slashes++;
  if (slashes % 2 === 1) return { text: line.slice(0, end - 1).trim(), brk: 'slash' };
  return { text: line.trim(), brk: undefined };
}

/** A paragraph's lines as one text: a hard break is a line break ('\n'), any other line end a space. The last line's
 *  break is no break: its spaces go, its backslash stays a backslash. */
function joinParagraph(lines: readonly { text: string; brk: HardBreak }[]): string {
  let out = '';
  lines.forEach((line, i) => {
    if (i > 0) out += lines[i - 1]!.brk ? '\n' : ' ';
    out += line.text;
  });
  if (lines[lines.length - 1]!.brk === 'slash') out += '\\';
  return out;
}

const levelOf = (indent: string) => Math.min(4, Math.floor(indent.replace(/\t/g, '  ').length / 2));

const HEADING_LINE = /^(#{1,6})\s+(.*)$/;
const DIVIDER_LINE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const TODO_LINE = /^(\s*)[-*+]\s+\[( |x|X)\]\s+(.*)$/;
const BULLET_LINE = /^(\s*)[-*+]\s+(.*)$/;
const NUMBERED_LINE = /^(\s*)\d+[.)]\s+(.*)$/;
const QUOTE_LINE = /^>\s?(.*)$/;

/** Whether `line` (with `next` after it) opens a block of its own, so it never carries on a list item's text after a
 *  hard break. */
function opensBlock(line: string, next: string): boolean {
  const bare = line.trim();
  return (
    !bare ||
    fenceOpening(line) > 0 ||
    (isTableRow(line) && isTableRule(next)) ||
    TOC_LINE.test(bare) ||
    HEADING_LINE.test(line) ||
    DIVIDER_LINE.test(line) ||
    BULLET_LINE.test(line) ||
    NUMBERED_LINE.test(line) ||
    QUOTE_LINE.test(line)
  );
}

/** Markdown as blocks. Its footnote definitions are taken out and its references to them read as footnotes; or, with
 *  `given` (an agent's text read in stretches, articleFromMarkdown), the definitions already taken from the whole. */
export function parseMarkdownBlocks(text: string, given?: FootnoteNotes): ArticleBlock[] {
  const taken = new Set<string>();
  const id = () => {
    const next = nextArticleBlockId(taken);
    taken.add(next);
    return next;
  };
  const blocks: ArticleBlock[] = [];
  const all = text.replace(/\r\n?/g, '\n').split('\n');
  const { lines, notes } = given ? { lines: all, notes: given } : takeFootnoteDefinitions(all);
  let para: { text: string; brk: HardBreak }[] = [];
  const flush = () => {
    if (para.length === 0) return;
    blocks.push({ id: id(), type: 'paragraph', runs: parseInline(joinParagraph(para), {}, notes) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const fence = fenceOpening(line);
    if (fence) {
      flush();
      const body: string[] = [];
      for (i++; i < lines.length && !closesFence(lines[i]!, fence); i++) body.push(lines[i]!);
      blocks.push({ id: id(), type: 'code', text: body.join('\n') });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (isTableRow(line) && isTableRule(lines[i + 1] ?? '')) {
      flush();
      const head = tableCells(line);
      const body: string[][] = [];
      for (i += 2; i < lines.length && isTableRow(lines[i]!); i++) body.push(tableCells(lines[i]!));
      i -= 1;
      // A header line of empty cells is no header row: the table starts with its first body row.
      const header = head.some(Boolean);
      const grid = (header ? [head, ...body] : body).map((row) =>
        row.map((c) => cellRuns(c, notes)),
      );
      const table = tableFromGrid(
        id(),
        grid.length ? grid : [head.map((c) => cellRuns(c, notes))],
        header,
      );
      if (table) blocks.push(table);
      continue;
    }
    const toc = TOC_LINE.exec(line.trim());
    if (toc) {
      flush();
      const depth = toc[1] === '1' ? 1 : toc[1] === '2' ? 2 : undefined;
      blocks.push({ id: id(), type: 'toc', ...(depth ? { depth } : {}) });
      continue;
    }
    const heading = HEADING_LINE.exec(line);
    if (heading) {
      flush();
      const n = heading[1]!.length;
      const style = n === 1 ? 'h1' : n === 2 ? 'h2' : 'h3';
      blocks.push({
        id: id(),
        type: 'paragraph',
        style,
        runs: parseInline(heading[2]!, {}, notes),
      });
      continue;
    }
    if (DIVIDER_LINE.test(line)) {
      flush();
      blocks.push({ id: id(), type: 'divider' });
      continue;
    }
    const todo = TODO_LINE.exec(line);
    const bullet = BULLET_LINE.exec(line);
    const numbered = NUMBERED_LINE.exec(line);
    const item = todo ?? bullet ?? numbered;
    if (item) {
      flush();
      const list: ArticleListKind = todo ? 'todo' : bullet ? 'bullet' : 'numbered';
      const level = levelOf(item[1]!);
      // A hard break at the line's end carries the item on to the next line (indented under it, as the writer puts
      // it), unless that line opens a block of its own.
      const text = [hardBreakOf(todo ? todo[3]! : item[2]!)];
      while (text[text.length - 1]!.brk && i + 1 < lines.length) {
        if (opensBlock(lines[i + 1]!, lines[i + 2] ?? '')) break;
        text.push(hardBreakOf(lines[++i]!));
      }
      blocks.push({
        id: id(),
        type: 'list',
        list,
        ...(level > 0 ? { level } : {}),
        ...(todo && todo[2] !== ' ' ? { checked: true as const } : {}),
        runs: parseInline(joinParagraph(text), {}, notes),
      });
      continue;
    }
    const quote = QUOTE_LINE.exec(line);
    if (quote) {
      flush();
      // Each `>` line is a quote of its own, but one ending in a hard break goes on into the `>` line after it.
      const text = [hardBreakOf(quote[1]!)];
      while (text[text.length - 1]!.brk) {
        const more = QUOTE_LINE.exec(lines[i + 1] ?? '');
        if (!more) break;
        text.push(hardBreakOf(more[1]!));
        i++;
      }
      blocks.push({
        id: id(),
        type: 'paragraph',
        style: 'quote',
        runs: parseInline(joinParagraph(text), {}, notes),
      });
      continue;
    }
    para.push(hardBreakOf(line));
  }
  flush();
  return blocks;
}

/** Plain text, one paragraph per line (blank lines dropped). */
export function plainTextBlocks(text: string): ArticleBlock[] {
  const taken = new Set<string>();
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const blockId = nextArticleBlockId(taken);
      taken.add(blockId);
      return { id: blockId, type: 'paragraph' as const, runs: [{ text: line }] };
    });
}
