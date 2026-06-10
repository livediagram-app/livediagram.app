import { useState } from 'react';
import { CloseIcon } from './CloseIcon';
import { useEscape } from '@/hooks/useEscape';
import type { ImportOutcome } from '@/lib/import-tab';

type Format = 'json' | 'markdown';

type ImportTabDialogProps = {
  // The active tab's name — shown in the warning so it's clear which
  // tab is about to be overwritten.
  tabName: string;
  // Runs the import for the chosen format: opens the file picker,
  // parses, and replaces the active tab. Returns an outcome so this
  // dialog can close / stay open / show an error without throwing.
  onImport: (format: Format) => Promise<ImportOutcome>;
  onClose: () => void;
};

// Counterpart to ExportTabDialog: pick a format to import a file INTO
// the current tab. Importing REPLACES the tab's contents (spec/27), so
// the dialog leads with a warning before the format cards. Errors render
// inline; on success the dialog closes and the canvas shows the result.
export function ImportTabDialog({ tabName, onImport, onClose }: ImportTabDialogProps) {
  const [busyFormat, setBusyFormat] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEscape(onClose);

  const handle = async (format: Format) => {
    if (busyFormat) return;
    setBusyFormat(format);
    setError(null);
    const outcome = await onImport(format);
    if (outcome.status === 'done') {
      onClose();
    } else if (outcome.status === 'error') {
      setError(outcome.error);
      setBusyFormat(null);
    } else {
      // 'cancelled' — the file dialog was dismissed. Stay open, no error.
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
        aria-label="Import into tab"
        className="pointer-events-auto flex max-h-[90vh] w-[36rem] max-w-[92%] animate-fly-up-in flex-col rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pt-6 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Import to tab
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Pick a format to import a file into the current tab.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Destructive-action warning — this overwrites the tab. */}
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <span className="mt-0.5 shrink-0">
              <WarningIcon />
            </span>
            <span>
              This replaces everything on{' '}
              <strong className="font-semibold">{tabName || 'this tab'}</strong> with the imported
              content. Undo (⌘Z / Ctrl&#8209;Z) brings it back.
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ImportCard
              kind="json"
              title="livediagram file"
              description="A .json tab exported from livediagram. Restores its elements exactly."
              busy={busyFormat === 'json'}
              onClick={() => void handle('json')}
            />
            <ImportCard
              kind="markdown"
              title="Markdown"
              description="A .md outline (headings + lists), e.g. exported from XMind. Becomes a themed tree."
              busy={busyFormat === 'markdown'}
              onClick={() => void handle('markdown')}
            />
          </div>
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

function ImportCard({
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
          {busy ? 'Choose a file…' : description}
        </p>
      </div>
    </button>
  );
}

function FormatIcon({ kind }: { kind: Format }) {
  if (kind === 'markdown') {
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
  }
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

function WarningIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2.5 1.5 14h13L8 2.5Z" />
      <path d="M8 6.5v3.5" />
      <path d="M8 12h.01" />
    </svg>
  );
}
