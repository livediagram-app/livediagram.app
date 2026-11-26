// An action's due day in words (liveknowledge/docs/specs/030-knowledgebase/page-comments.md "Comments on the
// writing"): "Due today", "Due tomorrow", "Due Thu 3 Dec" (with the year when it is not this one), and whether it is
// past. The day is a calendar day ('2026-12-03'), read in the reader's own zone. Pure.

const DAY_MS = 86_400_000;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The day as a local date at its midnight, or null when it is no calendar day. */
export function dueDayOf(due: string | undefined | null): Date | null {
  const m = due ? DAY_RE.exec(due) : null;
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
}

export type DueWords = { text: string; tone: 'past' | 'soon' | 'later' };

/** The due day in words, as of `now`; null with no day. */
export function actionDueWords(due: string | undefined | null, now: number): DueWords | null {
  const day = dueDayOf(due);
  if (!day) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Math.round((day.getTime() - today.getTime()) / DAY_MS);
  if (days === 0) return { text: 'Due today', tone: 'soon' };
  if (days === 1) return { text: 'Due tomorrow', tone: 'soon' };
  const sameYear = day.getFullYear() === today.getFullYear();
  const words = day.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return { text: `Due ${words.replace(',', '')}`, tone: days < 0 ? 'past' : 'later' };
}
