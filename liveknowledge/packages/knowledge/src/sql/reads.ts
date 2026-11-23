// Page reads (docs/specs/030-knowledgebase/insights.md "Reads"): counted by day, by reader kind and by agent,
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

/** Drops the reads older than `days` (READS_KEPT_DAYS, or the owner's AI Knowledge History with Pro on). The room
 *  runs it at most once a day. */
export const pruneReads = (now: number, days: number = READS_KEPT_DAYS): SqlStatement => ({
  sql: 'DELETE FROM page_reads WHERE day < ?',
  params: [daysBefore(now, days)],
});

/** How many agents a page's AI Context names. */
export const PAGE_AGENTS_LISTED = 3;

export type PageAgentReadsRow = { agent: string; reads: number };

/** The agents that read a page in the last `days` days, the most reads first, then by name, PAGE_AGENTS_LISTED at
 *  most (insights.md "AI Context on a page"). */
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

/** How many days of reads Insights' sparkline shows, today among them. */
export const READS_TREND_DAYS = 14;

export type DailyReadsRow = { day: string; readerKind: string; reads: number };

/** Every reader's reads by day and reader kind over the last READS_TREND_DAYS days (insights.md "Reads"): a range
 *  of the table's key, which leads with the day, at most two rows a day. */
export const countDailyReads = (now: number): SqlStatement => ({
  sql: `SELECT day, reader_kind AS readerKind, SUM(reads) AS reads FROM page_reads
    WHERE day > ? GROUP BY day, reader_kind`,
  params: [daysBefore(now, READS_TREND_DAYS)],
});

export type DailyReads = { day: string; people: number; agents: number };

/** `count` days ending today (READS_TREND_DAYS unless said), oldest first, a day with no reads at nought, from
 *  `countDailyReads`' or `countPageDailyReads`' rows. */
export function dailyReads(
  rows: readonly DailyReadsRow[],
  now: number,
  count = READS_TREND_DAYS,
): DailyReads[] {
  const days: DailyReads[] = [];
  const byDay = new Map<string, DailyReads>();
  for (let back = count - 1; back >= 0; back--) {
    const day = { day: daysBefore(now, back), people: 0, agents: 0 };
    days.push(day);
    byDay.set(day.day, day);
  }
  for (const row of rows) {
    const day = byDay.get(row.day);
    if (!day) continue;
    if (row.readerKind === 'person') day.people += row.reads;
    else if (row.readerKind === 'agent') day.agents += row.reads;
  }
  return days;
}

/** How many days of one page's reads Page Insights shows, today among them (insights.md "Page Insights"). */
export const PAGE_INSIGHT_DAYS = 30;

/** One page's reads by day and reader kind over the last `days` days: a range of `page_reads_tab` (tab, day), at
 *  most two rows a day. Page Health's read: the bars of Page Insights, and Read This Week summed from them. */
export const countPageDailyReads = (
  tab: string,
  now: number,
  days = PAGE_INSIGHT_DAYS,
): SqlStatement => ({
  sql: `SELECT day, reader_kind AS readerKind, SUM(reads) AS reads FROM page_reads
    WHERE tab = ? AND day > ? GROUP BY day, reader_kind`,
  params: [tab, daysBefore(now, days)],
});

/** How many pages Insights' Most Read names. */
export const MOST_READ_PAGES = 5;

export type MostReadRow = { tab: string; people: number; agents: number };

/** The pages read most in the last 7 days, people and agents apart, most first then by tab. Twice MOST_READ_PAGES,
 *  so the route still has enough when it leaves out a page that is gone. `+tab` keeps SQLite from grouping by the
 *  tab index, which scans all 90 days: it takes the week as a range of the key (day first) instead. */
export const countMostRead = (now: number, days = 7): SqlStatement => ({
  sql: `SELECT tab, SUM(CASE WHEN reader_kind = 'person' THEN reads ELSE 0 END) AS people,
      SUM(CASE WHEN reader_kind = 'agent' THEN reads ELSE 0 END) AS agents
    FROM page_reads WHERE day > ? GROUP BY +tab ORDER BY SUM(reads) DESC, tab LIMIT ?`,
  params: [daysBefore(now, days), MOST_READ_PAGES * 2],
});
