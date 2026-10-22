// Where a document's files go (docs/specs/027-repositories/blueprints/repository-link.md "Paths"): under the mirror
// directory, by the folders between the covered folder and the document's (RL7), then the document's slug; a slug
// another document's file holds takes the short id, then the whole id (CLI27, CLI85). Paths are relative to the
// mirror directory, with POSIX separators.

import { posix } from 'node:path';
import { fileSlug, idSlug, PULL_FILE_SUFFIX } from '../sync/pull-file';

export type FolderNode = { id: string; name: string; parentId: string | null };

// The slugged names of the folders from the covered folder (exclusive) down to `folderId` (inclusive); empty in the
// covered folder itself, or when `folderId` is not below it.
export function folderPathSegments(
  folderId: string | null,
  coveredFolderId: string | null,
  folders: ReadonlyMap<string, FolderNode>,
): string[] {
  const chain: FolderNode[] = [];
  for (let at = folderId === null ? undefined : folders.get(folderId); at;) {
    if (at.id === coveredFolderId) return chain.reverse().map((f) => fileSlug(f.name, f.id));
    chain.push(at);
    at = at.parentId === null ? undefined : folders.get(at.parentId);
  }
  return [];
}

// The paths a document's mirror file may take, in order: its slug, then its short id, then its whole id.
export function mirrorPathCandidates(
  document: { id: string; name: string },
  folderPath: readonly string[],
): string[] {
  const slug = fileSlug(document.name, document.id);
  const candidates = [slug, `${slug}-${idSlug(document.id)}`, `${slug}-${document.id}`];
  return candidates.map((name) => posix.join(...folderPath, `${name}${PULL_FILE_SUFFIX}`));
}

export function mirrorPathFor(
  document: { id: string; name: string },
  folderPath: readonly string[],
  taken: ReadonlySet<string>,
): string {
  const paths = mirrorPathCandidates(document, folderPath);
  return paths.find((path) => !taken.has(path)) ?? paths.at(-1)!;
}

export function outlinePathOf(mirrorPath: string): string {
  return `${mirrorPath.slice(0, -PULL_FILE_SUFFIX.length)}.md`;
}
