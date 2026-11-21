// Page reads (docs/specs/030-knowledgebase/ai-knowledge.md "Reads"): counted by day, by reader kind and by agent,
// kept READS_KEPT_DAYS days. A read is one open of a page in the editor, or one `read_page` or search result
// served to an agent. No reader's identity is kept beyond an agent's name.
import { dayOf, daysBefore } from '../days';
import type { SqlStatement } from './statement';

export const READS_KEPT_DAYS = 90;
/** Connected agents are those seen in this many days. */
export const AGENT_SEEN_DAYS = 30;
export const MAX_AGENT_NAME_CHARS = 80;
/** How many of an agent's most read pages its card names. */
export const AGENT_TOP_PAGES = 3;

export type Reader = { kind: 'person' } | { kind: 'agent'; name: string };

/** An agent's name as it is stored: trimmed, one line, at most MAX_AGENT_NAME_CHARS; "Agent" when it has none. */
export const agentName = (name: string): string =>
  name.replace(/\s+/g, ' ').trim().slice(0, MAX_AGENT_NAME_CHARS) || 'Agent';

/** Counts one read of a page at `now`. */
export function recordRead(tab: string, reader: Reader, now: number): SqlStatement {
  return {
    sql: `INSERT INTO page_reads (day, tab, reader_kind, agent, reads) VALUES (?, ?, ?, ?, 1)
      ON CONFLICT (day, tab, reader_kind, agent) DO UPDATE SET reads = reads + 1`,
    params: [dayOf(now), tab, reader.kind, reader.kind === 'agent' ? agentName(reader.name) : ''],
  };
}

/** Drops the reads older than READS_KEPT_DAYS. The room runs it at most once a day. */
export const pruneReads = (now: number): SqlStatement => ({
  sql: 'DELETE FROM page_reads WHERE day < ?',
  params: [daysBefore(now, READS_KEPT_DAYS)],
});

export type PageReadsRow = { readerKind: string; reads: number };

/** A page's reads in the last `days` days, by reader kind (Page Health: "reads by people and by agents this
 *  week"). */
export const countPageReads = (tab: string, now: number, days = 7): SqlStatement => ({
  sql: `SELECT reader_kind AS readerKind, SUM(reads) AS reads FROM page_reads
    WHERE tab = ? AND day > ? GROUP BY reader_kind`,
  params: [tab, daysBefore(now, days)],
});

/** A page's reads by people and by agents, from `countPageReads`' rows. */
export function pageReads(rows: readonly PageReadsRow[]): { people: number; agents: number } {
  const of = (kind: string) => rows.find((r) => r.readerKind === kind)?.reads ?? 0;
  return { people: of('person'), agents: of('agent') };
}

/** How many agents a page's AI Context names. */
export const PAGE_AGENTS_LISTED = 3;

export type PageAgentReadsRow = { agent: string; reads: number };

/** The agents that read a page in the last `days` days, the most reads first, then by name, PAGE_AGENTS_LISTED at
 *  most (ai-knowledge.md "AI Context on a page"). */
export const countPageAgentReads = (tab: string, now: number, days = 7): SqlStatement => ({
  sql: `SELECT agent, SUM(reads) AS reads FROM page_reads
    WHERE tab = ? AND reader_kind = 'agent' AND day > ? GROUP BY agent
    ORDER BY SUM(reads) DESC, agent LIMIT ?`,
  params: [tab, daysBefore(now, days), PAGE_AGENTS_LISTED],
});

export type AgentReadsRow = { agent: string; tab: string; reads: number; week: number };

/** Every agent seen in AGENT_SEEN_DAYS days, a row per page it read: its reads in that time, and in the last 7
 *  days. */
export const countAgentReads = (now: number): SqlStatement => ({
  sql: `SELECT agent, tab, SUM(reads) AS reads, SUM(CASE WHEN day > ? THEN reads ELSE 0 END) AS week
    FROM page_reads WHERE reader_kind = 'agent' AND day > ?
    GROUP BY agent, tab ORDER BY agent, week DESC, reads DESC, tab`,
  params: [daysBefore(now, 7), daysBefore(now, AGENT_SEEN_DAYS)],
});

export type AgentReads = {
  agent: string;
  /** Pages read this week (each read counted). */
  readsThisWeek: number;
  /** The pages it read most this week, most first, at most AGENT_TOP_PAGES. */
  topPages: string[];
};

/** One summary per connected agent, from `countAgentReads`' rows, in the rows' order. */
export function agentReads(rows: readonly AgentReadsRow[]): AgentReads[] {
  const agents = new Map<string, AgentReads>();
  for (const row of rows) {
    let summary = agents.get(row.agent);
    if (!summary) {
      summary = { agent: row.agent, readsThisWeek: 0, topPages: [] };
      agents.set(row.agent, summary);
    }
    summary.readsThisWeek += row.week;
    if (row.week > 0 && summary.topPages.length < AGENT_TOP_PAGES) summary.topPages.push(row.tab);
  }
  return [...agents.values()];
}
