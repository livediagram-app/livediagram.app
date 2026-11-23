'use client';

// Approval in the meta row (docs/specs/030-knowledgebase/approval.md "Where it shows"): a violet Pending Approval or
// rose Rejected pill for a page that has one, else Request Approval, a quiet button the row's size, for whoever may
// ask. Either opens the Approval popover (ApprovalPanel), which asks before it requests and holds Approve, Reject and
// Withdraw. Nothing at all for a page never asked about that the person here cannot ask about.
import { useId, useState, type ReactNode } from 'react';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { useRelativeNow } from '@/lib/relative-time';
import { useKnowledgePeople } from '../usePageKnowledge';
import { usePageApproval } from './usePageApproval';
import type { ApprovalAction, PageApproval } from '@liveknowledge/knowledge';
import { ResponsivePopover } from '@liveknowledge/ui';
import { approvalMark, APPROVAL_MARK_LABEL } from '@/lib/knowledge/approval-view';
import { ApprovalPanel, PENDING_PILL, REJECTED_PILL } from './ApprovalPanel';
import { PendingIcon, RejectedIcon, RequestIcon } from './feedback-icons';

export type PageApprovalMetaProps = {
  approval: PageApproval | undefined;
  actions: readonly ApprovalAction[];
  nameOf: (id: string | undefined) => string | undefined;
  self: string | null;
  now: number;
  onAct: (action: ApprovalAction, note?: string) => Promise<boolean>;
};

/** Whether the meta row draws anything for this approval: a Pending or Rejected pill only. Asking starts from the
 *  page's menu (owner 2026-11-21), so a page with none shows nothing here. */
export const showsApprovalMeta = (
  approval: PageApproval | undefined,
  _actions: readonly ApprovalAction[],
) => approvalMark(approval) !== undefined;

export function PageApprovalMeta(props: PageApprovalMetaProps) {
  const { approval, actions } = props;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const titleId = useId();
  const open = anchor !== null;
  const close = () => setAnchor(null);
  const mark = approvalMark(approval);
  if (!showsApprovalMeta(approval, actions)) return null;
  const trigger = mark ? (
    <button
      type="button"
      data-approval-pill={mark}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={(e) => setAnchor(e.currentTarget)}
      className={`optical-edges inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[13px] font-medium transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 phone:min-h-11 dark:hover:brightness-110 ${
        mark === 'pending' ? PENDING_PILL : REJECTED_PILL
      }`}
    >
      {mark === 'pending' ? <PendingIcon /> : <RejectedIcon />}
      <span className="text-optical-line">{APPROVAL_MARK_LABEL[mark]}</span>
    </button>
  ) : (
    <button
      type="button"
      data-meta-request-approval=""
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={(e) => setAnchor(e.currentTarget)}
      // As Verify: the row's 13 px and slate, its padding hover room only, pulled back by its negative margin.
      className={`-mx-1.5 inline-flex h-6 cursor-pointer items-center gap-1 rounded-md px-1.5 text-[13px] font-normal leading-5 text-slate-500 transition-colors hover:bg-violet-50 hover:text-violet-800 focus-visible:outline-2 focus-visible:outline-violet-600 phone:h-11 dark:text-slate-400 dark:hover:bg-violet-500/15 dark:hover:text-violet-200 ${
        open ? 'bg-violet-50 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200' : ''
      }`}
    >
      <RequestIcon />
      {approval ? 'Request Again' : 'Request Approval'}
    </button>
  );
  return (
    <>
      {trigger}
      <ResponsivePopover open={open} onClose={close} anchor={anchor} titleId={titleId} width={340}>
        <div data-approval-popover="">
          <ApprovalPanel
            {...props}
            // Request Again from the button reads as a fresh ask.
            approval={mark ? approval : undefined}
            titleId={titleId}
            onCancel={close}
            onAct={async (action, note) => {
              const done = await props.onAct(action, note);
              if (done) close();
              return done;
            }}
          />
        </div>
      </ResponsivePopover>
    </>
  );
}

/** The current page's approval for the meta row, from the editor's stores: its node, or null when it draws
 *  nothing (so the row adds no separator for it). */
export function useCurrentApprovalMeta(): ReactNode {
  const pageId = useEditorChrome((s) => s.activeId);
  const stored = useEditorChrome((s) => s.activeTab.knowledge);
  const page = usePageApproval(pageId, stored);
  const { nameOf } = useKnowledgePeople();
  const now = useRelativeNow();
  if (!showsApprovalMeta(page.approval, page.actions)) return null;
  return (
    <PageApprovalMeta
      approval={page.approval}
      actions={page.actions}
      nameOf={nameOf}
      self={page.self}
      now={now}
      onAct={(action, note) => page.act(pageId, action, note)}
    />
  );
}
