// A page's approval (docs/specs/030-knowledgebase/approval.md): its field read defensively, who may take which action,
// and the fields after one. Pure: the api enforces these rules and the editor shows only what they allow, from the same
// functions, so the two never disagree.
import {
  APPROVAL_NOTE_MAX,
  MAX_AGENT_NAME,
  MAX_PERSON_NAME,
  type ApprovalAction,
  type PageApproval,
} from './approval-field';
import { verified, type KnowledgeFields } from './trust';

/** Who is acting: their account (null for a guest or a link visitor), the role they act at, and an agent's name
 *  when the request bears an API token. */
export type ApprovalCaller = {
  account: string | null;
  role: 'edit' | 'participate' | 'view';
  agent: string | null;
  /** Their profile's name, kept with the record they make (absent where none is known). */
  name?: string | null;
};

const nameOf = (caller: ApprovalCaller) =>
  caller.name?.trim().slice(0, MAX_PERSON_NAME) || undefined;

export type ApprovalRefusal =
  | 'forbidden'
  | 'approval_needs_account'
  | 'approval_needs_a_person'
  | 'already_pending'
  | 'not_pending'
  | 'own_request'
  | 'not_your_request'
  | 'note_too_long';

/** Why `caller` may not take `action` on a page whose approval is `approval`, or null when they may. */
export function approvalRefusal(
  action: ApprovalAction,
  approval: PageApproval | undefined,
  caller: ApprovalCaller,
  note?: string,
): ApprovalRefusal | null {
  if (caller.role === 'view') return 'forbidden';
  if (!caller.account) return 'approval_needs_account';
  const pending = approval?.state === 'pending';
  switch (action) {
    case 'request':
      return pending ? 'already_pending' : null;
    case 'withdraw':
      if (!pending) return 'not_pending';
      // The person who asked (an agent's request is its person's), or an Editor in person.
      if (approval.requestedBy === caller.account) return null;
      return caller.role === 'edit' && !caller.agent ? null : 'not_your_request';
    case 'approve':
    case 'reject':
      // A person's judgement: never an agent's, never one's own request.
      if (caller.agent) return 'approval_needs_a_person';
      if (!pending) return 'not_pending';
      if (approval.requestedBy === caller.account) return 'own_request';
      if (action === 'reject' && note !== undefined && note.trim().length > APPROVAL_NOTE_MAX)
        return 'note_too_long';
      return null;
  }
}

/** The actions `caller` may take now, in the order the interface offers them. */
export function approvalActions(
  approval: PageApproval | undefined,
  caller: ApprovalCaller,
): ApprovalAction[] {
  return (['approve', 'reject', 'request', 'withdraw'] as const).filter(
    (action) => approvalRefusal(action, approval, caller) === null,
  );
}

/**
 * The page's fields after `action`, which the caller may take (approvalRefusal). Approving verifies the page as
 * Verify does (its approver vouches for it, and owns a page with none); withdrawing clears the approval; a request
 * replaces whatever was decided before.
 */
export function applyApproval(
  fields: KnowledgeFields,
  action: ApprovalAction,
  caller: ApprovalCaller & { account: string },
  now: number,
  note?: string,
): KnowledgeFields {
  const { approval: was, ...rest } = fields;
  switch (action) {
    case 'request':
      return {
        ...rest,
        approval: {
          state: 'pending',
          requestedBy: caller.account,
          requestedAt: now,
          ...(caller.agent ? { requestedByAgent: caller.agent.slice(0, MAX_AGENT_NAME) } : {}),
          ...(nameOf(caller) ? { requestedByName: nameOf(caller) } : {}),
        },
      };
    case 'withdraw':
      return rest;
    case 'approve':
      return {
        ...verified(rest, caller.account, now),
        approval: {
          ...was!,
          state: 'approved',
          decidedBy: caller.account,
          decidedAt: now,
          ...(nameOf(caller) ? { decidedByName: nameOf(caller) } : {}),
        },
      };
    case 'reject': {
      const kept = note?.trim().slice(0, APPROVAL_NOTE_MAX);
      return {
        ...rest,
        approval: {
          ...was!,
          state: 'rejected',
          decidedBy: caller.account,
          decidedAt: now,
          ...(nameOf(caller) ? { decidedByName: nameOf(caller) } : {}),
          ...(kept ? { note: kept } : {}),
        },
      };
    }
  }
}
