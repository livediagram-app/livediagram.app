'use client';

import { useState, type ReactNode } from 'react';
import { BackBar } from '@/components/palette/ThemeCategoryBrowser';

// The standardised folder-placement browser (spec/76, extended by spec/15):
// a two-level tile-grid browse. Pick a SPACE first (My Work, or one of your
// teams), then drill into its folder tree; every level shows a "here" card
// (Unsorted / Team Library / the open folder itself) plus the folders
// directly inside it, with an optional inline New Folder tile. One space
// collapses the overview away and the browser opens straight inside it.
//
// Shared by the New Diagram wizard's Save In step (spec/76) and the
// Move-to-folder dialog on every move surface (spec/15 + spec/35), so the
// product has exactly ONE way to choose where a diagram lives.

// A folder as the browser sees it: parentId drives the drill-down (root
// folders show at the space level; subfolders only inside their parent).
export type PickerFolder = { id: string; name: string; parentId: string | null };

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
// overview (only reachable when more than one space exists), 'my-work' the
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
  // Whether the personal ("My Work") space is offered. Team-scoped surfaces
  // (the team library's own move picker) turn it off and pass exactly one
  // team, so the browser opens directly inside that team's tree.
  showPersonal?: boolean;
  // Inline folder creation (the "New Folder" tile). Absent = tile hidden.
  onCreateFolder?: (
    name: string,
    parentId: string | null,
    teamId: string | null,
  ) => Promise<PickerFolder | null>;
}) {
  const spaceCount = (showPersonal ? 1 : 0) + teams.length;
  // With several spaces, open on the overview so the space choice comes
  // first; a single space goes straight in and never shows a space BackBar.
  // `undefined` = "not chosen yet", DERIVED per render rather than captured
  // at mount: teams load asynchronously, so a user who reaches the browser
  // before the fetch resolves must still get the overview once teams land
  // (a mount-time useState(hasTeams ? ...) would pin them into My Work).
  const [chosenSpace, setChosenSpace] = useState<string | null | undefined>(undefined);
  const defaultSpace = showPersonal ? 'my-work' : (teams[0]?.id ?? 'my-work');
  const space = chosenSpace === undefined ? (spaceCount > 1 ? null : defaultSpace) : chosenSpace;
  // Folder drill-down inside the current space (ids from root inward).
  const [stack, setStack] = useState<PickerFolder[]>([]);
  const placementSpace = placement.startsWith('team:') ? placement.split(':')[1] : 'my-work';

  // Entering a space also selects its root when the current choice lives
  // elsewhere, so the level never renders with nothing highlighted (the
  // "always something selected" rule; see selectionChain below for the
  // within-space half of it).
  const enterSpace = (next: string | null) => {
    setChosenSpace(next);
    setStack([]);
    if (next === 'my-work' && placementSpace !== 'my-work') onPlacement('unsorted');
    else if (next && next !== 'my-work' && placementSpace !== next) onPlacement(`team:${next}`);
  };

  if (spaceCount > 1 && space === null) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {showPersonal ? (
          <PlacementCard
            label="My Work"
            sub="Your folders"
            icon={<MyWorkIcon />}
            selected={placementSpace === 'my-work'}
            onSelect={() => enterSpace('my-work')}
          />
        ) : null}
        {teams.map((t) => (
          <PlacementCard
            key={t.id}
            label={t.name}
            sub="Team"
            icon={<TeamPlaceIcon />}
            selected={placementSpace === t.id}
            onSelect={() => enterSpace(t.id)}
          />
        ))}
      </div>
    );
  }

  const isMyWork = space === 'my-work';
  const teamId = isMyWork ? null : (space as string);
  const team = teamId ? teams.find((t) => t.id === teamId) : undefined;
  const spaceFolders = isMyWork ? folders : (teamFolders[teamId!] ?? []);
  const spaceName = isMyWork ? 'My Work' : (team?.name ?? 'Team');

  // Placement value for a folder in this space.
  const valueFor = (folderId: string) =>
    isMyWork ? `folder:${folderId}` : `team:${teamId}:folder:${folderId}`;
  const rootValue = isMyWork ? 'unsorted' : `team:${teamId}`;

  const openFolder = stack[stack.length - 1];
  const children = spaceFolders.filter((f) => f.parentId === (openFolder?.id ?? null));
  const hasKids = (id: string) => spaceFolders.some((f) => f.parentId === id);

  // The chosen destination folder and its ancestor chain within this space.
  // Keeps something visibly selected at EVERY level: a folder card is shown
  // selected when the destination IS it or lives inside it, so backing out
  // of a subfolder still highlights the branch that holds the choice.
  const selectionChain = new Set<string>();
  if (placementSpace === (isMyWork ? 'my-work' : teamId)) {
    const ix = placement.indexOf('folder:');
    const chosenId = ix >= 0 ? placement.slice(ix + 'folder:'.length) : null;
    const byId = new Map(spaceFolders.map((f) => [f.id, f]));
    let cur = chosenId ? byId.get(chosenId) : undefined;
    while (cur) {
      selectionChain.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
  }

  // Back: pop one folder level; at the space root, back to the overview
  // (only shown when the overview exists / we're inside a folder).
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
      {showBack ? (
        <BackBar label={backLabel} current={openFolder?.name ?? spaceName} onClick={onBack} />
      ) : null}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {openFolder ? (
          // Save directly in the open folder.
          <PlacementCard
            label={openFolder.name}
            sub="This folder"
            icon={<FolderPlaceIcon />}
            selected={placement === valueFor(openFolder.id)}
            onSelect={() => onPlacement(valueFor(openFolder.id))}
            onCommit={() => onCommitPlacement?.(valueFor(openFolder.id))}
          />
        ) : (
          <PlacementCard
            label={isMyWork ? 'My Work' : 'Team Library'}
            sub={isMyWork ? 'Unsorted' : (team?.name ?? 'Team')}
            icon={isMyWork ? <MyWorkIcon /> : <TeamPlaceIcon />}
            selected={placement === rootValue}
            onSelect={() => onPlacement(rootValue)}
            onCommit={() => onCommitPlacement?.(rootValue)}
          />
        )}
        {children.map((f) =>
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
              selected={selectionChain.has(f.id)}
              onSelect={() => {
                if (!selectionChain.has(f.id)) onPlacement(valueFor(f.id));
                setStack([...stack, f]);
              }}
            />
          ) : (
            <PlacementCard
              key={f.id}
              label={f.name}
              sub="Folder"
              icon={<FolderPlaceIcon />}
              selected={placement === valueFor(f.id)}
              onSelect={() => onPlacement(valueFor(f.id))}
              onCommit={() => onCommitPlacement?.(valueFor(f.id))}
            />
          ),
        )}
        {onCreateFolder ? (
          <NewFolderTile
            onCreate={async (name) => {
              const created = await onCreateFolder(name, openFolder?.id ?? null, teamId);
              // Select the fresh folder as the destination straight away.
              if (created) onPlacement(valueFor(created.id));
              return created !== null;
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

// The "New Folder" tile: a dashed card that flips into a small naming form in
// place (the popover the flow needs, without portal plumbing inside the
// modal). Enter creates in the CURRENT level's scope and the browser selects
// the fresh folder; Escape backs out. Exported for the tab Add-to-Folder
// dialog (spec/30), which offers the same create-in-place affordance.
export function NewFolderTile({ onCreate }: { onCreate: (name: string) => Promise<boolean> }) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const commit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const ok = await onCreate(trimmed);
    setBusy(false);
    if (ok) {
      setNaming(false);
      setName('');
    }
  };
  if (!naming) {
    return (
      <button
        type="button"
        onClick={() => setNaming(true)}
        className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 p-3 text-center transition hover:border-brand-400 hover:bg-brand-50/40 dark:border-slate-600 dark:hover:border-brand-500 dark:hover:bg-brand-500/10"
      >
        <span className="text-slate-400">
          <NewFolderIcon />
        </span>
        <span className="w-full truncate text-xs font-medium text-slate-500 dark:text-slate-400">
          New Folder
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">Create here</span>
      </button>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50/40 p-3 dark:border-brand-500/50 dark:bg-brand-500/10">
      <span className="text-brand-500">
        <NewFolderIcon />
      </span>
      <input
        type="text"
        autoFocus
        value={name}
        placeholder="Folder name"
        disabled={busy}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void commit();
          if (e.key === 'Escape') {
            setNaming(false);
            setName('');
          }
        }}
        onBlur={() => {
          if (busy) return;
          // Mobile keyboards give this single-line field no Enter key, so
          // tapping away with a name typed commits the folder; an empty
          // field just folds the tile back up. (Escape unmounts the input
          // without firing this handler, so cancel stays cancel.)
          if (name.trim()) {
            void commit();
          } else {
            setNaming(false);
            setName('');
          }
        }}
        className="w-full rounded border border-brand-300 bg-white px-1.5 py-1 text-center text-xs text-slate-800 outline-none dark:border-brand-500/50 dark:bg-slate-800 dark:text-slate-100"
      />
      <span className="text-[10px] text-slate-400 dark:text-slate-500">
        {busy ? 'Creating…' : 'Enter to create'}
      </span>
    </div>
  );
}

function NewFolderIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h3.6l1.8 2H15.5A1.5 1.5 0 0 1 17 7.5v7A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5v-9Z" />
      <path d="M10 9.2v4M8 11.2h4" />
    </svg>
  );
}

