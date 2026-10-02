import { useRef, useState } from 'react';
import { Button } from '@livediagram/ui';
import { ImportDropZone } from './ImportDropZone';
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
  const input = useRef<HTMLInputElement>(null);
  const choose = () => input.current?.click();
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
      <ImportDropZone
        label="Drop .excalidraw files here, or choose files"
        onChoose={choose}
        onDropData={(data) => onPicked([...data.files])}
        {...(error ? { error } : {})}
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="primary" size="md" onClick={choose}>
          Choose files
        </Button>
      </div>
    </>
  );
}
