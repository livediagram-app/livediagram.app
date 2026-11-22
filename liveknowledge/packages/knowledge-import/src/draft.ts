// A page as a source reader hands it over (docs/specs/020-import-export/blueprints/knowledgebase-import.md "Readers"):
// its place in the tree and its Markdown with the links still as the source wrote them. The plan orders the drafts,
// keys them and resolves their links (plan.ts, resolve.ts).

import type { ArchiveListing } from './archive';
import type { ImportLimits } from './limits';
import type { PageWarning, SkippedItem } from './types';

export type DraftPage = {
  /** Unique among the drafts. */
  id: string;
  parentId: string | null;
  title: string;
  /** The archive path its relative links and pictures resolve against. */
  path: string;
  /** Every archive path that is this page, for links to it. */
  paths: string[];
  markdown: string;
  /** Addresses of files the source lists as the page's attachments, outside its writing. */
  attached: string[];
  warnings: PageWarning[];
};

export type ReadContext = {
  listing: ArchiveListing;
  limits: ImportLimits;
  skipped: SkippedItem[];
  /** Keys of the files the import reads as pages, shows or links to. */
  used: Set<string>;
};

export type SourceReader = {
  /** Whether a file is a page of this source (before anything is read). */
  isPage: (path: string) => boolean;
  /** The drafts in sibling order: a page's children keep the order they are listed in. */
  read: (context: ReadContext) => Promise<DraftPage[]>;
};
