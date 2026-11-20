// What AI Knowledge says of what the room counted (docs/specs/030-knowledgebase/ai-knowledge.md). Pure.
import type {
  KnowledgeAgent,
  KnowledgeHealthCounts,
  KnowledgeOverviewResponse,
  KnowledgeQuestion,
  KnowledgeSuggestion,
} from '@liveknowledge/api-schema';
import { shortDate } from '@/lib/knowledge/page-trust';

const count = (n: number) => n.toLocaleString('en');
const list = (names: readonly string[]) =>
  names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** "Asked 4 times by people and the Coding Agent": the count is of asks, and no asker is named but an agent. */
export function askedByText(
  question: Pick<KnowledgeQuestion, 'asked' | 'byPeople' | 'agents'>,
): string {
  const by: string[] = [];
  if (question.byPeople > 0) by.push('people');
  for (const agent of question.agents) if (agent.asked > 0) by.push(`the ${agent.name}`);
  const times = question.asked === 1 ? 'once' : `${count(question.asked)} times`;
  return by.length > 0 ? `Asked ${times} by ${list(by)}` : `Asked ${times}`;
}

export type AgentDoor = 'mcp' | 'cli' | 'token' | 'named';

/** How an agent connects, from the name the api counts it under: its client's own name, or "MCP", "CLI" or "API
 *  Token" when the client sent none (api.md "Knowledge"). */
export function agentDoor(name: string): { door: AgentDoor; how: string } {
  if (name === 'MCP') return { door: 'mcp', how: 'Through the MCP server' };
  if (name === 'CLI') return { door: 'cli', how: 'Through the command line' };
  if (name === 'API Token') return { door: 'token', how: 'With an API token' };
  return { door: 'named', how: 'Through the MCP server, the command line or a token' };
}

/** What an agent has been seen to do: it reads, and it suggests edits when one of its suggestions is waiting. */
export function agentScopes(
  agent: Pick<KnowledgeAgent, 'name'>,
  suggestions: readonly Pick<KnowledgeSuggestion, 'agent'>[],
): string[] {
  return suggestions.some((suggestion) => suggestion.agent === agent.name)
    ? ['Reads', 'Suggests Edits']
    : ['Reads'];
}

export const readsText = (reads: number): string =>
  `${count(reads)} ${reads === 1 ? 'page' : 'pages'} read this week`;

export const tokensText = (tokens: number): string => `${count(tokens)} tokens`;
export const budgetText = (used: number, budget: number): string =>
  `${count(used)} of ${count(budget)} tokens`;

export type HealthPart = {
  key: 'verified' | 'reviewDue' | 'neverVerified';
  label: string;
  pages: number;
};

/** The bar's three parts, in order, and what a screen reader hears of the whole. */
export function healthParts(health: KnowledgeHealthCounts): { parts: HealthPart[]; label: string } {
  const parts: HealthPart[] = [
    { key: 'verified', label: 'Verified', pages: health.verified },
    { key: 'reviewDue', label: 'Review Due', pages: health.reviewDue },
    { key: 'neverVerified', label: 'Never Verified', pages: health.neverVerified },
  ];
  return {
    parts,
    label: `Of ${count(health.total)} ${health.total === 1 ? 'page' : 'pages'}: ${parts
      .map((part) => `${count(part.pages)} ${part.label.toLowerCase()}`)
      .join(', ')}.`,
  };
}

/** A suggestion's change as lines: what it takes out and what it puts in. An append takes nothing out. */
export function suggestionLines(
  suggestion: Pick<KnowledgeSuggestion, 'kind' | 'before' | 'after'>,
): {
  removed: string[];
  added: string[];
} {
  const lines = (text: string) => text.split('\n').filter((line) => line.trim() !== '');
  return {
    removed: suggestion.kind === 'append' ? [] : lines(suggestion.before),
    added: lines(suggestion.after),
  };
}

/** How one search result reads to an agent: built from a real passage of this knowledgebase when the overview holds
 *  one (a page that disagrees), from a page's title when it holds only that, else a made-up page. */
export function agentSample(overview: KnowledgeOverviewResponse | null, now: number): string {
  const side = overview?.conflicts[0]?.a;
  const title =
    side?.title ?? overview?.context.pages[0]?.title ?? overview?.agents[0]?.topPages[0]?.title;
  const page = title ?? 'Release Process';
  const text =
    side?.text.replace(/\s+/g, ' ').trim().slice(0, 220) ??
    'We release on Thursdays, after the checks pass.';
  const trust = side
    ? side.trust === 'verified'
      ? `verified${side.verifiedAt ? ` ${shortDate(side.verifiedAt, now)}` : ''}`
      : side.trust === 'review-due'
        ? 'review due (stale)'
        : 'never verified'
    : 'verified';
  return [
    `search_knowledge("${page.toLowerCase()}")`,
    '',
    `1. ${page}`,
    `   trust: ${trust}`,
    `   "${text}"`,
    '',
    'An agent is handed the passage, its page and how far to trust it,',
    'so it can say where an answer came from.',
  ].join('\n');
}
