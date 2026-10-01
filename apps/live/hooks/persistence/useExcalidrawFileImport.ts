// The Explorer's Excalidraw import (docs/specs/020-import-export/excalidraw-import-export.md "Import
// as new documents"): read the picked files into boards, make each its own document through the
// host's commit, and hand the report on, with the files that could not be read listed first.
import { useState } from 'react';
import type { BoardImportProgress } from '@/hooks/persistence/useBoardSceneImport';
import type { ImportScenes } from '@/hooks/persistence/useMsWhiteboardImport';
import type { BoardScene } from '@/lib/board-scene/scene';
import type { ExcalidrawContainer } from '@/lib/excalidraw-embedded';
import type { ImportOutcome } from '@/lib/import-tab';
import { track } from '@/lib/telemetry';

export const UNEXPECTED = "Couldn't import that. Check the files and try again.";

export type ExcalidrawImportStep =
  | { step: 'pick'; error?: string }
  | { step: 'reading' }
  | { step: 'importing'; board: number; boards: number; images?: { done: number; total: number } };

type DoneOutcome = Extract<ImportOutcome, { status: 'done' }>;

// The same telemetry types the Import dialog's Excalidraw card sends, by where the scene was found.
const TELEMETRY_TYPE: Readonly<Record<ExcalidrawContainer, string>> = {
  json: 'Excalidraw',
  png: 'ExcalidrawPng',
  svg: 'ExcalidrawSvg',
};

/**
 * The containers of the boards that became documents. The import keeps the scenes' order and
 * names each document after its scene, so the documents are matched to the scenes in order.
 */
function landedContainers(
  scenes: readonly BoardScene[],
  containers: readonly ExcalidrawContainer[],
  documents: readonly { name: string }[],
): ExcalidrawContainer[] {
  const out: ExcalidrawContainer[] = [];
  let at = 0;
  for (const doc of documents) {
    while (at < scenes.length && scenes[at]!.title !== doc.name) at++;
    out.push(containers[at] ?? 'json');
    at++;
  }
  return out;
}

export function useExcalidrawFileImport(deps: {
  importScenes: ImportScenes;
  onDone: (outcome: DoneOutcome) => void;
}) {
  const [state, setState] = useState<ExcalidrawImportStep>({ step: 'pick' });

  const onProgress = (p: BoardImportProgress) =>
    setState({
      step: 'importing',
      board: p.board ?? 1,
      boards: p.boards ?? 1,
      ...(p.total > 0 ? { images: { done: p.done, total: p.total } } : {}),
    });

  const open = async (files: readonly File[]): Promise<void> => {
    if (files.length === 0) return;
    setState({ step: 'reading' });
    try {
      const { readExcalidrawBoardFiles } = await import('@/lib/excalidraw-board-file');
      const read = await readExcalidrawBoardFiles(files);
      if (read.scenes.length === 0) {
        setState({ step: 'pick', error: read.failures[0]?.message ?? UNEXPECTED });
        return;
      }
      setState({ step: 'importing', board: 1, boards: read.scenes.length });
      const outcome = await deps.importScenes(read.scenes, onProgress);
      if (outcome.status !== 'done') {
        setState({ step: 'pick', error: outcome.status === 'error' ? outcome.error : UNEXPECTED });
        return;
      }
      for (const container of landedContainers(
        read.scenes,
        read.containers,
        outcome.documents ?? [],
      )) {
        track('Tab', 'Imported', TELEMETRY_TYPE[container]);
      }
      const failures = [...read.failures, ...(outcome.failures ?? [])];
      setState({ step: 'pick' });
      deps.onDone({ ...outcome, ...(failures.length > 0 ? { failures } : {}) });
    } catch (error) {
      console.warn('[excalidraw-import] failed', error);
      setState({ step: 'pick', error: UNEXPECTED });
    }
  };

  return { state, open };
}
