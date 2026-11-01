'use client';

// The Import dialog's Another Tool view (docs/specs/026-plan/tracker-import.md "The preview", "The import"): choose a
// Trello, Asana, Jira or Linear export, see what it will make, then import it into a new Board tab of this plan or a
// new plan. The file is read and planned here, in the dialog's chunk; the writes are the editor's (useTrackerImport).
// A plan is worked out once per file and target, never per render.
import { useState, type ReactNode } from 'react';
import { Button, DialogFooter } from '@liveplanner/ui';
import {
  TRACKER_FILE_MAX_BYTES,
  planTrackerImport,
  trackerSummary,
  type TrackerBoard,
  type TrackerImportPlan,
} from '@liveplanner/items';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { pickTabFile } from '@/lib/import-tab';
import {
  TRACKER_FILE_ACCEPT,
  TRACKER_TOO_BIG,
  readTrackerDrop,
  readTrackerText,
  type TrackerFileRead,
} from '@/lib/tracker-file';
import {
  TRACKER_IMPORT_FAILED,
  type TrackerImportActions,
  type TrackerTarget,
} from '@/hooks/plan/useTrackerImport';
import { TrackerChooseView } from './TrackerChooseView';
import { TrackerPreviewView } from './TrackerPreviewView';

// Why the tab choice is dimmed when the plan's cards never loaded.
export const TRACKER_NOT_LOADED = 'This plan’s cards haven’t loaded, so it can’t take a board now.';

const SUMMARY = 'text-[12px] text-slate-500 dark:text-slate-400';

type Preview = {
  board: TrackerBoard;
  plans: Partial<Record<TrackerTarget, TrackerImportPlan>>;
  target: TrackerTarget;
  // Set when this plan can't take it all: the tab choice is dimmed with it.
  tabReason?: string;
};

export function TrackerImportPanel({
  head,
  tracker,
  onDone,
}: {
  // What heads the body (the dialog's view switch).
  head?: ReactNode;
  tracker: TrackerImportActions;
  // The import landed in this plan: the dialog closes.
  onDone: () => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<'reading' | 'importing' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const planFor = async (board: TrackerBoard, target: TrackerTarget) => {
    const ctx = await tracker.contextFor(target);
    return ctx ? planTrackerImport(board, ctx) : null;
  };

  // The board, previewed into this plan when it has room, else into a new plan.
  const previewOf = async (board: TrackerBoard): Promise<Preview | null> => {
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

  const read = async (load: () => Promise<TrackerFileRead | null>) => {
    if (busy) return;
    setBusy('reading');
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
        cards: got.board.cards.length,
      });
      if (next) setPreview(next);
      else setError(TRACKER_IMPORT_FAILED);
    } catch (err) {
      console.warn('[tracker-import] read failed', { error: String(err) });
      setError('Couldn’t read that file. Check it and try again.');
    } finally {
      setBusy(null);
    }
  };

  const choose = () =>
    read(async () => {
      const picked = await pickTabFile(TRACKER_FILE_ACCEPT, { maxBytes: TRACKER_FILE_MAX_BYTES });
      if (!picked) return null;
      return picked.tooBig ? { error: TRACKER_TOO_BIG } : readTrackerText(picked.text, picked.name);
    });

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

  const shown = preview ? preview.plans[preview.target]!.preview : null;

  const summary = preview && shown ? trackerSummary(shown, preview.target) : null;

  // The body scrolls under the dialog's header; the actions stay in its footer, always in reach.
  return (
    <>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        {head}
        {preview && shown ? (
          <TrackerPreviewView
            preview={shown}
            target={preview.target}
            tabReason={preview.tabReason}
            onTarget={(t) => void changeTarget(t)}
            disabled={busy !== null}
          />
        ) : (
          <TrackerChooseView
            reading={busy === 'reading'}
            onChoose={() => void choose()}
            onDropFile={(file) => void read(() => readTrackerDrop(file))}
          />
        )}
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {error}
          </p>
        ) : null}
        {/* A phone's footer has room for its buttons alone: the line goes at the end of the preview. */}
        {summary ? <p className={`sm:hidden ${SUMMARY}`}>{summary}</p> : null}
      </div>
      {summary ? (
        <DialogFooter>
          <p className={`mr-auto hidden min-w-0 sm:block ${SUMMARY}`}>{summary}</p>
          <Button
            variant="secondary"
            size="md"
            className="shrink-0 whitespace-nowrap"
            onClick={() => {
              setPreview(null);
              setError(null);
            }}
            disabled={busy !== null}
          >
            Choose Another File
          </Button>
          <Button
            variant="primary"
            size="md"
            // Wide enough for "Importing…", so the label swap moves nothing.
            className="min-w-[7.5rem] shrink-0"
            onClick={() => void run()}
            disabled={busy !== null}
          >
            {busy === 'importing' ? 'Importing…' : 'Import'}
          </Button>
        </DialogFooter>
      ) : null}
    </>
  );
}
