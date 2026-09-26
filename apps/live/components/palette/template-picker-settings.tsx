'use client';

import { NAME_MAX_LENGTH } from '@livediagram/diagram';
import { TextInput } from '@livediagram/ui';
import { PlacementBrowser, type PickerFolder } from '@/components/placement/PlacementBrowser';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { isOfflineLocation, saveLocationLabel, type SaveLocationId } from '@/lib/save-locations';
import { SaveLocationPicker } from './SaveLocationPicker';

// The New Diagram wizard's third step (docs/specs/006-diagram/offline-mode.md, docs/specs/006-diagram/save-locations.md): name the diagram,
// choose its save location (livediagram or Local Browser), and where in that
// location it lives. Placement is the shared
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
  onCreateTeam,
  saveLocation,
  onSaveLocation,
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
  // Inline team creation (the overview's "New Team" tile). Absent = hidden.
  onCreateTeam?: (name: string) => Promise<{ id: string; name: string } | null>;
  saveLocation: SaveLocationId;
  onSaveLocation: (v: SaveLocationId) => void;
}) {
  // Local Browser is Offline Mode (docs/specs/006-diagram/offline-mode.md): it drives the warning below and
  // removes the folder step (an offline diagram has no server folder / team).
  const offline = isOfflineLocation(saveLocation);
  const folderHeading = `Choose ${saveLocationLabel(saveLocation)} Folder`;
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
          // Capped (docs/specs/006-diagram/name-length.md), same as every other name field.
          maxLength={NAME_MAX_LENGTH}
          onChange={(e) => onDiagramName(e.target.value)}
          // rounded-lg keeps the wizard's field shape; the rest converges
          // on the shared input treatment (focus ring included).
          className="rounded-lg dark:bg-slate-800"
        />
      </label>

      {/* Save location (docs/specs/006-diagram/save-locations.md): a tile row, not a toggle, so a third store
          can join without reshaping the step. Sits above Save In because the
          location decides whether placement applies at all. */}
      <div className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Save location</span>
        <SaveLocationPicker value={saveLocation} onChange={onSaveLocation} />
      </div>

      {/* Data-loss warning (docs/specs/006-diagram/offline-mode.md). Offline diagrams live only in this
          browser's storage, so anything that wipes it takes the diagram with
          it. Only shown while Local Browser is chosen, so the risk is surfaced
          exactly when it applies. */}
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
              className="!text-amber-800 underline hover:!text-amber-900 dark:!text-amber-200 dark:hover:!text-amber-100"
            />
          </span>
        </div>
      ) : null}

      {/* Placement: the shared space -> folder browser, as list rows so it
          doesn't read as a twin of the tile row above, headed by the chosen
          location ("Choose livediagram Folder"). Absent entirely for Local
          Browser: an offline diagram has no server placement, so there is
          nothing to choose. */}
      {offline ? null : (
        <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={folderHeading}>
          <span className={fieldLabel}>{folderHeading}</span>
          <PlacementBrowser
            placement={placement}
            onPlacement={onPlacement}
            onCommitPlacement={onCommitPlacement}
            folders={folders}
            teams={teams}
            teamFolders={teamFolders}
            onCreateFolder={onCreateFolder}
            onCreateTeam={onCreateTeam}
            layout="list"
          />
        </div>
      )}
    </div>
  );
}
