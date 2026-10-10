// The Explorer's draw.io import (docs/specs/020-import-export/drawio-import.md "Import as new
// documents"): read the picked files and folders by content, list what was found when there is
// more than one, make each ticked diagram its own document and each ticked library its own shape
// library (docs/specs/013-workspace/shape-libraries.md) through the host's commits, and hand the
// report on with the files left out listed first.
import { useRef, useState } from 'react';
import type { ImportChecklistRow } from '@/components/dialogs/ImportChecklist';
import type { BoardImportProgress } from '@/hooks/persistence/useBoardSceneImport';
import type { DrawioFiles, DrawioLibraryFile } from '@/lib/drawio/files';
import type { ShapeLibrariesImported } from '@/lib/drawio/library-store';
import type { DrawioDocumentFile } from '@/lib/drawio/new-document';
import type { ImportOutcome } from '@/lib/import-tab';
import { toggled, toggledAll } from '@/lib/import-selection';
import { track } from '@/lib/telemetry';
import { pluralGrouped } from '@livediagram/document';

export const DRAWIO_UNEXPECTED = "Couldn't import that. Check the files and try again.";

/** The host's commit for libraries: each library its own shape library, counted after `offset`. */
export type ImportDrawioLibraries = (
  files: DrawioLibraryFile[],
  progress: { onProgress: (p: BoardImportProgress) => void; offset: number; total: number },
) => Promise<ShapeLibrariesImported>;

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

function rowsOf(read: DrawioFiles): ImportChecklistRow[] {
  const diagrams = read.diagrams.map((d, i) => ({
    key: `diagram:${i}`,
    name: d.name,
    detail: [
      d.modifiedAt ? `Edited ${DATE.format(new Date(d.modifiedAt))}` : null,
      pluralGrouped(d.pages.length, 'page', 'pages'),
    ]
      .filter(Boolean)
      .join(' · '),
  }));
  const libraries = read.libraries.map((l, i) => ({
    key: `library:${i}`,
    name: l.name,
    detail: `Shape library · ${pluralGrouped(l.items.length, 'shape', 'shapes')}`,
  }));
  return [...diagrams, ...libraries];
}

export function useDrawioFileImport(deps: {
  importDocuments: ImportDrawioDocuments;
  importLibraries: ImportDrawioLibraries;
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
    const libraries = files.libraries.filter((_, i) => checked.has(`library:${i}`));
    const total = diagrams.length + libraries.length;
    let outcome: DoneOutcome = { status: 'done' };
    if (diagrams.length > 0) {
      setState({ step: 'importing', board: 1, boards: total });
      // One count over diagrams and libraries alike.
      const landed = await deps.importDocuments(diagrams, (p) =>
        onProgress({ ...p, boards: total }),
      );
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
    if (libraries.length > 0) {
      setState({ step: 'importing', board: diagrams.length + 1, boards: total });
      const made = await deps.importLibraries(libraries, {
        onProgress,
        offset: diagrams.length,
        total,
      });
      const { withLibraries } = await import('@/lib/drawio/library-store');
      outcome = withLibraries(outcome, made);
    }
    const all = [...files.failures, ...(outcome.failures ?? [])];
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
      if (rows.length === 0) {
        setState({ step: 'pick', error: found.failures[0]?.message ?? DRAWIO_UNEXPECTED });
        return;
      }
      const all = new Set(rows.map((r) => r.key));
      if (rows.length === 1 && found.failures.length === 0) return run(all);
      setState({ step: 'list', rows, failures: found.failures, checked: all });
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
