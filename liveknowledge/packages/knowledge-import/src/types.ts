// What an import reads and what it answers (docs/specs/020-import-export/blueprints/knowledgebase-import.md "The
// plan"). The archive is abstract, so one engine serves a picked folder, a `.zip` and the tests; the plan is plain
// data plus lazy picture reads, so nothing here writes a page or uploads a picture.

import type { ImportLimits } from './limits';

/** One file of an archive. `read` is called at most once per use, and only when its bytes are wanted. */
export type ArchiveEntry = {
  /** The file's path inside the archive, as the archive names it. */
  path: string;
  /** Its unpacked size in bytes, when the archive declares one. */
  size?: number;
  read(): Promise<Uint8Array>;
};

/** A picked folder, an opened `.zip`, or a test's list of files. Read once, entry by entry. */
export type ImportArchive = Iterable<ArchiveEntry> | AsyncIterable<ArchiveEntry>;

export type ImportSource = 'markdown-folder' | 'notion' | 'confluence';

export type ImportOptions = {
  /** Pages the knowledgebase already holds: they share its page limit with the import. */
  existingPages?: number;
  /** How deep the page the import lands under sits (1 for a top-level page); 0 for a new knowledgebase. */
  parentDepth?: number;
  /** The archive file's own size, when known before it is opened. */
  archiveBytes?: number;
  limits?: Partial<ImportLimits>;
};

export type WarningKind =
  'missing-picture' | 'picture-too-large' | 'flattened' | 'duplicate-title' | 'unsafe-link';

export type PageWarning = { kind: WarningKind; detail: string };

/** A picture a page shows. Its bytes are read only when asked for, and refused past the picture limit. */
export type PlannedPicture = {
  /** The picture's path inside the archive. */
  path: string;
  alt: string;
  /** Its declared size, or null when the archive gives none. */
  size: number | null;
  read(): Promise<Uint8Array>;
};

/** A page link in a page's Markdown: `[text](knowledgebase-page:<target>)`. */
export type PlannedLink = { target: string; text: string };

export type PlannedPage = {
  /** The page's key in this plan: `p1`, `p2`, ... in tree order. */
  key: string;
  title: string;
  parentKey: string | null;
  /** The writing as Markdown, its page links and pictures in the plan's two schemes. */
  markdown: string;
  links: PlannedLink[];
  /** In the order the Markdown numbers them: `![alt](knowledgebase-picture:<index>)`. */
  pictures: PlannedPicture[];
  /** Other files the page links to, as plain names (v1 stores no files). */
  attachments: string[];
  warnings: PageWarning[];
  /** A line-art page icon's id; a starter structure's pages carry one, an import's never do. */
  icon?: string;
  /** A built-in theme gradient cover (`theme-<name>`); the same. */
  cover?: string;
};

export type SkipReason = 'outside-archive' | 'page-failed' | 'page-too-large' | 'picture-too-large';

export type SkippedItem = { path: string; reason: SkipReason; detail: string };

export type ImportBlock =
  | { reason: 'archive-too-large'; limitBytes: number }
  | { reason: 'too-many-pages'; found: number; room: number };

export type ImportSummary = {
  source: ImportSource;
  pages: number;
  pictures: number;
  attachments: number;
  /** What the import leaves out, each with why. */
  skipped: SkippedItem[];
  /** Files that are no page and that no page shows or links to. */
  ignoredFiles: number;
  /** Set when nothing can be imported: the plan then holds no pages. */
  blocked: ImportBlock | null;
};

export type ImportPlan = { pages: PlannedPage[]; summary: ImportSummary };

/** The scheme of a page link's address in a planned page's Markdown, followed by the target page's key. */
export const PAGE_LINK_SCHEME = 'knowledgebase-page:';
/** The scheme of a picture's address in a planned page's Markdown, followed by its index in `pictures`. */
export const PICTURE_SCHEME = 'knowledgebase-picture:';
