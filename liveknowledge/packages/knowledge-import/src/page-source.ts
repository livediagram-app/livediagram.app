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

export type TitledMarkdown = {
  title: string | null;
  markdown: string;
  /** The front matter's `cover`: a picture's address, as an export from liveknowledge writes it. */
  cover?: string;
};

/**
 * A Markdown page's title and its writing: the first `#` heading outside code, which leaves the writing when it
 * opens it (it becomes the page's Title block). Front matter is dropped. No heading: a null title.
 */
export function titleOfMarkdown(source: string): TitledMarkdown {
  const front = FRONT_MATTER.exec(source)?.[0] ?? '';
  const cover = frontMatterValue(front, 'cover');
  const more = cover ? { cover } : {};
  const lines = source.slice(front.length).replace(/\r\n?/g, '\n').split('\n');
  for (const [index, line] of proseLines(lines)) {
    const title = HEADING.exec(line)?.[1];
    if (!title) continue;
    if (lines.slice(0, index).every((before) => before.trim() === '')) lines.splice(0, index + 1);
    return { title, markdown: lines.join('\n').trim(), ...more };
  }
  // No heading: the front matter's `title`, as an export written by liveknowledge before it wrote the heading, Hugo
  // and Obsidian say it (knowledgebase-import.md "Titles").
  return { title: frontMatterTitle(front), markdown: lines.join('\n').trim(), ...more };
}

/** The `title:` of a page's front matter, unquoted; null when it has none or an empty one. */
export const frontMatterTitle = (front: string): string | null => frontMatterValue(front, 'title');

/** One top-level field of a page's front matter, unquoted; null when it has none or an empty one. */
export function frontMatterValue(front: string, field: string): string | null {
  for (const line of front.split(/\r?\n/)) {
    if (!line.startsWith(`${field}:`)) continue;
    let value = line.slice(field.length + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      try {
        value = String(JSON.parse(value));
      } catch {
        value = value.slice(1, -1);
      }
    } else if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1).replaceAll("''", "'");
    }
    return value.trim() || null;
  }
  return null;
}
