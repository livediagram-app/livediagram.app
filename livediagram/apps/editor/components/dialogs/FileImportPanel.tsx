import { useState, type ReactNode } from 'react';
import { Button, BackBar } from '@livediagram/ui';
import type { ImportOutcome } from '@/lib/import-tab';
import type { ImportImageProgress } from '@/lib/import-images';
import { ImportDropZone } from './ImportDropZone';

type DoneOutcome = Extract<ImportOutcome, { status: 'done' }>;
type ProgressListener = (progress: ImportImageProgress) => void;

const ONE_FILE = 'Drop one file at a time.';

// The panel of a format that is a binary file, so there is nothing to paste (docs/specs/020-import-export/
// visio-import.md "UI"): the shared drop target, which opens the picker when pressed and takes a dropped file, a
// line saying where the file comes from, the format's help link and Choose a File. Owns its busy, error and image
// progress as the text panel does, and lays out the same, so moving between formats moves nothing.
export function FileImportPanel({
  formatTitle,
  dropLabel,
  hint,
  note,
  onImportFile,
  onDone,
  onBack,
}: {
  formatTitle: string;
  dropLabel: string;
  hint: string;
  note?: ReactNode;
  // Opens the picker, or imports the dropped file when one is given.
  onImportFile: (onProgress: ProgressListener, dropped?: File) => Promise<ImportOutcome>;
  onDone: (outcome: DoneOutcome) => void;
  // Absent when the dialog offers this one format: there is no list to go back to.
  onBack?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportImageProgress | null>(null);

  const run = async (dropped?: File) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setProgress(null);
    // A runner that throws must still hand the panel back, as the text panel's does.
    const outcome = await onImportFile(setProgress, dropped).catch((): ImportOutcome => ({
      status: 'error',
      error: "Couldn't import that. Check the file and try again.",
    }));
    setProgress(null);
    if (outcome.status === 'done') {
      onDone(outcome);
    } else {
      if (outcome.status === 'error') setError(outcome.error);
      setBusy(false);
    }
  };

  const onDrop = (data: DataTransfer) => {
    if (busy) return;
    const files = [...data.files];
    if (files.length !== 1) {
      setError(files.length === 0 ? null : ONE_FILE);
      return;
    }
    void run(files[0]);
  };

  return (
    <div>
      {onBack ? (
        <BackBar label="All formats" current={formatTitle} onClick={onBack} disabled={busy} />
      ) : null}
      <ImportDropZone
        label={dropLabel}
        onChoose={() => void run()}
        onDropData={onDrop}
        {...(error ? { error } : {})}
      />
      <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{hint}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div aria-live="polite" className="min-w-0">
          {busy && progress && progress.total > 0 ? (
            <p className="text-xs text-slate-600 tabular-nums dark:text-slate-300">
              Importing images {progress.done} of {progress.total}…
            </p>
          ) : (
            note
          )}
        </div>
        <Button
          variant="primary"
          size="md"
          // Wide enough for "Importing…", so the label swap moves nothing.
          className="min-w-[7.5rem]"
          onClick={() => void run()}
          busy={busy}
        >
          {busy ? 'Importing…' : 'Choose a File'}
        </Button>
      </div>
    </div>
  );
}
