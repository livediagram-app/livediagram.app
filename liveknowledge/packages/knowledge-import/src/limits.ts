// The bounds of a knowledgebase import (docs/specs/020-import-export/knowledgebase-import.md "Bounds"), each a named
// constant with where it is enforced (docs/specs/020-import-export/blueprints/knowledgebase-import.md "Bounds").

/** The most an archive may hold, unpacked: 200 MB. */
export const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024;
/** A knowledgebase's page limit (`MAX_KNOWLEDGEBASE_PAGES`), which an import shares with the pages already there. */
export const MAX_IMPORT_PAGES = 500;
/** How deep the page tree goes (`MAX_PAGE_DEPTH`); deeper pages are flattened under the last level. */
export const MAX_IMPORT_DEPTH = 8;
/** The most one picture may weigh: 10 MB. */
export const MAX_PICTURE_BYTES = 10 * 1024 * 1024;
/** The most one page's source file may weigh: 5 MB of text is far past any written page. */
export const MAX_PAGE_SOURCE_BYTES = 5 * 1024 * 1024;
/** The most files an archive may list, so the listing itself stays small whatever the archive claims. */
export const MAX_ARCHIVE_ENTRIES = 20_000;

export type ImportLimits = {
  archiveBytes: number;
  pages: number;
  depth: number;
  pictureBytes: number;
  pageSourceBytes: number;
  entries: number;
};

export const DEFAULT_LIMITS: ImportLimits = {
  archiveBytes: MAX_ARCHIVE_BYTES,
  pages: MAX_IMPORT_PAGES,
  depth: MAX_IMPORT_DEPTH,
  pictureBytes: MAX_PICTURE_BYTES,
  pageSourceBytes: MAX_PAGE_SOURCE_BYTES,
  entries: MAX_ARCHIVE_ENTRIES,
};
