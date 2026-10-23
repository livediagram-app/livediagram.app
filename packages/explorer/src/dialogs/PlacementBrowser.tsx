'use client';

// liveplanner's PlacementBrowser (list layout): choose a space (My Work or a team), then drill into its
// folders; a card selects, a double-click (or Enter) picks at once, and New Folder makes one where you are. Where the
// host can make teams, the spaces end with New Team (livediagram's Move dialog): the team is made on the spot and
// opened, its root chosen.
// Placements are strings so a selection compares by value: `unsorted`, `folder:<id>`, `team:<id>`,
// `team:<id>:folder:<id>`.

import { useMemo, useState, type ReactNode } from 'react';
import { FOLDER_NAME_MAX } from '@liveworkspace/index-client';
import {
  ChevronRightIcon,
  FolderPlaceIcon,
  FolderStackIcon,
  NewFolderIcon,
  PersonalSpaceIcon,
  TeamPlaceIcon,
} from '../ui/icons';

export type PickerFolder = { id: string; name: string; parentId: string | null };
export type PickerTeam = { id: string; name: string; folders: PickerFolder[] };
export type Destination = { teamId: string | null; folderId: string | null };

export function placementValue(teamId: string | null, folderId: string | null): string {
  if (teamId) return folderId ? `team:${teamId}:folder:${folderId}` : `team:${teamId}`;
  return folderId ? `folder:${folderId}` : 'unsorted';
}

export function parsePlacement(placement: string): Destination {
  if (placement.startsWith('folder:')) return { teamId: null, folderId: placement.slice(7) };
  if (placement.startsWith('team:')) {
    const rest = placement.slice(5);
    const sep = rest.indexOf(':folder:');
    return sep >= 0
      ? { teamId: rest.slice(0, sep), folderId: rest.slice(sep + 8) }
      : { teamId: rest, folderId: null };
  }
  return { teamId: null, folderId: null };
}

const PERSONAL = 'personal';

// The longest team name accounts keep (liveworkspace/apps/accounts teams.ts TEAM_NAME_MAX_LENGTH).
export const TEAM_NAME_MAX = 80;

function pathTo(byId: Map<string, PickerFolder>, id: string | null): PickerFolder[] {
  const path: PickerFolder[] = [];
  const seen = new Set<string>();
  let at = id ? byId.get(id) : undefined;
  while (at && !seen.has(at.id)) {
    seen.add(at.id);
    path.unshift(at);
    at = at.parentId ? byId.get(at.parentId) : undefined;
  }
  return path;
}

