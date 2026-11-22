// Notion's "Markdown & CSV" export (docs/specs/020-import-export/knowledgebase-import.md "Notion"). Every page is
// `Title <32 hex>.md` beside a folder of the same name holding its subpages; a database is a `.csv` (and an
// `_all.csv` with every row) whose rows are pages in its folder. The ids leave the titles; the paths keep them, as
// the export's links are written with them.

import type { ArchiveFile } from './archive';
import { csvToMarkdownTable } from './csv';
import type { ReadContext, SourceReader } from './draft';
import { folderDrafts, type FolderPage } from './folder-tree';
import { notionMarkdown } from './notion-markdown';
import { readPageSource, titleOfMarkdown } from './page-source';
import { baseOf, extOf, keyOf } from './paths';

/** A Notion name without its id: `Roadmap 0123...cdef` is `Roadmap`. */
export const stripNotionId = (name: string): string =>
  name.replace(/[ -]?[0-9a-f]{32}$/i, '').trim() || name;

// A database with no page of its own makes one too, so this count is the least the export holds.
const isPage = (path: string): boolean => extOf(path) === 'md';

/** The folder a page file owns: its path without the extension, and without a database's `_all`. */
const ownedBy = (path: string): string => path.replace(/(?:_all)?\.[^./]+$/, '');

async function read(context: ReadContext) {
  const pages = new Map<string, FolderPage>();
  const tables = new Map<string, ArchiveFile>();
  for (const file of context.listing.files.values()) {
    if (extOf(file.path) === 'csv') {
      context.used.add(keyOf(file.path));
      const key = keyOf(ownedBy(file.path));
      // Both exist for a database with a filtered view: the one with every row wins.
      if (!tables.has(key) || /_all\.csv$/i.test(file.path)) tables.set(key, file);
      continue;
    }
    if (!isPage(file.path)) continue;
    const source = await readPageSource(file, context);
    if (source === null) continue;
    const { title, markdown } = titleOfMarkdown(notionMarkdown(source));
    const owns = ownedBy(file.path);
    const name = stripNotionId(baseOf(owns));
    pages.set(keyOf(owns), {
      id: keyOf(file.path),
      title: title ?? name,
      path: file.path,
      paths: [file.path],
      markdown,
      attached: [],
      warnings: [],
      owns,
      sortName: name,
    });
  }
  for (const [key, file] of tables) {
    const source = await readPageSource(file, context);
    if (source === null) continue;
    const table = csvToMarkdownTable(source);
    const owns = ownedBy(file.path);
    const name = stripNotionId(baseOf(owns));
    const page = pages.get(key);
    if (page) {
      // The database's own page: its table follows what the page says.
      page.markdown = [page.markdown, table].filter(Boolean).join('\n\n');
      page.paths.push(`${owns}.csv`, `${owns}_all.csv`);
    } else {
      pages.set(key, {
        id: keyOf(file.path),
        title: name,
        path: file.path,
        paths: [`${owns}.csv`, `${owns}_all.csv`],
        markdown: table,
        attached: [],
        warnings: [],
        owns,
        sortName: name,
      });
    }
  }
  return folderDrafts([...pages.values()], stripNotionId);
}

export const notionReader: SourceReader = { isPage, read };
