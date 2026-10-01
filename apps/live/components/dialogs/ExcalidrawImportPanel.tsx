import { useRef, useState, type DragEvent } from 'react';
import { Button } from '@livediagram/ui';
import { ImportImageReport } from './ImportImageReport';
import type { ImportOutcome } from '@/lib/import-tab';
import type { ImportScenes } from '@/hooks/persistence/useMsWhiteboardImport';
import {
  useExcalidrawFileImport,
  type ExcalidrawImportStep,
} from '@/hooks/persistence/useExcalidrawFileImport';

type DoneOutcome = Extract<ImportOutcome, { status: 'done' }>;

// What the file input offers: saved scenes and exports that may embed one.
export const EXCALIDRAW_FILE_ACCEPT = '.excalidraw,.json,.png,.svg';

// The Explorer's Excalidraw import, whole (docs/specs/020-import-export/excalidraw-import-export.md
// "Import as new documents"): pick or drop files, watch them import, read the report. The host
// supplies the commit and what Done does.
export function ExcalidrawImportPanel({
  importScenes,
  onClose,
}: {
  importScenes: ImportScenes;
  onClose: () => void;
}) {
  const [done, setDone] = useState<DoneOutcome | null>(null);
  const flow = useExcalidrawFileImport({ importScenes, onDone: setDone });
  const { state } = flow;

  if (done) {
    return (
      <ImportImageReport
        report={done.images}
        scene={done.scene}
        failures={done.failures}
        documents={done.documents}
        onDone={onClose}
      />
    );
  }
  if (state.step !== 'pick') {
    return (
      <p
        role="status"
        className="py-10 text-center text-sm text-slate-600 tabular-nums dark:text-slate-300"
      >
        {progressText(state)}
      </p>
    );
  }
  return <PickStep error={state.error} onPicked={(files) => void flow.open(files)} />;
}

function progressText(state: ExcalidrawImportStep): string {
  if (state.step === 'reading') return 'Reading files…';
  if (state.step !== 'importing') return '';
  if (state.images && state.images.total > 0)
    return `Importing images ${state.images.done} of ${state.images.total}…`;
  return state.boards > 1
    ? `Importing board ${state.board} of ${state.boards}…`
    : 'Importing board…';
}

function PickStep({ error, onPicked }: { error?: string; onPicked: (files: File[]) => void }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const choose = () => input.current?.click();
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    onPicked([...e.dataTransfer.files]);
  };
  return (
    <>
      <p className="mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        Pick boards saved in Excalidraw (.excalidraw files), or PNG and SVG images exported with the
        scene embedded. Each file becomes its own document with one whiteboard tab, named and dated
        after the file.
      </p>
      <input
        ref={input}
        type="file"
        multiple
        accept={EXCALIDRAW_FILE_ACCEPT}
        className="hidden"
        data-testid="excalidraw-file-input"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          onPicked(files);
        }}
      />
      <button
        type="button"
        onClick={choose}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`flex h-32 w-full items-center justify-center rounded-lg border-2 border-dashed text-sm text-slate-600 transition focus:ring-2 focus:ring-brand-300 focus:outline-none dark:text-slate-300 ${over ? 'border-brand-400 bg-brand-50/50 dark:bg-brand-500/10' : 'border-slate-300 dark:border-slate-600'}`}
      >
        Drop .excalidraw files here, or choose files
      </button>
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="primary" size="md" onClick={choose}>
          Choose files
        </Button>
      </div>
    </>
  );
}
