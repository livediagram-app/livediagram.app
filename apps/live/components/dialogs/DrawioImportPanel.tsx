import { useRef, useState } from 'react';
import { Button } from '@livediagram/ui';
import { pickExport, readDrop, type PickedExport } from '@/lib/pick-folder';
import type { ImportOutcome } from '@/lib/import-tab';
import {
  useDrawioFileImport,
  type DrawioImportStep,
  type ImportDrawioDocuments,
} from '@/hooks/persistence/useDrawioFileImport';
import { ImportChecklist } from './ImportChecklist';
import { ImportDropZone } from './ImportDropZone';
import { ImportImageReport } from './ImportImageReport';

type DoneOutcome = Extract<ImportOutcome, { status: 'done' }>;

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;

/** A folder pick or a drop as files, each named after its own path's last part. */
export function filesOfPick(picked: PickedExport | null): File[] {
  if (!picked) return [];
  if (picked.kind === 'zip') return [picked.file];
  return picked.files.map(({ path, file }) =>
    file instanceof File ? file : new File([file], path.split('/').pop() ?? path),
  );
}

// The Explorer's draw.io import, whole (docs/specs/020-import-export/drawio-import.md "Import as new
// documents"): pick or drop files or a folder, choose what to import, watch it import, read the
// report. The host supplies the commit and what Done does.
export function DrawioImportPanel({
  importDocuments,
  onClose,
}: {
  importDocuments: ImportDrawioDocuments;
  onClose: () => void;
}) {
  const [done, setDone] = useState<DoneOutcome | null>(null);
  const flow = useDrawioFileImport({ importDocuments, onDone: setDone });
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
  if (state.step === 'pick') {
    return <PickStep error={state.error} onPicked={(files) => void flow.open(files)} />;
  }
  if (state.step === 'list') {
    const count = state.checked.size;
    return (
      <ImportChecklist
        legend="Files to import"
        rows={state.rows}
        checked={state.checked}
        onToggle={flow.toggle}
        onToggleAll={flow.toggleAll}
        {...(state.failures.length > 0
          ? {
              leftOut: `${plural(state.failures.length, "file isn't", "files aren't")} draw.io's or couldn't be read, and will be left out.`,
            }
          : {})}
        importLabel={`Import ${plural(count, 'file', 'files')}`}
        onImport={() => void flow.importChecked()}
        onCancel={flow.reset}
      />
    );
  }
  return (
    <p
      role="status"
      className="py-10 text-center text-sm text-slate-600 tabular-nums dark:text-slate-300"
    >
      {progressText(state)}
    </p>
  );
}

function progressText(state: DrawioImportStep): string {
  if (state.step === 'reading') return 'Reading files…';
  if (state.step !== 'importing') return '';
  if (state.images && state.images.total > 0)
    return `Importing images ${state.images.done} of ${state.images.total}…`;
  return state.boards > 1 ? `Importing ${state.board} of ${state.boards}…` : 'Importing…';
}

function PickStep({ error, onPicked }: { error?: string; onPicked: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const choose = () => input.current?.click();
  return (
    <>
      <p className="mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        Pick draw.io files or a whole folder: .drawio files, files saved to Google Drive, PNG and
        SVG exports with the diagram inside, and JSON exports. Each diagram becomes its own
        document, its pages as tabs, named and dated after the file.
      </p>
      {/* No accept filter: a Google Drive save has no extension, so every file is read by its content. */}
      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        data-testid="drawio-file-input"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          onPicked(files);
        }}
      />
      <ImportDropZone
        label="Drop draw.io files or a folder here, or choose files"
        onChoose={choose}
        onDropData={async (data) => onPicked(filesOfPick(await readDrop(data)))}
        {...(error ? { error } : {})}
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="secondary"
          size="md"
          onClick={async () => onPicked(filesOfPick(await pickExport('folder')))}
        >
          Choose a folder
        </Button>
        <Button variant="primary" size="md" onClick={choose}>
          Choose files
        </Button>
      </div>
    </>
  );
}
