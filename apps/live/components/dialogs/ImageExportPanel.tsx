import { useState } from 'react';
import { ToggleSwitch } from '@/components/palette/palette-controls';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { track } from '@/lib/telemetry';

// The options-and-download second screen for an image export format
// (PNG / SVG / PDF). The isometric + background-pattern toggles used to sit
// permanently on the main export grid; they only affect image formats, so
// they now live here, behind the format card (spec/48). Owns the two toggle
// states and hands them to the parent's renderer on Download.
export function ImageExportPanel({
  label,
  busy,
  error,
  onExport,
  onBack,
}: {
  // The picked format's display name, e.g. 'PNG'.
  label: string;
  busy: boolean;
  error: string | null;
  // Render + download the image with the chosen options. The parent owns the
  // rasteriser + telemetry; this panel just collects the two options.
  onExport: (opts: { isometric: boolean; pattern: boolean }) => void;
  onBack: () => void;
}) {
  // Isometric export (spec/45 / 48): tilt the rendered image into the editor's
  // isometric projection. Off by default — the standard export is flat top-down.
  const [isometric, setIsometric] = useState(false);
  // Backdrop pattern (spec/48): paint the tab's grid / dots / … pattern. On by
  // default so the export matches the canvas; switch off for a clean backdrop.
  const [pattern, setPattern] = useState(true);

  return (
    <div>
      {/* Isometric toggle. */}
      <button
        type="button"
        onClick={() => {
          // Fire before the flip so an opt-out still reaches the wire.
          track('UI', 'Toggled', 'IsometricExport');
          setIsometric((v) => !v);
        }}
        aria-pressed={isometric}
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10"
      >
        <span className="flex flex-col">
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Isometric view
          </span>
          <span className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            Tilt the export into the isometric projection.
          </span>
        </span>
        <ToggleSwitch presentational checked={isometric} label="Export isometric view" />
      </button>
      {/* Background-pattern toggle. */}
      <button
        type="button"
        onClick={() => {
          track('UI', 'Toggled', 'PatternExport');
          setPattern((v) => !v);
        }}
        aria-pressed={pattern}
        className="mt-2 flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10"
      >
        <span className="flex flex-col">
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Background pattern
          </span>
          <span className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            Paint the tab's grid / dots / texture behind the diagram.
          </span>
        </span>
        <ToggleSwitch presentational checked={pattern} label="Export background pattern" />
      </button>
      {/* Help link as a quiet footnote (same pattern as the import dialog),
          instead of a stray `?` circle crowding the toggle. */}
      <div className="mt-2.5">
        <HelpArticleLink
          article="isometricMode"
          variant="text"
          label="What's the isometric view?"
          title="Isometric view"
          description="How the isometric projection works."
        />
      </div>
      {error ? (
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="text-xs font-medium text-slate-500 transition hover:text-slate-700 disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-200"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => onExport({ isometric, pattern })}
          disabled={busy}
          className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition enabled:hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Exporting…' : `Download ${label}`}
        </button>
      </div>
    </div>
  );
}