// One selectable destination tile: icon over name over a small kind caption,
// radio semantics (exactly one destination is ever active).
export function PlacementCard({
  label,
  sub,
  icon,
  selected,
  onSelect,
  onCommit,
}: {
  label: string;
  sub: string;
  icon: ReactNode;
  selected: boolean;
  onSelect: () => void;
  // Double-click: select + commit the host flow in one gesture. Only wired on
  // cards that stay mounted across the first click (drill-in cards swap the
  // level under the cursor, so a dblclick can never land on them).
  onCommit?: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      onDoubleClick={onCommit}
      className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition ${
        selected
          ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-200 dark:border-brand-500 dark:bg-brand-500/10 dark:ring-brand-500/30'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700/60'
      }`}
    >
      <span className={selected ? 'text-brand-600 dark:text-brand-300' : 'text-slate-400'}>
        {icon}
      </span>
      <span
        className={`w-full truncate text-xs font-medium ${
          selected ? 'text-brand-800 dark:text-brand-200' : 'text-slate-700 dark:text-slate-200'
        }`}
      >
        {label}
      </span>
      <span className="text-[10px] text-slate-400 dark:text-slate-500">{sub}</span>
    </button>
  );
}

// Tile glyphs, sized to sit above the card label.
function MyWorkIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3.5 8.5 10 3l6.5 5.5" />
      <path d="M5 7.5V16a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7.5" />
      <path d="M8 17v-4.5h4V17" />
    </svg>
  );
}

export function FolderPlaceIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h3.6l1.8 2H15.5A1.5 1.5 0 0 1 17 7.5v7A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5v-9Z" />
    </svg>
  );
}

// A folder with a smaller folder tucked inside: the "has subfolders" marker
// on drill-in cards, distinct from the plain FolderPlaceIcon leaf.
function FolderStackIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h3.6l1.8 2H15.5A1.5 1.5 0 0 1 17 7.5v7A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5v-9Z" />
      <path d="M6.5 12.9v-2.6c0-.44.36-.8.8-.8h1.5l.9 1h2.5c.44 0 .8.36.8.8v1.6c0 .44-.36.8-.8.8H7.3a.8.8 0 0 1-.8-.8Z" />
    </svg>
  );
}

function TeamPlaceIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="7.5" cy="7" r="2.6" />
      <path d="M3 16c.5-2.8 2.2-4.2 4.5-4.2S11.5 13.2 12 16" />
      <circle cx="13.8" cy="7.8" r="2" />
      <path d="M13.2 11.6c1.9.2 3.2 1.5 3.7 3.9" />
    </svg>
  );
}
