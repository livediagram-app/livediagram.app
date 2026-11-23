// The import engine's one door (docs/specs/020-import-export/blueprints/knowledgebase-import.md "planImport"): an
// archive in, an `ImportPlan` out. It lists the archive, stops before reading anything when the import cannot fit,
// reads the pages one at a time through the source's reader, arranges the tree, and resolves every page's links and
// pictures against lookups built once. It writes nothing: the Import dialog shows the plan and writes its pages.

import { listArchive } from './archive';
import { confluenceReader } from './confluence';
import type { ReadContext, SourceReader } from './draft';
import { DEFAULT_LIMITS, type ImportLimits } from './limits';
import { markdownFolderReader } from './markdown-folder';
import { notionReader } from './notion';
import { keyOf } from './paths';
import { buildLookups, resolvePage, type KeyedDraft } from './resolve';
import { arrangeTree } from './tree';
import type {
  ImportArchive,
  ImportBlock,
  ImportOptions,
  ImportPlan,
  ImportSource,
  ImportSummary,
} from './types';

const READERS: Record<ImportSource, SourceReader> = {
  'markdown-folder': markdownFolderReader,
  notion: notionReader,
  confluence: confluenceReader,
};

export async function planImport(
  source: ImportSource,
  archive: ImportArchive,
  options: ImportOptions = {},
): Promise<ImportPlan> {
  const limits: ImportLimits = { ...DEFAULT_LIMITS, ...options.limits };
  const summary: ImportSummary = {
    source,
    pages: 0,
    pictures: 0,
    attachments: 0,
    skipped: [],
    ignoredFiles: 0,
    blocked: null,
  };
  const blocked = (block: ImportBlock): ImportPlan => ({
    pages: [],
    summary: { ...summary, blocked: block },
  });
  const tooLarge: ImportBlock = { reason: 'archive-too-large', limitBytes: limits.archiveBytes };
  if ((options.archiveBytes ?? 0) > limits.archiveBytes) return blocked(tooLarge);

  const listing = await listArchive(archive, limits);
  summary.skipped.push(...listing.skipped);
  if (listing.tooLarge) return blocked(tooLarge);

  // The page limit, before a page is read: the files alone say when the import cannot fit.
  const reader = READERS[source];
  const room = Math.max(0, limits.pages - (options.existingPages ?? 0));
  let found = 0;
  for (const file of listing.files.values()) if (reader.isPage(file.path)) found++;
  const trim = options.trimToRoom === true && room > 0;
  if (found > room && !trim) return blocked({ reason: 'too-many-pages', found, room });

  const used = new Set<string>();
  const context: ReadContext = { listing, limits, skipped: summary.skipped, used };
  const drafts = await reader.read(context);
  // And after: a folder nobody owns and a database with no page of its own are pages too.
  if (drafts.length > room && !trim)
    return blocked({ reason: 'too-many-pages', found: drafts.length, room });

  const depth = Math.max(1, limits.depth - (options.parentDepth ?? 0));
  const keys = new Map<string, string>();
  const titles = new Set<string>();
  // Trimmed, the first that fit in the tree's own order, where a parent comes before its subpages.
  const arranged = arrangeTree(drafts, depth);
  const kept = arranged.length > room ? arranged.slice(0, room) : arranged;
  if (kept.length < arranged.length) summary.leftOut = arranged.length - kept.length;
  const keyed: KeyedDraft[] = kept.map(({ item, parent, flattened }, at) => {
    const key = `p${at + 1}`;
    keys.set(item.id, key);
    if (flattened) {
      item.warnings.push({
        kind: 'flattened',
        detail: `Moved up: a knowledgebase goes ${limits.depth} levels deep.`,
      });
    }
    const title = keyOf(item.title.trim());
    if (titles.has(title)) {
      item.warnings.push({ kind: 'duplicate-title', detail: 'Another page has this title.' });
    }
    titles.add(title);
    // A parent is placed before its children, so its key is already made.
    return { draft: item, key, parentKey: parent ? keys.get(parent.id)! : null };
  });

  const resolve = { ...context, lookups: buildLookups(keyed), isPage: reader.isPage };
  const pages = keyed.map((page) => resolvePage(page, resolve));
  const pictures = new Set<string>();
  for (const page of pages) {
    for (const picture of page.pictures) pictures.add(keyOf(picture.path));
    summary.attachments += page.attachments.length;
  }
  summary.pages = pages.length;
  summary.pictures = pictures.size;
  summary.ignoredFiles = listing.files.size - used.size;
  return { pages, summary };
}
