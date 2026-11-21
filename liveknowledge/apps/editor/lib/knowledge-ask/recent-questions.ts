// A person's chats with one knowledgebase (docs/specs/030-knowledgebase/search-and-ask.md "The Ask view"): kept in
// this browser alone, each its first question, when it was last asked in, its turns with their answers and sources,
// and when it was accepted (Completed Questions). Newest first, 50 at most and about 1.5 MB in all, the oldest going
// first. Pure over a `Storage`, so a private window that refuses writes costs nothing but the list. A row kept
// before chats (a question alone, no `id`) still reads, as a question to ask again.
import type { AskNotUsed, AskSource } from '@liveknowledge/api-schema';

export const RECENT_QUESTIONS_MAX = 50;
export const RECENT_QUESTIONS_PREFIX = 'liveknowledge:ask-recent:v1:';
/** The most characters every chat of a knowledgebase may take in the store, in all. */
export const CHATS_MAX_CHARS = 1_500_000;

/** One turn as a chat keeps it: an answer still streaming when the page went is kept as stopped. */
export type SavedTurn = {
  id: string;
  question: string;
  status: 'done' | 'stopped' | 'failed';
  text: string;
  sources: AskSource[];
  notUsed: AskNotUsed[];
  gaps: string[];
  model: string;
  failure?: string;
  feedback?: 'helpful' | 'not-helpful';
};

/** A chat: `question` is its first, `askedAt` when it was last asked in. */
export type RecentQuestion = {
  question: string;
  askedAt: number;
  id?: string;
  turns?: SavedTurn[];
  /** When its answer was accepted: it is in Completed Questions. */
  completedAt?: number;
};

/** A row's id: its own, or one made from when a question-only row was asked. */
export const chatIdOf = (row: RecentQuestion): string => row.id ?? `asked:${row.askedAt}`;
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

/** The list with `chat` at its head (its earlier copy gone), within RECENT_QUESTIONS_MAX chats and CHATS_MAX_CHARS
 *  characters: the oldest go first, never the one just saved. Linear in the list. */
export function withChatSaved(
  list: readonly RecentQuestion[],
  chat: RecentQuestion,
): RecentQuestion[] {
  const id = chatIdOf(chat);
  const next = [chat, ...list.filter((row) => chatIdOf(row) !== id)].slice(0, RECENT_QUESTIONS_MAX);
  const sizes = next.map((row) => JSON.stringify(row).length);
  let chars = sizes.reduce((sum, size) => sum + size, 0);
  while (next.length > 1 && chars > CHATS_MAX_CHARS) {
    next.pop();
    chars -= sizes.pop()!;
  }
  return next;
}

/** The list without the chat `id`. */
export const withChatRemoved = (list: readonly RecentQuestion[], id: string): RecentQuestion[] =>
  list.filter((row) => chatIdOf(row) !== id);

/** The list with the chat `id` changed by `change`, in its place. */
export function withChatChanged(
  list: readonly RecentQuestion[],
  id: string,
  change: (row: RecentQuestion) => RecentQuestion,
): RecentQuestion[] {
  return list.map((row) => (chatIdOf(row) === id ? change(row) : row));
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

/** The chats not yet accepted, as Today, This Week (the six days before today) and Earlier, each newest first; a
 *  group with nothing is left out. Accepted ones are `completedQuestions`. */
export function groupRecentQuestions(list: readonly RecentQuestion[], now: number): RecentGroup[] {
  const today = startOfDay(now);
  const week = today - 6 * DAY_MS;
  const groups: Record<RecentGroupLabel, RecentQuestion[]> = {
    Today: [],
    'This Week': [],
    Earlier: [],
  };
  for (const row of list) {
    if (row.completedAt !== undefined) continue;
    groups[row.askedAt >= today ? 'Today' : row.askedAt >= week ? 'This Week' : 'Earlier'].push(
      row,
    );
  }
  return (['Today', 'This Week', 'Earlier'] as const)
    .map((label) => ({ label, questions: groups[label] }))
    .filter((group) => group.questions.length > 0);
}

/** Completed Questions: the chats whose answer was accepted, the one accepted last first. */
export const completedQuestions = (list: readonly RecentQuestion[]): RecentQuestion[] =>
  list
    .filter((row) => row.completedAt !== undefined)
    .sort((a, b) => b.completedAt! - a.completedAt!);

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
      for (const row of parse(storage.getItem(key)))
        found.push({ question: row.question, askedAt: row.askedAt, documentId });
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
