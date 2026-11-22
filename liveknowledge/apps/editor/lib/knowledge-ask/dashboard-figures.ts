// AI Knowledge's figures band and Needs Attention (docs/specs/030-knowledgebase/ai-knowledge.md "The view, as
// built"): every figure from the one overview read, and the waiting work in the order it is shown. Pure.
import type {
  KnowledgeConflict,
  KnowledgeOverviewResponse,
  KnowledgeQuestion,
  KnowledgeReadsDay,
  KnowledgeSuggestion,
} from '@liveknowledge/api-schema';

export type DashboardFigures = {
  /** Reads in the last 7 days. */
  readsWeek: { people: number; agents: number; total: number };
  agents: number;
  /** Agents that may write. */
  writers: number;
  questions: number;
  /** Every ask of the open questions. */
  asks: number;
  conflicts: number;
  suggestions: number;
  /** The verified share of the pages, a whole percent rounded down; null with no pages. */
  verifiedShare: number | null;
  reviewDue: number;
  neverVerified: number;
};

export function dashboardFigures(overview: KnowledgeOverviewResponse): DashboardFigures {
  const week = overview.reads.days.slice(-7);
  const people = week.reduce((sum, day) => sum + day.people, 0);
  const agents = week.reduce((sum, day) => sum + day.agents, 0);
  const { health } = overview;
  return {
    readsWeek: { people, agents, total: people + agents },
    agents: overview.agents.length,
    writers: overview.agents.filter((agent) => agent.scopes?.includes('write')).length,
    questions: overview.questions.length,
    asks: overview.questions.reduce((sum, question) => sum + question.asked, 0),
    conflicts: overview.conflicts.length,
    suggestions: overview.suggestions.length,
    // Rounded down, so one page unverified never reads as 100%.
    verifiedShare: health.total === 0 ? null : Math.floor((health.verified / health.total) * 100),
    reviewDue: health.reviewDue,
    neverVerified: health.neverVerified,
  };
}

const count = (n: number) => n.toLocaleString('en');

/** The sparkline's one spoken label. */
export function readsSparkLabel(days: readonly KnowledgeReadsDay[]): string {
  const people = days.reduce((sum, day) => sum + day.people, 0);
  const agents = days.reduce((sum, day) => sum + day.agents, 0);
  return `Reads by day over the last ${days.length} days: ${count(people)} by people, ${count(agents)} by agents.`;
}

/** "12 people, 4 agents", "1 person, 0 agents". */
export const readersText = (people: number, agents: number): string =>
  `${count(people)} ${people === 1 ? 'person' : 'people'}, ${count(agents)} ${agents === 1 ? 'agent' : 'agents'}`;

export type AttentionFilter = 'all' | 'questions' | 'conflicts' | 'suggestions';

export type AttentionItem =
  | { kind: 'conflict'; id: string; conflict: KnowledgeConflict }
  | { kind: 'suggestion'; id: string; suggestion: KnowledgeSuggestion }
  | { kind: 'question'; id: string; question: KnowledgeQuestion };

/** The waiting work, most urgent first: pages that disagree (a wrong answer is being given now), then agents'
 *  suggested edits (an agent waits), then questions nobody could answer, the most asked first. */
export function attentionItems(
  overview: Pick<KnowledgeOverviewResponse, 'conflicts' | 'suggestions' | 'questions'>,
  filter: AttentionFilter,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  if (filter === 'all' || filter === 'conflicts')
    for (const conflict of [...overview.conflicts].sort((a, b) => b.foundAt - a.foundAt))
      items.push({ kind: 'conflict', id: `conflict:${conflict.id}`, conflict });
  if (filter === 'all' || filter === 'suggestions')
    for (const suggestion of [...overview.suggestions].sort((a, b) => b.createdAt - a.createdAt))
      items.push({ kind: 'suggestion', id: `suggestion:${suggestion.id}`, suggestion });
  if (filter === 'all' || filter === 'questions')
    for (const question of [...overview.questions].sort(
      (a, b) => b.asked - a.asked || b.lastAt - a.lastAt,
    ))
      items.push({ kind: 'question', id: `question:${question.key}`, question });
  return items;
}
