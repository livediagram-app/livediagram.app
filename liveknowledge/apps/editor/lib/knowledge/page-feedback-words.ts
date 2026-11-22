// What a refused approval or comment request says, in words (docs/specs/030-knowledgebase/approval.md,
// page-comments.md): never a status or a code.
import { APPROVAL_NOTE_MAX, type ApprovalAction } from '@liveknowledge/knowledge';
import { PAGE_THREADS_MAX } from '@liveknowledge/api-schema';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';

const APPROVAL_FALLBACK: Record<ApprovalAction, string> = {
  request: 'Approval could not be requested. Try again.',
  withdraw: 'The request could not be withdrawn. Try again.',
  approve: 'The page could not be approved. Try again.',
  reject: 'The page could not be rejected. Try again.',
};

const APPROVAL_REFUSED: Record<string, string> = {
  forbidden: 'Only an Editor or a Participant takes part in approval.',
  approval_needs_account: 'Sign in to request, approve or reject a page.',
  approval_needs_a_person: 'A person approves or rejects a page.',
  already_pending: 'Someone has already asked for this page to be approved.',
  not_pending: 'This page is no longer waiting for approval.',
  own_request: 'Someone other than the person who asked approves or rejects it.',
  not_your_request: 'Only the person who asked, or an Editor, withdraws a request.',
  note_too_long: `A note is ${APPROVAL_NOTE_MAX} characters at most.`,
  tab_busy: 'The page was being saved. Try again.',
};

export function approvalFailureText(err: unknown, action: ApprovalAction): string {
  if (err instanceof ApiError && err.code && APPROVAL_REFUSED[err.code])
    return APPROVAL_REFUSED[err.code]!;
  return APPROVAL_FALLBACK[action];
}

export type CommentAction = 'start' | 'reply' | 'resolve' | 'reopen' | 'edit' | 'delete' | 'load';

const COMMENT_FALLBACK: Record<CommentAction, string> = {
  start: 'The comment could not be posted. Try again.',
  reply: 'The reply could not be posted. Try again.',
  resolve: 'The thread could not be resolved. Try again.',
  reopen: 'The thread could not be reopened. Try again.',
  edit: 'The comment could not be changed. Try again.',
  delete: 'The comment could not be deleted. Try again.',
  load: 'The comments could not be loaded.',
};

const COMMENT_REFUSED: Record<string, string> = {
  forbidden: 'Only an Editor or a Participant comments on a page.',
  missing_text: 'Write something first.',
  text_too_long: 'A comment is 2,000 characters at most.',
  thread_not_found: 'That thread is gone.',
  comment_not_found: 'That comment is gone.',
  not_your_comment: 'You can change only your own comments.',
  thread_full: `This page holds as many comments as it can (${PAGE_THREADS_MAX} threads).`,
  thread_busy: 'Someone else changed this thread at the same moment. Try again.',
};

export function commentFailureText(err: unknown, action: CommentAction): string {
  if (err instanceof ApiError && err.code && COMMENT_REFUSED[err.code])
    return COMMENT_REFUSED[err.code]!;
  return COMMENT_FALLBACK[action];
}
