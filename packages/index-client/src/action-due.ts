// An action's due day in words (liveknowledge/docs/specs/030-knowledgebase/page-comments.md "Comments on the
// writing"), the same in the editor and on its Inbox row (liveworkspace/docs/specs/004-index/inbox-reading.md): "Due today", "Due tomorrow", "Due Thu 3 Dec" (with the year when it is not this one), and whether it is
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

// One formatter for this year's days and one for another's, made on first use: an Inbox of a few hundred dated rows
// words each without building a formatter per call, as toLocaleDateString does.
const formatters: Partial<Record<'this' | 'other', Intl.DateTimeFormat>> = {};
function formatter(sameYear: boolean): Intl.DateTimeFormat {
  const key = sameYear ? 'this' : 'other';
  return (formatters[key] ??= new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }));
}

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
  const words = formatter(sameYear).format(day);
  return { text: `Due ${words.replace(',', '')}`, tone: days < 0 ? 'past' : 'later' };
}
