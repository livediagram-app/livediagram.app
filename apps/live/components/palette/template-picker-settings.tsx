'use client';

import { useState, type ReactNode } from 'react';
import { ToggleSwitch } from '@/components/palette/palette-controls';
import { BackBar } from '@/components/palette/ThemeCategoryBrowser';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';

// A folder as the placement browser sees it: parentId drives the drill-down
// (root folders show at the space level; subfolders only inside their parent).
type PickerFolder = { id: string; name: string; parentId: string | null };

// The New Diagram wizard's third step (spec/76): name the diagram, choose where
// it lives, and whether it's saved offline. Placement is a two-level browse
// (the theme-picker pattern): pick a SPACE first (My Work, or one of your
// teams), then a folder inside it. With no teams the space level disappears
// and the picker goes straight to the My Work folders. Only the committed
// `placement` lives in TemplatePicker; the drill-down is view state here.

export function NewDiagramSettingsStep({
  diagramName,
  onDiagramName,
  placeholder,
  placement,
  onPlacement,
  onCommitPlacement,
  folders,
  teams,
  teamFolders = {},
  onCreateFolder,
  offline,
  onOffline,
  showTour = false,
  tour = false,
  onTour,
}: {
  diagramName: string;
  onDiagramName: (v: string) => void;
  placeholder: string;
  // 'unsorted' | `folder:<id>` | `team:<teamId>` | `team:<teamId>:folder:<id>`
  placement: string;
  onPlacement: (v: string) => void;
  // Double-click on a destination card: select it AND commit the wizard in
  // one gesture (the template-card pattern). Absent = double-click ignored.
  onCommitPlacement?: (v: string) => void;
  folders: PickerFolder[];
  teams: { id: string; name: string }[];
  // Per-team folder lists, keyed by team id. Empty / missing while the team
  // libraries are still loading.
  teamFolders?: Record<string, PickerFolder[]>;
  // Inline folder creation (the "New Folder" tile). Absent = tile hidden.
  onCreateFolder?: (
    name: string,
    parentId: string | null,
    teamId: string | null,
  ) => Promise<PickerFolder | null>;
  offline: boolean;
  onOffline: (v: boolean) => void;
  // "Show me around" (spec/79): the interactive editor tour toggle, shown
  // only for brand-new users (the /new page gates on zero owned diagrams).
  showTour?: boolean;
  tour?: boolean;
  onTour?: (v: boolean) => void;
}) {
  const fieldLabel =
    'text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';
  return (
    <div className="flex flex-col gap-5">
      {/* Name */}
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Diagram name</span>
        <input
          type="text"
          value={diagramName}
          placeholder={placeholder}
          onChange={(e) => onDiagramName(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-brand-500 dark:focus:ring-brand-500/20"
        />
      </label>

      {/* "Show me around" (spec/79): brand-new users (zero diagrams) can opt
          into the interactive editor tour, which starts once the created
          diagram opens. Same row anatomy as the offline toggle below. */}
      {showTour ? (
        <button
          type="button"
          aria-pressed={tour}
          onClick={() => onTour?.(!tour)}
          className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-left transition hover:bg-slate-100/70 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:bg-slate-800/70"
        >
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
              Show me around
            </span>
            <span className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Take a quick interactive tour of the editor once your diagram opens.
            </span>
          </span>
          <ToggleSwitch checked={tour} presentational label="Show me around" />
        </button>
      ) : null}

      {/* Offline toggle (spec/76): an iOS-style switch, not a checkbox. Sits
          above Save In because turning it on disables placement (an offline
          diagram has no server folder / team). The whole row is the click
          target, so the switch is presentational and the button owns the
          toggle (no button-in-button). */}
      <button
        type="button"
        aria-pressed={offline}
        onClick={() => onOffline(!offline)}
        className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-left transition hover:bg-slate-100/70 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:bg-slate-800/70"
      >
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
            Save Offline, This Browser Only
          </span>
          <span className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            When enabled your diagram is only stored within your Web Browser storage.
          </span>
        </span>
        <ToggleSwitch checked={offline} presentational label="Save offline, this browser only" />
      </button>

      {/* Data-loss warning (spec/76). Offline diagrams live only in this
          browser's storage, so anything that wipes it takes the diagram with
          it. Only shown while offline is on, so the risk is surfaced exactly
          when it applies. */}
      {offline ? (
        <div className="-mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <svg
            className="mt-px shrink-0"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M8 2.5 1.8 13.5h12.4L8 2.5Z" />
            <path d="M8 6.5v3.2M8 11.6v.1" />
          </svg>
          <span>
            This diagram is not backed up or synced. Clearing your browser data, using private
            browsing, or switching device or browser will lose it for good. You can Sync it to your
            account later.{' '}
            <HelpArticleLink
              article="offlineMode"
              variant="text"
              label="Learn more"
              title="Offline Mode"
              description="How offline diagrams work, and moving them to or from your account."
              className="!text-amber-800 underline hover:!text-amber-900 dark:!text-amber-200 dark:hover:!text-amber-100"
            />
          </span>
        </div>
      ) : null}

      {/* Placement: a two-level browse. Space cards first (My Work + each
          team, hidden entirely for team-less users), then the folders inside
          the picked space, behind a BackBar (the theme-picker pattern).
          Collapses to a single static "My Work (Offline)" card while offline
          (an offline diagram has no server placement). */}
      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Save in">
        <span className={fieldLabel}>Save in</span>
        {offline ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <div className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3 opacity-60 dark:border-slate-700 dark:bg-slate-800/40">
              <span className="text-amber-500">
                <OfflinePlaceIcon />
              </span>
              <span className="w-full truncate text-center text-xs font-medium text-slate-700 dark:text-slate-200">
                My Work
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Offline</span>
            </div>
          </div>
        ) : (
          <PlacementBrowser
            placement={placement}
            onPlacement={onPlacement}
            onCommitPlacement={onCommitPlacement}
            folders={folders}
            teams={teams}
            teamFolders={teamFolders}
            onCreateFolder={onCreateFolder}
          />
        )}
      </div>
    </div>
  );
}

// The space -> folder browser. `space` is view state: null shows the space
// overview (only reachable when teams exist), 'my-work' the personal tree, a
// team id that team's tree. Within a space, `stack` is the folder drill-down:
// each level lists a "save at this level" card (Unsorted / Team Library /
// the open folder itself) plus the folders directly inside it — subfolders
// only appear inside their parent, mirroring the Explorer tree. Clicking a
// folder WITH subfolders drills in; a leaf folder just selects.
function PlacementBrowser({
  placement,
  onPlacement,
  onCommitPlacement,
  folders,
  teams,
  teamFolders,
  onCreateFolder,
}: {
  placement: string;
  onPlacement: (v: string) => void;
  onCommitPlacement?: (v: string) => void;
  folders: PickerFolder[];
  teams: { id: string; name: string }[];
  teamFolders: Record<string, PickerFolder[]>;
  onCreateFolder?: (
    name: string,
    parentId: string | null,
    teamId: string | null,
  ) => Promise<PickerFolder | null>;
}) {
  const hasTeams = teams.length > 0;
  // With teams, open on the overview so the space choice comes first; the
  // team-less path goes straight to My Work and never shows a space BackBar.
  // `undefined` = "not chosen yet", DERIVED per render rather than captured
  // at mount: teams load asynchronously, so a user who reaches this step
  // before the fetch resolves must still get the overview once teams land
  // (a mount-time useState(hasTeams ? ...) would pin them into My Work).
  const [chosenSpace, setChosenSpace] = useState<string | null | undefined>(undefined);
  const space = chosenSpace === undefined ? (hasTeams ? null : 'my-work') : chosenSpace;
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

  if (hasTeams && space === null) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <PlacementCard
          label="My Work"
          sub="Your folders"
          icon={<MyWorkIcon />}
          selected={placementSpace === 'my-work'}
          onSelect={() => enterSpace('my-work')}
        />
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

  const isMyWork = space === 'my-work' || !hasTeams;
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
  const showBack = hasTeams || stack.length > 0;
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
// the fresh folder; Escape backs out.
function NewFolderTile({ onCreate }: { onCreate: (name: string) => Promise<boolean> }) {
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
          if (!busy && !name.trim()) {
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
function PlacementCard({
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
  // Double-click: select + commit the wizard in one gesture. Only wired on
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

function FolderPlaceIcon() {
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

function OfflinePlaceIcon() {
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
      <path d="M5.5 14.5h8.3a3 3 0 0 0 .5-5.96 4.3 4.3 0 0 0-7.9-1A2.9 2.9 0 0 0 5.5 14.5Z" />
      <path d="M3.5 3.5l13 13" />
    </svg>
  );
}
