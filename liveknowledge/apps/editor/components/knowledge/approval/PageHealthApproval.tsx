'use client';

// Approval in the Page Info rail, under Page Health (docs/specs/030-knowledgebase/approval.md "Where it shows"): the
// same body as the meta row's popover (ApprovalPanel) in a panel washed in its state's hue, with its actions one press
// away. Drawn for a page that has an approval, or one the person here may ask about; nothing otherwise.
import { useId } from 'react';
import type { PageApproval } from '@liveknowledge/knowledge';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { useRelativeNow } from '@/lib/relative-time';
import { useKnowledgePeople } from '../usePageKnowledge';
import { ApprovalPanel, type ApprovalPanelProps } from './ApprovalPanel';
import { usePageApproval } from './usePageApproval';
import { clearApprovalAsk, useApprovalAsked } from '@/lib/knowledge/approval-asked';

const WASH: Record<PageApproval['state'] | 'none', string> = {
  none: 'bg-slate-50 ring-slate-200/70 dark:bg-slate-900/50 dark:ring-slate-800',
  pending: 'bg-violet-50/70 ring-violet-100 dark:bg-violet-500/10 dark:ring-violet-900/50',
  rejected: 'bg-rose-50/70 ring-rose-100 dark:bg-rose-500/10 dark:ring-rose-900/50',
  approved: 'bg-brand-50/60 ring-brand-100 dark:bg-brand-500/10 dark:ring-brand-900/50',
};

export function PageHealthApprovalView({
  asked = false,
  onPutAway,
  ...props
}: Omit<ApprovalPanelProps, 'inPanel' | 'onCancel'> & {
  /** Asked for from the page menu: the request form shows on a page with no approval yet. */
  asked?: boolean;
  onPutAway?: () => void;
}) {
  const titleId = useId();
  // Nothing until the page has an approval, or one is asked for from its menu (owner 2026-11-21).
  if (!props.approval && !(asked && props.actions.includes('request'))) return null;
  // Asking for the first time confirms in a centred modal, never in the rail (owner 2026-11-22).
  if (!props.approval)
    return (
      <Dialog open onClose={() => onPutAway?.()} titleId={titleId} size="sm" phoneSheet>
        <div data-health-approval="" className="p-6">
          <ApprovalPanel {...props} titleId={titleId} onCancel={() => onPutAway?.()} />
        </div>
      </Dialog>
    );
  return (
    <section aria-label="Approval" data-health-approval="">
      {/* Inside Page Health, above the Verified panel (owner 2026-11-22): the panel's own heading names it. */}
      <div
        className={`mt-3 rounded-2xl p-4 ring-1 ring-inset ${WASH[props.approval?.state ?? 'none']}`}
      >
        {/* A page already asked about has nothing to put away (owner 2026-11-21: its Cancel did nothing), so it
            shows its actions alone; the first request is the modal's above. */}
        <ApprovalPanel {...props} inPanel />
      </div>
    </section>
  );
}

/** The current page's approval panel, from the editor's stores. */
export function PageHealthApproval() {
  const pageId = useEditorChrome((s) => s.activeId);
  const stored = useEditorChrome((s) => s.activeTab.knowledge);
  const page = usePageApproval(pageId, stored);
  const { nameOf } = useKnowledgePeople();
  const now = useRelativeNow();
  const asked = useApprovalAsked(pageId);
  return (
    <PageHealthApprovalView
      // Keyed by page, so a half-written rejection note never carries to the next page.
      key={pageId}
      asked={asked}
      onPutAway={clearApprovalAsk}
      approval={page.approval}
      actions={page.actions}
      nameOf={nameOf}
      self={page.self}
      now={now}
      onAct={async (action, note) => {
        const done = await page.act(pageId, action, note);
        if (done) clearApprovalAsk();
        return done;
      }}
    />
  );
}
