// What Insights says of what the room counted (docs/specs/030-knowledgebase/insights.md). Pure.
import { HEALTH_LABEL_WORDS } from '@liveknowledge/knowledge';
import type {
  AgentScope,
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

/** "Asked 4 times by people and Coding Agent" (an agent by its own name, never "the Claude Code"): the count is of asks, and no asker is named but an agent. */
export function askedByText(
  question: Pick<KnowledgeQuestion, 'asked' | 'byPeople' | 'agents'>,
): string {
  const by: string[] = [];
  if (question.byPeople > 0) by.push('people');
  for (const agent of question.agents) if (agent.asked > 0) by.push(agent.name);
  const times = question.asked === 1 ? 'once' : `${count(question.asked)} times`;
  return by.length > 0 ? `Asked ${times} by ${list(by)}` : `Asked ${times}`;
}

export type AgentDoor = 'mcp' | 'cli' | 'token' | 'named';

const HOW: Record<Exclude<AgentDoor, 'named'>, string> = {
  mcp: 'Through the MCP server',
  cli: 'Through the command line',
  token: 'With an API token',
};

/** How an agent connects: what the room saw of its token's requests (`door`), else, for an agent known only by its
 *  reads, the name the api counted it under ("MCP", "CLI" or "API Token" when the client sent none). */
export function agentDoor(agent: Pick<KnowledgeAgent, 'name' | 'door'>): {
  door: AgentDoor;
  how: string;
} {
  if (agent.door) return { door: agent.door, how: HOW[agent.door] };
  if (agent.name === 'MCP') return { door: 'mcp', how: HOW.mcp };
  if (agent.name === 'CLI') return { door: 'cli', how: HOW.cli };
  if (agent.name === 'API Token') return { door: 'token', how: HOW.token };
  return { door: 'named', how: 'Through the MCP server, the command line or a token' };
}

const SCOPE_CHIP: Record<AgentScope, string> = {
  read: 'Reads',
  suggest: 'Suggests Edits',
  write: 'Writes',
};

/** What a connection may do here, as chips, from the scopes the room answers. An agent known only by its reads
 *  (no scopes in the read) is shown as what it was counted doing: it reads. */
export function agentScopeChips(agent: Pick<KnowledgeAgent, 'scopes'>): string[] {
  return (agent.scopes ?? ['read']).map((scope) => SCOPE_CHIP[scope]);
}

/** What an Editor may change about a connection's writing, and why not when nothing. `tokenId` is only in an
 *  Editor's read. */
export type AgentWriteChoice =
  { kind: 'allow' | 'stop'; tokenId: string } | { kind: 'none'; why: string | null };

export function agentWriteChoice(
  agent: Pick<KnowledgeAgent, 'scopes' | 'tokenId' | 'canHoldWrite'>,
): AgentWriteChoice {
  if (!agent.tokenId || !agent.scopes) return { kind: 'none', why: null };
  if (agent.scopes.includes('write')) return { kind: 'stop', tokenId: agent.tokenId };
  if (agent.canHoldWrite) return { kind: 'allow', tokenId: agent.tokenId };
  return {
    kind: 'none',
    why: agent.scopes.includes('suggest')
      ? 'It acts for someone who is not an Editor here, so it cannot be allowed to write.'
      : 'Its token is read-only, or its person only views this knowledgebase, so it cannot be allowed to write.',
  };
}

/** "Last seen today", "Last seen 3 days ago": the room keeps it to the hour, so a day is as fine as it reads. */
export function lastSeenText(lastSeenAt: number, now: number): string {
  const days = Math.max(0, Math.floor((now - lastSeenAt) / 86_400_000));
  if (days === 0) return 'Last seen today';
  return days === 1 ? 'Last seen yesterday' : `Last seen ${count(days)} days ago`;
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
  // Verification off (a Review Period of Never): agents are told so, whatever page the sample shows.
  const trust =
    overview?.reviewEvery === 'never' || side?.trust === 'off'
      ? 'verification off'
      : side
        ? side.trust === 'verified'
          ? `verified${side.verifiedAt ? ` ${shortDate(side.verifiedAt, now)}` : ''}`
          : side.trust === 'review-due'
            ? 'review due (stale)'
            : 'never verified'
        : 'verified';
  // Every result carries its page's Health Score too (search-and-ask.md "Sources"; owner 2026-11-22: the sample left it
  // out, so it read as if agents never see it).
  const health = side ? side.health : { score: 92, label: 'healthy' as const };
  return [
    `search_knowledge("${page.toLowerCase()}")`,
    '',
    `1. ${page}`,
    `   trust: ${trust}`,
    ...(health
      ? [`   health: ${health.score} (${HEALTH_LABEL_WORDS[health.label].toLowerCase()})`]
      : []),
    `   "${text}"`,
    '',
    'An agent is handed the passage, its page, how far to trust it and its health,',
    'so it can say where an answer came from.',
  ].join('\n');
}

/** Not Read in 90 Days' line under a page (insights.md): "Last edited 95 days ago", "Last edited 5 months ago",
 *  "Last edited 2 years ago", or "Last edit not kept" where page_authors kept neither the edit nor the making. */
export function lastEditedText(touchedAt: number | undefined, now: number): string {
  if (touchedAt === undefined) return 'Last edit not kept';
  const days = Math.max(0, Math.floor((now - touchedAt) / 86_400_000));
  if (days < 120) return `Last edited ${count(days)} ${days === 1 ? 'day' : 'days'} ago`;
  if (days < 730) return `Last edited ${count(Math.floor(days / 30))} months ago`;
  return `Last edited ${count(Math.floor(days / 365))} years ago`;
}

/** "4 more not listed". */
export const moreNotListedText = (n: number): string => `${count(n)} more not listed`;
