'use client';

// A board from another tool, in the Import dialog (docs/specs/026-plan/tracker-import.md "Reading the file", "The
// preview", "The import"): a picked or dropped Trello, Asana, Jira or Linear export read and previewed, where it goes,
// then the import into a new Board tab of this plan or a new plan. The file is read and planned in a Web Worker
// (lib/tracker-worker), which keeps the board, so the page holds only its summary and the plans; the writes are the
// editor's (useTrackerImport). A plan is worked out once per file and target, never per render, and the preview's
// plan is the one imported while what it read of this plan is unchanged.
import { useState } from 'react';
import {
  TRACKER_FILE_MAX_BYTES,
  type TrackerImportPlan,
  type TrackerSource,
} from '@liveplanner/items';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { pickTabFile } from '@/lib/import-tab';
import { TRACKER_FILE_ACCEPT, TRACKER_TOO_BIG } from '@/lib/tracker-file';
import {
  trackerContextKey,
  type TrackerBoardRef,
  type TrackerRead,
} from '@/lib/tracker-worker/tracker-tasks';
import { trackerTasks, type TrackerTasks } from '@/lib/tracker-worker/tracker-worker-client';
import {
  TRACKER_IMPORT_FAILED,
  type TrackerImportActions,
  type TrackerTarget,
} from '@/hooks/plan/useTrackerImport';

// Why the tab choice is dimmed when the plan's cards never loaded.
export const TRACKER_NOT_LOADED = 'This plan’s cards haven’t loaded, so it can’t take a board now.';
export const TRACKER_UNREADABLE = 'Couldn’t read that file. Check it and try again.';

export type TrackerPreviewState = {
  // The board the worker holds, by key, with what the page shows of it.
  board: TrackerBoardRef;
  plans: Partial<Record<TrackerTarget, TrackerImportPlan>>;
  // What each plan read of this plan (trackerContextKey): Import reuses the plan while it still reads the same.
  keys: Partial<Record<TrackerTarget, string>>;
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
  show: (got: TrackerRead) => Promise<void>;
  changeTarget: (target: TrackerTarget) => Promise<void>;
  run: () => Promise<void>;
  // Back to the dialog's list.
  back: () => void;
};

export function useTrackerFlow(
  tracker: TrackerImportActions,
  onDone: () => void,
  tasks: TrackerTasks = trackerTasks(),
): TrackerFlow {
  const [preview, setPreview] = useState<TrackerPreviewState | null>(null);
  const [busy, setBusy] = useState<'reading' | 'importing' | null>(null);
  const [reading, setReading] = useState<TrackerSource | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The context's `random` stays behind: the worker plans with its own.
  const planFor = async (board: TrackerBoardRef, target: TrackerTarget) => {
    const got = await tracker.contextFor(target);
    if (!got) return null;
    const { random: _random, ...ctx } = got;
    const plan = await tasks.run({ kind: 'plan', key: board.key, ctx });
    return { plan, key: trackerContextKey(ctx) };
  };

  // The board, previewed into this plan when it has room, else into a new plan.
  const previewOf = async (board: TrackerBoardRef): Promise<TrackerPreviewState | null> => {
    const tab = await planFor(board, 'tab');
    if (tab?.plan.preview.fits)
      return { board, plans: { tab: tab.plan }, keys: { tab: tab.key }, target: 'tab' };
    const plan = await planFor(board, 'plan');
    if (!plan) return null;
    return {
      board,
      plans: { ...(tab ? { tab: tab.plan } : {}), plan: plan.plan },
      keys: { ...(tab ? { tab: tab.key } : {}), plan: plan.key },
      target: 'plan',
      tabReason: tab?.plan.preview.reason ?? TRACKER_NOT_LOADED,
    };
  };

  const read = async (load: () => Promise<TrackerRead | null>, from?: TrackerSource) => {
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
        cards: got.board.cards,
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
      return picked.tooBig
        ? { error: TRACKER_TOO_BIG }
        : tasks.run({ kind: 'read', text: picked.text, name: picked.name });
    }, from);

  const show = (got: TrackerRead) => read(async () => got);

  // The rows are dimmed while busy, and the tab's while it has a reason.
  const changeTarget = async (target: TrackerTarget) => {
    if (!preview || target === preview.target) return;
    if (target === 'tab' && preview.tabReason) return;
    const known = preview.plans[target];
    const planned = known ? null : await planFor(preview.board, target);
    const plan = known ?? planned?.plan;
    if (!plan) return;
    setPreview({
      ...preview,
      target,
      plans: { ...preview.plans, [target]: plan },
      keys: planned ? { ...preview.keys, [target]: planned.key } : preview.keys,
    });
  };

  const run = async () => {
    if (!preview || busy) return;
    setBusy('importing');
    setError(null);
    let plan = preview.plans[preview.target]!;
    if (preview.target === 'tab') {
      // Checked against the plan as it is now: the preview's plan is imported while what it read is unchanged, and
      // planned again when cards, card types or people have come or gone since.
      const fresh = await freshTabPlan(preview);
      if (!fresh?.preview.fits) {
        const tabReason = fresh?.preview.reason ?? TRACKER_NOT_LOADED;
        const asPlan =
          preview.plans.plan ?? (await planFor(preview.board, 'plan').catch(() => null))?.plan;
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

  // The tab's plan as of now: the preview's own when this plan reads the same as it did, else planned again (null when
  // the cards never loaded, or the worker lost the board).
  const freshTabPlan = async (p: TrackerPreviewState): Promise<TrackerImportPlan | null> => {
    const got = await tracker.contextFor('tab');
    if (!got) return null;
    const { random: _random, ...ctx } = got;
    const key = trackerContextKey(ctx);
    const known = p.plans.tab;
    if (known && p.keys.tab === key) {
      debugLog('[tracker-import] plan reused', { cards: known.creates.length });
      // Its board id is the preview's, still unused: no board is placed until the import.
      return known;
    }
    try {
      return await tasks.run({ kind: 'plan', key: p.board.key, ctx });
    } catch (err) {
      console.warn('[tracker-import] plan failed', { error: String(err) });
      return null;
    }
  };

  const back = () => {
    setPreview(null);
    setError(null);
  };

  return { preview, busy, reading, error, pick, show, changeTarget, run, back };
}
