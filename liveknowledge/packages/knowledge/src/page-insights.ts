// How pages are used over time (docs/specs/030-knowledgebase/ai-knowledge.md "Page Insights", "Not Read in 90
// Days"): one page's reads by day with how often Ask cited it, and the pages nobody read in all the time the room
// keeps reads. Pure, from rows the api already reads: no tracking of its own.
import { daysBefore } from './days';
import {
  PAGE_INSIGHT_DAYS,
  READS_KEPT_DAYS,
  dailyReads,
  type DailyReads,
  type DailyReadsRow,
} from './sql/reads';

const DAY_MS = 86_400_000;

/** A page made this recently shows New This Week, never 30 days of bars mostly from before it was made (the Health
 *  Score's first week). */
export const NEW_PAGE_INSIGHT_DAYS = 7;
/** Not read in this many days: every day `page_reads` keeps. */
export const NOT_READ_DAYS = READS_KEPT_DAYS;
/** How many of them AI Knowledge lists. */
export const NOT_READ_LISTED = 10;

export type PageInsightsWeek = { people: number; agents: number };

/** PAGE_INSIGHT_DAYS days of one page's reads, oldest first, and the last 7 of them summed (Read This Week). */
export function pageInsights(
  rows: readonly DailyReadsRow[],
  now: number,
): { days: DailyReads[]; week: PageInsightsWeek } {
  const days = dailyReads(rows, now, PAGE_INSIGHT_DAYS);
  const week = { people: 0, agents: 0 };
  for (const day of days.slice(-7)) {
    week.people += day.people;
    week.agents += day.agents;
  }
  return { days, week };
}

/** Whether a page made at `createdAt` is in its first week: shown as New This Week. */
export const isNewPage = (createdAt: number | undefined, now: number): boolean =>
  createdAt !== undefined && now - createdAt < NEW_PAGE_INSIGHT_DAYS * DAY_MS;

/** A page as Not Read in 90 Days reads it: its latest read day kept (`lastRead`, null for none), when it was made
 *  and last edited where `page_authors` kept them, and its tree place. */
export type NotReadCandidate = {
  tab: string;
  title: string;
  lastRead: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  order: number;
};

export type NotReadPage = { tab: string; title: string; touchedAt?: number };

/**
 * The pages with no read in NOT_READ_DAYS days, leaving out one made in that time (it has not had them to be read):
 * the one touched longest ago first (its last edit, else when it was made; neither kept leads, older than both),
 * ties in tree order. The first NOT_READ_LISTED, and how many there are.
 */
export function notReadPages(
  pages: readonly NotReadCandidate[],
  now: number,
  // The days asked about: NOT_READ_DAYS, or fewer where the owner's tier keeps fewer days of reads (tiers.md "AI
  // Knowledge History"), since a read past them is gone and its page would look unread.
  days: number = NOT_READ_DAYS,
): { pages: NotReadPage[]; total: number } {
  const since = daysBefore(now, days);
  const madeBefore = now - days * DAY_MS;
  const unread = pages
    .filter(
      (p) =>
        (p.lastRead === null || p.lastRead <= since) &&
        (p.createdAt === null || p.createdAt <= madeBefore),
    )
    .map((p) => ({ page: p, touched: p.updatedAt ?? p.createdAt }))
    .sort(
      (a, b) => (a.touched ?? -Infinity) - (b.touched ?? -Infinity) || a.page.order - b.page.order,
    );
  return {
    pages: unread.slice(0, NOT_READ_LISTED).map(({ page, touched }) => ({
      tab: page.tab,
      title: page.title,
      ...(touched === null ? {} : { touchedAt: touched }),
    })),
    total: unread.length,
  };
}
