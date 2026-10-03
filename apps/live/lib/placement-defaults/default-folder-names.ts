// This browser's memory of the names of a person's default folders
// (docs/specs/013-workspace/default-folders.md "Settings", blueprint D113): a deleted folder's row is
// gone from the server, so the only way Settings can still say "Workshops (deleted)" is to have
// noted the name while the folder was visible. Owner-keyed, so a shared browser never shows one
// account's folder names to another.
import type {
  DefaultFolderIndex,
  PlacementDefaults,
  RememberedFolder,
} from './default-destination';

export const DEFAULT_FOLDER_NAMES_PREFIX = 'livediagram:v2:default-folder-names:';

type Store = Pick<Storage, 'getItem' | 'setItem'>;
type Memory = Record<string, RememberedFolder>;

function browserStorage(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function isRemembered(v: unknown): v is RememberedFolder {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return typeof r.name === 'string' && (r.teamId === null || typeof r.teamId === 'string');
}

function read(store: Store, ownerId: string): Memory {
  try {
    const raw: unknown = JSON.parse(store.getItem(DEFAULT_FOLDER_NAMES_PREFIX + ownerId) ?? '{}');
    if (!raw || typeof raw !== 'object') return {};
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => isRemembered(v)));
  } catch {
    return {};
  }
}

/** Notes the name of every default folder the index can see, and forgets folders no longer a
 *  default. A folder the index cannot see keeps what was noted, which is the point. */
export function rememberDefaultFolders(
  ownerId: string,
  defaults: PlacementDefaults,
  index: DefaultFolderIndex,
  store: Store | null = browserStorage(),
): void {
  if (!store) return;
  const before = read(store, ownerId);
  const next: Memory = {};
  for (const folderId of new Set(defaults.values())) {
    const folder = index.folders.get(folderId);
    const known = folder ? { name: folder.name, teamId: folder.teamId } : before[folderId];
    if (known) next[folderId] = known;
  }
  try {
    store.setItem(DEFAULT_FOLDER_NAMES_PREFIX + ownerId, JSON.stringify(next));
  } catch {
    // A full storage costs only a deleted folder's name in Settings ("A deleted folder").
  }
}

export function rememberedDefaultFolder(
  ownerId: string,
  folderId: string,
  store: Store | null = browserStorage(),
): RememberedFolder | null {
  if (!store) return null;
  return read(store, ownerId)[folderId] ?? null;
}
