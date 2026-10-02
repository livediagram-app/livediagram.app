import { useState } from 'react';
import { BackBar } from '@/components/primitives/BackBar';
import { Button } from '@livediagram/ui';
import { pickExport, readDrop } from '@/lib/pick-folder';
import { ImportChecklist } from './ImportChecklist';
import { ImportDropZone } from './ImportDropZone';
import { ImportImageReport } from './ImportImageReport';
import type { ImportOutcome } from '@/lib/import-tab';
import {
  useMsWhiteboardImport,
  type ImportScenes,
  type MsWhiteboardStep,
} from '@/hooks/persistence/useMsWhiteboardImport';

type DoneOutcome = Extract<ImportOutcome, { status: 'done' }>;

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;

// The Microsoft Whiteboard import, whole (docs/specs/020-import-export/whiteboard-import.md
// "Importing"): pick or drop a board export, choose boards, watch them import, read the report.
// Self-contained so any host can mount it: the host supplies the commit and what Done does, and
// optionally a way back (shown as the house back bar).
export function MsWhiteboardImportPanel({
  importScenes,
  onClose,
  onBack,
}: {
  importScenes: ImportScenes;
  onClose: () => void;
  onBack?: { label: string; onClick: () => void };
}) {
  const [done, setDone] = useState<DoneOutcome | null>(null);
  const flow = useMsWhiteboardImport({ importScenes, onDone: setDone });
  const { state } = flow;
  const busy = state.step === 'reading' || state.step === 'importing';

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
  return (
    <div>
      {onBack ? (
        <BackBar
          label={onBack.label}
          current="Microsoft Whiteboard"
          onClick={onBack.onClick}
          disabled={busy}
        />
      ) : null}
      {state.step === 'pick' ? (
        <PickStep error={state.error} onPicked={(p) => void flow.open(p)} />
      ) : state.step === 'list' ? (
        <ImportChecklist
          legend="Boards to import"
          rows={state.boards.map((b) => ({
            key: b.dir,
            name: b.name,
            detail: [
              b.dates.modifiedAt ? `Edited ${DATE.format(new Date(b.dates.modifiedAt))}` : null,
              plural(b.elementCount, 'item', 'items'),
            ]
              .filter(Boolean)
              .join(' · '),
          }))}
          checked={state.checked}
          onToggle={flow.toggle}
          onToggleAll={flow.toggleAll}
          {...(state.failures.length > 0
            ? {
                leftOut: `${plural(state.failures.length, "board couldn't be read", "boards couldn't be read")} and will be left out.`,
              }
            : {})}
          importLabel={`Import ${plural(state.checked.size, 'board', 'boards')}`}
          onImport={() => void flow.importChecked()}
          onCancel={flow.reset}
        />
      ) : (
        <p
          role="status"
          className="py-10 text-center text-sm text-slate-600 tabular-nums dark:text-slate-300"
        >
          {progressText(state)}
        </p>
      )}
    </div>
  );
}

function progressText(state: MsWhiteboardStep): string {
  if (state.step === 'reading') return 'Reading boards…';
  if (state.step !== 'importing') return '';
  if (state.images && state.images.total > 0)
    return `Importing images ${state.images.done} of ${state.images.total}…`;
  return state.boards > 1
    ? `Importing board ${state.board} of ${state.boards}…`
    : 'Importing board…';
}

function PickStep({
  error,
  onPicked,
}: {
  error?: string;
  onPicked: (picked: Awaited<ReturnType<typeof pickExport>>) => void;
}) {
  return (
    <>
      <p className="mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        Pick a Microsoft Whiteboard board export: a board folder, a folder of boards, or their .zip.
        Each board becomes its own document with one whiteboard tab, named and dated as the board;
        nothing here changes.
      </p>
      <ImportDropZone
        label="Drop a board folder or .zip here, or choose a folder"
        onChoose={async () => onPicked(await pickExport('folder'))}
        onDropData={async (data) => onPicked(await readDrop(data))}
        {...(error ? { error } : {})}
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="secondary"
          size="md"
          onClick={async () => onPicked(await pickExport('zip'))}
        >
          Choose a .zip
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={async () => onPicked(await pickExport('folder'))}
        >
          Choose a folder
        </Button>
      </div>
    </>
  );
}
