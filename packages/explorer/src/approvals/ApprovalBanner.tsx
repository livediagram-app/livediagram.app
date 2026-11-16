'use client';

// The banner under the editor's header for a named approver of the open request (approvals.md "In the editor"):
// "<Requester> asked you to approve this <noun>", the note, the due day, and Request Changes and Approve. Request
// Changes opens a note field in place with Cancel and Send (off until there is a note). Once they have decided it says
// so with Change Decision (while the request is open), and can be closed for the session. On a phone it wraps under its words, its buttons 44px
// tall. Approving is a Viewer's one write (share-roles.md): the index checks they are named; this only draws it.

import { useEffect, useId, useRef, useState } from 'react';
import { APPROVAL_NOTE_MAX, type ApprovalDecisionInput } from '@liveworkspace/index-client';
import { Button, TextArea } from '@liveworkspace/ui';
import { DOCUMENT_CHECK } from '../library/event-icons';
import { Glyph } from '../ui/icons';
import { decidedWords, dueWords, isOverdue, personName } from './approval-words';
import { useApprovalDoor } from './door';

// A phone's 44px touch target; the header's density from `sm` up.
const ACTION = 'max-sm:min-h-11';

export function ApprovalBanner() {
  const ctx = useApprovalDoor();
  const [writing, setWriting] = useState(false);
  const [changing, setChanging] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'request_changes' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closedFor, setClosedFor] = useState<string | null>(null);
  // The request the reader's own answer just closed: the banner stays to say so until closed.
  const [closedByMe, setClosedByMe] = useState<string | null>(null);
  const noteId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (writing) field.current?.focus();
  }, [writing]);

  const approval = ctx?.approval ?? null;
  if (!ctx || !approval) return null;
  const open = approval.state === 'open';
  if (!open && !(approval.state === 'approved' && closedByMe === approval.id)) return null;
  const mine = approval.approvers.find((a) => a.id === ctx.door.viewerId);
  if (!mine) return null;
  const decided = mine.decision !== 'pending' && !changing;
  // Closed for the session: until the request or their decision changes.
  const key = `${approval.id}:${mine.decision}`;
  if (decided && closedFor === key) return null;

  const decide = async (input: ApprovalDecisionInput) => {
    setBusy(input.decision);
    setError(null);
    try {
      const { approval: next } = await ctx.door.client.decideApproval(
        ctx.door.itemId,
        input,
        ctx.door.share,
      );
      ctx.setApproval(next);
      if (next.state === 'approved') setClosedByMe(next.id);
      setWriting(false);
      setChanging(false);
      setNote('');
    } catch {
      setError('Couldn’t send your answer. Try again.');
      ctx.refresh();
    } finally {
      setBusy(null);
    }
  };

  const who = personName(approval.requestedBy);
  const overdue = isOverdue(approval.due);
  return (
    <section
      aria-label="Approval"
      data-approval-banner={decided ? 'decided' : 'asked'}
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[13px] text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200"
      >
        <Glyph size={16} units={24}>
          <path d={DOCUMENT_CHECK} />
        </Glyph>
      </span>
      {decided ? (
        <>
          <p className="min-w-0 flex-1 font-medium" role="status">
            {decidedWords(approval, ctx.door.viewerId)}
          </p>
          <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-end">
            {open ? (
              <Button
                variant="secondary"
                size="xs"
                className={ACTION}
                onClick={() => setChanging(true)}
              >
                Change Decision
              </Button>
            ) : null}
            <Button variant="ghost" size="xs" className={ACTION} onClick={() => setClosedFor(key)}>
              Close
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p>
              <strong className="font-semibold">{who}</strong> asked you to approve this{' '}
              {ctx.door.noun}
              {approval.due ? (
                <>
                  {' by '}
                  <strong className="font-semibold">{dueWords(approval.due)}</strong>
                  {overdue ? (
                    <span className="ml-1.5 rounded-full bg-rose-100 px-1.5 py-px text-[11px] font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
                      Overdue
                    </span>
                  ) : null}
                </>
              ) : null}
              .
            </p>
            {approval.note ? (
              <p className="mt-0.5 line-clamp-2 break-words text-amber-900/80 dark:text-amber-100/80">
                {approval.note}
              </p>
            ) : null}
          </div>
          {writing ? null : (
            <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-end">
              {changing ? (
                <Button
                  variant="ghost"
                  size="xs"
                  className={ACTION}
                  onClick={() => setChanging(false)}
                >
                  Keep My Answer
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="xs"
                className={ACTION}
                disabled={busy !== null}
                onClick={() => setWriting(true)}
              >
                Request Changes
              </Button>
              <Button
                variant="primary"
                size="xs"
                className={ACTION}
                busy={busy === 'approve'}
                disabled={busy === 'request_changes'}
                onClick={() => void decide({ decision: 'approve' })}
              >
                Approve
              </Button>
            </div>
          )}
          {writing ? (
            <form
              className="flex w-full flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                if (note.trim()) void decide({ decision: 'request_changes', note: note.trim() });
              }}
            >
              <label htmlFor={noteId} className="sr-only">
                What needs to change?
              </label>
              <TextArea
                id={noteId}
                ref={field}
                compact
                rows={2}
                value={note}
                maxLength={APPROVAL_NOTE_MAX}
                placeholder="What needs to change?"
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setWriting(false);
                  }
                }}
              />
              <div className="flex shrink-0 items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="xs"
                  className={ACTION}
                  onClick={() => setWriting(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="xs"
                  className={ACTION}
                  disabled={!note.trim()}
                  busy={busy === 'request_changes'}
                >
                  Send
                </Button>
              </div>
            </form>
          ) : null}
        </>
      )}
      {error ? (
        <p role="alert" className="w-full text-[12px] text-rose-700 dark:text-rose-300">
          {error}
        </p>
      ) : null}
    </section>
  );
}
