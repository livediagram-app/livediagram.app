// Reading one page's source text, and a Markdown page's title
// (docs/specs/020-import-export/blueprints/knowledgebase-import.md "Titles").

import { ImportSizeError, readText, type ArchiveFile } from './archive';
import type { ReadContext } from './draft';
import { proseLines } from './markdown-scan';
import { keyOf } from './paths';

/** The page's text, or null when it cannot be read: the page is then reported by name and the rest continue. */
export async function readPageSource(
  file: ArchiveFile,
  context: ReadContext,
): Promise<string | null> {
  context.used.add(keyOf(file.path));
  try {
    return await readText(file, context.limits.pageSourceBytes);
  } catch (error) {
    const tooLarge = error instanceof ImportSizeError;
    context.skipped.push({
      path: file.path,
      reason: tooLarge ? 'page-too-large' : 'page-failed',
      detail: tooLarge ? 'The page is too large to import.' : 'The page could not be read.',
    });
    return null;
  }
}

const FRONT_MATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const HEADING = /^#\s+(.*?)\s*#*\s*$/;

export type TitledMarkdown = { title: string | null; markdown: string };

/**
 * A Markdown page's title and its writing: the first `#` heading outside code, which leaves the writing when it
 * opens it (it becomes the page's Title block). Front matter is dropped. No heading: a null title.
 */
export function titleOfMarkdown(source: string): TitledMarkdown {
  const lines = source.replace(FRONT_MATTER, '').replace(/\r\n?/g, '\n').split('\n');
  for (const [index, line] of proseLines(lines)) {
    const title = HEADING.exec(line)?.[1];
    if (!title) continue;
    if (lines.slice(0, index).every((before) => before.trim() === '')) lines.splice(0, index + 1);
    return { title, markdown: lines.join('\n').trim() };
  }
  return { title: null, markdown: lines.join('\n').trim() };
}
