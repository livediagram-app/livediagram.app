'use client';

// A board from another tool, in the Import dialog (docs/specs/026-plan/tracker-import.md "Reading the file", "The
// preview", "The import"): a picked or dropped Trello, Asana, Jira or Linear export read and previewed, where it goes,
// then the import into a new Board tab of this plan or a new plan. The file is read and planned here, in the dialog's
// chunk; the writes are the editor's (useTrackerImport). A plan is worked out once per file and target, never per
// render.
import { useState } from 'react';
import {
  TRACKER_FILE_MAX_BYTES,
  planTrackerImport,
  type TrackerBoard,
  type TrackerImportPlan,
  type TrackerSource,
} from '@liveplanner/items';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { pickTabFile } from '@/lib/import-tab';
import {
  TRACKER_FILE_ACCEPT,
  TRACKER_TOO_BIG,
  readTrackerText,
  type TrackerFileRead,
} from '@/lib/tracker-file';
import {
  TRACKER_IMPORT_FAILED,
  type TrackerImportActions,
  type TrackerTarget,
} from '@/hooks/plan/useTrackerImport';

// Why the tab choice is dimmed when the plan's cards never loaded.
export const TRACKER_NOT_LOADED = 'This plan’s cards haven’t loaded, so it can’t take a board now.';
export const TRACKER_UNREADABLE = 'Couldn’t read that file. Check it and try again.';

export type TrackerPreviewState = {
  board: TrackerBoard;
  plans: Partial<Record<TrackerTarget, TrackerImportPlan>>;
  target: TrackerTarget;
  // Set when this plan can't take it all: the tab choice is dimmed with it.
  tabReason?: string;
};

export type TrackerFlow = {
  preview: TrackerPreviewState | null;
  busy: 'reading' | 'importing' | null;
  // The tool whose row was pressed, while its file is read.
  reading: TrackerSource | null;
  error: string | null;
  // Opens the picker (from a tool's row, or Choose Another File) and previews what is picked.
  pick: (from?: TrackerSource) => Promise<void>;
  // Previews a board already read (a file dropped on the dialog).
  show: (got: TrackerFileRead) => Promise<void>;
  changeTarget: (target: TrackerTarget) => Promise<void>;
  run: () => Promise<void>;
  // Back to the dialog's list.
  back: () => void;
};

export function useTrackerFlow(tracker: TrackerImportActions, onDone: () => void): TrackerFlow {
  const [preview, setPreview] = useState<TrackerPreviewState | null>(null);
  const [busy, setBusy] = useState<'reading' | 'importing' | null>(null);
  const [reading, setReading] = useState<TrackerSource | null>(null);
  const [error, setError] = useState<string | null>(null);

  const planFor = async (board: TrackerBoard, target: TrackerTarget) => {
    const ctx = await tracker.contextFor(target);
    return ctx ? planTrackerImport(board, ctx) : null;
  };

  // The board, previewed into this plan when it has room, else into a new plan.
  const previewOf = async (board: TrackerBoard): Promise<TrackerPreviewState | null> => {
    const tab = await planFor(board, 'tab');
    if (tab?.preview.fits) return { board, plans: { tab }, target: 'tab' };
    const plan = await planFor(board, 'plan');
    if (!plan) return null;
    return {
      board,
      plans: { ...(tab ? { tab } : {}), plan },
      target: 'plan',
      tabReason: tab?.preview.reason ?? TRACKER_NOT_LOADED,
    };
  };

  const read = async (load: () => Promise<TrackerFileRead | null>, from?: TrackerSource) => {
    if (busy) return;
    setBusy('reading');
    setReading(from ?? null);
    setError(null);
    try {
      const got = await load();
      if (!got) return;
      if ('error' in got) {
        setError(got.error);
        return;
      }
      const next = await previewOf(got.board);
      debugLog('[tracker-import] read', {
        source: got.board.source,
        from: from ?? 'drop',
        cards: got.board.cards.length,
      });
      if (next) setPreview(next);
      else setError(TRACKER_IMPORT_FAILED);
    } catch (err) {
      console.warn('[tracker-import] read failed', { error: String(err) });
      setError(TRACKER_UNREADABLE);
    } finally {
      setBusy(null);
      setReading(null);
    }
  };

  // The file says which tool it came from (tracker-import.md "Where it lives"): the row only opens the picker.
  const pick = (from?: TrackerSource) =>
    read(async () => {
      const picked = await pickTabFile(TRACKER_FILE_ACCEPT, { maxBytes: TRACKER_FILE_MAX_BYTES });
      if (!picked) return null;
      return picked.tooBig ? { error: TRACKER_TOO_BIG } : readTrackerText(picked.text, picked.name);
    }, from);

  const show = (got: TrackerFileRead) => read(async () => got);

  // The rows are dimmed while busy, and the tab's while it has a reason.
  const changeTarget = async (target: TrackerTarget) => {
    if (!preview || target === preview.target) return;
    if (target === 'tab' && preview.tabReason) return;
    const plan = preview.plans[target] ?? (await planFor(preview.board, target));
    if (!plan) return;
    setPreview({ ...preview, target, plans: { ...preview.plans, [target]: plan } });
  };

  const run = async () => {
    if (!preview || busy) return;
    setBusy('importing');
    setError(null);
    let plan = preview.plans[preview.target]!;
    if (preview.target === 'tab') {
      // Planned again against the plan as it is now: cards may have come or gone since the preview.
      const fresh = await planFor(preview.board, 'tab');
      if (!fresh?.preview.fits) {
        const tabReason = fresh?.preview.reason ?? TRACKER_NOT_LOADED;
        const asPlan = preview.plans.plan ?? (await planFor(preview.board, 'plan'));
        if (asPlan)
          setPreview({
            ...preview,
            tabReason,
            target: 'plan',
            plans: { ...preview.plans, plan: asPlan },
          });
        else setError(TRACKER_IMPORT_FAILED);
        setBusy(null);
        return;
      }
      plan = fresh;
    }
    const outcome = await tracker.importPlan(plan, preview.target);
    if (!outcome.ok) {
      setError(outcome.error);
      setBusy(null);
      return;
    }
    // A new plan opens in this window: the dialog stays busy until it goes.
    if (preview.target === 'tab') onDone();
  };

  const back = () => {
    setPreview(null);
    setError(null);
  };

  return { preview, busy, reading, error, pick, show, changeTarget, run, back };
}
