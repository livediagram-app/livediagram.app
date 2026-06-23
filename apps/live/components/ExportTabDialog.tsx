import { useState } from 'react';
import { CloseIcon } from './CloseIcon';
import { ToggleSwitch } from './palette-controls';
import { useEscape } from '@/hooks/ui/useEscape';
import type { Tab } from '@livediagram/diagram';
import {
  downloadBlob,
  exportTabAsJson,
  exportTabAsMarkdown,
  exportTabAsPdf,
  exportTabAsPng,
  exportTabAsSvg,
} from '@/lib/export-tab';
import { track } from '@/lib/telemetry';
import { HelpArticleLink } from './HelpArticleLink';

// Telemetry (spec/22): map the internal format key to the public label
// the dashboard shows. 'file' is the portable .json export.
const EXPORT_LABEL: Record<Format, string> = {
  markdown: 'Markdown',
  pdf: 'PDF',
  png: 'PNG',
  svg: 'SVG',
  file: 'JSON',
};

type ExportTabDialogProps = {
  tab: Tab;
  diagramName: string;
  onClose: () => void;
  // 'tab' (default) exports the whole active tab; 'selection' exports a
  // derived tab whose `elements` are just the multi-selection. The caller
  // does the element filtering and hands us the already-scoped `tab`; this
  // flag only drives the copy, filename suffix, and telemetry so the dialog
  // stays a dumb renderer over whatever Tab it's given.
  scope?: 'tab' | 'selection';
};

type Format = 'markdown' | 'pdf' | 'png' | 'svg' | 'file';

