// A person's recent questions for one knowledgebase (docs/specs/030-knowledgebase/search-and-ask.md "Scope"): kept in
// this browser alone, the question and when it was asked, never an answer. Newest first, each question once, 50 at
// most. Pure over a `Storage`, so a private window that refuses writes costs nothing but the list.

export const RECENT_QUESTIONS_MAX = 50;
export const RECENT_QUESTIONS_PREFIX = 'liveknowledge:ask-recent:v1:';

export type RecentQuestion = { question: string; askedAt: number };
export type RecentGroupLabel = 'Today' | 'This Week' | 'Earlier';
export type RecentGroup = { label: RecentGroupLabel; questions: RecentQuestion[] };

export const recentQuestionsKey = (ownerId: string, documentId: string): string =>
  `${RECENT_QUESTIONS_PREFIX}${ownerId}:${documentId}`;

const same = (question: string) => question.trim().replace(/\s+/g, ' ').toLowerCase();

function parse(raw: string | null): RecentQuestion[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (row): row is RecentQuestion =>
          !!row &&
          typeof (row as RecentQuestion).question === 'string' &&
          typeof (row as RecentQuestion).askedAt === 'number',
      )
      .slice(0, RECENT_QUESTIONS_MAX);
  } catch {
    return [];
  }
}

export function readRecentQuestions(
  storage: Pick<Storage, 'getItem'> | null,
  ownerId: string,
  documentId: string,
): RecentQuestion[] {
  try {
    return parse(storage?.getItem(recentQuestionsKey(ownerId, documentId)) ?? null);
  } catch {
    return [];
  }
}

/** The list with `question` at its head, asked now; an earlier ask of the same words is replaced. */
export function withQuestionRemembered(
  list: readonly RecentQuestion[],
  question: string,
  now: number,
): RecentQuestion[] {
  const text = question.trim();
  if (!text) return [...list];
  const key = same(text);
  return [
    { question: text, askedAt: now },
    ...list.filter((row) => same(row.question) !== key),
  ].slice(0, RECENT_QUESTIONS_MAX);
}

/** Store the list; false when the browser would not keep it. */
export function writeRecentQuestions(
  storage: Pick<Storage, 'setItem'> | null,
  ownerId: string,
  documentId: string,
  list: readonly RecentQuestion[],
): boolean {
  try {
    storage?.setItem(recentQuestionsKey(ownerId, documentId), JSON.stringify(list));
    return storage !== null;
  } catch {
    return false;
  }
}

const startOfDay = (at: number) => {
  const day = new Date(at);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
};
const DAY_MS = 86_400_000;

/** Today, This Week (the six days before today) and Earlier, each newest first; a group with nothing is left out. */
export function groupRecentQuestions(list: readonly RecentQuestion[], now: number): RecentGroup[] {
  const today = startOfDay(now);
  const week = today - 6 * DAY_MS;
  const groups: Record<RecentGroupLabel, RecentQuestion[]> = {
    Today: [],
    'This Week': [],
    Earlier: [],
  };
  for (const row of list)
    groups[row.askedAt >= today ? 'Today' : row.askedAt >= week ? 'This Week' : 'Earlier'].push(
      row,
    );
  return (['Today', 'This Week', 'Earlier'] as const)
    .map((label) => ({ label, questions: groups[label] }))
    .filter((group) => group.questions.length > 0);
}

/** The person's newest questions across every knowledgebase kept in this browser, newest first, each once. */
export function recentQuestionsEverywhere(
  storage: Pick<Storage, 'getItem' | 'key' | 'length'> | null,
  ownerId: string,
  max: number,
): (RecentQuestion & { documentId: string })[] {
  if (!storage) return [];
  const prefix = `${RECENT_QUESTIONS_PREFIX}${ownerId}:`;
  const found: (RecentQuestion & { documentId: string })[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const documentId = key.slice(prefix.length);
      for (const row of parse(storage.getItem(key))) found.push({ ...row, documentId });
    }
  } catch {
    return [];
  }
  const seen = new Set<string>();
  return found
    .sort((a, b) => b.askedAt - a.askedAt)
    .filter((row) => !seen.has(same(row.question)) && seen.add(same(row.question)))
    .slice(0, max);
}
