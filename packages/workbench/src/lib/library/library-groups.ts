// How the palette's Library lays out (liveworkspace/docs/specs/006-media/libraries.md "What an item is"): Personal
// first, then each team in the order the person's token lists them, each holding its folders (the top first, then by
// name), each folder its items newest first. A search keeps a whole folder or group whose name matches, else the items
// whose title does.

import type { LibraryItemSummary, LibraryTeam } from '@liveworkspace/media';

export type LibraryFolder = { name: string; items: LibraryItemSummary[] };

export type LibraryGroup = {
  // 'personal', or the team's id.
  key: string;
  scope: 'personal' | 'team';
  teamId: string | null;
  label: string;
  role: 'admin' | 'member' | null;
  folders: LibraryFolder[];
};

export const PERSONAL_LABEL = 'Personal';

const byNewest = (a: LibraryItemSummary, b: LibraryItemSummary) => b.createdAt - a.createdAt;

function foldersOf(items: readonly LibraryItemSummary[]): LibraryFolder[] {
  const byName = new Map<string, LibraryItemSummary[]>();
  for (const item of items) {
    const list = byName.get(item.folder);
    if (list) list.push(item);
    else byName.set(item.folder, [item]);
  }
  return [...byName.entries()]
    .sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
    .map(([name, list]) => ({ name, items: [...list].sort(byNewest) }));
}

const matches = (text: string, q: string) => text.toLowerCase().includes(q);

function narrowed(group: LibraryGroup, q: string): LibraryGroup | null {
  if (!q || matches(group.label, q)) return group;
  const folders = group.folders
    .map((f) =>
      f.name && matches(f.name, q)
        ? f
        : { ...f, items: f.items.filter((i) => matches(i.title, q)) },
    )
    .filter((f) => f.items.length > 0);
  return folders.length > 0 ? { ...group, folders } : null;
}

export function libraryGroups(
  items: readonly LibraryItemSummary[],
  teams: readonly LibraryTeam[],
  query = '',
): LibraryGroup[] {
  const personal = items.filter((i) => i.scope === 'personal');
  const groups: LibraryGroup[] = [];
  if (personal.length > 0) {
    groups.push({
      key: 'personal',
      scope: 'personal',
      teamId: null,
      label: PERSONAL_LABEL,
      role: null,
      folders: foldersOf(personal),
    });
  }
  for (const team of teams) {
    const held = items.filter((i) => i.scope === 'team' && i.teamId === team.id);
    if (held.length === 0) continue;
    groups.push({
      key: team.id,
      scope: 'team',
      teamId: team.id,
      label: team.name,
      role: team.role,
      folders: foldersOf(held),
    });
  }
  const q = query.trim().toLowerCase();
  return groups.flatMap((g) => narrowed(g, q) ?? []);
}

// Whether the person may tidy (rename, delete) an item or a folder of a group: Personal is theirs, a team's is its
// admins'. A shape library read in place is copied on its first tidy, which only a signed-in person's can be.
export function canTidy(
  group: Pick<LibraryGroup, 'scope' | 'role'>,
  item?: Pick<LibraryItemSummary, 'legacy'>,
  legacyWritable = true,
): boolean {
  if (item?.legacy && !legacyWritable) return false;
  return group.scope === 'personal' || group.role === 'admin';
}

// The folders a destination already has, for the Save dialog's suggestions.
export function folderNames(
  items: readonly LibraryItemSummary[],
  scope: 'personal' | 'team',
  teamId: string | null,
): string[] {
  const names = new Set<string>();
  for (const item of items) {
    if (item.scope !== scope || (scope === 'team' && item.teamId !== teamId)) continue;
    if (item.folder) names.add(item.folder);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

// An item's preview as an inert image's source.
export function previewSrc(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
