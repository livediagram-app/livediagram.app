import { useState } from 'react';
import { Button } from '@liveplanner/ui';
import type { ImportOutcome } from '@/lib/import-tab';

type DoneOutcome = Extract<ImportOutcome, { status: 'done' }>;

// The paste-or-file view of the Import dialog. A textarea to paste the
// content, an Import button, and a "pick a file instead" escape hatch. The
// parent supplies the placeholder example and the two runners (text vs file).
// Owns its own text / busy / error so the dialog stays simple.
export function TextImportPanel({
  placeholder,
  initialText = '',
  onImportText,
  onImportFile,
  onDone,
}: {
  placeholder: string;
  // Text already in hand (a file dropped on the Import dialog), shown in the box to import with a press.
  initialText?: string;
  onImportText: (text: string) => Promise<ImportOutcome>;
  onImportFile: () => Promise<ImportOutcome>;
  onDone: (outcome: DoneOutcome) => void;
}) {
  const [text, setText] = useState(initialText);
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
      onDone(outcome);
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
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button
          variant="none"
          onClick={() => void run(onImportFile)}
          busy={busy}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition enabled:hover:border-brand-300 enabled:hover:bg-brand-50/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:enabled:hover:border-brand-500/60"
        >
          Import a file instead
        </Button>
        <Button
          variant="primary"
          size="md"
          // Wide enough for "Importing…", so the label swap moves nothing.
          className="min-w-[7.5rem]"
          onClick={() => void run(() => onImportText(text))}
          disabled={text.trim().length === 0}
          busy={busy}
        >
          {busy ? 'Importing…' : 'Import'}
        </Button>
      </div>
    </div>
  );
}
