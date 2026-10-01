import { useState, type DragEvent } from 'react';
import { BackBar } from '@/components/primitives/BackBar';
import { Button } from '@livediagram/ui';
import { pickExport, readDrop } from '@/lib/pick-folder';
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
        <ListStep
          state={state}
          onToggle={flow.toggle}
          onToggleAll={flow.toggleAll}
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
  const [over, setOver] = useState(false);
  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    onPicked(await readDrop(e.dataTransfer));
  };
  return (
    <>
      <p className="mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        Pick a Microsoft Whiteboard board export: a board folder, a folder of boards, or their .zip.
        Each board becomes a new whiteboard tab; nothing on this tab changes.
      </p>
      <button
        type="button"
        onClick={async () => onPicked(await pickExport('folder'))}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => void onDrop(e)}
        className={`flex h-32 w-full items-center justify-center rounded-lg border-2 border-dashed text-sm text-slate-600 transition focus:ring-2 focus:ring-brand-300 focus:outline-none dark:text-slate-300 ${over ? 'border-brand-400 bg-brand-50/50 dark:bg-brand-500/10' : 'border-slate-300 dark:border-slate-600'}`}
      >
        Drop a board folder or .zip here, or choose a folder
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

function ListStep({
  state,
  onToggle,
  onToggleAll,
  onImport,
  onCancel,
}: {
  state: Extract<MsWhiteboardStep, { step: 'list' }>;
  onToggle: (dir: string) => void;
  onToggleAll: () => void;
  onImport: () => void;
  onCancel: () => void;
}) {
  const count = state.checked.size;
  const all = count === state.boards.length;
  return (
    <>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Boards to import
        </legend>
        <label className="mb-1 flex items-center gap-2 px-2 text-xs text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={all}
            ref={(el) => {
              if (el) el.indeterminate = count > 0 && !all;
            }}
            onChange={onToggleAll}
          />
          Select all
        </label>
        <ul className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
          {state.boards.map((b) => (
            <li key={b.dir}>
              <label className="flex cursor-pointer items-start gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={state.checked.has(b.dir)}
                  onChange={() => onToggle(b.dir)}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-800 dark:text-slate-100">
                    {b.name}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {[
                      b.dates.modifiedAt
                        ? `Edited ${DATE.format(new Date(b.dates.modifiedAt))}`
                        : null,
                      plural(b.elementCount, 'item', 'items'),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {state.failures.length > 0 ? (
        <p role="alert" className="mt-3 text-xs text-rose-700 dark:text-rose-300">
          {plural(state.failures.length, "board couldn't be read", "boards couldn't be read")} and
          will be left out.
        </p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="md" onClick={onCancel}>
          Back
        </Button>
        <Button variant="primary" size="md" onClick={onImport} disabled={count === 0}>
          {`Import ${plural(count, 'board', 'boards')}`}
        </Button>
      </div>
    </>
  );
}
