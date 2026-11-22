// What a refused approval or comment request says, in words (docs/specs/030-knowledgebase/approval.md,
// page-comments.md): never a status or a code.
import { APPROVAL_NOTE_MAX, type ApprovalAction } from '@liveknowledge/knowledge';
import { PAGE_THREADS_MAX, WATCHES_PER_KNOWLEDGEBASE_MAX } from '@liveknowledge/api-schema';
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

const REACTION_REFUSED: Record<string, string> = {
  invalid_emoji: 'A reaction is one emoji.',
  reaction_needs_account: 'Sign in to react to a page.',
  reactions_full: 'This page holds as many reactions as it can.',
  too_many_reactions: 'You have put as many different reactions on this page as it takes.',
  reacting_too_fast: 'That was a lot of reactions at once. Try again in a moment.',
};

/** A refused reaction (docs/specs/030-knowledgebase/page-reactions.md), in words. */
export function reactionFailureText(err: unknown, on: boolean): string {
  if (err instanceof ApiError && err.code && REACTION_REFUSED[err.code])
    return REACTION_REFUSED[err.code]!;
  return on
    ? 'The reaction could not be added. Try again.'
    : 'The reaction could not be taken back. Try again.';
}

const WATCH_REFUSED: Record<string, string> = {
  watch_needs_account: 'Sign in to watch a page.',
  not_a_section: 'This page has no subpages to watch with it.',
  section_out_of_reach: 'Your link opens this page alone, so you can watch only this page.',
  watchers_full: `This knowledgebase holds as many watches as it can (${WATCHES_PER_KNOWLEDGEBASE_MAX.toLocaleString('en')}).`,
  watching_too_fast: 'That was a lot of changes at once. Try again in a moment.',
};

/** A refused watch (docs/specs/030-knowledgebase/watching.md), in words. */
export function watchFailureText(err: unknown, on: boolean): string {
  if (err instanceof ApiError && err.code && WATCH_REFUSED[err.code])
    return WATCH_REFUSED[err.code]!;
  return on
    ? 'The page could not be watched. Try again.'
    : 'The watch could not be stopped. Try again.';
}
