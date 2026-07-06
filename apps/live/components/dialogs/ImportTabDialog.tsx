import { useState } from 'react';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import { Dialog } from '@/components/dialogs/Dialog';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import type { ImportOutcome } from '@/lib/import-tab';

type Format = 'json' | 'markdown' | 'mermaid';

type ImportTabDialogProps = {
  // The active tab's name — shown in the warning so it's clear which
  // tab is about to be overwritten.
  tabName: string;
  // Runs the import for the chosen format: opens the file picker,
  // parses, and replaces the active tab. Returns an outcome so this
  // dialog can close / stay open / show an error without throwing.
  onImport: (format: Format) => Promise<ImportOutcome>;
  // Imports pasted/written Mermaid text (the "Paste or write" path),
  // bypassing the file picker (spec/73).
  onImportMermaidText: (text: string) => Promise<ImportOutcome>;
  onClose: () => void;
};

// Counterpart to ExportTabDialog: pick a format to import a file INTO
// the current tab. Importing REPLACES the tab's contents (spec/27), so
// the dialog leads with a warning before the format cards. Mermaid adds
// a two-step flow (file or paste, spec/73); other formats stay one-click.
// Errors render inline; on success the dialog closes and the canvas shows
// the result.
export function ImportTabDialog({
  tabName,
  onImport,
  onImportMermaidText,
  onClose,
}: ImportTabDialogProps) {
  const [view, setView] = useState<'grid' | 'mermaid'>('grid');
  const [busyFormat, setBusyFormat] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <Dialog open onClose={onClose} ariaLabel="Import into tab" size="xl" className="max-h-[90vh]">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pt-6 pb-4 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Import to tab
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {view === 'mermaid'
              ? 'Import a Mermaid flowchart from a file, or paste one in.'
              : 'Pick a format to import a file into the current tab.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <HelpArticleLink
            article="importTabs"
            title="Importing tabs"
            description="What you can import and how it replaces the tab."
          />
          <DialogCloseButton onClick={onClose} />
        </div>
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
        {view === 'mermaid' ? (
          <MermaidImportPanel
            onImportText={onImportMermaidText}
            onImportFile={() => onImport('mermaid')}
            onDone={onClose}
            onBack={() => setView('grid')}
          />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <ImportCard
                kind="json"
                title="livediagram file"
                description="A .json tab exported from livediagram. Restores its elements exactly."
                busy={busyFormat === 'json'}
                busyLabel="Choose a file…"
                onClick={() => void handle('json')}
              />
              <ImportCard
                kind="mermaid"
                title="Mermaid"
                description="A flowchart in Mermaid text. Keeps every connection. Paste it or pick a file."
                busy={false}
                onClick={() => {
                  setError(null);
                  setView('mermaid');
                }}
              />
              <ImportCard
                kind="markdown"
                title="Markdown"
                description="A .md outline (headings + lists), e.g. exported from XMind. Becomes a themed tree."
                busy={busyFormat === 'markdown'}
                busyLabel="Choose a file…"
                onClick={() => void handle('markdown')}
              />
            </div>
            <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
              Importing a Markdown outline?{' '}
              <HelpArticleLink
                article="markdownImport"
                variant="text"
                label="See how it maps to a tree"
                title="Markdown import"
                description="How headings and lists become a themed tree diagram."
              />
            </p>
            {error ? (
              <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                {error}
              </p>
            ) : null}
          </>
        )}
      </div>
    </Dialog>
  );
}

// The Mermaid sub-view: a textarea to paste/write a flowchart, an Import
// button, and a "pick a file instead" escape hatch (spec/73). Owns its own
// text / busy / error so the grid stays simple.
function MermaidImportPanel({
  onImportText,
  onImportFile,
  onDone,
  onBack,
}: {
  onImportText: (text: string) => Promise<ImportOutcome>;
  onImportFile: () => Promise<ImportOutcome>;
  onDone: () => void;
  onBack: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (runner: () => Promise<ImportOutcome>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const outcome = await runner();
    if (outcome.status === 'done') {
      onDone();
    } else {
      if (outcome.status === 'error') setError(outcome.error);
      setBusy(false);
    }
  };

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        placeholder={'flowchart TD\n  A([Start]) --> B{OK?}\n  B -->|yes| C[Ship]\n  B -->|no| A'}
        className="h-56 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:ring-brand-500/30"
      />
      {error ? (
        <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void run(onImportFile)}
            disabled={busy}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition enabled:hover:border-brand-300 enabled:hover:bg-brand-50/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:enabled:hover:border-brand-500/60"
          >
            Import a file instead
          </button>
          <button
            type="button"
            onClick={() => void run(() => onImportText(text))}
            disabled={busy || text.trim().length === 0}
            className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition enabled:hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Importing…' : 'Import'}
          </button>
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
  busyLabel,
  onClick,
}: {
  kind: Format;
  title: string;
  description: string;
  busy: boolean;
  busyLabel?: string;
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
          {busy ? (busyLabel ?? 'Working…') : description}
        </p>
      </div>
    </button>
  );
}

function FormatIcon({ kind }: { kind: Format }) {
  if (kind === 'markdown' || kind === 'mermaid') {
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
          {kind === 'mermaid' ? 'mmd' : 'md'}
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
