// The Explorer's draw.io import (docs/specs/020-import-export/drawio-import.md "Import as new
// documents"): read the picked files and folders by content, list what was found when there is
// more than one, make each ticked diagram its own document through the host's commit, and hand the
// report on with the files left out listed first.
import { useRef, useState } from 'react';
import type { ImportChecklistRow } from '@/components/dialogs/ImportChecklist';
import type { BoardImportProgress } from '@/hooks/persistence/useBoardSceneImport';
import type { DrawioFiles } from '@/lib/drawio/files';
import type { DrawioDocumentFile } from '@/lib/drawio/new-document';
import type { ImportOutcome } from '@/lib/import-tab';
import { toggled, toggledAll } from '@/lib/import-selection';
import { track } from '@/lib/telemetry';

export const DRAWIO_UNEXPECTED = "Couldn't import that. Check the files and try again.";
/** What a library file is told until shape libraries exist (docs/specs/013-workspace/shape-libraries.md). */
export const DRAWIO_LIBRARIES_SOON = 'Shape libraries are coming soon.';

/** The host's commit: each file its own new document. */
export type ImportDrawioDocuments = (
  files: DrawioDocumentFile[],
  onProgress?: (p: BoardImportProgress) => void,
) => Promise<ImportOutcome>;

type Failure = { title: string; message: string };

export type DrawioImportStep =
  | { step: 'pick'; error?: string }
  | { step: 'reading' }
  | {
      step: 'list';
      rows: ImportChecklistRow[];
      failures: Failure[];
      checked: ReadonlySet<string>;
    }
  | { step: 'importing'; board: number; boards: number; images?: { done: number; total: number } };

type DoneOutcome = Extract<ImportOutcome, { status: 'done' }>;

const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;

function rowsOf(read: DrawioFiles): ImportChecklistRow[] {
  return read.diagrams.map((d, i) => ({
    key: `diagram:${i}`,
    name: d.name,
    detail: [
      d.modifiedAt ? `Edited ${DATE.format(new Date(d.modifiedAt))}` : null,
      plural(d.pages.length, 'page', 'pages'),
    ]
      .filter(Boolean)
      .join(' · '),
  }));
}

// Everything left out: what could not be read, and each library (skipped until they exist).
function leftOutOf(read: DrawioFiles): Failure[] {
  return [
    ...read.failures,
    ...read.libraries.map((l) => ({ title: l.name, message: DRAWIO_LIBRARIES_SOON })),
  ];
}

export function useDrawioFileImport(deps: {
  importDocuments: ImportDrawioDocuments;
  onDone: (outcome: DoneOutcome) => void;
}) {
  const [state, setState] = useState<DrawioImportStep>({ step: 'pick' });
  const read = useRef<DrawioFiles | null>(null);

  const onProgress = (p: BoardImportProgress) =>
    setState({
      step: 'importing',
      board: p.board ?? 1,
      boards: p.boards ?? 1,
      ...(p.total > 0 ? { images: { done: p.done, total: p.total } } : {}),
    });

  const run = async (checked: ReadonlySet<string>) => {
    const files = read.current!;
    const diagrams = files.diagrams.filter((_, i) => checked.has(`diagram:${i}`));
    const failures = leftOutOf(files);
    let outcome: DoneOutcome = { status: 'done' };
    if (diagrams.length > 0) {
      setState({ step: 'importing', board: 1, boards: diagrams.length });
      const landed = await deps.importDocuments(diagrams, onProgress);
      if (landed.status !== 'done') {
        setState({
          step: 'pick',
          ...(landed.status === 'error' ? { error: landed.error } : {}),
        });
        return;
      }
      for (let i = 0; i < (landed.documents?.length ?? 0); i++) {
        track('Tab', 'Imported', 'Drawio');
      }
      outcome = landed;
    }
    const all = [...failures, ...(outcome.failures ?? [])];
    setState({ step: 'pick' });
    deps.onDone({ ...outcome, ...(all.length > 0 ? { failures: all } : {}) });
  };

  // Anything unexpected hands the panel back with a message, never a stuck spinner.
  const guarded = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      console.warn('[drawio-import] import failed', { error: String(error) });
      setState({ step: 'pick', error: DRAWIO_UNEXPECTED });
    }
  };

  /** Reads the picked files; a single readable file imports straight away. */
  const open = (files: readonly File[]) =>
    guarded(async () => {
      if (files.length === 0) return;
      setState({ step: 'reading' });
      const { readDrawioFiles } = await import('@/lib/drawio/files');
      const found = await readDrawioFiles(files);
      read.current = found;
      const rows = rowsOf(found);
      const leftOut = leftOutOf(found);
      if (rows.length === 0) {
        // Only libraries (with or without unreadable files): a report naming them, never an error.
        if (found.libraries.length > 0) {
          setState({ step: 'pick' });
          deps.onDone({ status: 'done', failures: leftOut });
          return;
        }
        setState({ step: 'pick', error: leftOut[0]?.message ?? DRAWIO_UNEXPECTED });
        return;
      }
      const all = new Set(rows.map((r) => r.key));
      if (rows.length === 1 && leftOut.length === 0) return run(all);
      setState({ step: 'list', rows, failures: leftOut, checked: all });
    });

  const toggle = (key: string) =>
    setState((s) => (s.step !== 'list' ? s : { ...s, checked: toggled(s.checked, key) }));

  const toggleAll = () =>
    setState((s) =>
      s.step !== 'list'
        ? s
        : {
            ...s,
            checked: toggledAll(
              s.checked,
              s.rows.map((r) => r.key),
            ),
          },
    );

  const importChecked = () =>
    guarded(async () => {
      if (state.step !== 'list') return;
      await run(state.checked);
    });

  const reset = () => setState({ step: 'pick' });

  return { state, open, toggle, toggleAll, importChecked, reset };
}
