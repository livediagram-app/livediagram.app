'use client';

import { type FormEvent, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  COMMUNITY_REPORT_NOTE_MAX,
  COMMUNITY_REPORT_REASONS,
  communityReportReasonType,
  type CommunityReportReason,
} from '@livediagram/api-schema';
import {
  Button,
  CommunityHelpLink,
  Dialog,
  DialogCloseButton,
  DialogHeader,
  TextArea,
} from '@livediagram/ui';
import { CommunityApiError, reportPost } from '@/lib/api';
import { communityTelemetry } from '@/lib/telemetry';

type Phase = 'editing' | 'sending' | 'sent' | 'failed' | 'gone';

// Report This Document (docs/specs/025-community/community.md "Reports and moderation"; blueprint §9,
// §10): a reason as radio rows, an optional note of up to 300 characters with a counter, Send Report,
// then a thank-you that says what happens next (enough reports take a post down; nobody reviews by hand). The shared
// Dialog shell: it traps focus, closes on Escape or a press on the backdrop, and hands focus back to Report; on a
// phone it rises as a sheet.
export function ReportDialog({ postId, onClose }: { postId: string; onClose: () => void }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const noteId = useId();
  const [reason, setReason] = useState<CommunityReportReason | null>(null);
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<Phase>('editing');
  // Sending disables the focused Send button, which drops focus out of the dialog; when a send fails, bring it back
  // inside (the dialog's body), so the trap holds and the alert is read in place.
  useEffect(() => {
    if (phase === 'failed' || phase === 'gone') bodyRef.current?.focus({ preventScroll: true });
  }, [phase]);
  // Nothing closes the dialog while a report is in flight. The phase is read from a ref set at commit, so a close
  // asked for the moment a failure shows (Escape, the backdrop) is never refused by a stale phase.
  const phaseRef = useRef(phase);
  useLayoutEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  const close = () => {
    if (phaseRef.current !== 'sending') onClose();
  };

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

  return (
    <Dialog open onClose={close} titleId={titleId} phoneSheet>
      <DialogHeader title={<span id={titleId}>Report This Document</span>}>
        <DialogCloseButton onClick={close} />
      </DialogHeader>
      <div ref={bodyRef} tabIndex={-1} className="px-6 py-5 outline-none">
        {phase === 'sent' ? (
          <div className="flex flex-col gap-5">
            <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
              Thanks for letting us know. When enough people report a document, it is taken out of
              the Community.
            </p>
            <div className="flex justify-end">
              {/* The form it replaces held focus; keep it inside the dialog. */}
              <Button size="md" onClick={close} autoFocus>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-5">
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-2 text-sm text-slate-600 dark:text-slate-300">
                What&apos;s wrong with this document?
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
                Anything Else?{' '}
                <span className="font-normal text-slate-500 dark:text-slate-400">(Optional)</span>
              </label>
              <TextArea
                id={noteId}
                value={note}
                maxLength={COMMUNITY_REPORT_NOTE_MAX}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                aria-describedby={`${noteId}-count`}
                className="resize-none"
              />
              <p
                id={`${noteId}-count`}
                className="self-end text-xs tabular-nums text-slate-500 dark:text-slate-400"
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
            <div className="flex flex-wrap items-center justify-end gap-2">
              <CommunityHelpLink article="finding" className="mr-auto max-sm:mb-1 max-sm:w-full">
                How Reports Work
              </CommunityHelpLink>
              <Button variant="secondary" size="md" onClick={close} disabled={phase === 'sending'}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={!reason || phase === 'sending' || phase === 'gone'}
              >
                {phase === 'sending' ? 'Sending...' : 'Send Report'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
}
