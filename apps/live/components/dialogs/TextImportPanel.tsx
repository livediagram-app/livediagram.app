import { useState, type ReactNode } from 'react';
import { BackBar } from '@/components/primitives/BackBar';
import { Button } from '@livediagram/ui';
import type { ImportOutcome } from '@/lib/import-tab';

// The paste-or-file sub-view for a text import format (docs/specs/020-import-export/markdown-import.md + docs/specs/020-import-export/mermaid.md).
// A textarea to paste/write the content, an Import button, and a "pick a
// file instead" escape hatch. Format-agnostic — the parent supplies the
// placeholder example and the two runners (text vs file). Owns its own
// text / busy / error so the format grid stays simple. Shared by JSON,
// Mermaid, and Markdown.
export function TextImportPanel({
  formatTitle,
  placeholder,
  note,
  onImportText,
  onImportFile,
  onDone,
  onBack,
}: {
  // The chosen format's name, shown as the bar's chip so the step says
  // which format is being pasted.
  formatTitle: string;
  placeholder: string;
  // Optional footnote for this format (a help link). It rides in the footer's
  // left slot, level with the action buttons — the conventional spot for a
  // dialog's help link, and the slot the old "← Back" link vacated when the
  // way back became the BackBar above. Left to hang under the footer instead,
  // it read as a stray line that had fallen off the dialog.
  note?: ReactNode;
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
    // A runner that throws must still hand the panel back: an uncaught
    // rejection here left `busy` set, every control disabled, and no message.
    const outcome = await runner().catch((): ImportOutcome => ({
      status: 'error',
      error: "Couldn't import that. Check the file and try again.",
    }));
    if (outcome.status === 'done') {
      onDone();
    } else {
      if (outcome.status === 'error') setError(outcome.error);
      setBusy(false);
    }
  };

  return (
    <div>
      {/* The shared two-level "back to the overview" bar (docs/specs/018-help/contextual-help-links.md house
          style), the same control the New Diagram wizard's location step
          uses — not a small text link buried in the footer beside the
          commit button, where the way back sat next to the way forward. */}
      <BackBar label="All formats" current={formatTitle} onClick={onBack} disabled={busy} />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        placeholder={placeholder}
        className="h-56 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:ring-brand-500/30"
      />
      {error ? (
        <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex items-center justify-between gap-3">
        {note ?? <span />}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void run(onImportFile)}
            disabled={busy}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition enabled:hover:border-brand-300 enabled:hover:bg-brand-50/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:enabled:hover:border-brand-500/60"
          >
            Import a file instead
          </button>
          <Button
            variant="primary"
            size="md"
            onClick={() => void run(() => onImportText(text))}
            disabled={busy || text.trim().length === 0}
          >
            {busy ? 'Importing…' : 'Import'}
          </Button>
        </div>
      </div>
    </div>
  );
}
