// The Knowledgebase import's steps (docs/specs/020-import-export/blueprints/knowledgebase-import.md "The dialog"):
// pick an archive, read it into a plan, review the plan and where it lands, write it, and say how it went. The plan
// depends on where it lands (the pages already there, how deep the page above sits), so choosing another place
// plans the archive again; only the newest answer is kept.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_KNOWLEDGEBASE_PAGES,
  MAX_PAGE_DEPTH,
  pageCount,
  pageDepth,
} from '@liveknowledge/document';
import { planImport, type ImportPlan, type ImportSource } from '@liveknowledge/knowledge-import';
import type { PickedArchive } from '@/lib/knowledge-import/archive-sources';
import type {
  ImportDestination,
  KnowledgeImportHost,
  RunImportResult,
} from '@/lib/knowledge-import/run-import';
import type { ImportProgress } from '@/lib/knowledge-import/write-plan';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

export type KnowledgeImportState =
  | { step: 'pick'; error: string | null }
  | { step: 'reading'; archive: PickedArchive }
  | {
      step: 'review';
      archive: PickedArchive;
      plan: ImportPlan;
      destination: ImportDestination;
      /** Planning again for another place: the last plan stays on screen meanwhile. */
      replanning: boolean;
    }
  | { step: 'importing'; progress: ImportProgress; stopping: boolean }
  | { step: 'done'; result: RunImportResult; destination: ImportDestination };

/** What an archive that cannot be opened says. */
export const UNREADABLE_ARCHIVE =
  'That could not be read as an archive. Choose a .zip, or a folder of pages.';

type Runner = typeof import('@/lib/knowledge-import/run-import').runImport;

export function useKnowledgeImport(
  source: ImportSource,
  host: KnowledgeImportHost,
  // The write path, loaded when an import starts; a test hands its own.
  loadRunner: () => Promise<Runner> = async () =>
    (await import('@/lib/knowledge-import/run-import')).runImport,
) {
  const [state, setState] = useState<KnowledgeImportState>({ step: 'pick', error: null });
  // Each plan asked for; an answer that is no longer the newest is dropped.
  const asked = useRef(0);
  const stop = useRef(false);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
      // A dialog closed mid-import stops at the next batch; what was written stays.
      stop.current = true;
    },
    [],
  );

  const plan = useCallback(
    async (archive: PickedArchive, destination: ImportDestination) => {
      const turn = ++asked.current;
      const tabs = host.getTabs();
      try {
        const made = await planImport(source, await archive.open(), {
          existingPages: destination.kind === 'new' ? 0 : pageCount(tabs),
          parentDepth: destination.kind === 'new' ? 0 : pageDepth(tabs, destination.pageId),
          ...(archive.bytes !== null ? { archiveBytes: archive.bytes } : {}),
          // The knowledgebase's own limits, so there is one source for them.
          limits: { pages: MAX_KNOWLEDGEBASE_PAGES, depth: MAX_PAGE_DEPTH },
        });
        if (!alive.current || turn !== asked.current) return;
        debugLog('[knowledge-import] planned', {
          source,
          pages: made.summary.pages,
          pictures: made.summary.pictures,
          skipped: made.summary.skipped.length,
          blocked: made.summary.blocked?.reason ?? null,
        });
        setState({ step: 'review', archive, plan: made, destination, replanning: false });
      } catch (error) {
        if (!alive.current || turn !== asked.current) return;
        debugLog('[knowledge-import] unreadable', { source, error: String(error) });
        setState({ step: 'pick', error: UNREADABLE_ARCHIVE });
      }
    },
    [source, host],
  );

  const pick = useCallback(
    (archive: PickedArchive | null) => {
      if (!archive) {
        setState({ step: 'pick', error: UNREADABLE_ARCHIVE });
        return;
      }
      setState({ step: 'reading', archive });
      void plan(archive, { kind: 'new' });
    },
    [plan],
  );

  const setDestination = useCallback(
    (destination: ImportDestination) => {
      if (state.step !== 'review') return;
      setState({ ...state, destination, replanning: true });
      void plan(state.archive, destination);
    },
    [state, plan],
  );

  const start = useCallback(async () => {
    if (state.step !== 'review' || state.replanning || state.plan.summary.blocked) return;
    const { plan: ready, archive, destination } = state;
    stop.current = false;
    setState({
      step: 'importing',
      progress: { done: 0, total: ready.pages.length },
      stopping: false,
    });
    const run = await loadRunner();
    const result = await run({
      plan: ready,
      source,
      name: archive.name,
      destination,
      host,
      cancelled: () => stop.current,
      onProgress: (progress) => {
        if (alive.current) {
          setState((s) => (s.step === 'importing' ? { ...s, progress } : s));
        }
      },
    });
    debugLog('[knowledge-import] written', {
      source,
      imported: result.imported,
      failedPages: result.failedPages.length,
      failedPictures: result.failedPictures.length,
      cancelled: result.cancelled,
      stalled: result.stalled,
    });
    if (alive.current) setState({ step: 'done', result, destination });
  }, [state, source, host, loadRunner]);

  const cancel = useCallback(() => {
    stop.current = true;
    setState((s) => (s.step === 'importing' ? { ...s, stopping: true } : s));
  }, []);

  const reset = useCallback(() => {
    asked.current += 1;
    setState({ step: 'pick', error: null });
  }, []);

  return { state, pick, setDestination, start, cancel, reset };
}
