import { useMemo, useState } from 'react';
import { BackBar } from '@/components/primitives/BackBar';
import { Button } from '@livediagram/ui';
import { ToggleSwitch } from '@/components/palette/palette-controls';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { track } from '@/lib/telemetry';

// The options-and-download second screen for an image export format
// (PNG / SVG / PDF). The isometric + background-pattern toggles used to sit
// permanently on the main export grid; they only affect image formats, so
// they now live here, behind the format card (spec/48), above a live preview
// of exactly what will be exported. Owns the two toggle states and hands them
// to the parent's renderer on Download.
export function ImageExportPanel({
  label,
  busy,
  error,
  hasHiddenLayers,
  renderPreview,
  previewReady,
  onExport,
  onBack,
}: {
  // The picked format's display name, e.g. 'PNG'.
  label: string;
  busy: boolean;
  error: string | null;
  // True when the tab has at least one hidden layer (spec/74) — only then
  // does the include-hidden-layers toggle render at all.
  hasHiddenLayers: boolean;
  // Build the preview SVG markup for the given options (same content the
  // export produces). Called on each toggle change.
  renderPreview: (opts: { isometric: boolean; pattern: boolean; hiddenLayers: boolean }) => string;
  // False until the icon catalogues + image bitmaps have loaded, so the
  // preview doesn't flash placeholder glyphs first.
  previewReady: boolean;
  // Render + download the image with the chosen options. The parent owns the
  // rasteriser + telemetry; this panel just collects the options.
  onExport: (opts: { isometric: boolean; pattern: boolean; hiddenLayers: boolean }) => void;
  onBack: () => void;
}) {
  // Isometric export (spec/45 / 48): tilt the rendered image into the editor's
  // isometric projection. Off by default — the standard export is flat top-down.
  const [isometric, setIsometric] = useState(false);
  // Backdrop pattern (spec/48): paint the tab's grid / dots / … pattern. On by
  // default so the export matches the canvas; switch off for a clean backdrop.
  const [pattern, setPattern] = useState(true);
  // Hidden layers (spec/74): include layers the user has hidden. Off by
  // default — what you see is what you export.
  const [hiddenLayers, setHiddenLayers] = useState(false);

  // Rebuild the preview only when an option or the loaded assets change.
  const previewSvg = useMemo(
    () => (previewReady ? renderPreview({ isometric, pattern, hiddenLayers }) : ''),
    [previewReady, renderPreview, isometric, pattern, hiddenLayers],
  );

  return (
    <div>
      {/* The shared two-level "back to the overview" bar (spec/56 house
          style), the same control the New Diagram wizard's location step
          uses — not a small text link buried in the footer beside the
          commit button, where the way back sat next to the way forward. */}
      <BackBar label="All formats" current={label} onClick={onBack} disabled={busy} />
      {/* Live preview — exactly what Download produces under the current
          options. The injected SVG is our own export output (no external
          content); CSS fits it inside the frame. */}
      <div className="mb-4 flex h-48 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
        {previewSvg ? (
          <div
            className="flex max-h-full max-w-full items-center justify-center [&>svg]:max-h-[176px] [&>svg]:w-auto [&>svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: previewSvg }}
          />
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">Preparing preview…</span>
        )}
      </div>
      {/* Isometric toggle. The help `?` sits beside the LABEL, not at the
          row's end: trailing it after the switch pushed this row's toggle
          out of line with the one below, and a `?` at the edge reads as
          belonging to the panel rather than to this option. It used to be a
          "What's the isometric view?" line under the last toggle, a footnote
          to the whole panel with nothing tying it to the one option it
          answers for.

          A link cannot nest inside a button, so the row's hit target is an
          overlay button behind the content (the card stays one click target,
          as every settings row in the editor is) and the content sits above
          it, click-through except for the `?` itself. */}
      <div className="relative flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10">
        <button
          type="button"
          onClick={() => {
            // Fire before the flip so an opt-out still reaches the wire.
            track('UI', 'Toggled', 'IsometricExport');
            setIsometric((v) => !v);
          }}
          aria-pressed={isometric}
          // The label lives outside this button (so the `?` can sit in it),
          // so the button names itself.
          aria-label="Isometric view"
          className="absolute inset-0 cursor-pointer rounded-lg"
        />
        <span className="pointer-events-none relative flex flex-col">
          <span className="flex items-center gap-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
            Isometric view
            <HelpArticleLink article="isometricMode" className="pointer-events-auto" />
          </span>
          <span className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            Tilt the export into the isometric projection.
          </span>
        </span>
        <span className="pointer-events-none relative">
          <ToggleSwitch presentational checked={isometric} label="Export isometric view" />
        </span>
      </div>
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
      {/* Hidden-layers toggle (spec/74) — only offered when a layer is
          actually hidden, alongside the other image options. */}
      {hasHiddenLayers ? (
        <button
          type="button"
          onClick={() => {
            track('UI', 'Toggled', 'HiddenLayersExport');
            setHiddenLayers((v) => !v);
          }}
          aria-pressed={hiddenLayers}
          className="mt-2 flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10"
        >
          <span className="flex flex-col">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Hidden layers
            </span>
            <span className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              Include layers you've hidden in the Layers panel.
            </span>
          </span>
          <ToggleSwitch presentational checked={hiddenLayers} label="Export hidden layers" />
        </button>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex items-center justify-end gap-3">
        <Button
          variant="primary"
          size="md"
          onClick={() => onExport({ isometric, pattern, hiddenLayers })}
          disabled={busy}
        >
          {busy ? 'Exporting…' : `Download ${label}`}
        </Button>
      </div>
    </div>
  );
}
