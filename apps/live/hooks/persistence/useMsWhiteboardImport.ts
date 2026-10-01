// The Microsoft Whiteboard card's flow (docs/specs/020-import-export/whiteboard-import.md
// "Importing in the dialog"): read a pick, list its boards (one imports straight away), turn the
// chosen ones into scenes and open each as a new whiteboard tab through the board scene's commit.
import { useRef, useState } from 'react';
import type { BoardScene } from '@/lib/board-scene/scene';
import type { BoardImportProgress } from '@/hooks/persistence/useBoardSceneImport';
import type { ImportOutcome } from '@/lib/import-tab';
import type { PickedExport } from '@/lib/pick-folder';
import type { BoardFailure, BoardSummary } from '@/lib/ms-whiteboard/import';
import type { ExportFileSet } from '@/lib/ms-whiteboard/board-export';
import { track } from '@/lib/telemetry';

export type ImportScenes = (
  scenes: BoardScene[],
  onProgress?: (p: BoardImportProgress) => void,
) => Promise<ImportOutcome>;

export type MsWhiteboardStep =
  | { step: 'pick'; error?: string }
  | { step: 'reading' }
  | { step: 'list'; boards: BoardSummary[]; failures: BoardFailure[]; checked: ReadonlySet<string> }
  | { step: 'importing'; board: number; boards: number; images?: { done: number; total: number } };

type DoneOutcome = Extract<ImportOutcome, { status: 'done' }>;

export const READ_ERRORS: Readonly<Record<string, string>> = {
  'zip-damaged': "This .zip couldn't be read.",
  'zip-encrypted': 'This .zip is password-protected.',
  'too-large': 'This export is too large to import at once. Import fewer boards.',
};

export const UNEXPECTED = "Couldn't import that. Check the export and try again.";

const loadImport = () => import('@/lib/ms-whiteboard/import');
const loadFileSets = () => import('@/lib/ms-whiteboard/file-sets');

export function useMsWhiteboardImport(deps: {
  importScenes: ImportScenes;
  onDone: (outcome: DoneOutcome) => void;
}) {
  const [state, setState] = useState<MsWhiteboardStep>({ step: 'pick' });
  const files = useRef<ExportFileSet | null>(null);

  const run = async (boards: BoardSummary[], earlier: BoardFailure[]) => {
    const { boardSceneOf } = await loadImport();
    const scenes: BoardScene[] = [];
    const failures = [...earlier];
    for (const [i, board] of boards.entries()) {
      setState({ step: 'importing', board: i + 1, boards: boards.length });
      try {
        scenes.push(await boardSceneOf(files.current!, board));
      } catch (error) {
        console.warn('[ms-whiteboard] board failed', {
          rejection: 'board-unreadable',
          error: String(error),
        });
        failures.push({ title: board.name, message: "This board's files couldn't be read." });
      }
    }
    const outcome: ImportOutcome = scenes.length
      ? await deps.importScenes(scenes, (p) =>
          setState({
            step: 'importing',
            board: p.board ?? 1,
            boards: p.boards ?? scenes.length,
            images: { done: p.done, total: p.total },
          }),
        )
      : { status: 'error', error: failures[0]?.message ?? 'There was no board to import.' };
    if (outcome.status !== 'done') {
      setState({ step: 'pick', ...(outcome.status === 'error' ? { error: outcome.error } : {}) });
      return;
    }
    const landed = scenes.length - (outcome.failures?.length ?? 0);
    for (let i = 0; i < landed; i++) track('Tab', 'Imported', 'MicrosoftWhiteboard');
    const all = [...failures, ...(outcome.failures ?? [])];
    deps.onDone({ ...outcome, ...(all.length ? { failures: all } : {}) });
  };

  // Anything unexpected hands the panel back with a message, never a stuck spinner.
  const guarded = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      console.warn('[ms-whiteboard] import failed', { error: String(error) });
      setState({ step: 'pick', error: UNEXPECTED });
    }
  };

  /** Reads a pick and lists its boards; a single board imports straight away. */
  const open = (picked: PickedExport | null) => guarded(() => openPick(picked));
  const openPick = async (picked: PickedExport | null) => {
    if (!picked) return;
    setState({ step: 'reading' });
    const { fileSetFromFiles, fileSetFromZip } = await loadFileSets();
    const set =
      picked.kind === 'zip'
        ? fileSetFromZip(new Uint8Array(await picked.file.arrayBuffer()))
        : fileSetFromFiles(picked.files);
    if (!set.ok) {
      setState({ step: 'pick', error: READ_ERRORS[set.rejection] ?? READ_ERRORS['zip-damaged'] });
      return;
    }
    files.current = set.files;
    const { listBoards } = await loadImport();
    const listed = await listBoards(set.files);
    if (!listed.ok) return setState({ step: 'pick', error: listed.error });
    if (listed.boards.length === 1 && listed.failures.length === 0) {
      return run(listed.boards, []);
    }
    setState({
      step: 'list',
      boards: listed.boards,
      failures: listed.failures,
      checked: new Set(listed.boards.map((b) => b.dir)),
    });
  };

  const toggle = (dir: string) =>
    setState((s) => {
      if (s.step !== 'list') return s;
      const checked = new Set(s.checked);
      if (checked.has(dir)) checked.delete(dir);
      else checked.add(dir);
      return { ...s, checked };
    });

  const toggleAll = () =>
    setState((s) =>
      s.step !== 'list'
        ? s
        : {
            ...s,
            checked: new Set(s.checked.size === s.boards.length ? [] : s.boards.map((b) => b.dir)),
          },
    );

  const importChecked = async () => {
    if (state.step !== 'list') return;
    const chosen = state;
    await guarded(() =>
      run(
        chosen.boards.filter((b) => chosen.checked.has(b.dir)),
        chosen.failures,
      ),
    );
  };

  const reset = () => setState({ step: 'pick' });

  return { state, open, toggle, toggleAll, importChecked, reset };
}
