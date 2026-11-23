// The figures band's pictures (docs/specs/030-knowledgebase/insights.md "Every tile draws a picture"): what each
// tile but Reads draws, and its words, from the one overview read. Pure.
import type {
  KnowledgeAgent,
  KnowledgeConflict,
  KnowledgeHealthCounts,
  KnowledgeQuestion,
  KnowledgeSuggestion,
} from '@liveknowledge/api-schema';

const DAY = 24 * 60 * 60 * 1000;
const count = (n: number) => n.toLocaleString('en');
const plural = (n: number, one: string, many: string) => `${count(n)} ${n === 1 ? one : many}`;

/** How many agents the Connected Agents bar names before the rest become "others". */
export const AGENTS_SHOWN = 4;
/** How many open questions the Open Questions bars show. */
export const QUESTIONS_SHOWN = 12;
/** The Suggested Edits track's length in days, today included. */
export const TRACK_DAYS = 14;
/** A wait this many days or longer is amber. */
export const OLD_WAIT_DAYS = 7;

export type AgentShare = { name: string; reads: number; share: number };

/** The agents reading most this week (AGENTS_SHOWN at most), then one "Others" piece for the rest, as shares of the
 *  week's agent reads; empty with no agent reads. */
export function agentShares(agents: readonly KnowledgeAgent[]): AgentShare[] {
  const reading = agents
    .filter((agent) => agent.readsThisWeek > 0)
    .sort((a, b) => b.readsThisWeek - a.readsThisWeek || a.name.localeCompare(b.name));
  const total = reading.reduce((sum, agent) => sum + agent.readsThisWeek, 0);
  if (total === 0) return [];
  const shown = reading.slice(0, AGENTS_SHOWN).map((agent) => ({
    name: agent.name,
    reads: agent.readsThisWeek,
    share: agent.readsThisWeek / total,
  }));
  const rest = reading.slice(AGENTS_SHOWN).reduce((sum, agent) => sum + agent.readsThisWeek, 0);
  return rest > 0 ? [...shown, { name: 'Others', reads: rest, share: rest / total }] : shown;
}

/** The Connected Agents caption: who reads most, or why the bar is empty. */
export function agentsCaption(
  agents: readonly KnowledgeAgent[],
  shares: readonly AgentShare[],
): string {
  if (agents.length === 0) return 'Connect one to start';
  const top = shares[0];
  if (!top) return 'No reads this week';
  if (shares.length === 1) return `Only ${top.name} reads`;
  return `${top.name}, ${Math.round(top.share * 100)}% of reads`;
}

export type QuestionBar = { key: string; people: number; agents: number; asked: number };

/** Each open question's asks, most asked first, QUESTIONS_SHOWN at most. */
export function questionBars(questions: readonly KnowledgeQuestion[]): QuestionBar[] {
  return [...questions]
    .sort((a, b) => b.asked - a.asked || b.lastAt - a.lastAt)
    .slice(0, QUESTIONS_SHOWN)
    .map((question) => {
      const people = Math.min(question.byPeople, question.asked);
      return { key: question.key, people, agents: question.asked - people, asked: question.asked };
    });
}

/** The Open Questions line: the asks and how many were agents'. */
export function questionsLine(questions: readonly KnowledgeQuestion[]): string {
  if (questions.length === 0) return 'Every question answered';
  const asks = questions.reduce((sum, question) => sum + question.asked, 0);
  const byPeople = questions.reduce(
    (sum, question) => sum + Math.min(question.byPeople, question.asked),
    0,
  );
  const byAgents = asks - byPeople;
  const asked = asks === 1 ? 'Asked once' : `Asked ${count(asks)} times`;
  if (byAgents === 0) return `${asked}, all by people`;
  if (byAgents === asks) return `${asked}, all by agents`;
  return `${asked}, ${count(byAgents)} by agents`;
}

/** The Open Questions bars' words. */
export function questionsSpoken(bars: readonly QuestionBar[]): string {
  if (bars.length === 0) return '';
  return `Asks per open question, most first: ${bars.map((bar) => count(bar.asked)).join(', ')}.`;
}

