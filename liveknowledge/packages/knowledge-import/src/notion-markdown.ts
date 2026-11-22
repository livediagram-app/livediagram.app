// What Notion's export writes as HTML inside its Markdown, as Markdown
// (docs/specs/020-import-export/knowledgebase-import.md "Notion"): a callout (`<aside>`) becomes a quote, and a
// toggle (`<details>` with its `<summary>`) becomes a heading and its content. Code is left as written.

import { proseLines } from './markdown-scan';

const SUMMARY = /<summary>(.*?)<\/summary>/i;
const DETAILS_OPEN = /^\s*<details[^>]*>/i;
const DETAILS_CLOSE = /^\s*<\/details>\s*$/i;

export function notionMarkdown(source: string): string {
  const lines = source.split('\n');
  const drop = new Set<number>();
  let callout = false;
  for (const [index, line] of proseLines(lines)) {
    const trimmed = line.trim();
    if (/^<aside>$/i.test(trimmed)) {
      callout = true;
      drop.add(index);
    } else if (/^<\/aside>$/i.test(trimmed)) {
      callout = false;
      drop.add(index);
    } else if (callout) {
      lines[index] = trimmed === '' ? '>' : `> ${trimmed}`;
    } else if (DETAILS_OPEN.test(line) || SUMMARY.test(line)) {
      const summary = SUMMARY.exec(line)?.[1]?.trim();
      if (summary) lines[index] = `### ${summary}`;
      else drop.add(index);
    } else if (DETAILS_CLOSE.test(line)) {
      drop.add(index);
    }
  }
  return lines.filter((_, index) => !drop.has(index)).join('\n');
}
