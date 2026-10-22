'use client';

// The paste notice (docs/specs/020-import-export/board-scene.md "In the editor"): after a paste that
// changed or dropped anything, a small non-blocking status at the bottom of the canvas says what;
// while images store, it shows their progress. It never takes the focus and never times out under
// the reader: Close (or Escape inside it), the next paste, or another tab clears it.
import { describeImportImageReport } from '@/lib/import-images';
import type { BoardSceneNoticeState, BoardSceneSource } from '@/hooks/canvas/useBoardSceneInsert';
import { BoardSceneReportList } from '@/components/dialogs/BoardSceneReportList';
import { useNoticeSlot } from './useNoticeSlot';

const SOURCE_NAMES: Readonly<Record<BoardSceneSource, string>> = {
  excalidraw: 'Excalidraw',
  'microsoft-whiteboard': 'Microsoft Whiteboard',
};

export function BoardSceneNotice({
  notice,
  onClose,
}: {
  notice: BoardSceneNoticeState | null;
  onClose: () => void;
}) {
  const bottom = useNoticeSlot(notice !== null);
  if (!notice) return null;
  const source = SOURCE_NAMES[notice.source];
  const images =
    notice.kind === 'report' && notice.images ? describeImportImageReport(notice.images) : null;
  return (
    // Bottom centre, in its own slot above the dock (lib/board-scene-notice-slot); measured before
    // paint and hidden until then, so it never shows in the wrong place nor moves anything.
    <div
      className="pointer-events-none fixed inset-x-0 z-[var(--z-overlay)] flex justify-center px-4"
      style={bottom === null ? { bottom: 0, visibility: 'hidden' } : { bottom }}
    >
      <div
        role="status"
        aria-live="polite"
        data-testid="board-scene-notice"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && notice.kind !== 'progress') {
            e.stopPropagation();
            onClose();
          }
        }}
        className="pointer-events-auto w-full max-w-[360px] rounded-lg border border-slate-200 bg-white p-3 text-slate-900 shadow-lg shadow-slate-900/5 motion-safe:animate-fade-in dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40"
      >
        {notice.kind === 'progress' ? (
          <p className="text-sm">
            Pasting images {notice.done} of {notice.total}…
          </p>
        ) : (
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {notice.kind === 'refused'
                  ? `Couldn't paste from ${source}`
                  : `Pasted from ${source} with some changes`}
              </p>
              {notice.kind === 'refused' ? (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{notice.message}</p>
              ) : (
                <>
                  <BoardSceneReportList report={notice.report} />
                  {images && images.failures.length > 0 ? (
                    <ul className="mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      {images.failures.map((f) => (
                        <li key={f.failure} data-failure={f.failure}>
                          <span className="font-semibold tabular-nums">{f.count}</span> ·{' '}
                          {f.sentence}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {images?.hint ? (
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{images.hint}</p>
                  ) : null}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              data-testid="board-scene-notice-close"
              className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
