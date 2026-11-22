// A page's Markdown as an agent reads and changes it (docs/specs/024-agents/knowledgebase-for-agents.md): one
// heading's section or a first part of the page instead of the whole of it, and one passage replaced by another.
// Pure text work: the Markdown itself is `articleToMarkdown`'s (@liveknowledge/document).

/** A heading line of the Markdown, outside any code fence. */
export type MarkdownHeading = { level: number; text: string; line: number };

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^(#{1,6})\s(.*)$/;

// The heading's text: its line after the hashes, less the spaces around it and any closing hashes ("## Title ##").
// Trimmed by hand, not by a regex, so a long line of spaces or hashes costs one pass.
const headingText = (rest: string): string => {
  let text = rest.trimEnd();
  let end = text.length;
  while (end > 0 && text[end - 1] === '#') end--;
  text = text.slice(0, end);
  return text.trim();
};

export function markdownHeadings(markdown: string): MarkdownHeading[] {
  const out: MarkdownHeading[] = [];
  let fenced = false;
  markdown.split('\n').forEach((text, line) => {
    if (FENCE.test(text)) fenced = !fenced;
    else if (!fenced) {
      const found = HEADING.exec(text);
      if (found) out.push({ level: found[1]!.length, text: headingText(found[2]!), line });
    }
  });
  return out;
}

const headingKey = (text: string) =>
  text.replace(/[*_`]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** One heading's section: its line through to the next heading of its level or above. Undefined when no heading
 *  reads as `heading` (case, spacing and emphasis marks aside). */
export function markdownSection(markdown: string, heading: string): string | undefined {
  const headings = markdownHeadings(markdown);
  const key = headingKey(heading.replace(/^#+\s*/, ''));
  const at = headings.findIndex((h) => headingKey(h.text) === key);
  if (at < 0 || !key) return undefined;
  const from = headings[at]!;
  const next = headings.slice(at + 1).find((h) => h.level <= from.level);
  const lines = markdown.split('\n');
  return lines
    .slice(from.line, next ? next.line : lines.length)
    .join('\n')
    .trim();
}

/** The Markdown's first part, cut at the last paragraph break that fits (mid paragraph only when the first one
 *  alone is longer), and how many characters were left out. */
export function cutMarkdown(
  markdown: string,
  maxChars: number,
): { markdown: string; leftOut: number } {
  if (markdown.length <= maxChars) return { markdown, leftOut: 0 };
  const head = markdown.slice(0, Math.max(0, maxChars));
  const at = head.lastIndexOf('\n\n');
  const kept = (at > 0 ? head.slice(0, at) : head).trimEnd();
  return { markdown: kept, leftOut: markdown.length - kept.length };
}

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Where `passage` sits in the Markdown: as written, else with any run of spaces and line breaks matching any other
 *  (a passage copied from a wrapped or re-flowed read). */
function passageMatches(markdown: string, passage: string): { at: number; length: number }[] {
  const wanted = passage.trim();
  if (!wanted) return [];
  const exact: { at: number; length: number }[] = [];
  for (
    let at = markdown.indexOf(wanted);
    at >= 0;
    at = markdown.indexOf(wanted, at + wanted.length)
  )
    exact.push({ at, length: wanted.length });
  if (exact.length > 0) return exact;
  const loose = new RegExp(wanted.split(/\s+/).map(escaped).join('\\s+'), 'g');
  return [...markdown.matchAll(loose)].map((m) => ({ at: m.index, length: m[0].length }));
}

export type PassageRefusal = 'passage_not_found' | 'passage_ambiguous';

/** The Markdown with the one place `before` sits replaced by `after`; a refusal when it sits nowhere, or in more
 *  than one place. */
export function replacePassage(
  markdown: string,
  before: string,
  after: string,
): { markdown: string } | { refusal: PassageRefusal } {
  const found = passageMatches(markdown, before);
  if (found.length === 0) return { refusal: 'passage_not_found' };
  if (found.length > 1) return { refusal: 'passage_ambiguous' };
  const { at, length } = found[0]!;
  return { markdown: markdown.slice(0, at) + after.trim() + markdown.slice(at + length) };
}

// Table lines are read trimmed, cell by cell, never with one regex over the line: an agent writes these lines, and a
// pattern of `\s*` runs around optional pipes backtracks polynomially on a long run of spaces or tabs.

/** A table row: `| … |`, two pipes at least. */
function isTableLine(line: string): boolean {
  const t = line.trim();
  return t.length >= 2 && t.startsWith('|') && t.endsWith('|');
}

const RULE_CELL = /^:?-{3,}:?$/;

/** A table's header rule: `| --- | :---: |`, its outer pipes optional, every cell three dashes or more. */
function isTableRule(line: string): boolean {
  const t = line.trim();
  if (!t.includes('-')) return false;
  const inner = t.slice(
    t.startsWith('|') ? 1 : 0,
    t.endsWith('|') && t.length > 1 ? -1 : undefined,
  );
  return inner.split('|').every((cell) => RULE_CELL.test(cell.trim()));
}

/** Whether `text` is nothing but table rows, with no header rule: rows meant for a table already on the page. */
export function isBareTableRows(text: string): boolean {
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  return lines.length > 0 && lines.every((line) => isTableLine(line) && !isTableRule(line));
}

/** The Markdown with bare table `rows` added under the last row of its last table (outside code fences); null when
 *  `rows` are not bare rows, or the Markdown holds no table. Appended on their own, rows with no header are not a
 *  table, and read as a paragraph of pipes (owner 2026-11-22, an accepted suggestion). */
export function appendTableRows(markdown: string, rows: string): string | null {
  if (!isBareTableRows(rows)) return null;
  const lines = markdown.split('\n');
  let fenced = false;
  let lastRow = -1;
  lines.forEach((line, at) => {
    if (FENCE.test(line)) fenced = !fenced;
    else if (!fenced && isTableRule(line) && at > 0 && isTableLine(lines[at - 1]!)) {
      let end = at;
      while (end + 1 < lines.length && isTableLine(lines[end + 1]!)) end++;
      lastRow = end;
    }
  });
  if (lastRow < 0) return null;
  const added = rows
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => line.trim());
  return [...lines.slice(0, lastRow + 1), ...added, ...lines.slice(lastRow + 1)].join('\n');
}
