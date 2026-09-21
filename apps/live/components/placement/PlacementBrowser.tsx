'use client';

import { useState } from 'react';
import { BackBar } from '@/components/primitives/BackBar';
import {
  FolderPlaceIcon,
  FolderStackIcon,
  PersonalSpaceIcon,
  NewFolderTile,
  PlacementCard,
  TeamPlaceIcon,
  type PlacementLayout,
} from './PlacementCard';

// The standardised folder-placement browser (spec/76, extended by spec/15):
// a two-level tile-grid browse. Pick a SPACE first (Personal Space, or one of your
// teams), then drill into its folder tree; every level shows a "here" card
// (Unsorted / Team Library / the open folder itself) plus the folders
// directly inside it, with an optional inline New Folder tile. One space
// collapses the overview away and the browser opens straight inside it.
//
// Shared by the New Diagram wizard's folder step (spec/76, spec/141) and the
// Move-to-folder dialog on every move surface (spec/15 + spec/35), so the
// product has exactly ONE way to choose where a diagram lives. Two layouts
// of the same browse: `tiles` (icon over label, a grid) for the move dialog,
// `list` (icon beside label, stacked rows, the file-explorer idiom) for the
// wizard, where a tile grid would read as a twin of the Save location row
// directly above it.

// A folder as the browser sees it: parentId drives the drill-down (root
// folders show at the space level; subfolders only inside their parent).
export type PickerFolder = { id: string; name: string; parentId: string | null };

// Direct subfolders of a folder (null = a space's root). Drives both the
// count badge and whether a folder card drills in rather than selects.
function countChildren(list: PickerFolder[], parentId: string | null): number {
  return list.filter((f) => f.parentId === parentId).length;
}

// Placement strings are the browser's selection wire format:
// 'unsorted' | `folder:<id>` | `team:<teamId>` | `team:<teamId>:folder:<id>`.
// These two helpers convert to / from the `{ teamId, folderId }` pair the
// API layer speaks, so callers never re-parse the string by hand.
export function placementValue(teamId: string | null, folderId: string | null): string {
  if (teamId) return folderId ? `team:${teamId}:folder:${folderId}` : `team:${teamId}`;
  return folderId ? `folder:${folderId}` : 'unsorted';
}

export function parsePlacement(placement: string): {
  teamId: string | null;
  folderId: string | null;
} {
  if (placement.startsWith('folder:')) {
    return { teamId: null, folderId: placement.slice('folder:'.length) };
  }
  if (placement.startsWith('team:')) {
    // `team:<teamId>` (library root) or `team:<teamId>:folder:<folderId>`.
    const rest = placement.slice('team:'.length);
    const sep = rest.indexOf(':folder:');
    if (sep >= 0) {
      return { teamId: rest.slice(0, sep), folderId: rest.slice(sep + ':folder:'.length) };
    }
    return { teamId: rest, folderId: null };
  }
  return { teamId: null, folderId: null };
}

