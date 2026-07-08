import { useState } from 'react';
import type { ImportOutcome } from '@/lib/import-tab';

// The paste-or-file sub-view for a text import format (spec/27 + spec/73).
// A textarea to paste/write the content, an Import button, and a "pick a
// file instead" escape hatch. Format-agnostic — the parent supplies the
// placeholder example and the two runners (text vs file). Owns its own
// text / busy / error so the format grid stays simple. Shared by JSON,
// Mermaid, and Markdown.
export function TextImportPanel({
  placeholder,
  onImportText,
  onImportFile,
  onDone,
  onBack,
}: {
  placeholder: string;
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
        placeholder={placeholder}
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