export function PlacementBrowser({
  placement,
  onPlacement,
  onCommitPlacement,
  folders,
  teams: hostTeams = [],
  showPersonal = true,
  onCreateFolder,
  onCreateTeam,
}: {
  placement: string;
  onPlacement: (value: string) => void;
  onCommitPlacement?: (value: string) => void;
  folders: PickerFolder[];
  teams?: PickerTeam[];
  showPersonal?: boolean;
  onCreateFolder?: (
    name: string,
    parentId: string | null,
    teamId: string | null,
  ) => Promise<PickerFolder | null>;
  /** New Team on the spaces: makes one and answers it, or null when refused. */
  onCreateTeam?: (name: string) => Promise<{ id: string; name: string } | null>;
}) {
  const chosen = parsePlacement(placement);
  // Teams made here, shown at once (the host's list catches up after).
  const [made, setMade] = useState<PickerTeam[]>([]);
  const teams = useMemo(
    () => [...hostTeams, ...made.filter((m) => !hostTeams.some((t) => t.id === m.id))],
    [hostTeams, made],
  );
  // The spaces are shown wherever there is a choice, and wherever New Team can make one.
  const hasOverview = (showPersonal ? 1 : 0) + teams.length > 1 || Boolean(showPersonal && onCreateTeam);
  // Opens where the current placement is: its space, and the folder holding it.
  const [space, setSpace] = useState<string | null>(
    () => chosen.teamId ?? (showPersonal ? PERSONAL : hasOverview ? null : (teams[0]?.id ?? null)),
  );
  const spaceFolders =
    space === PERSONAL ? folders : (teams.find((t) => t.id === space)?.folders ?? []);
  const byId = useMemo(() => new Map(spaceFolders.map((f) => [f.id, f])), [spaceFolders]);
  const [openId, setOpenId] = useState<string | null>(() => {
    const parent = chosen.folderId ? byId.get(chosen.folderId)?.parentId : null;
    return parent ?? null;
  });
  const [naming, setNaming] = useState(false);
  const [namingTeam, setNamingTeam] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  if (space === null) {
    return (
      <div className="flex flex-col gap-1">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Choose a Space
        </p>
        {showPersonal ? (
          <PlacementCard
            label="My Work"
            sub="Your folders"
            icon={<PersonalSpaceIcon />}
            selected={chosen.teamId === null}
            drills
            onSelect={() => {
              setSpace(PERSONAL);
              setOpenId(null);
              if (chosen.teamId !== null) onPlacement('unsorted');
            }}
          />
        ) : null}
        {teams.map((t) => (
          <PlacementCard
            key={t.id}
            label={t.name}
            sub="Team"
            icon={<TeamPlaceIcon />}
            selected={chosen.teamId === t.id}
            drills
            onSelect={() => {
              setSpace(t.id);
              setOpenId(null);
              if (chosen.teamId !== t.id) onPlacement(`team:${t.id}`);
            }}
          />
        ))}
        {onCreateTeam ? (
          namingTeam ? (
            <NameField
              placeholder="Team name"
              label="New team name"
              maxLength={TEAM_NAME_MAX}
              error={teamError}
              onCancel={() => {
                setNamingTeam(false);
                setTeamError(null);
              }}
              onCreate={async (name) => {
                const team = await onCreateTeam(name).catch(() => null);
                if (!team) {
                  setTeamError('That team could not be made. Try again.');
                  return;
                }
                setMade((m) => [...m, { id: team.id, name: team.name, folders: [] }]);
                setNamingTeam(false);
                setTeamError(null);
                // Straight into the new team, its root chosen: the point of making it here is to file in it.
                setSpace(team.id);
                setOpenId(null);
                onPlacement(`team:${team.id}`);
              }}
            />
          ) : (
            <PlacementCard
              label="New Team"
              sub="Create a New Team"
              icon={<TeamPlaceIcon />}
              selected={false}
              onSelect={() => setNamingTeam(true)}
            />
          )
        ) : null}
      </div>
    );
  }

  const teamId = space === PERSONAL ? null : space;
  const spaceName = teamId ? (teams.find((t) => t.id === teamId)?.name ?? 'Team') : 'My Work';
  const open = openId ? byId.get(openId) : undefined;
  const children = spaceFolders
    .filter((f) => f.parentId === (open?.id ?? null))
    .sort((a, b) => a.name.localeCompare(b.name));
  const hasKids = (id: string) => spaceFolders.some((f) => f.parentId === id);
  const valueFor = (folderId: string | null) => placementValue(teamId, folderId);
  const chain = new Set(
    chosen.teamId === teamId ? pathTo(byId, chosen.folderId).map((f) => f.id) : [],
  );
  const trail = pathTo(byId, open?.id ?? null);
  const back =
    trail.length > 0
      ? () => setOpenId(trail.length > 1 ? trail[trail.length - 2]!.id : null)
      : hasOverview
        ? () => setSpace(null)
        : undefined;

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
        {back ? (
          <button
            type="button"
            onClick={back}
            className="rounded px-1.5 py-0.5 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ‹ Back
          </button>
        ) : null}
        <span className="truncate font-semibold uppercase tracking-wider">
          {[spaceName, ...trail.map((f) => f.name)].join(' › ')}
        </span>
      </div>
      <PlacementCard
        label={open ? open.name : teamId ? 'Team Library' : 'My Work'}
        sub={open ? 'This folder' : teamId ? spaceName : 'Top level'}
        icon={open ? <FolderPlaceIcon /> : teamId ? <TeamPlaceIcon /> : <PersonalSpaceIcon />}
        selected={placement === valueFor(open?.id ?? null)}
        onSelect={() => onPlacement(valueFor(open?.id ?? null))}
        onCommit={() => onCommitPlacement?.(valueFor(open?.id ?? null))}
      />
      {children.map((f) =>
        hasKids(f.id) ? (
          <PlacementCard
            key={f.id}
            label={f.name}
            sub="Open folder"
            icon={<FolderStackIcon />}
            selected={chain.has(f.id)}
            drills
            onSelect={() => {
              setOpenId(f.id);
              if (!chain.has(f.id)) onPlacement(valueFor(f.id));
            }}
          />
        ) : (
          <PlacementCard
            key={f.id}
            label={f.name}
            sub={open ? 'Subfolder' : 'Folder'}
            icon={<FolderPlaceIcon />}
            selected={placement === valueFor(f.id)}
            onSelect={() => onPlacement(valueFor(f.id))}
            onCommit={() => onCommitPlacement?.(valueFor(f.id))}
          />
        ),
      )}
      {onCreateFolder ? (
        naming ? (
          <NameField
            placeholder="Folder name"
            label="New folder name"
            maxLength={FOLDER_NAME_MAX}
            onCancel={() => setNaming(false)}
            onCreate={async (name) => {
              const made = await onCreateFolder(name, open?.id ?? null, teamId);
              setNaming(false);
              if (made) onPlacement(valueFor(made.id));
            }}
          />
        ) : (
          <PlacementCard
            label={open ? 'New Subfolder' : 'New Folder'}
            sub={open ? `In ${open.name}` : 'Create here'}
            icon={<NewFolderIcon />}
            selected={false}
            onSelect={() => setNaming(true)}
          />
        )
      ) : null}
    </div>
  );
}

