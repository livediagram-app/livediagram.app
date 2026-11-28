// A Sprint Review session's rules (docs/specs/026-plan/session-tabs.md "Sprint Review", blueprint session-tabs.md
// "Behaviour and state"): the done range's chips as dates, the stages it starts from, and where a follow-up card goes
// and the field it is linked through. Pure: the caller passes `now`.
import { linkTypesOf, type CustomFieldDef, type ItemTypeDef } from './item-types';
import { DAY_MS } from './plan-view-dates';
import { typeStatusesOf } from './type-statuses';

// The follow-ups one reviewed card keeps, and a follow-up's title (under a card title's 500).
export const SESSION_FOLLOW_UPS_MAX = 20;
export const FOLLOW_UP_TITLE_MAX = 200;
// With no earlier review, the range starts this many days back.
export const REVIEW_RANGE_DEFAULT_DAYS = 14;

// The Done Range's chips (docs/specs/026-plan/session-tabs.md "Sprint Review"): since the last review, a number of
// days back, or all time.
export const REVIEW_RANGE_PRESETS = ['since-last', '7', '14', '30', 'all'] as const;
export type ReviewRangePreset = (typeof REVIEW_RANGE_PRESETS)[number];

// Stage names (lower case) a review starts from, beside any stage in the Done phase.
export const REVIEW_DONE_STAGES: readonly string[] = [
  'done',
  'closed',
  'complete',
  'completed',
  'shipped',
  'released',
  'resolved',
  'fixed',
  'deployed',
  'delivered',
  'live',
];

// Card field labels (lower case) a follow-up is linked through.
const FOLLOW_UP_FIELDS = [
  'follow-up of',
  'follow up of',
  'followup of',
  'follows up',
  'related',
  'related to',
  'relates to',
  'related cards',
  'see also',
];
const BACKLOG_LIKE = ['backlog', 'icebox', 'inbox', 'ideas', 'idea', 'someday'];

// A chip's start date: the last review's moment (none when there was none), a number of days back from `now`, or
// none for all time.
export function doneRangeFrom(
  preset: ReviewRangePreset,
  now: number,
  lastReviewAt: number | null,
): number | undefined {
  if (preset === 'all') return undefined;
  if (preset === 'since-last') return lastReviewAt ?? undefined;
  return now - Number(preset) * DAY_MS;
}

// The newest decision of any other Sprint Review session among `sessions` (each a tab's id and its read session), or
// null when none has decided a card.
export function lastReviewAt(
  sessions: Iterable<{
    tabId: string;
    sessionKind: string;
    decided?: Readonly<Record<string, { at: number }>> | undefined;
  }>,
  exceptTabId?: string,
): number | null {
  let out: number | null = null;
  for (const s of sessions) {
    if (s.sessionKind !== 'review' || s.tabId === exceptTabId) continue;
    for (const d of Object.values(s.decided ?? {})) if (out === null || d.at > out) out = d.at;
  }
  return out;
}

// The Card field of `type` a follow-up links back through: one labelled like a follow-up or Related that links to
// `toType`, else undefined (the link goes in the follow-up's description).
export function followUpFieldOf(type: ItemTypeDef, toType: string): CustomFieldDef | undefined {
  return type.custom?.find(
    (c) =>
      c.kind === 'card' &&
      type.fields.includes(c.id) &&
      FOLLOW_UP_FIELDS.includes(c.label.trim().toLowerCase()) &&
      linkTypesOf(c).includes(toType),
  );
}

// Where a follow-up of `type` starts: its first Backlog-like stage (by the plan's name for it), else null (the
// editor then takes the type's Default State).
export function followUpStatus(
  type: ItemTypeDef,
  names: ReadonlyMap<string, string>,
): string | null {
  const order = typeStatusesOf(type, [...names.keys()]);
  return order.find((s) => BACKLOG_LIKE.includes((names.get(s) ?? s).trim().toLowerCase())) ?? null;
}

// A follow-up's title as kept: one line, trimmed, at most FOLLOW_UP_TITLE_MAX characters.
export function followUpTitle(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, FOLLOW_UP_TITLE_MAX).trim();
}
