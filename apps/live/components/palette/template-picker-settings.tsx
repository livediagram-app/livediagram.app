'use client';

import { ToggleSwitch } from '@/components/palette/palette-controls';

// The New Diagram wizard's third step (spec/76): name the diagram, choose where
// it lives (a personal folder or a team library), and whether it's saved
// offline. Presentational — all state lives in TemplatePicker.

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

      {/* Placement: personal folder or team library. Disabled once offline
          (an offline diagram has no server folder / team). */}
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Save in</span>
        <div className="relative">
          <select
            value={offline ? 'unsorted' : placement}
            disabled={offline}
            onChange={(e) => onPlacement(e.target.value)}
            className="w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-brand-500 dark:focus:ring-brand-500/20"
          >
            <option value="unsorted">My diagrams (Unsorted)</option>
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
        {offline ? (
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Offline diagrams stay on this device, so folders and teams do not apply.
          </span>
        ) : null}
      </label>

      {/* Offline toggle (spec/76): an iOS-style switch, not a checkbox. */}
      <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/40">
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
            Save Offline, This Browser Only
          </span>
          <span className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            When enabled your diagram is not auto saved to our servers.
          </span>
        </span>
        <ToggleSwitch
          checked={offline}
          onChange={() => onOffline(!offline)}
          label="Save offline, this browser only"
        />
      </div>
    </div>
  );
}
