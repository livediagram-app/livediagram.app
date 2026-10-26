// Pasted text read as writing (docs/specs/007-editor/article-pages.md "Writing", Paste): Markdown
// (headings, lists by indent, to-dos, quotes, code fences, dividers; bold, italic, strikethrough,
// inline code and links) becomes the blocks it means; other plain text becomes one paragraph per
// line. Pure: text in, blocks out (ids fresh).
import {
  isSafeArticleHref,
  nextArticleBlockId,
  normaliseRuns,
  type ArticleBlock,
  type ArticleListKind,
  type ArticleRun,
} from './article-flow';

// Something that only Markdown writes: a heading, a list, a quote, a fence, a rule, emphasis or a link.
const MARKDOWN_SIGNAL =
  /^(#{1,6}\s|\s*([-*+]|\d+[.)])\s|>\s|```|(-{3,}|\*{3,}|_{3,})\s*$)|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`/m;

export function looksLikeMarkdown(text: string): boolean {
  return MARKDOWN_SIGNAL.test(text);
}

// Bold and italic at once (`***x***`, `___x___`) first, so the two marks are read together rather than as bold inside
// two literal stars.
const INLINE =
  /(\*\*\*([^*]+)\*\*\*|___([^_]+)___|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|(?<!`)(`+)(?!`)([\s\S]*?[^`])\7(?!`)|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_)/;

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

/** One line's inline Markdown as runs. */
export function parseInline(text: string, base: Omit<ArticleRun, 'text'> = {}): ArticleRun[] {
  return normaliseRuns(
    readInline(holdEscapes(text), base).map((r) => ({ ...r, text: releaseEscapes(r.text) })),
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

const levelOf = (indent: string) => Math.min(4, Math.floor(indent.replace(/\t/g, '  ').length / 2));

/** Markdown as blocks. */
export function parseMarkdownBlocks(text: string): ArticleBlock[] {
  const taken = new Set<string>();
  const id = () => {
    const next = nextArticleBlockId(taken);
    taken.add(next);
    return next;
  };
  const blocks: ArticleBlock[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let para: string[] = [];
  const flush = () => {
    if (para.length === 0) return;
    blocks.push({ id: id(), type: 'paragraph', runs: parseInline(para.join(' ')) });
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
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const n = heading[1]!.length;
      const style = n === 1 ? 'h1' : n === 2 ? 'h2' : 'h3';
      blocks.push({ id: id(), type: 'paragraph', style, runs: parseInline(heading[2]!) });
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flush();
      blocks.push({ id: id(), type: 'divider' });
      continue;
    }
    const todo = /^(\s*)[-*+]\s+\[( |x|X)\]\s+(.*)$/.exec(line);
    const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    const numbered = /^(\s*)\d+[.)]\s+(.*)$/.exec(line);
    const item = todo ?? bullet ?? numbered;
    if (item) {
      flush();
      const list: ArticleListKind = todo ? 'todo' : bullet ? 'bullet' : 'numbered';
      const level = levelOf(item[1]!);
      blocks.push({
        id: id(),
        type: 'list',
        list,
        ...(level > 0 ? { level } : {}),
        ...(todo && todo[2] !== ' ' ? { checked: true as const } : {}),
        runs: parseInline(todo ? todo[3]! : item[2]!),
      });
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flush();
      blocks.push({ id: id(), type: 'paragraph', style: 'quote', runs: parseInline(quote[1]!) });
      continue;
    }
    para.push(line.trim());
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