function PlacementCard({
  label,
  sub,
  icon,
  selected,
  drills = false,
  onSelect,
  onCommit,
}: {
  label: string;
  sub: string;
  icon: ReactNode;
  selected: boolean;
  drills?: boolean;
  onSelect: () => void;
  onCommit?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      onDoubleClick={onCommit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onCommit && selected) {
          e.preventDefault();
          onCommit();
        }
      }}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
        selected
          ? 'border-brand-400 bg-brand-50/70 dark:border-brand-400/60 dark:bg-brand-500/10'
          : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-lg ${
          selected
            ? 'bg-brand-600 text-white'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
        }`}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
          {label}
        </span>
        <span className="truncate text-xs text-slate-500 dark:text-slate-400">{sub}</span>
      </span>
      {drills ? (
        <span className="shrink-0 text-slate-400">
          <ChevronRightIcon />
        </span>
      ) : null}
    </button>
  );
}

function NameField({
  onCreate,
  onCancel,
  placeholder,
  label,
  maxLength,
  error = null,
}: {
  onCreate: (name: string) => Promise<void>;
  onCancel: () => void;
  placeholder: string;
  label: string;
  maxLength: number;
  error?: string | null;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-300 px-3 py-2 dark:border-brand-500/50"
      onSubmit={(e) => {
        e.preventDefault();
        const next = name.trim();
        if (!next || busy) return;
        setBusy(true);
        void onCreate(next).finally(() => setBusy(false));
      }}
    >
      <input
        autoFocus
        value={name}
        maxLength={maxLength}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none dark:text-slate-100"
      />
      <button
        type="submit"
        disabled={busy}
        className="text-sm font-semibold text-brand-700 disabled:opacity-60 dark:text-brand-300"
      >
        {busy ? 'Creating…' : 'Create'}
      </button>
      {error ? (
        <p role="alert" className="w-full text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </form>
  );
}
