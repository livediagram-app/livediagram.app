import type { PickerFolder } from './PlacementBrowser';

// Where the placement browser opens for a selection (docs/specs/006-document/save-locations.md,
// "It opens where its selection is"; blueprint default-folders.md "Browser view"): a folder opens
// the level that lists it, so its own card is the checked one; a space's root opens the overview.

/** The personal space's id in a view; any other non-null space is a team id. */
export const PERSONAL_SPACE = 'personal-space';

/** What the browser shows: `space` null is the overview; `stack` the folders opened, root inward. */
export type PlacementView = { space: string | null; stack: PickerFolder[] };

/** The spaces a surface offers, and their folders. */
export type PlacementSpaces = {
  showPersonal: boolean;
  teams: { id: string; name: string }[];
  folders: PickerFolder[];
  teamFolders: Record<string, PickerFolder[]>;
};

/** Whether the surface opens on the space overview: wherever My documents or two spaces are on offer. */
export function hasSpaceOverview({ showPersonal, teams }: PlacementSpaces): boolean {
  return showPersonal || teams.length > 1;
}

/** The view a surface shows with nothing more specific to open: the overview, else its one space. */
export function spaceRootView(spaces: PlacementSpaces): PlacementView {
  if (hasSpaceOverview(spaces)) return { space: null, stack: [] };
  return {
    space: spaces.showPersonal ? PERSONAL_SPACE : (spaces.teams[0]?.id ?? PERSONAL_SPACE),
    stack: [],
  };
}

/** The folder's ancestors, root inward, the folder itself excluded. */
function ancestorsOf(folder: PickerFolder, byId: Map<string, PickerFolder>): PickerFolder[] {
  const chain: PickerFolder[] = [];
  let cur = folder.parentId ? byId.get(folder.parentId) : undefined;
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain;
}

/** Where the browser opens for a selection: the level that lists a selected folder it can see. */
export function placementViewFor(
  { teamId, folderId }: { teamId: string | null; folderId: string | null },
  spaces: PlacementSpaces,
): PlacementView {
  if (!folderId) return spaceRootView(spaces);
  const offered = teamId ? spaces.teams.some((t) => t.id === teamId) : spaces.showPersonal;
  if (!offered) return spaceRootView(spaces);
  const list = teamId ? (spaces.teamFolders[teamId] ?? []) : spaces.folders;
  const byId = new Map(list.map((f) => [f.id, f]));
  const folder = byId.get(folderId);
  if (!folder) return spaceRootView(spaces);
  return { space: teamId ?? PERSONAL_SPACE, stack: ancestorsOf(folder, byId) };
}
