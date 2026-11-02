import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { BackBar, Button, Glyph } from '@livedocuments/ui';
import type { ImportOutcome } from '@/lib/import-tab';
import type { FileImportFormat, FileImportStage } from '@/hooks/persistence/useTabImport';

type DoneOutcome = Extract<ImportOutcome, { status: 'done' }>;

// What each file format's panel says (docs/specs/020-import-export/office-import.md "How it's triggered").
const COPY: Record<
  FileImportFormat,
  { drop: string; touch: string; reading: string; accept: string; google: string; title: string }
> = {
  word: {
    title: 'Word',
    drop: 'Drop a Word document here',
    touch: 'Choose a Word document',
    reading: 'Reading the document…',
    accept:
      '.docx,.docm,.dotx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    google: 'From Google Docs: File › Download › Microsoft Word',
  },
  powerpoint: {
    title: 'PowerPoint',
    drop: 'Drop a PowerPoint deck here',
    touch: 'Choose a PowerPoint deck',
    reading: 'Reading the deck…',
    accept:
      '.pptx,.pptm,.ppsx,.potx,application/vnd.openxmlformats-officedocument.presentationml.presentation',
    google: 'From Google Slides: File › Download › Microsoft PowerPoint',
  },
};

/** The stage line while an import runs. */
export function stageLine(format: FileImportFormat, stage: FileImportStage | null): string {
  if (stage?.stage === 'images' && stage.total > 0) {
    return `Saving images (${Math.min(stage.done + 1, stage.total)} of ${stage.total})…`;
  }
  return COPY[format].reading;
}

// The file sub-view for a Word or PowerPoint import: a drop area naming the format, Choose a File under it, the
// Google route beside the help link, the stage while it runs and the error if it fails. Owns its own busy / stage /
// error, as the text panel does.
export function FileImportPanel({
  format,
  note,
  onImportFile,
  onDone,
  onBack,
}: {
  format: FileImportFormat;
  // The help link, in the footer's right slot.
  note?: ReactNode;
  onImportFile: (file: File, onStage: (stage: FileImportStage) => void) => Promise<ImportOutcome>;
  onDone: (outcome: DoneOutcome) => void;
  // Absent when the dialog offers this one format.
  onBack?: () => void;
}) {
  const copy = COPY[format];
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<FileImportStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const run = async (file: File) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setStage(null);
    const outcome = await onImportFile(file, setStage).catch((): ImportOutcome => ({
      status: 'error',
      error: "Couldn't import that. Check the file and try again.",
    }));
    if (outcome.status === 'done') {
      onDone(outcome);
      return;
    }
    if (outcome.status === 'error') setError(outcome.error);
    setBusy(false);
    setStage(null);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void run(file);
  };

  return (
    <div>
      {onBack ? (
        <BackBar label="All formats" current={copy.title} onClick={onBack} disabled={busy} />
      ) : null}
      <div
        role="region"
        aria-label={copy.drop}
        aria-busy={busy}
        data-testid="file-import-drop"
        data-over={over || undefined}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setOver(true);
        }}
        // Moving over the area's own children fires a leave too: only leaving the area itself turns the light off.
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
        }}
        onDrop={busy ? (e) => e.preventDefault() : onDrop}
        className={`flex min-h-[13rem] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          over
            ? 'border-brand-400 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/10'
            : 'border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/40'
        }`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          {busy ? <BigSpinner /> : <FormatGlyph format={format} />}
        </span>
        <div aria-live="polite">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {busy ? (
              stageLine(format, stage)
            ) : (
              <>
                {/* A touch screen has nothing to drag a file from: it names the choice instead. */}
                <span className="pointer-coarse:hidden">{copy.drop}</span>
                <span className="hidden pointer-coarse:inline">{copy.touch}</span>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            {busy ? (
              'This can take a moment for a large file.'
            ) : (
              <>
                <span className="pointer-coarse:hidden">or choose one from your computer</span>
                <span className="hidden pointer-coarse:inline">It is read on this device.</span>
              </>
            )}
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => input.current?.click()}
          busy={busy}
          className="mt-1"
        >
          Choose a File
        </Button>
        <input
          ref={input}
          type="file"
          accept={copy.accept}
          className="hidden"
          tabIndex={-1}
          aria-hidden
          data-testid="file-import-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // The same file chosen twice still fires a change.
            e.target.value = '';
            if (file) void run(file);
          }}
        />
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <span className="shrink-0 text-slate-400">
            <InfoGlyph />
          </span>
          <span>{copy.google}</span>
        </p>
        <div className="shrink-0">{note}</div>
      </div>
    </div>
  );
}

function FormatGlyph({ format }: { format: FileImportFormat }) {
  if (format === 'word') {
    return (
      <Glyph size={24} units={24}>
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v4h4" />
        <path d="M9 11h6M9 14h6M9 17h4" />
      </Glyph>
    );
  }
  return (
    <Glyph size={24} units={24}>
      <rect x="3" y="5" width="18" height="12" rx="1.5" />
      <path d="M12 17v3M8.5 20h7" />
      <path d="M7 9h6M7 12h4" />
    </Glyph>
  );
}

function BigSpinner() {
  return (
    <Glyph size={22} units={16} className="motion-safe:animate-spin" strokeLinejoin="miter">
      <circle cx="8" cy="8" r="6" strokeOpacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" />
    </Glyph>
  );
}

function InfoGlyph() {
  return (
    <Glyph size={14} units={16}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7.5V11" />
      <path d="M8 5h.01" />
    </Glyph>
  );
}
