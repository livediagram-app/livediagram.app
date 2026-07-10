'use client';

import { useState, type ReactNode } from 'react';
import { ToggleSwitch } from '@/components/palette/palette-controls';
import { BackBar } from '@/components/palette/ThemeCategoryBrowser';

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
  folders,
  teams,
  teamFolders = {},
  offline,
  onOffline,
}: {
  diagramName: string;
  onDiagramName: (v: string) => void;
  placeholder: string;
  // 'unsorted' | `folder:<id>` | `team:<teamId>` | `team:<teamId>:folder:<id>`
  placement: string;
  onPlacement: (v: string) => void;
  folders: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  // Per-team folder lists (flattened), keyed by team id. Empty / missing while
  // the team libraries are still loading.
  teamFolders?: Record<string, { id: string; name: string }[]>;
  offline: boolean;
  onOffline: (v: boolean) => void;
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
            account later.
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
            folders={folders}
            teams={teams}
            teamFolders={teamFolders}
          />
        )}
      </div>
    </div>
  );
}

// The two-level space -> folder browser. `space` is view state: null shows
// the space overview (only reachable when teams exist), 'my-work' the
// personal folders, a team id that team's folders.
function PlacementBrowser({
  placement,
  onPlacement,
  folders,
  teams,
  teamFolders,
}: {
  placement: string;
  onPlacement: (v: string) => void;
  folders: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  teamFolders: Record<string, { id: string; name: string }[]>;
}) {
  const hasTeams = teams.length > 0;
  // With teams, open on the overview so the space choice comes first; the
  // team-less path goes straight to My Work and never shows a BackBar.
  const [space, setSpace] = useState<string | null>(hasTeams ? null : 'my-work');
  const placementSpace = placement.startsWith('team:') ? placement.split(':')[1] : 'my-work';

  if (hasTeams && space === null) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <PlacementCard
          label="My Work"
          sub="Your folders"
          icon={<MyWorkIcon />}
          selected={placementSpace === 'my-work'}
          onSelect={() => setSpace('my-work')}
        />
        {teams.map((t) => (
          <PlacementCard
            key={t.id}
            label={t.name}
            sub="Team"
            icon={<TeamPlaceIcon />}
            selected={placementSpace === t.id}
            onSelect={() => setSpace(t.id)}
          />
        ))}
      </div>
    );
  }

  if (space === 'my-work' || !hasTeams) {
    return (
      <div className="flex flex-col gap-2">
        {hasTeams ? (
          <BackBar label="All spaces" current="My Work" onClick={() => setSpace(null)} />
        ) : null}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          <PlacementCard
            label="My Work"
            sub="Unsorted"
            icon={<MyWorkIcon />}
            selected={placement === 'unsorted'}
            onSelect={() => onPlacement('unsorted')}
          />
          {folders.map((f) => (
            <PlacementCard
              key={f.id}
              label={f.name}
              sub="Folder"
              icon={<FolderPlaceIcon />}
              selected={placement === `folder:${f.id}`}
              onSelect={() => onPlacement(`folder:${f.id}`)}
            />
          ))}
        </div>
      </div>
    );
  }

  // space is a team id on this branch (null and 'my-work' returned above).
  const teamId = space as string;
  const team = teams.find((t) => t.id === teamId);
  const inTeamFolders = teamFolders[teamId] ?? [];
  return (
    <div className="flex flex-col gap-2">
      <BackBar label="All spaces" current={team?.name ?? 'Team'} onClick={() => setSpace(null)} />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <PlacementCard
          label="Team Library"
          sub={team?.name ?? 'Team'}
          icon={<TeamPlaceIcon />}
          selected={placement === `team:${teamId}`}
          onSelect={() => onPlacement(`team:${teamId}`)}
        />
        {inTeamFolders.map((f) => (
          <PlacementCard
            key={f.id}
            label={f.name}
            sub="Folder"
            icon={<FolderPlaceIcon />}
            selected={placement === `team:${teamId}:folder:${f.id}`}
            onSelect={() => onPlacement(`team:${teamId}:folder:${f.id}`)}
          />
        ))}
      </div>
    </div>
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
}: {
  label: string;
  sub: string;
  icon: ReactNode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
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
