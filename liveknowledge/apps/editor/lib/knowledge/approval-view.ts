// A page's approval as the editor shows it (docs/specs/030-knowledgebase/approval.md): who the person here is to the
// rule, which actions they may take (the engine's own `approvalActions`, the api's rule too), what the pill and the
// tree's dot say, and the sentences the popover and Page Health print. Pure: presentation only, the api is the rule.
import {
  approvalActions,
  parseApproval,
  type ApprovalAction,
  type ApprovalCaller,
  type PageApproval,
} from '@liveknowledge/knowledge';
import type { AccessLevel } from '@liveknowledge/api-schema';
import { relativeSince } from '@/lib/relative-time';

/** The person here as the approval rule reads them. A link confined to one page, and a knowledgebase kept Offline,
 *  decide nothing: they read as a Viewer. */
export function approvalCallerOf(input: {
  level: AccessLevel;
  account: string | null;
  isStructureReadOnly: boolean;
  offline: boolean;
}): ApprovalCaller {
  const writes =
    (input.level === 'edit' || input.level === 'participate') &&
    !input.isStructureReadOnly &&
    !input.offline;
  return {
    account: input.account,
    role: writes ? input.level : 'view',
    agent: null,
  };
}

/** The approval the page's fields carry, read defensively. */
export const approvalOfFields = (fields: { approval?: unknown } | undefined) =>
  parseApproval(fields?.approval);

/** The actions the person may take on the page now. */
export const approvalActionsOf = (approval: PageApproval | undefined, caller: ApprovalCaller) =>
  approvalActions(approval, caller);

/** What a row or the meta row shows of an approval: a pending or rejected mark; an approved page shows its Verified
 *  tick instead, so it has none of its own. */
export type ApprovalMark = 'pending' | 'rejected';
export const approvalMark = (approval: PageApproval | undefined): ApprovalMark | undefined =>
  approval?.state === 'pending' || approval?.state === 'rejected' ? approval.state : undefined;

export const APPROVAL_MARK_LABEL: Record<ApprovalMark, string> = {
  pending: 'Pending Approval',
  rejected: 'Rejected',
};

/** The marks of every page that has one, from the tab list alone: one pass, no request. */
export function approvalMarks(
  pages: readonly { id: string; knowledge?: unknown }[],
  fieldsOf: (page: { id: string; knowledge?: unknown }) => unknown = (page) => page.knowledge,
): ReadonlyMap<string, ApprovalMark> {
  const marks = new Map<string, ApprovalMark>();
  for (const page of pages) {
    const fields = fieldsOf(page);
    if (!fields || typeof fields !== 'object') continue;
    const mark = approvalMark(approvalOfFields(fields));
    if (mark) marks.set(page.id, mark);
  }
  return marks;
}

type NameOf = (id: string | undefined) => string | undefined;

/** "Priya Shah", "you", or "Someone" for an account the editor cannot name. */
function who(
  id: string | undefined,
  kept: string | undefined,
  nameOf: NameOf,
  self: string | null,
): string {
  if (id && id === self) return 'you';
  // The editor's people first (a renamed profile reads as now), else the name kept with the record.
  return nameOf(id) ?? kept ?? 'Someone';
}

/** "Requested by Priya Shah, 3 hours ago", "Requested by Claude for Priya Shah, ...", "Requested by you, ...". */
export function requestedLine(
  approval: PageApproval,
  nameOf: NameOf,
  self: string | null,
  now: number,
): string {
  const person = who(approval.requestedBy, approval.requestedByName, nameOf, self);
  const by = approval.requestedByAgent ? `${approval.requestedByAgent} for ${person}` : person;
  return `Requested by ${by}, ${relativeSince(approval.requestedAt, now)}`;
}

/** "Approved by Priya Shah, 2 days ago" or "Rejected by you, just now"; undefined while pending. */
export function decidedLine(
  approval: PageApproval,
  nameOf: NameOf,
  self: string | null,
  now: number,
): string | undefined {
  if (approval.state === 'pending' || approval.decidedAt === undefined) return undefined;
  const verb = approval.state === 'approved' ? 'Approved' : 'Rejected';
  const person = who(approval.decidedBy, approval.decidedByName, nameOf, self);
  return `${verb} by ${person}, ${relativeSince(approval.decidedAt, now)}`;
}

/** What the popover says above its buttons, for the person here. */
export function approvalPrompt(
  approval: PageApproval | undefined,
  actions: readonly ApprovalAction[],
): string {
  if (!approval)
    return 'Signed-in members of this knowledgebase can approve or reject it. Approving also verifies it.';
  if (approval.state === 'pending') {
    if (actions.includes('approve')) return 'Approving verifies the page as it stands today.';
    if (actions.includes('withdraw')) return 'Waiting for someone else to approve it.';
    return 'Waiting for a signed-in member to approve it.';
  }
  if (approval.state === 'rejected')
    return actions.includes('request')
      ? 'Change what the note asks, then request approval again.'
      : 'It needs changes before it is approved.';
  return 'It was approved, and verified with it.';
}

/** The heading of the popover and Page Health's panel. */
export function approvalHeading(approval: PageApproval | undefined): string {
  if (!approval) return 'Request Approval?';
  return approval.state === 'pending'
    ? 'Pending Approval'
    : approval.state === 'rejected'
      ? 'Rejected'
      : 'Approved';
}
