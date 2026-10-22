// The person's folders as paths (docs/specs/015-api/cli.md `folder ls`, `workbench open --folder`; blueprint CLI86, CLI87): the personal tree, then each joined team's in name order, each depth first,
// siblings by name. A folder is named by its full id, an id prefix, or its name ignoring case, as a document is.

import type { Folder } from '@livedesign/api-schema';
import type { Libraries } from './find-documents';
import { VerbRefusal } from './define';
import { REF_MIN_PREFIX, shortestUniquePrefixes } from './refs';

// `library` is 'personal' or the team's name; `teamId` null for a personal folder.
export type FolderChoice = { id: string; path: string; library: string; teamId: string | null };

const byName = (a: { name: string }, b: { name: string }) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0;

// One library's tree, depth first, siblings by name.
function treeOf(
  folders: readonly Folder[],
  library: string,
  teamId: string | null,
): FolderChoice[] {
  const walk = (parentId: string | null, prefix: string): FolderChoice[] =>
    folders
      .filter((f) => f.parentId === parentId)
      .sort(byName)
      .flatMap((f) => {
        const path = `${prefix}${f.name}`;
        return [{ id: f.id, path, library, teamId }, ...walk(f.id, `${path}/`)];
      });
  return walk(null, '');
}

// The personal folders, then each joined team's, teams in name order.
export function folderChoices(libraries: Libraries): FolderChoice[] {
  return [
    ...treeOf(libraries.personal.folders, 'personal', null),
    ...[...libraries.teams].sort(byName).flatMap((t) => treeOf(t.folders, t.name, t.id)),
  ];
}

// The folders a reference names: its full id, an id prefix, or its own name (the last part of its path) ignoring
// case.
export function matchFolders(choices: readonly FolderChoice[], ref: string): FolderChoice[] {
  const lower = ref.toLowerCase();
  return choices.filter(
    (c) =>
      c.id === ref ||
      (ref.length >= REF_MIN_PREFIX && c.id.startsWith(ref)) ||
      c.path.split('/').at(-1)!.toLowerCase() === lower,
  );
}

// A candidate as the refusals list it: its shortest unique ref, its path and its library.
export function folderLines(all: readonly FolderChoice[], list: readonly FolderChoice[]): string[] {
  const refs = shortestUniquePrefixes(all.map((c) => c.id));
  return list.map((c) => `${refs.get(c.id)}  ${JSON.stringify(c.path)}  ${c.library}`);
}

// The one folder a reference names, or the refusal (exit 3) with the nearest candidates or the several it matched.
export function resolveFolderRef(
  choices: readonly FolderChoice[],
  ref: string,
  flag: string,
): FolderChoice {
  const matches = matchFolders(choices, ref);
  if (matches.length === 1) return matches[0]!;
  if (matches.length === 0) {
    const lower = ref.toLowerCase();
    const nearest = choices.filter((c) => c.path.toLowerCase().includes(lower)).slice(0, 5);
    throw new VerbRefusal({
      status: 404,
      code: 'not_found',
      message: `no folder matches "${ref}"${nearest.length ? '; the nearest:' : ''}`,
      lines: folderLines(choices, nearest),
      hint: 'livedesign folder ls',
    });
  }
  const refs = shortestUniquePrefixes(choices.map((c) => c.id));
  throw new VerbRefusal({
    status: 404,
    code: 'ambiguous',
    message: `"${ref}" matches ${matches.length} folders`,
    lines: folderLines(choices, matches),
    hint: `${flag} ${refs.get(matches[0]!.id)}`,
  });
}
