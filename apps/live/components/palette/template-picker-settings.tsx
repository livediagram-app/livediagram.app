'use client';

import { ToggleSwitch } from '@/components/palette/palette-controls';

// The New Diagram wizard's third step (spec/76): name the diagram, choose where
// it lives (a personal folder or a team library), and whether it's saved
// offline. Presentational: all state lives in TemplatePicker.

export function NewDiagramSettingsStep({
  diagramName,
  onDiagramName,
  placeholder,
  placement,
  onPlacement,
  folders,
  teams,
  offline,
  onOffline,
}: {
  diagramName: string;
  onDiagramName: (v: string) => void;
  placeholder: string;
  // 'unsorted' | `folder:<id>` | `team:<id>`
  placement: string;
  onPlacement: (v: string) => void;
  folders: { id: string; name: string }[];
  teams: { id: string; name: string }[];
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

      {/* Placement: personal folder or team library. Disabled once offline
          (an offline diagram has no server folder / team). */}
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Save in</span>
        <div className="relative">
          <select
            value={offline ? 'offline' : placement}
            disabled={offline}
            onChange={(e) => onPlacement(e.target.value)}
            className="w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-brand-500 dark:focus:ring-brand-500/20"
          >
            {offline ? (
              // Offline has no server placement, so show a single, self-explaining
              // option so "Save in" still reads sensibly while disabled.
              <option value="offline">My Work (Offline)</option>
            ) : (
              <>
                <option value="unsorted">My Work (Unsorted)</option>
                {folders.length > 0 ? (
                  <optgroup label="Folders">
                    {folders.map((f) => (
                      <option key={f.id} value={`folder:${f.id}`}>
                        {f.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {teams.length > 0 ? (
                  <optgroup label="Teams">
                    {teams.map((t) => (
                      <option key={t.id} value={`team:${t.id}`}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </>
            )}
          </select>
          <svg
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 4.5 6 7.5 9 4.5" />
          </svg>
        </div>
      </label>
    </div>
  );
}