/** Whole days from `at` to `now`, never below 0. */
const daysAgo = (at: number, now: number) => Math.max(0, Math.floor((now - at) / DAY));

/** "today", "yesterday", "3 days ago". */
const agoText = (days: number) =>
  days === 0 ? 'today' : days === 1 ? 'yesterday' : `${count(days)} days ago`;

/** The open conflict found first, and how many others are open; null with none. */
export function oldestConflict(
  conflicts: readonly KnowledgeConflict[],
): { conflict: KnowledgeConflict; others: number } | null {
  if (conflicts.length === 0) return null;
  const conflict = conflicts.reduce((oldest, c) => (c.foundAt < oldest.foundAt ? c : oldest));
  return { conflict, others: conflicts.length - 1 };
}

/** The Pages That Disagree line. */
export function conflictsLine(conflicts: readonly KnowledgeConflict[], now: number): string {
  const oldest = oldestConflict(conflicts);
  if (!oldest) return 'None found';
  const ago = agoText(daysAgo(oldest.conflict.foundAt, now));
  return conflicts.length === 1 ? `Found ${ago}` : `Oldest found ${ago}`;
}

/** The Pages That Disagree picture's words. */
export function conflictsSpoken(conflicts: readonly KnowledgeConflict[]): string {
  const oldest = oldestConflict(conflicts);
  if (!oldest) return '';
  const { a, b } = oldest.conflict;
  const more = oldest.others > 0 ? `, and ${plural(oldest.others, 'more', 'more')}` : '';
  return `${a.title} disagrees with ${b.title}${more}.`;
}

export type WaitingDot = { id: string; days: number; stack: number; old: boolean };

/** Each waiting edit on the track: its whole days waited (capped at the track's left end), its place in its day's
 *  stack, and whether it has waited OLD_WAIT_DAYS or more. */
export function waitingDots(
  suggestions: readonly KnowledgeSuggestion[],
  now: number,
): WaitingDot[] {
  const stacks = new Map<number, number>();
  return [...suggestions]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((suggestion) => {
      const waited = daysAgo(suggestion.createdAt, now);
      const days = Math.min(waited, TRACK_DAYS - 1);
      const stack = stacks.get(days) ?? 0;
      stacks.set(days, stack + 1);
      return { id: suggestion.id, days, stack, old: waited >= OLD_WAIT_DAYS };
    });
}

/** The Suggested Edits line: the oldest wait. */
export function suggestionsLine(suggestions: readonly KnowledgeSuggestion[], now: number): string {
  if (suggestions.length === 0) return 'None waiting';
  const oldest = Math.min(...suggestions.map((suggestion) => suggestion.createdAt));
  const days = daysAgo(oldest, now);
  const subject = suggestions.length === 1 ? 'Waiting' : 'Oldest waiting';
  return days === 0 ? `${subject} since today` : `${subject} ${plural(days, 'day', 'days')}`;
}

/** The Suggested Edits track's words. */
export function suggestionsSpoken(dots: readonly WaitingDot[]): string {
  if (dots.length === 0) return '';
  const old = dots.filter((dot) => dot.old).length;
  return `${plural(dots.length, 'edit', 'edits')} waiting${old > 0 ? `, ${count(old)} for a week or more` : ''}.`;
}

export type VerifiedParts = { verified: number; due: number; never: number; total: number };

/** Every page in three parts: verified, Review Due and never verified. */
export function verifiedParts(health: KnowledgeHealthCounts): VerifiedParts {
  return {
    verified: health.verified,
    due: health.reviewDue,
    never: health.neverVerified,
    total: health.total,
  };
}

/** The Verified bar's legend: "9 verified, 3 due, 2 never", leaving out the parts that are 0. */
export function verifiedCaption(parts: VerifiedParts): string {
  if (parts.total === 0) return 'No pages yet';
  const words = [
    parts.verified > 0 ? `${count(parts.verified)} verified` : '',
    parts.due > 0 ? `${count(parts.due)} due` : '',
    parts.never > 0 ? `${count(parts.never)} never` : '',
  ].filter(Boolean);
  return words.length > 0 ? words.join(', ') : 'No pages yet';
}
