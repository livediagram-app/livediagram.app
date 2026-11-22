// What AI Knowledge says after an Editor asks for a Knowledgebase Reviews email (docs/specs/030-knowledgebase/
// ai-knowledge.md "Pages that disagree", "Knowledge Health"): what was sent, or why nothing was, in words. Pure.
import type { KnowledgeEmailResult } from '@liveknowledge/api-schema';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { shortDate } from '@/lib/knowledge/page-trust';

export type OwnersEmail = 'ask' | 'remind';

const owners = (n: number) => `${n.toLocaleString('en')} ${n === 1 ? 'owner' : 'owners'}`;
const NOT_REACHED =
  'have these emails turned off, have no verified address or can no longer open this knowledgebase';

/** One sentence for the toast. */
export function emailResultText(
  result: KnowledgeEmailResult,
  kind: OwnersEmail,
  now: number,
): string {
  switch (result.outcome) {
    case 'sent':
      return result.sent === result.owners
        ? `Sent to ${owners(result.sent)}.`
        : `Sent to ${result.sent.toLocaleString('en')} of ${owners(result.owners)}. The rest ${NOT_REACHED}.`;
    case 'already_sent':
      if (kind === 'ask')
        return `The owners were already asked on ${shortDate(result.sentAt, now)}.`;
      return result.nextAt
        ? `The owners were already reminded this week. They can be reminded again on ${shortDate(result.nextAt, now)}.`
        : 'The owners were already reminded this week.';
    case 'no_owners':
      return kind === 'ask'
        ? 'Neither page has an owner to ask. Set one in Page Health.'
        : 'None of the pages to review has an owner. Set one in Page Health.';
    case 'nothing_due':
      return 'Every page is verified, so there is nobody to remind.';
    case 'verification_off':
      return 'This knowledgebase has no Review Period, so there is nothing to review.';
    case 'no_recipients':
      return `No email was sent: the owners ${NOT_REACHED}.`;
    case 'daily_limit':
      return 'This knowledgebase has sent all its review emails for today. Try again tomorrow.';
    case 'unavailable':
      return 'This server does not send email.';
  }
}

/** A request that failed outright. */
export function emailFailureText(err: unknown, kind: OwnersEmail): string {
  if (err instanceof ApiError) {
    if (err.code === 'conflict_unknown')
      return 'This disagreement has closed since: one of the passages changed.';
    if (err.status === 403) return 'Only a signed-in Editor can email the owners.';
  }
  return kind === 'ask'
    ? 'The owners could not be asked. Check your connection and try again.'
    : 'The owners could not be reminded. Check your connection and try again.';
}

/** "Owners asked 14 Nov", "Owners reminded 14 Nov": what stands in for the button once the email has gone. */
export const ownersEmailedText = (kind: OwnersEmail, at: number, now: number): string =>
  `Owners ${kind === 'ask' ? 'asked' : 'reminded'} ${shortDate(at, now)}`;

/** Whether the owners may be reminded again: a week after the last time. */
export const REMIND_GAP_MS = 7 * 86_400_000;
export const remindedThisWeek = (remindedAt: number | undefined, now: number): boolean =>
  remindedAt !== undefined && remindedAt > now - REMIND_GAP_MS;