// Welcome-style overlay: four export options laid out as a card grid,
// matching the visual language of the TemplatePicker. One per format.
// Each card kicks off the matching helper from lib/export-tab and
// closes the dialog on success — the visible signal is the browser's
// own download notification, so the modal doesn't need to linger.
export function ExportTabDialog({
  tab,
  diagramName,
  onClose,
  scope = 'tab',
}: ExportTabDialogProps) {
  const [busyFormat, setBusyFormat] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Isometric export (spec/45 / 48): tilt the rendered image into the editor's
  // isometric projection. Off by default — the standard export is flat top-down.
  // Only affects the image formats (PNG / SVG / PDF); JSON / Markdown ignore it.
  const [isometric, setIsometric] = useState(false);
  // Backdrop pattern (spec/48): paint the tab's grid / dots / … pattern. On by
  // default so the export matches the canvas; switch off for a clean backdrop.
  const [pattern, setPattern] = useState(true);
  useEscape(onClose);

  const isSelection = scope === 'selection';
  const suffix = isSelection ? ' - selection' : '';
  const baseName = sanitizeFilename(`${diagramName || 'diagram'} - ${tab.name || 'tab'}${suffix}`);

  const handle = async (format: Format) => {
    if (busyFormat) return;
    setBusyFormat(format);
    setError(null);
    try {
      if (format === 'file') {
        downloadBlob(exportTabAsJson(tab), `${baseName}.livediagram-tab.json`);
      } else if (format === 'markdown') {
        downloadBlob(exportTabAsMarkdown(tab), `${baseName}.md`);
      } else if (format === 'png') {
        downloadBlob(await exportTabAsPng(tab, { isometric, pattern }), `${baseName}.png`);
      } else if (format === 'svg') {
        downloadBlob(exportTabAsSvg(tab, { isometric, pattern }), `${baseName}.svg`);
      } else if (format === 'pdf') {
        downloadBlob(await exportTabAsPdf(tab, { isometric, pattern }), `${baseName}.pdf`);
      }
      track('Diagram', 'Exported', EXPORT_LABEL[format]);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
      setBusyFormat(null);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-sm dark:bg-slate-950/60"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isSelection ? 'Export selection' : 'Export tab'}
        className="pointer-events-auto flex max-h-[90vh] w-[36rem] max-w-[92%] animate-fly-up-in flex-col rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pt-6 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {isSelection ? 'Export selection' : 'Export tab'}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {isSelection
                ? 'Pick a format to download the selected elements.'
                : 'Pick a format to download the current tab.'}
            </p>
            <div className="mt-1.5">
              <HelpArticleLink
                article="exportingDiagrams"
                variant="text"
                title="Exporting diagrams"
                description="What each export format is for and how to use it."
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <ExportCard
              kind="markdown"
              title="Markdown"
              description="A text outline of this tab's elements and connections, ready to paste into a doc."
              busy={busyFormat === 'markdown'}
              onClick={() => void handle('markdown')}
            />
            <ExportCard
              kind="pdf"
              title="PDF"
              description="A single-page PDF of this tab, ready to print or share."
              busy={busyFormat === 'pdf'}
              onClick={() => void handle('pdf')}
            />
            <ExportCard
              kind="png"
              title="PNG"
              description="A high-resolution image of this tab, for slides or screenshots."
              busy={busyFormat === 'png'}
              onClick={() => void handle('png')}
            />
            <ExportCard
              kind="svg"
              title="SVG"
              description="A scalable vector image of this tab, crisp at any size and editable in design tools."
              busy={busyFormat === 'svg'}
              onClick={() => void handle('svg')}
            />
            <ExportCard
              kind="file"
              title="File"
              description="A livediagram file. Drop it back into any diagram via Import to recreate this tab."
              busy={busyFormat === 'file'}
              onClick={() => void handle('file')}
            />
          </div>
          {/* Image-format option: an iOS-style toggle to tilt PNG / SVG / PDF
              into the isometric projection (spec/45 / 48). Off by default. */}
          <div className="mt-3 flex items-center gap-1.5">
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
                  Tilt the PNG / SVG / PDF into the isometric projection.
                </span>
              </span>
              <ToggleSwitch presentational checked={isometric} label="Export isometric view" />
            </button>
            <HelpArticleLink
              article="isometricMode"
              title="Isometric view"
              description="How the isometric projection works."
            />
          </div>
          {/* Image-format option: paint the tab's backdrop pattern (grid / dots
              / …). On by default so the export matches the canvas. */}
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
          {error ? (
            <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ExportCard({
  kind,
  title,
  description,
  busy,
  onClick,
}: {
  kind: Format;
  title: string;
  description: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex flex-col items-start gap-1.5 rounded-lg border border-slate-200 bg-white p-3 text-left transition enabled:hover:border-brand-300 enabled:hover:bg-brand-50/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:enabled:hover:border-brand-500/60 dark:enabled:hover:bg-brand-500/10"
    >
      <div className="flex h-12 w-full items-center justify-center rounded-md bg-slate-50 dark:bg-slate-200">
        <FormatIcon kind={kind} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {busy ? 'Exporting…' : description}
        </p>
      </div>
    </button>
  );
}

function FormatIcon({ kind }: { kind: Format }) {
  switch (kind) {
    case 'markdown':
      return (
        <svg width="32" height="20" viewBox="0 0 32 20" aria-hidden>
          <rect
            x="1"
            y="1"
            width="30"
            height="18"
            rx="2"
            fill="none"
            stroke="rgb(148 163 184)"
            strokeWidth="1.25"
          />
          <text
            x="16"
            y="14"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
            fontSize="9"
            fontWeight="600"
            fill="rgb(71 85 105)"
          >
            md
          </text>
        </svg>
      );
    case 'pdf':
      return (
        <svg width="22" height="28" viewBox="0 0 22 28" aria-hidden>
          <path
            d="M3 1h11l5 5v20a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"
            fill="rgb(254 226 226)"
            stroke="rgb(248 113 113)"
            strokeWidth="1.25"
          />
          <text
            x="11"
            y="20"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
            fontSize="7"
            fontWeight="700"
            fill="rgb(190 18 60)"
          >
            PDF
          </text>
        </svg>
      );
    case 'png':
      return (
        <svg width="32" height="22" viewBox="0 0 32 22" aria-hidden>
          <rect
            x="1"
            y="1"
            width="30"
            height="20"
            rx="2"
            fill="rgb(219 234 254)"
            stroke="rgb(147 197 253)"
            strokeWidth="1.25"
          />
          <circle cx="9" cy="9" r="2.5" fill="rgb(251 191 36)" />
          <path d="M2 18l8-8 6 6 4-4 10 8" stroke="rgb(59 130 246)" strokeWidth="1.5" fill="none" />
        </svg>
      );
    case 'svg':
      return (
        <svg width="32" height="22" viewBox="0 0 32 22" aria-hidden>
          <rect
            x="1"
            y="1"
            width="30"
            height="20"
            rx="2"
            fill="rgb(220 252 231)"
            stroke="rgb(134 239 172)"
            strokeWidth="1.25"
          />
          <text
            x="16"
            y="15"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
            fontSize="9"
            fontWeight="600"
            fill="rgb(21 128 61)"
          >
            SVG
          </text>
        </svg>
      );
    case 'file':
      return (
        <svg width="22" height="28" viewBox="0 0 22 28" aria-hidden>
          <path
            d="M3 1h11l5 5v20a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"
            fill="rgb(241 245 249)"
            stroke="rgb(148 163 184)"
            strokeWidth="1.25"
          />
          <path d="M14 1v6h5" fill="none" stroke="rgb(148 163 184)" strokeWidth="1.25" />
        </svg>
      );
  }
}

// Filesystem-safe filename: replace anything that isn't alphanumeric,
// dot, dash, underscore, or space with a dash. Collapses runs of
// dashes and trims trailing whitespace so the resulting name is OS-
// friendly across Windows / macOS / Linux.
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^A-Za-z0-9._\- ]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}
