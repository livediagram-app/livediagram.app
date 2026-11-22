// A page's approval (docs/specs/030-knowledgebase/approval.md):
//   POST /api/documents/<id>/pages/<tab>/approval   { action: request | withdraw | approve | reject, note? }
// Who may take which action is the knowledge package's rule (approvalRefusal), read here against the caller's grant:
// a writer of the whole knowledgebase with an account; an agent asks and withdraws, never decides. The field and
// the page's row in `page_approvals` are written in one transaction and told to every open editor, as Verify is
// (saveFields). A rejection emails the page's owner.
import { getParticipant } from '../person/profiles';
import { noteWatched } from '../knowledge/watch-notes';
import {
  APPROVAL_NOTE_MAX,
  applyApproval,
  approvalRefusal,
  isApprovalAction,
  type ApprovalCaller,
  type ApprovalRefusal,
  type PageApproval,
} from '@liveknowledge/knowledge';
import { sendPageRejected } from '../knowledge/approval-email';
import { accountOf, readerOf } from '../knowledge/knowledge-caller';
import { pageApprovalStatement } from '../knowledge/page-approvals';
import { json } from '../responses';
import type { DocumentDTO } from '../types';
import type { DocumentAccess, DocumentRouteContext } from './context';
import { saveFields } from './knowledge-page-routes';

const REFUSALS: Record<ApprovalRefusal, { status: number; message: string }> = {
  forbidden: { status: 403, message: 'Only an Editor or a Participant takes part in approval.' },
  approval_needs_account: {
    status: 403,
    message: 'Approval needs a signed-in account: sign in to ask for, approve or reject a page.',
  },
  approval_needs_a_person: {
    status: 403,
    message:
      'An agent asks for approval and withdraws its request; a person approves or rejects a page.',
  },
  already_pending: { status: 409, message: 'This page is already Pending Approval.' },
  not_pending: { status: 409, message: 'This page is not Pending Approval.' },
  own_request: {
    status: 403,
    message: 'Someone other than the person who asked approves or rejects a page.',
  },
  not_your_request: {
    status: 403,
    message: 'Only the person who asked, or an Editor, withdraws a request.',
  },
  note_too_long: {
    status: 400,
    message: `A rejection's note is ${APPROVAL_NOTE_MAX} characters at most.`,
  },
};

const refused = (code: ApprovalRefusal) =>
  json({ error: code, message: REFUSALS[code].message }, { status: REFUSALS[code].status });

/** Who is acting, as the rule reads them. A link confined to one page decides nothing for the knowledgebase. */
export function approvalCallerOf(ctx: DocumentRouteContext, grant: DocumentAccess): ApprovalCaller {
  const reader = readerOf(ctx);
  const writes = grant.tabScope === null && (grant.role === 'edit' || grant.role === 'participate');
  return {
    account: accountOf(ctx),
    role: writes ? grant.role : 'view',
    agent: reader.kind === 'agent' ? reader.name : null,
  };
}

export async function handleApproval(
  ctx: DocumentRouteContext,
  document: DocumentDTO,
  grant: DocumentAccess,
  tab: string,
): Promise<Response> {
  const body = (await ctx.request.json().catch(() => null)) as {
    action?: unknown;
    note?: unknown;
  } | null;
  if (!body || typeof body !== 'object' || !isApprovalAction(body.action))
    return json(
      {
        error: 'invalid_body',
        message:
          'Send { "action": "request" | "withdraw" | "approve" | "reject", "note"?: string }.',
      },
      { status: 400 },
    );
  const action = body.action;
  if (body.note !== undefined && (typeof body.note !== 'string' || action !== 'reject'))
    return json(
      { error: 'invalid_note', message: 'A note is a string, and only a rejection takes one.' },
      { status: 400 },
    );
  const note = typeof body.note === 'string' ? body.note : undefined;
  const known = approvalCallerOf(ctx, grant);
  // The profile's name rides the record, so a reader whose editor cannot name the account still sees who.
  const profile = known.account ? await getParticipant(ctx.env, known.account) : null;
  const caller = { ...known, name: profile?.name ?? null };
  const account = caller.account;
  // Settled on each attempt (saveFields repeats once on a lost race); read by the row's write and the email.
  let approval: PageApproval | undefined;
  let owner: string | undefined;
  const response = await saveFields(
    ctx,
    document,
    tab,
    async (page) => {
      const refusal = approvalRefusal(action, page.fields.approval, caller, note);
      if (refusal || !account) return refused(refusal ?? 'approval_needs_account');
      const next = applyApproval(page.fields, action, { ...caller, account }, Date.now(), note);
      approval = next.approval;
      owner = next.owner;
      return next;
    },
    {
      verified: action === 'approve',
      also: (rev) => [pageApprovalStatement(ctx.env, tab, approval, rev)],
    },
  );
  if (!response.ok) return response;
  console.info('[knowledge] approval', { documentId: document.id, tabId: tab, action });
  // A decision is news to the page's watchers (watching.md "Approved, Rejected"); a request or a withdrawal is not.
  if ((action === 'approve' || action === 'reject') && account)
    await noteWatched(ctx.env, {
      tabs: [tab],
      kind: action === 'approve' ? 'approved' : 'rejected',
      actor: () => ({ id: account, name: caller.name || 'Someone' }),
    });
  if (action === 'reject' && account) {
    const title = document.tabs.find((t) => t.id === tab)?.name ?? '';
    const sending = sendPageRejected(
      ctx.env,
      document,
      { tab, title, owner },
      account,
      approval?.note,
    );
    // After the answer where the runtime keeps the request alive for it; else before it.
    if (ctx.waitUntil) ctx.waitUntil(sending);
    else await sending;
  }
  return response;
}
