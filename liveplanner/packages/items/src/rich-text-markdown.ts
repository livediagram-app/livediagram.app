// A description written as Markdown by an agent (docs/specs/026-plan/plan-agents.md "Naming things as people do"):
// the plain text the item store keeps as `description` and the runs it keeps as `descriptionRich`, in the marks
// the item panel draws. Headings and bullets are line marks, as the panel's own lists are literal "• " text.
import type { ItemFieldValue } from './item';
import { isRichLink } from './rich-text-field';

interface Marks {
  bold?: true;
  italic?: true;
  strikethrough?: true;
  heading?: 1 | 2 | 3;
  link?: string;
}
type Run = Marks & { text: string };

interface DescriptionText {
  plain: string;
  // Undefined when nothing in the text is marked, so the description is stored plain.
  runs?: ItemFieldValue[];
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
// Bounded, so a line of "[" with no link to close it stays linear; the url bound is the store's link limit.
const LINK = /\[([^\]\n]{1,500})\]\(([^)\s]{1,2048})\)/y;
const WORD = /[\p{L}\p{N}]/u;
const DELIMS = ['**', '__', '~~', '*', '_'];

const sameMarks = (a: Marks, b: Marks) =>
  a.bold === b.bold &&
  a.italic === b.italic &&
  a.strikethrough === b.strikethrough &&
  a.heading === b.heading &&
  a.link === b.link;

// Whether `delim` at `i` can close a mark: after text, and for `_` not inside a word.
function closes(line: string, i: number, delim: string): boolean {
  if (i === 0 || /\s/.test(line[i - 1]!)) return false;
  const after = line[i + delim.length];
  return delim[0] !== '_' || after === undefined || !WORD.test(after);
}

// Where each delimiter last closes on the line, found once so a line of marks with nothing to close them stays
// linear (an opener only needs to know a closer comes after it).
function lastClosers(line: string): Record<string, number> {
  const last: Record<string, number> = {};
  for (const d of DELIMS) {
    last[d] = -1;
    for (let i = line.lastIndexOf(d); i >= 0; i = i > 0 ? line.lastIndexOf(d, i - 1) : -1) {
      if (closes(line, i, d)) {
        last[d] = i;
        break;
      }
    }
  }
  return last;
}

// Whether `delim` at `at` can open: followed by text, for `_` not inside a word, with a closer later on the line.
function opens(line: string, at: number, delim: string, last: Record<string, number>): boolean {
  const next = line[at + delim.length];
  if (next === undefined || /\s/.test(next)) return false;
  if (delim[0] === '_' && at > 0 && WORD.test(line[at - 1]!)) return false;
  return last[delim]! > at + delim.length;
}

const MARK_OF: Record<string, 'bold' | 'italic' | 'strikethrough'> = {
  '**': 'bold',
  __: 'bold',
  '~~': 'strikethrough',
  '*': 'italic',
  _: 'italic',
};

function inlineRuns(line: string, heading: Marks['heading'], out: Run[]): void {
  const marks: Marks = heading ? { heading } : {};
  const open: string[] = [];
  const last = lastClosers(line);
  let text = '';
  const flush = () => {
    if (text) out.push({ ...marks, text });
    text = '';
  };
  for (let i = 0; i < line.length;) {
    const ch = line[i]!;
    if (ch === '\\' && i + 1 < line.length && /[\\`*_~[\]()#-]/.test(line[i + 1]!)) {
      text += line[i + 1];
      i += 2;
      continue;
    }
    if (ch === '`') {
      const end = line.indexOf('`', i + 1);
      if (end > i + 1) {
        text += line.slice(i + 1, end);
        i = end + 1;
        continue;
      }
    }
    if (ch === '[') {
      LINK.lastIndex = i;
      const m = LINK.exec(line);
      if (m) {
        flush();
        out.push(
          isRichLink(m[2]!) ? { ...marks, text: m[1]!, link: m[2]! } : { ...marks, text: m[1]! },
        );
        i += m[0].length;
        continue;
      }
    }
    // The innermost open mark closes first ("***" after "**b *c" ends the italic, then the bold).
    const top = open[open.length - 1];
    if (top && line.startsWith(top, i) && closes(line, i, top)) {
      flush();
      open.pop();
      delete marks[MARK_OF[top]!];
      i += top.length;
      continue;
    }
    const delim = DELIMS.find((d) => line.startsWith(d, i));
    if (delim) {
      const mark = MARK_OF[delim]!;
      if (!marks[mark] && opens(line, i, delim, last)) {
        flush();
        open.push(delim);
        marks[mark] = true;
      } else {
        // A delimiter that neither opens nor closes is text, whole: "**" is never read as two italics.
        text += delim;
      }
      i += delim.length;
      continue;
    }
    text += ch;
    i += 1;
  }
  flush();
}

export function descriptionFromMarkdown(markdown: string): DescriptionText {
  const runs: Run[] = [];
  markdown
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .forEach((raw, n) => {
      if (n > 0) runs.push({ text: '\n' });
      const heading = HEADING.exec(raw);
      if (heading) {
        inlineRuns(heading[2]!, Math.min(heading[1]!.length, 3) as 1 | 2 | 3, runs);
        return;
      }
      const bullet = BULLET.exec(raw);
      if (bullet) {
        runs.push({ text: `${bullet[1]}• ` });
        inlineRuns(bullet[2]!, undefined, runs);
        return;
      }
      inlineRuns(raw, undefined, runs);
    });
  const merged: Run[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    // A line break joins the run before it, whatever that run's marks.
    if (last && (run.text === '\n' || sameMarks(last, run))) last.text += run.text;
    else merged.push({ ...run });
  }
  const plain = merged.map((r) => r.text).join('');
  const marked = merged.some((r) => Object.keys(r).length > 1);
  return marked ? { plain, runs: merged as unknown as ItemFieldValue[] } : { plain };
}
