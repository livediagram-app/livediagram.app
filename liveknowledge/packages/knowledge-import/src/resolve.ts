// A draft's links, pictures and attachments resolved against the whole import
// (docs/specs/020-import-export/blueprints/knowledgebase-import.md "Resolving"). The lookups are built once for the
// import, so a link costs one map read however many pages there are.

import type { ArchiveFile, ArchiveListing } from './archive';
import { ImportSizeError } from './archive';
import type { DraftPage } from './draft';
import type { ImportLimits } from './limits';
import { rewriteMarkdown, type MarkdownToken } from './markdown-scan';
import { baseOf, decodeTarget, dirOf, isPicturePath, keyOf, resolveFrom, stemOf } from './paths';
import {
  PAGE_LINK_SCHEME,
  PICTURE_SCHEME,
  type PlannedPage,
  type PlannedPicture,
  type SkippedItem,
} from './types';

export type KeyedDraft = { draft: DraftPage; key: string; parentKey: string | null };

export type Lookups = {
  /** A page's key by each archive path that is it. */
  byPath: Map<string, string>;
  /** The first page in tree order by title, then by file name: what `[[Title]]` finds. */
  byName: Map<string, string>;
};

export function buildLookups(pages: KeyedDraft[]): Lookups {
  const byPath = new Map<string, string>();
  const byTitle = new Map<string, string>();
  const byStem = new Map<string, string>();
  const first = (map: Map<string, string>, name: string, key: string): void => {
    if (!map.has(name)) map.set(name, key);
  };
  for (const { draft, key } of pages) {
    first(byTitle, keyOf(draft.title.trim()), key);
    for (const path of draft.paths) {
      byPath.set(keyOf(path), key);
      first(byStem, keyOf(stemOf(path)), key);
    }
  }
  // A title wins over a file name of the same spelling.
  return { byPath, byName: new Map([...byStem, ...byTitle]) };
}

export type ResolveContext = {
  listing: ArchiveListing;
  lookups: Lookups;
  limits: ImportLimits;
  skipped: SkippedItem[];
  /** Keys of the files some page shows or links to. */
  used: Set<string>;
  /** Whether a file is a page of the source: one that is no page of the plan could not be read. */
  isPage: (path: string) => boolean;
};

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
// Addresses that run or embed something when followed: never kept as a link.
const UNSAFE_SCHEME = /^(?:javascript|vbscript|data|file):/i;

/** Where a relative address leads inside the archive: its path, or null for an address that is not one. */
function archivePathOf(draft: DraftPage, target: string): string | null {
  if (target === '' || target.startsWith('#') || SCHEME.test(target)) return null;
  return resolveFrom(dirOf(draft.path), decodeTarget(target.replace(/[?#].*$/, '')));
}

function lazyPicture(file: ArchiveFile, alt: string, limit: number): PlannedPicture {
  return {
    path: file.path,
    alt,
    size: file.size,
    read: async () => {
      const bytes = await file.read();
      if (bytes.byteLength > limit) throw new ImportSizeError(file.path, limit);
      return bytes;
    },
  };
}

export function resolvePage(page: KeyedDraft, context: ResolveContext): PlannedPage {
  const { draft, key, parentKey } = page;
  const { listing, lookups, limits } = context;
  const planned: PlannedPage = {
    key,
    title: draft.title,
    parentKey,
    markdown: '',
    links: [],
    pictures: [],
    attachments: [],
    warnings: [...draft.warnings],
  };
  const pictureAt = new Map<string, number>();

  const attach = (file: ArchiveFile): void => {
    context.used.add(keyOf(file.path));
    const name = baseOf(file.path);
    if (!planned.attachments.includes(name)) planned.attachments.push(name);
  };
  const pageLink = (target: string, text: string): string => {
    planned.links.push({ target, text });
    return `[${text}](${PAGE_LINK_SCHEME}${target})`;
  };

  const link = (text: string, target: string): string | null => {
    if (UNSAFE_SCHEME.test(target.trim())) {
      planned.warnings.push({ kind: 'unsafe-link', detail: text });
      return text;
    }
    const path = archivePathOf(draft, target);
    if (path === null) return null;
    const to = lookups.byPath.get(keyOf(path));
    if (to !== undefined) return pageLink(to, text);
    const file = listing.files.get(keyOf(path));
    // A page outside the import or one that could not be read, or a file the archive does not hold: an ordinary
    // link, as written.
    if (!file || context.isPage(file.path)) return null;
    attach(file);
    return text;
  };

  const picture = (alt: string, target: string): string | null => {
    if (/^https?:/i.test(target)) return null;
    const path = archivePathOf(draft, target);
    const file = path === null ? undefined : listing.files.get(keyOf(path));
    if (!file) {
      planned.warnings.push({ kind: 'missing-picture', detail: target });
      return alt;
    }
    if (!isPicturePath(file.path)) {
      attach(file);
      return alt;
    }
    if ((file.size ?? 0) > limits.pictureBytes) {
      const detail = 'The picture is larger than 10 MB.';
      planned.warnings.push({ kind: 'picture-too-large', detail: file.path });
      context.skipped.push({ path: file.path, reason: 'picture-too-large', detail });
      return alt;
    }
    const fileKey = keyOf(file.path);
    let index = pictureAt.get(fileKey);
    if (index === undefined) {
      index = planned.pictures.push(lazyPicture(file, alt, limits.pictureBytes)) - 1;
      pictureAt.set(fileKey, index);
      context.used.add(fileKey);
    }
    return `![${alt}](${PICTURE_SCHEME}${index})`;
  };

  const visit = (token: MarkdownToken): string | null => {
    if (token.kind === 'link') return link(token.text, token.target);
    if (token.kind === 'picture') return picture(token.alt, token.target);
    const name = token.target.replace(/#.*$/, '').trim();
    const to = lookups.byName.get(keyOf(name));
    return to === undefined ? null : pageLink(to, token.label ?? name);
  };

  planned.markdown = rewriteMarkdown(draft.markdown, visit);
  for (const target of draft.attached) {
    const path = archivePathOf(draft, target);
    const file = path === null ? undefined : listing.files.get(keyOf(path));
    if (file && !isPicturePath(file.path)) attach(file);
  }
  if (planned.attachments.length > 0) {
    const list = planned.attachments.map((name) => `- ${name}`).join('\n');
    planned.markdown = `${planned.markdown}\n\n**Attachments**\n\n${list}`.trim();
  }
  return planned;
}
