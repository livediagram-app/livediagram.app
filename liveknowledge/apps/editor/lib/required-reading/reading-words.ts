// Required Reading's words (docs/specs/030-knowledgebase/required-reading.md): the counts, the banner's line, the
// reminders' toasts and every refusal, in one place so the banner, Page Info and the setup panel agree.
import { READING_PEOPLE_MAX, type ReadingRemindResult } from '@liveknowledge/api-schema';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { shortDate } from '@/lib/knowledge/page-trust';
import { formatRelativeTime } from '@/lib/relative-time';

const people = (n: number) => (n === 1 ? '1 person' : `${n.toLocaleString('en')} people`);

/** "7 of 12 have read it" (one: "has"). */
export function progressText(done: number, total: number): string {
  return `${done.toLocaleString('en')} of ${total.toLocaleString('en')} ${
    total === 1 ? 'has' : 'have'
  } read it`;
}

/** Who is asked: "Everyone" or "4 People". */
export function audienceText(audience: 'everyone' | 'people', count: number): string {
  if (audience === 'everyone') return 'Everyone';
  return count === 1 ? '1 Person' : `${count.toLocaleString('en')} People`;
}

/** The banner's line: the first ask, or the ask after a change. */
export function bannerLine(round: number, askedAt: number, now: number): string {
  return round > 1
    ? `This page changed on ${shortDate(askedAt, now)}. Please read it again, then confirm.`
    : 'Please read this page, then confirm you have.';
}

export const confirmedToast = (page: string) => `Thanks. You've confirmed you read ${page}.`;

/** Remind's answer, as its toast. */
export function remindText(result: ReadingRemindResult): string {
  switch (result.outcome) {
    case 'sent':
      return `Reminded ${people(result.sent)}.`;
    case 'already_sent':
      return 'Everyone not yet read was reminded this week.';
    case 'nobody_pending':
      return 'Nobody is left to remind.';
    case 'no_recipients':
      return 'Nobody left to remind can get email about this page.';
    case 'daily_limit':
      return "The day's emails for this knowledgebase are used up. Try tomorrow.";
    case 'unavailable':
      return 'This knowledgebase sends no email.';
  }
}

/** Whether Remind's answer is good news (a success toast) or not (an info toast). */
export const remindSent = (result: ReadingRemindResult) => result.outcome === 'sent';

/** "Last reminded 2 days ago". */
export const lastRemindedText = (at: number, now: number) =>
  `Last reminded ${formatRelativeTime(Math.max(0, now - at))}`;

const REFUSED: Record<string, string> = {
  forbidden: 'Only an Editor can change Required Reading.',
  invalid_change: 'Choose Everyone, or at least one person.',
  too_many_people: `A page can ask at most ${READING_PEOPLE_MAX} chosen people.`,
  reading_pages_full: 'This knowledgebase has as many Required Reading pages as it can hold.',
  reading_needs_account: 'Sign in to confirm you read this page.',
  not_required: 'This page is no longer Required Reading.',
  not_asked: "You aren't asked to read this page.",
  reading_too_fast: 'That was a lot of changes at once. Try again in a moment.',
};

export type ReadingAct = 'confirm' | 'set' | 'stop' | 'again' | 'remind';

const FALLBACK: Record<ReadingAct, string> = {
  confirm: 'Your confirmation could not be saved. Try again.',
  set: 'Required Reading could not be saved. Try again.',
  stop: 'Required Reading could not be stopped. Try again.',
  again: 'Everyone could not be asked again. Try again from Page Info.',
  remind: 'The reminders could not be sent. Try again.',
};

/** A refused change, in words. */
export function readingFailureText(err: unknown, act: ReadingAct): string {
  if (err instanceof ApiError && err.code && REFUSED[err.code]) return REFUSED[err.code]!;
  return FALLBACK[act];
}
