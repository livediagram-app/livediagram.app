// Coverage (docs/specs/027-repositories/blueprints/repository-link.md "Coverage"): the documents a link covers, its
// folder's subtree in the personal library or a team's, and its listed documents wherever they are, each with its
// folder path (RL7). A covered folder no library holds leaves its documents unknown (RL6).

import { readLibraries, type Libraries, type VerbContext } from '@livediagram/agent-verbs';
import type { DocumentSummary, Folder } from '@livediagram/api-schema';
import type { LinkFile } from './link-file';
import { folderPathSegments } from './mirror-paths';

export const PERSONAL_SPACE = 'My documents';
export const SHARED_SPACE = 'Shared with me';

export type CoveredDocument = {
  id: string;
  // Null for a listed document no library holds: its name comes from its own read.
  name: string | null;
  // The slugged folders below the covered folder, for its files' paths.
  folderPath: string[];
  // Its folder as INDEX.md names it: the space, then the folders' names.
  indexFolder: string;
  // `personal`, the team's name, or Shared with me.
  library: string;
  savedAt: number | null;
};

export type Coverage = {
  folder: { id: string; found: boolean } | null;
  documents: CoveredDocument[];
  // Every document id the account's libraries hold, for refs as `document ls` prints them.
  reachable: string[];
};

type Space = { name: string; library: string; folders: Folder[]; documents: DocumentSummary[] };

const spacesOf = (libraries: Libraries): Space[] => [
  { name: PERSONAL_SPACE, library: 'personal', ...libraries.personal },
  ...libraries.teams.map((t) => ({
    name: t.name,
    library: t.name,
    folders: t.folders,
    documents: t.documents,
  })),
];

// The folder's names from its space's root, `/`-joined after the space's name.
function indexFolderOf(space: Space, folderId: string | null): string {
  const names: string[] = [];
  for (let at = space.folders.find((f) => f.id === folderId); at;) {
    names.unshift(at.name);
    const parent = at.parentId;
    at = space.folders.find((f) => f.id === parent);
  }
  return [space.name, ...names].join('/');
}

// Whether a folder is the covered folder or below it.
function inSubtree(
  folderId: string | null,
  coveredId: string,
  nodes: ReadonlyMap<string, Folder>,
): boolean {
  for (let at = folderId === null ? undefined : nodes.get(folderId); at;) {
    if (at.id === coveredId) return true;
    at = at.parentId === null ? undefined : nodes.get(at.parentId);
  }
  return false;
}

// Whether a document is covered: null when the covered folder could not be read and the document is not listed.
export function isCovered(coverage: Coverage, documentId: string): boolean | null {
  if (coverage.documents.some((d) => d.id === documentId)) return true;
  return coverage.folder?.found === false ? null : false;
}

export async function readCoverage(ctx: VerbContext, link: LinkFile): Promise<Coverage> {
  const libraries = await readLibraries(ctx.api);
  const spaces = spacesOf(libraries);
  const folderId = link.covers.folder;
  const home =
    folderId === null ? undefined : spaces.find((s) => s.folders.some((f) => f.id === folderId));
  const nodes = new Map(spaces.flatMap((s) => s.folders.map((f) => [f.id, f] as const)));
  const covered = (space: Space, d: DocumentSummary): CoveredDocument => ({
    id: d.id,
    name: d.name,
    folderPath: folderPathSegments(d.folderId, folderId, nodes),
    indexFolder: indexFolderOf(space, d.folderId),
    library: space.library,
    savedAt: d.savedAt,
  });
  const documents: CoveredDocument[] = home
    ? home.documents
        .filter((d) => inSubtree(d.folderId, folderId!, nodes))
        .map((d) => covered(home, d))
    : [];
  for (const id of link.covers.documents) {
    if (documents.some((d) => d.id === id)) continue;
    const space = spaces.find((s) => s.documents.some((d) => d.id === id));
    documents.push(
      space
        ? covered(
            space,
            space.documents.find((d) => d.id === id)!,
          )
        : {
            id,
            name: null,
            folderPath: [],
            indexFolder: SHARED_SPACE,
            library: SHARED_SPACE,
            savedAt: null,
          },
    );
  }
  if (folderId !== null && !home) ctx.notice(`folder ${folderId} is not readable by this account`);
  ctx.log(
    `coverage ${documents.length} covered folder ${folderId === null ? '-' : home ? 'found' : 'unreadable'}`,
  );
  return {
    folder: folderId === null ? null : { id: folderId, found: home !== undefined },
    documents,
    reachable: spaces.flatMap((s) => s.documents.map((d) => d.id)),
  };
}
