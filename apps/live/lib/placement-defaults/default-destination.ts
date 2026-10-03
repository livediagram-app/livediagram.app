// Where a person's new documents go, read on the client (docs/specs/013-workspace/default-folders.md
// "Surfaces"; blueprint "Behaviour and state (surfaces)"). Pure: the defaults and the folders the
// surface has loaded go in, and the server's precedence comes out, skipping a default whose folder
// is not among them exactly as the server skips a dangling one.
import {
  defaultKeysFor,
  PLACEMENT_DEFAULT_KEYS,
  type CreationIntent,
  type PlacementDefaultKey,
} from '@livediagram/api-schema';
import type { EditorMode } from '@livediagram/document';

export type IndexedFolder = {
  id: string;
  name: string;
  parentId: string | null;
  teamId: string | null;
};

/** The folders a surface can see: the reader's own, and those of the teams it lists. */
export type DefaultFolderIndex = {
  folders: ReadonlyMap<string, IndexedFolder>;
  /** Team id to name, for the teams the reader has joined. */
  teams: ReadonlyMap<string, string>;
};

/** Key to folder id, as `GET /api/placement-defaults` answers. */
export type PlacementDefaults = ReadonlyMap<PlacementDefaultKey, string>;

type PlainFolder = { id: string; name: string; parentId: string | null };

/** Team folders either as rows carrying their team (the Explorer's sweep), or keyed by team (the
 *  placement pickers' lists). */
export type TeamFolderLists =
  readonly (PlainFolder & { teamId: string })[] | Readonly<Record<string, readonly PlainFolder[]>>;

export function buildDefaultFolderIndex(
  personal: readonly PlainFolder[],
  teamFolders: TeamFolderLists,
  teams: readonly { id: string; name: string }[],
): DefaultFolderIndex {
  const folders = new Map<string, IndexedFolder>();
  const plain = ({ id, name, parentId }: PlainFolder) => ({ id, name, parentId });
  for (const f of personal) folders.set(f.id, { ...plain(f), teamId: null });
  if (Array.isArray(teamFolders)) {
    for (const f of teamFolders as readonly (PlainFolder & { teamId: string })[])
      folders.set(f.id, { ...plain(f), teamId: f.teamId });
  } else {
    for (const [teamId, list] of Object.entries(teamFolders))
      for (const f of list) folders.set(f.id, { ...plain(f), teamId });
  }
  return { folders, teams: new Map(teams.map((t) => [t.id, t.name])) };
}

/** The key's folder when the index holds it (a team folder only of a listed team), else null. */
export function workingDefault(
  key: PlacementDefaultKey,
  defaults: PlacementDefaults,
  index: DefaultFolderIndex,
): IndexedFolder | null {
  const id = defaults.get(key);
  const folder = id ? index.folders.get(id) : undefined;
  if (!folder) return null;
  if (folder.teamId && !index.teams.has(folder.teamId)) return null;
  return folder;
}

export type ResolvedDefault = { key: PlacementDefaultKey; folder: IndexedFolder };

/** The first working default of the intent's keys, most specific first, and the keys skipped. */
export function resolveDefaultFor(
  intent: CreationIntent,
  defaults: PlacementDefaults,
  index: DefaultFolderIndex,
): { resolved: ResolvedDefault | null; skipped: PlacementDefaultKey[] } {
  const skipped: PlacementDefaultKey[] = [];
  for (const key of defaultKeysFor(intent)) {
    if (!defaults.has(key)) continue;
    const folder = workingDefault(key, defaults, index);
    if (folder) return { resolved: { key, folder }, skipped };
    skipped.push(key);
  }
  return { resolved: null, skipped };
}

/** What a new document of this entry is made as. Every Event Storming board and every family
 *  template opens in Diagram mode (blueprint D112). */
export function representativeIntent(key: PlacementDefaultKey): CreationIntent {
  const [dimension, value] = key.split(':') as [string, string];
  if (dimension === 'mode') return { mode: value as EditorMode, tabKind: 'diagram' };
  if (dimension === 'kind') return { mode: 'diagram', tabKind: value as 'event-storming' };
  return {
    mode: 'diagram',
    tabKind: 'diagram',
    templateFamily: value as 'retrospective' | 'kanban',
  };
}

export type RememberedFolder = { name: string; teamId: string | null };

export type DefaultDestination =
  | { kind: 'root' }
  | { kind: 'folder'; folder: IndexedFolder; teamName: string | null }
  | {
      kind: 'dangling';
      folderId: string;
      /** From this browser's memory; null when it never saw the folder. */
      name: string | null;
      reason: 'deleted' | 'unavailable';
      /** Where these documents go instead; null = My documents. */
      fallback: IndexedFolder | null;
    };

/** Where new documents of this entry go now, as Settings shows it. */
export function destinationOf(
  key: PlacementDefaultKey,
  defaults: PlacementDefaults,
  index: DefaultFolderIndex,
  remember: (folderId: string) => RememberedFolder | null = () => null,
): DefaultDestination {
  const folderId = defaults.get(key);
  if (!folderId) return { kind: 'root' };
  const folder = workingDefault(key, defaults, index);
  if (folder) {
    return {
      kind: 'folder',
      folder,
      teamName: folder.teamId ? (index.teams.get(folder.teamId) ?? null) : null,
    };
  }
  const known = remember(folderId);
  const teamGone = !!known?.teamId && !index.teams.has(known.teamId);
  return {
    kind: 'dangling',
    folderId,
    name: known?.name ?? null,
    reason: teamGone ? 'unavailable' : 'deleted',
    fallback:
      resolveDefaultFor(representativeIntent(key), defaults, index).resolved?.folder ?? null,
  };
}

/** The keys this folder is the default for, in list order. */
export function folderDefaultKeys(
  folderId: string,
  defaults: PlacementDefaults,
): PlacementDefaultKey[] {
  return PLACEMENT_DEFAULT_KEYS.filter((key) => defaults.get(key) === folderId);
}
