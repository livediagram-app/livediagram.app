'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  COMMUNITY_REPORT_NOTE_MAX,
  COMMUNITY_REPORT_REASONS,
  communityReportReasonType,
  type CommunityReportReason,
} from '@livediagram/api-schema';
import { Button, CloseIcon, useEscape, useFocusTrap } from '@livediagram/ui';
import { CommunityApiError, reportPost } from '@/lib/api';
import { communityTelemetry } from '@/lib/telemetry';

type Phase = 'editing' | 'sending' | 'sent' | 'failed' | 'gone';

// Report This Board (docs/specs/025-community/community.md "Reports and moderation"; blueprint §9,
// §10): a reason as radio rows, an optional note of up to 300 characters with a counter, Send Report,
// then "Thanks. We'll take a look." A modal that traps focus, closes on Escape or the backdrop, and
// hands focus back to Report when it closes.
export function ReportDialog({ postId, onClose }: { postId: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const noteId = useId();
  const [reason, setReason] = useState<CommunityReportReason | null>(null);
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<Phase>('editing');
  useFocusTrap(ref);
  useEscape(onClose, { enabled: phase !== 'sending' });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!reason || phase === 'sending') return;
    setPhase('sending');
    const trimmed = note.trim();
    reportPost(postId, { reason, note: trimmed ? trimmed : null })
      .then(() => {
        communityTelemetry.reported(communityReportReasonType(reason));
        setPhase('sent');
      })
      .catch((err: unknown) => {
        console.warn('[community] report failed', err);
        setPhase(err instanceof CommunityApiError && err.status === 404 ? 'gone' : 'failed');
      });
  };

  // Portalled to the body: the post's sticky side column is its own stacking context, and a modal
  // inside it would sit under the header and the cards below.
  return createPortal(
    <div className="fixed inset-0 z-(--z-modal) flex items-end justify-center p-4 sm:items-center">
      <div
        aria-hidden
        className="absolute inset-0 animate-fade-in bg-slate-900/45 motion-reduce:animate-none dark:bg-slate-950/70"
        onClick={phase === 'sending' ? undefined : onClose}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-md animate-fade-in rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl outline-none motion-reduce:animate-none dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white">
            Report This Board
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={phase === 'sending'}
            className="-mr-2 -mt-1 rounded-md p-1.5 text-slate-400 transition-colors duration-micro hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <CloseIcon size={16} aria-hidden />
          </button>
        </div>

        {phase === 'sent' ? (
          <div className="flex flex-col gap-5">
            <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
              Thanks. We&apos;ll take a look.
            </p>
            <div className="flex justify-end">
              {/* The form it replaces held focus; keep it inside the dialog. */}
              <Button size="md" onClick={onClose} autoFocus>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-5">
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-2 text-sm text-slate-600 dark:text-slate-300">
                What&apos;s wrong with this board?
              </legend>
              {COMMUNITY_REPORT_REASONS.map((r) => (
                <label
                  key={r.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors duration-micro ${
                    reason === r.id
                      ? 'border-brand-400 bg-brand-50 text-brand-800 dark:border-brand-500/60 dark:bg-brand-500/10 dark:text-brand-100'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.id}
                    checked={reason === r.id}
                    onChange={() => setReason(r.id)}
                    className="accent-brand-600"
                  />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={noteId}
                className="text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Anything Else? <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              <textarea
                id={noteId}
                value={note}
                maxLength={COMMUNITY_REPORT_NOTE_MAX}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                aria-describedby={`${noteId}-count`}
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <p
                id={`${noteId}-count`}
                className="self-end text-xs tabular-nums text-slate-400 dark:text-slate-500"
              >
                {note.length} / {COMMUNITY_REPORT_NOTE_MAX}
              </p>
            </div>
            {phase === 'failed' || phase === 'gone' ? (
              <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
                {phase === 'gone'
                  ? 'This post is no longer available.'
                  : "We couldn't send your report. Please try again."}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="md"
                onClick={onClose}
                disabled={phase === 'sending'}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                size="md"
                disabled={!reason || phase === 'sending' || phase === 'gone'}
              >
                {phase === 'sending' ? 'Sending...' : 'Send Report'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
