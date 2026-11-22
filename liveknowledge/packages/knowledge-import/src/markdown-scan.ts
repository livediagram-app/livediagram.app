// One pass over a page's Markdown that hands every link, picture and `[[Title]]` to a visitor and writes back what it
// answers (docs/specs/020-import-export/blueprints/knowledgebase-import.md "The Markdown scan"). Code is left as
// written: fenced blocks and code spans are skipped. Every search for a closing mark is remembered for the line it
// ran on, so a line of unclosed brackets is read once, not once per bracket.

export type MarkdownToken =
  | { kind: 'link'; text: string; target: string }
  | { kind: 'picture'; alt: string; target: string }
  | { kind: 'title-link'; target: string; label: string | null };

/** What to write in the token's place, or null to keep it as written. */
export type MarkdownVisitor = (token: MarkdownToken) => string | null;

const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** `mark`'s next position at or after `from`, searched at most once per stretch of the line. */
function finder(line: string, mark: string): (from: number) => number {
  let found = -2;
  return (from) => {
    if (found === -1 || found >= from) return found;
    found = line.indexOf(mark, from);
    return found;
  };
}

/** A link's address without its angle brackets or its quoted title. */
function targetOf(inner: string): string {
  const trimmed = inner.trim();
  const angled = /^<([^>]*)>/.exec(trimmed);
  if (angled) return angled[1]!;
  return trimmed.replace(/\s+(?:"[^"]*"|'[^']*')$/, '');
}

/** Where the address opened at `open` (a `(`) closes: parentheses may nest one deep inside it. -1 when it does not. */
function closeOfTarget(line: string, open: number): number {
  let nested = false;
  for (let at = open + 1; at < line.length; at++) {
    const char = line[at];
    if (char === '(') {
      if (nested) return -1;
      nested = true;
    } else if (char === ')') {
      if (!nested) return at;
      nested = false;
    }
  }
  return -1;
}

function scanLine(line: string, visit: MarkdownVisitor): string {
  const nextBracket = finder(line, ']');
  const nextTitleEnd = finder(line, ']]');
  const nextParen = finder(line, ')');
  const tickFinders = new Map<number, (from: number) => number>();
  let out = '';
  let at = 0;
  // Writes the visitor's answer for the token that spans [start, end), or the text as written.
  const emit = (start: number, end: number, token: MarkdownToken): number => {
    out += visit(token) ?? line.slice(start, end);
    return end;
  };
  while (at < line.length) {
    const char = line[at]!;
    if (char === '\\') {
      out += line.slice(at, at + 2);
      at += 2;
      continue;
    }
    if (char === '`') {
      let run = 1;
      while (line[at + run] === '`') run++;
      const ticks = '`'.repeat(run);
      let find = tickFinders.get(run);
      if (!find) tickFinders.set(run, (find = finder(line, ticks)));
      const close = find(at + run);
      const end = close === -1 ? at + run : close + run;
      out += line.slice(at, end);
      at = end;
      continue;
    }
    const picture = char === '!' && line[at + 1] === '[';
    const open = picture ? at + 1 : at;
    if (line[open] !== '[') {
      out += char;
      at++;
      continue;
    }
    if (line[open + 1] === '[') {
      const end = nextTitleEnd(open + 2);
      const inner = end === -1 ? '' : line.slice(open + 2, end);
      if (inner.trim() !== '' && !/[[\]]/.test(inner)) {
        const bar = inner.indexOf('|');
        const target = (bar === -1 ? inner : inner.slice(0, bar)).trim();
        at = emit(
          at,
          end + 2,
          picture
            ? { kind: 'picture', alt: '', target }
            : {
                kind: 'title-link',
                target,
                label: bar === -1 ? null : inner.slice(bar + 1).trim(),
              },
        );
        continue;
      }
    }
    const close = nextBracket(open + 1);
    const text = close === -1 ? '[' : line.slice(open + 1, close);
    if (!text.includes('[') && line[close + 1] === '(' && nextParen(close + 2) !== -1) {
      const end = closeOfTarget(line, close + 1);
      if (end !== -1) {
        const target = targetOf(line.slice(close + 2, end));
        at = emit(
          at,
          end + 1,
          picture ? { kind: 'picture', alt: text, target } : { kind: 'link', text, target },
        );
        continue;
      }
    }
    out += line.slice(at, open + 1);
    at = open + 1;
  }
  return out;
}

/** `source` with every link, picture and `[[Title]]` outside code passed through `visit`. */
export function rewriteMarkdown(source: string, visit: MarkdownVisitor): string {
  const lines = source.split('\n');
  for (const [index, line] of proseLines(lines)) lines[index] = scanLine(line, visit);
  return lines.join('\n');
}

/** The lines of `source` that are not inside a fenced code block, each with its index. */
export function* proseLines(source: string[]): Generator<[index: number, line: string]> {
  let fence: string | null = null;
  for (let i = 0; i < source.length; i++) {
    const mark = FENCE.exec(source[i]!)?.[1];
    if (fence !== null) {
      // A fence closes on its own character, at least as long as it opened.
      if (mark && mark[0] === fence[0] && mark.length >= fence.length) fence = null;
    } else if (mark) {
      fence = mark;
    } else {
      yield [i, source[i]!];
    }
  }
}
