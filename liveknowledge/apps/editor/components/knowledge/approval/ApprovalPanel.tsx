'use client';

// What a page's approval says and the actions the person here may take (docs/specs/030-knowledgebase/approval.md
// "Where it shows"): one body for the meta row's popover and Page Health's Approval panel, so the two never differ.
// The state with its glyph, who asked and when, who decided and when, a rejection's note in a quote, then the
// actions: Approve and Reject (a note field first), Withdraw, Request Approval or Request Again.
import { useId, useState, type ReactNode } from 'react';
import {
  APPROVAL_NOTE_MAX,
  type ApprovalAction,
  type PageApproval,
} from '@liveknowledge/knowledge';
import { Button, TextArea } from '@liveknowledge/ui';
import {
  approvalHeading,
  approvalPrompt,
  decidedLine,
  requestedLine,
} from '@/lib/knowledge/approval-view';
import {
  ApprovedPanelIcon,
  PendingPanelIcon,
  RejectedPanelIcon,
  RequestIcon,
} from './feedback-icons';

// Violet is approval's own hue (approval.md "States"); rose a refusal; brand the Verified a decision makes.
export const PENDING_PILL =
  'bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-100';
export const REJECTED_PILL = 'bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-100';

const RING: Record<PageApproval['state'] | 'none', string> = {
  none: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-900/50',
  pending:
    'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-900/50',
  rejected:
    'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-900/50',
  approved:
    'bg-brand-50 text-brand-700 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-900/50',
};

function StateGlyph({ approval }: { approval: PageApproval | undefined }): ReactNode {
  if (!approval) return <RequestIcon size={18} />;
  if (approval.state === 'pending') return <PendingPanelIcon />;
  if (approval.state === 'rejected') return <RejectedPanelIcon />;
  return <ApprovedPanelIcon />;
}

export type ApprovalPanelProps = {
  approval: PageApproval | undefined;
  actions: readonly ApprovalAction[];
  nameOf: (id: string | undefined) => string | undefined;
  self: string | null;
  now: number;
  /** Takes the action; resolves true once it landed (the popover closes then). */
  onAct: (action: ApprovalAction, note?: string) => Promise<boolean> | void;
  /** The popover's Cancel; Page Health's panel has none. */
  onCancel?: () => void;
  /** The heading's id, for the popover's aria-labelledby. */
  titleId?: string;
  /** Page Health's panel: a smaller heading level, and no prompt for a page never asked about. */
  inPanel?: boolean;
};

export function ApprovalPanel({
  approval,
  actions,
  nameOf,
  self,
  now,
  onAct,
  onCancel,
  titleId,
  inPanel = false,
}: ApprovalPanelProps) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const noteId = useId();
  const act = async (action: ApprovalAction, withNote?: string) => {
    setBusy(true);
    try {
      const done = await onAct(action, withNote);
      if (done !== false) {
        setRejecting(false);
        setNote('');
      }
    } finally {
      setBusy(false);
    }
  };
  const state = approval?.state ?? 'none';
  const decided = approval ? decidedLine(approval, nameOf, self, now) : undefined;
  const Heading = inPanel ? 'h3' : 'h2';
  const tooLong = note.trim().length > APPROVAL_NOTE_MAX;
  return (
    <div data-approval-panel={state} className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${RING[state]}`}
        >
          <StateGlyph approval={approval} />
        </span>
        <div className="min-w-0">
          <Heading
            id={titleId}
            className="text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            {approvalHeading(approval)}
          </Heading>
          {approval ? (
            <p className="mt-0.5 text-[13px] leading-5 text-slate-600 dark:text-slate-400">
              {requestedLine(approval, nameOf, self, now)}
            </p>
          ) : null}
          {decided ? (
            <p className="text-[13px] leading-5 text-slate-600 dark:text-slate-400">{decided}</p>
          ) : null}
          {approval?.state === 'rejected' && approval.note ? (
            <blockquote
              data-approval-note=""
              className="mt-2 whitespace-pre-wrap break-words border-l-2 border-rose-300 pl-2.5 text-[13px] leading-5 text-slate-700 dark:border-rose-500/60 dark:text-slate-300"
            >
              {approval.note}
            </blockquote>
          ) : null}
          {!rejecting && (approval || !inPanel) ? (
            <p className="mt-2 text-[13px] leading-5 text-slate-600 dark:text-slate-400">
              {approvalPrompt(approval, actions)}
            </p>
          ) : null}
        </div>
      </div>
      {rejecting ? (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={noteId}
            className="text-[13px] font-medium text-slate-700 dark:text-slate-300"
          >
            What needs to change? (optional)
          </label>
          <TextArea
            id={noteId}
            data-approval-note-field=""
            rows={3}
            autoFocus
            value={note}
            invalid={tooLong}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !tooLong) {
                e.preventDefault();
                void act('reject', note.trim() || undefined);
              }
            }}
            className="resize-none text-[13px]"
          />
          <p
            className={`self-end text-xs tabular-nums ${tooLong ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}
          >
            {note.trim().length}/{APPROVAL_NOTE_MAX}
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRejecting(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              size="sm"
              disabled={busy || tooLong}
              onClick={() => void act('reject', note.trim() || undefined)}
              className="cursor-pointer bg-rose-700 hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500"
            >
              Reject
            </Button>
          </div>
        </div>
      ) : actions.length > 0 || onCancel ? (
        <div className="flex flex-wrap justify-end gap-2">
          {onCancel ? (
            <Button variant="secondary" size="sm" onClick={onCancel} className="cursor-pointer">
              {actions.length ? 'Cancel' : 'Close'}
            </Button>
          ) : null}
          {actions.includes('withdraw') ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void act('withdraw')}
              className="cursor-pointer"
            >
              Withdraw
            </Button>
          ) : null}
          {actions.includes('reject') ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => setRejecting(true)}
              className="cursor-pointer text-rose-800 dark:text-rose-200"
            >
              Reject
            </Button>
          ) : null}
          {actions.includes('approve') ? (
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => void act('approve')}
              className="cursor-pointer"
            >
              Approve
            </Button>
          ) : null}
          {actions.includes('request') ? (
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => void act('request')}
              className="cursor-pointer"
            >
              {approval ? 'Request Again' : 'Request Approval'}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
