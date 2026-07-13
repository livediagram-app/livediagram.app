'use client';

import { TextInput } from '@livediagram/ui';
import { ToggleSwitch } from '@/components/palette/palette-controls';
import { PlacementBrowser, type PickerFolder } from '@/components/placement/PlacementBrowser';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';

// The New Diagram wizard's third step (spec/76): name the diagram, choose where
// it lives, and whether it's saved offline. Placement is the shared
// PlacementBrowser (components/placement) — the same two-level space -> folder
// browse the move-to-folder dialog uses. Only the committed `placement` lives
// in TemplatePicker; the browser owns its own drill-down view state.

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
}) {
  const fieldLabel =
    'text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';
  return (
    <div className="flex flex-col gap-5">
      {/* Name */}
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Diagram name</span>
        <TextInput
          value={diagramName}
          placeholder={placeholder}
          onChange={(e) => onDiagramName(e.target.value)}
          // rounded-lg keeps the wizard's field shape; the rest converges
          // on the shared input treatment (focus ring included).
          className="rounded-lg dark:bg-slate-800"
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

      {/* Placement: the shared space -> folder browser. Collapses to a single
          static "My Work (Offline)" card while offline (an offline diagram
          has no server placement). */}
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