// The space -> folder browser. `space` is view state: null shows the space
// overview (only reachable when more than one space exists), 'personal-space' the
// personal tree, a team id that team's tree. Within a space, `stack` is the
// folder drill-down: each level lists a "save at this level" card (Unsorted /
// Team Library / the open folder itself) plus the folders directly inside
// it — subfolders only appear inside their parent, mirroring the Explorer
// tree. Clicking a folder WITH subfolders drills in; a leaf folder just
// selects.
export function PlacementBrowser({
  placement,
  onPlacement,
  onCommitPlacement,
  folders,
  teams,
  teamFolders,
  showPersonal = true,
  onCreateFolder,
  layout = 'tiles',
}: {
  placement: string;
  onPlacement: (v: string) => void;
  // Double-click on a destination card: select it AND commit the host flow
  // in one gesture (create the diagram / perform the move). Absent =
  // double-click ignored.
  onCommitPlacement?: (v: string) => void;
  folders: PickerFolder[];
  teams: { id: string; name: string }[];
  // Per-team folder lists, keyed by team id. Empty / missing while the team
  // libraries are still loading.
  teamFolders: Record<string, PickerFolder[]>;
  // Whether the personal ("Personal Space") space is offered. Team-scoped surfaces
  // (the team library's own move picker) turn it off and pass exactly one
  // team, so the browser opens directly inside that team's tree.
  showPersonal?: boolean;
  // Inline folder creation (the "New Folder" tile). Absent = tile hidden.
  onCreateFolder?: (
    name: string,
    parentId: string | null,
    teamId: string | null,
  ) => Promise<PickerFolder | null>;
  // Tile grid (default) or stacked rows; see the header comment.
  layout?: PlacementLayout;
}) {
  const levelClass =
    layout === 'list' ? 'flex flex-col gap-1' : 'grid grid-cols-3 gap-2 sm:grid-cols-4';
  // Rows enter as a cascade, each a beat after the one above (the entrance
  // is on the card, see `enterIndex`). The level container is keyed on
  // WHICH level is showing, so every drill in / back / space change
  // remounts its rows and they cascade in again; a folder created in place
  // only mounts its own row.
  const spaceCount = (showPersonal ? 1 : 0) + teams.length;
  // With several spaces, open on the overview so the space choice comes
  // first; a single space goes straight in and never shows a space BackBar.
  // `undefined` = "not chosen yet", DERIVED per render rather than captured
  // at mount: teams load asynchronously, so a user who reaches the browser
  // before the fetch resolves must still get the overview once teams land
  // (a mount-time useState(hasTeams ? ...) would pin them into Personal Space).
  const [chosenSpace, setChosenSpace] = useState<string | null | undefined>(undefined);
  const defaultSpace = showPersonal ? 'personal-space' : (teams[0]?.id ?? 'personal-space');
  const space = chosenSpace === undefined ? (spaceCount > 1 ? null : defaultSpace) : chosenSpace;
  // Folder drill-down inside the current space (ids from root inward).
  const [stack, setStack] = useState<PickerFolder[]>([]);
  const placementSpace = placement.startsWith('team:') ? placement.split(':')[1] : 'personal-space';

  // Entering a space also selects its root when the current choice lives
  // elsewhere, so the level never renders with nothing highlighted (the
  // "always something selected" rule; see selectionChain below for the
  // within-space half of it).
  const enterSpace = (next: string | null) => {
    setChosenSpace(next);
    setStack([]);
    if (next === 'personal-space' && placementSpace !== 'personal-space') onPlacement('unsorted');
    else if (next && next !== 'personal-space' && placementSpace !== next)
      onPlacement(`team:${next}`);
  };

  // The bar above the rows is at EVERY level (see BackBar): a back button
  // where there is a level above, a static heading where there is not, so
  // it never appears and disappears under the rows as you move about.
  if (spaceCount > 1 && space === null) {
    return (
      <div className="flex flex-col gap-2">
        <BackBar label="Choose a Space" />
        <div key="overview" className={levelClass}>
          {showPersonal ? (
            <PlacementCard
              label="Personal Space"
              sub="Your folders"
              icon={<PersonalSpaceIcon />}
              count={countChildren(folders, null)}
              selected={placementSpace === 'personal-space'}
              onSelect={() => enterSpace('personal-space')}
              layout={layout}
              enterIndex={0}
            />
          ) : null}
          {teams.map((t, i) => (
            <PlacementCard
              key={t.id}
              label={t.name}
              sub="Team"
              icon={<TeamPlaceIcon />}
              count={countChildren(teamFolders[t.id] ?? [], null)}
              selected={placementSpace === t.id}
              onSelect={() => enterSpace(t.id)}
              layout={layout}
              enterIndex={(showPersonal ? 1 : 0) + i}
            />
          ))}
        </div>
      </div>
    );
  }

  const isPersonalSpace = space === 'personal-space';
  const teamId = isPersonalSpace ? null : (space as string);
  const team = teamId ? teams.find((t) => t.id === teamId) : undefined;
  const spaceFolders = isPersonalSpace ? folders : (teamFolders[teamId!] ?? []);
  const spaceName = isPersonalSpace ? 'Personal Space' : (team?.name ?? 'Team');

  // Placement value for a folder in this space.
  const valueFor = (folderId: string) =>
    isPersonalSpace ? `folder:${folderId}` : `team:${teamId}:folder:${folderId}`;
  const rootValue = isPersonalSpace ? 'unsorted' : `team:${teamId}`;

  const openFolder = stack[stack.length - 1];
  const children = spaceFolders.filter((f) => f.parentId === (openFolder?.id ?? null));
  const hasKids = (id: string) => countChildren(spaceFolders, id) > 0;

  // The chosen destination folder and its ancestor chain within this space.
  // Keeps something visibly selected at EVERY level: a folder card is shown
  // selected when the destination IS it or lives inside it, so backing out
  // of a subfolder still highlights the branch that holds the choice.
  const selectionChain = new Set<string>();
  const byId = new Map(spaceFolders.map((f) => [f.id, f]));
  // The folder the destination currently points at, if it's a folder in
  // this space (undefined when the space's root is the choice).
  let chosenFolder: PickerFolder | undefined;
  if (placementSpace === (isPersonalSpace ? 'personal-space' : teamId)) {
    const ix = placement.indexOf('folder:');
    const chosenId = ix >= 0 ? placement.slice(ix + 'folder:'.length) : null;
    chosenFolder = chosenId ? byId.get(chosenId) : undefined;
    let cur = chosenFolder;
    while (cur) {
      selectionChain.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
  }

  // Where the New Folder tile creates. A folder is created UNDER the
  // selected destination: pick a folder and the tile reads "New
  // Subfolder"; pick the space's root and it's "New Folder" again. With
  // nothing chosen in this space, the open folder (if any) is the parent,
  // so drilling in never creates back at the root behind your back.
  const newFolderParent = chosenFolder ?? openFolder;
  // Root inward, so the browser can open the parent after creating in it.
  const pathTo = (folder: PickerFolder): PickerFolder[] => {
    const path: PickerFolder[] = [];
    let cur: PickerFolder | undefined = folder;
    while (cur) {
      path.unshift(cur);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return path;
  };

  // Back: pop one folder level; at the space root, back to the overview.
  // With one space and nothing open there is no level above, and the bar
  // reads as a heading instead.
  const showBack = spaceCount > 1 || stack.length > 0;
  const onBack = () => (stack.length > 0 ? setStack(stack.slice(0, -1)) : enterSpace(null));
  const backLabel =
    stack.length > 1
      ? stack[stack.length - 2]!.name
      : stack.length === 1
        ? spaceName
        : 'All spaces';

  return (
    <div className="flex flex-col gap-2">
      <BackBar
        label={showBack ? backLabel : 'Choose a Folder'}
        current={openFolder?.name ?? spaceName}
        onClick={showBack ? onBack : undefined}
      />
      <div key={`${space}:${openFolder?.id ?? 'root'}`} className={levelClass}>
        {openFolder ? (
          // Save directly in the open folder.
          <PlacementCard
            label={openFolder.name}
            sub="This folder"
            icon={<FolderPlaceIcon />}
            count={children.length}
            selected={placement === valueFor(openFolder.id)}
            onSelect={() => onPlacement(valueFor(openFolder.id))}
            onCommit={() => onCommitPlacement?.(valueFor(openFolder.id))}
            layout={layout}
            enterIndex={0}
          />
        ) : (
          <PlacementCard
            label={isPersonalSpace ? 'Personal Space' : 'Team Library'}
            sub={isPersonalSpace ? 'Unsorted' : (team?.name ?? 'Team')}
            icon={isPersonalSpace ? <PersonalSpaceIcon /> : <TeamPlaceIcon />}
            count={children.length}
            selected={placement === rootValue}
            onSelect={() => onPlacement(rootValue)}
            onCommit={() => onCommitPlacement?.(rootValue)}
            layout={layout}
            enterIndex={0}
          />
        )}
        {children.map((f, i) =>
          hasKids(f.id) ? (
            // A folder with subfolders drills in (its "save here" card is the
            // first tile of the next level) and gets the stacked-folders
            // glyph so it reads as "contains more" before you click. Drilling
            // also selects it (unless the choice already lives inside it), so
            // the next level opens with its first card highlighted.
            <PlacementCard
              key={f.id}
              label={f.name}
              sub="Open folder"
              icon={<FolderStackIcon />}
              count={countChildren(spaceFolders, f.id)}
              selected={selectionChain.has(f.id)}
              onSelect={() => {
                if (!selectionChain.has(f.id)) onPlacement(valueFor(f.id));
                setStack([...stack, f]);
              }}
              layout={layout}
              enterIndex={i + 1}
            />
          ) : (
            // A leaf: "Folder" at a space's root, "Subfolder" once you are
            // inside a folder, so the caption says where you are.
            <PlacementCard
              key={f.id}
              label={f.name}
              sub={openFolder ? 'Subfolder' : 'Folder'}
              icon={<FolderPlaceIcon />}
              selected={placement === valueFor(f.id)}
              onSelect={() => onPlacement(valueFor(f.id))}
              onCommit={() => onCommitPlacement?.(valueFor(f.id))}
              layout={layout}
              enterIndex={i + 1}
            />
          ),
        )}
        {onCreateFolder ? (
          <NewFolderTile
            layout={layout}
            enterIndex={children.length + 1}
            label={newFolderParent ? 'New Subfolder' : 'New Folder'}
            sub={newFolderParent ? `In ${newFolderParent.name}` : 'Create here'}
            onCreate={async (name) => {
              const created = await onCreateFolder(name, newFolderParent?.id ?? null, teamId);
              if (!created) return false;
              // Select the fresh folder as the destination straight away,
              // and open its parent if that isn't the level on screen, so
              // the new row is the one highlighted rather than hidden
              // inside a folder the reader hasn't opened.
              onPlacement(valueFor(created.id));
              if (newFolderParent && newFolderParent.id !== openFolder?.id) {
                setStack(pathTo(newFolderParent));
              }
              return true;
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
