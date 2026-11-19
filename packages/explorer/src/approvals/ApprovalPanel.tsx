'use client';

// The Share dialog's Approval tab (approvals.md "In the editor"), for an Editor of the whole item. With no request
// (or a cancelled one), the form; with one, where it stands: its status pill, who asked and when, the note and due
// day, the snapshot it points at, and each approver's decision and note, with Cancel Request (open only, confirmed in
// place) and New Request, which opens the form again saying it replaces the open one.

import { useState } from 'react';
import type { Approval } from '@liveworkspace/index-client';
import { Button, PictureDisc } from '@liveworkspace/ui';
import { dateFormat } from '@liveworkspace/ui/date-format';
import { HelpLink } from '../dialogs/share/HelpLink';
import { SECTION_LABEL } from '../dialogs/share/parts';
import { initials } from '../library/person-name';
import { ApprovalPill } from './ApprovalBadge';
import { ApprovalForm, PlaceholderRows } from './ApprovalForm';
import { DECISION_WORDS, dueWords, isOverdue, personName, statusWords } from './approval-words';
import { useApprovalDoor, type ApprovalContext } from './door';

const ASKED_AT = dateFormat({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const DECISION_TONE = {
  pending: 'text-slate-500 dark:text-slate-400',
  approved: 'text-emerald-700 dark:text-emerald-300',
  changes_requested: 'text-rose-700 dark:text-rose-300',
} as const;

/** The tab's form or status, with a link to the Request Approval article under it where the app has one. */
export function ApprovalPanel({ helpHref }: { helpHref?: string }) {
  const body = <ApprovalBody />;
  if (!helpHref) return body;
  return (
    <>
      {body}
      <div className="-mt-2">
        <HelpLink href={helpHref} label="How approvals work" variant="text" />
      </div>
    </>
  );
}

function ApprovalBody() {
  const ctx = useApprovalDoor();
  const [asking, setAsking] = useState(false);
  if (!ctx) return null;
  const { approval, loaded, failed } = ctx;
  if (!loaded) return <PlaceholderRows />;
  if (failed && !approval) {
    return (
      <div className="flex items-center justify-between gap-3 text-sm text-rose-700 dark:text-rose-300">
        <p>Couldn’t load the approval.</p>
        <Button variant="secondary" size="xs" onClick={ctx.refresh}>
          Try Again
        </Button>
      </div>
    );
  }
  const current = approval && approval.status ? approval : null;
  if (!current || asking) {
    return (
      <ApprovalForm
        ctx={ctx}
        replacing={current?.state === 'open'}
        onBack={current ? () => setAsking(false) : null}
        onDone={(next) => {
          ctx.setApproval(next);
          setAsking(false);
        }}
      />
    );
  }
  return <ApprovalStatusView ctx={ctx} approval={current} onNew={() => setAsking(true)} />;
}

function ApprovalStatusView({
  ctx,
  approval,
  onNew,
}: {
  ctx: ApprovalContext;
  approval: Approval;
  onNew: () => void;
}) {
  const { door } = ctx;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const words = statusWords(approval);
  const open = approval.state === 'open';
  const asker =
    approval.requestedBy.id === door.viewerId ? 'You' : personName(approval.requestedBy);

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await door.client.cancelApproval(door.itemId, door.share);
      ctx.setApproval(null);
    } catch {
      setError('Couldn’t cancel the request. Try again.');
      ctx.refresh();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {words ? <ApprovalPill {...words} /> : null}
          {approval.snapshotId ? (
            <span className="rounded-full bg-slate-100 px-2 py-px text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Snapshot saved
            </span>
          ) : null}
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-200">
          <strong className="font-semibold">{asker}</strong> asked{' '}
          {ASKED_AT.format(approval.createdAt)}
          {approval.due ? (
            <>
              {', due '}
              <strong className="font-semibold">{dueWords(approval.due)}</strong>
              {open && isOverdue(approval.due) ? (
                <span className="ml-1.5 rounded-full bg-rose-100 px-1.5 py-px text-[11px] font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
                  Overdue
                </span>
              ) : null}
            </>
          ) : null}
        </p>
        {approval.note ? (
          <p className="whitespace-pre-line break-words rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
            {approval.note}
          </p>
        ) : null}
      </div>

      <section aria-label="Approvers" className="flex flex-col gap-2">
        <h3 className={SECTION_LABEL}>Approvers</h3>
        <ul className="flex flex-col gap-2">
          {approval.approvers.map((a) => {
            const name = a.id === door.viewerId ? 'You' : personName(a);
            return (
              <li key={a.id} className="flex items-start gap-3">
                <PictureDisc
                  aria-hidden
                  pictureUrl={null}
                  name={name}
                  size={24}
                  className="mt-0.5 bg-brand-100 text-[10px] font-semibold text-brand-800 dark:bg-brand-500/20 dark:text-brand-200"
                >
                  {initials(personName(a)) ?? '?'}
                </PictureDisc>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm text-slate-800 dark:text-slate-100">
                      {name}
                    </span>
                    <span className={`shrink-0 text-xs font-medium ${DECISION_TONE[a.decision]}`}>
                      {DECISION_WORDS[a.decision]}
                    </span>
                  </div>
                  {a.note ? (
                    <p className="mt-0.5 whitespace-pre-line break-words text-xs text-slate-600 dark:text-slate-300">
                      {a.note}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {error ? (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
          {error}
        </p>
      ) : null}
      {confirming ? (
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg bg-rose-50 px-3 py-2 dark:bg-rose-500/10">
          <p className="mr-auto text-sm text-rose-900 dark:text-rose-100">
            Cancel this request? Its answers stay in History.
          </p>
          <Button variant="ghost" size="xs" onClick={() => setConfirming(false)}>
            Keep It
          </Button>
          <Button
            variant="solid"
            size="xs"
            busy={busy}
            onClick={() => void cancel()}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            Cancel Request
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-2">
          {open ? (
            <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
              Cancel Request
            </Button>
          ) : null}
          <Button variant="primary" size="sm" onClick={onNew}>
            New Request
          </Button>
        </div>
      )}
    </div>
  );
}
