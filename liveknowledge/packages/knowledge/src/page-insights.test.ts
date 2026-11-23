// Page Insights and Not Read in 90 Days (docs/specs/030-knowledgebase/insights.md "Page Insights", "Not Read
// in 90 Days").
import { describe, expect, it } from 'vitest';
import { daysBefore } from './days';
import {
  NOT_READ_LISTED,
  isNewPage,
  notReadPages,
  pageInsights,
  type NotReadCandidate,
} from './page-insights';
import { PAGE_INSIGHT_DAYS } from './sql/reads';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 20, 14);

describe('pageInsights', () => {
  it('answers 30 days oldest first, people and agents apart, and the last 7 summed as the week', () => {
    const { days, week } = pageInsights(
      [
        { day: daysBefore(NOW, 0), readerKind: 'person', reads: 3 },
        { day: daysBefore(NOW, 0), readerKind: 'agent', reads: 2 },
        { day: daysBefore(NOW, 6), readerKind: 'person', reads: 1 },
        { day: daysBefore(NOW, 7), readerKind: 'agent', reads: 4 },
        { day: daysBefore(NOW, 29), readerKind: 'person', reads: 5 },
      ],
      NOW,
    );
    expect(days).toHaveLength(PAGE_INSIGHT_DAYS);
    expect(days[0]).toEqual({ day: daysBefore(NOW, 29), people: 5, agents: 0 });
    expect(days.at(-1)).toEqual({ day: daysBefore(NOW, 0), people: 3, agents: 2 });
    expect(week).toEqual({ people: 4, agents: 2 });
  });

  it('answers a page with no reads as 30 empty days', () => {
    const { days, week } = pageInsights([], NOW);
    expect(days.every((d) => d.people === 0 && d.agents === 0)).toBe(true);
    expect(week).toEqual({ people: 0, agents: 0 });
  });
});

describe('isNewPage', () => {
  it('is a page made in the last 7 days', () => {
    expect(isNewPage(NOW - 6 * DAY, NOW)).toBe(true);
    expect(isNewPage(NOW - 7 * DAY, NOW)).toBe(false);
    expect(isNewPage(undefined, NOW)).toBe(false);
  });
});

describe('notReadPages', () => {
  const page = (tab: string, over: Partial<NotReadCandidate> = {}): NotReadCandidate => ({
    tab,
    title: `Page ${tab}`,
    lastRead: null,
    createdAt: NOW - 200 * DAY,
    updatedAt: null,
    order: 0,
    ...over,
  });

  it('lists pages with no read in 90 days, touched longest ago first, ties in tree order', () => {
    const { pages, total } = notReadPages(
      [
        page('read', { lastRead: daysBefore(NOW, 89), order: 1 }),
        page('edge', { lastRead: daysBefore(NOW, 90), updatedAt: NOW - 100 * DAY, order: 2 }),
        page('older', { updatedAt: NOW - 150 * DAY, order: 3 }),
        page('unknown', { createdAt: null, order: 5 }),
        page('unknown-first', { createdAt: null, order: 4 }),
        page('made', { order: 6 }),
      ],
      NOW,
    );
    expect(pages.map((p) => p.tab)).toEqual(['unknown-first', 'unknown', 'made', 'older', 'edge']);
    expect(pages[0]).toEqual({ tab: 'unknown-first', title: 'Page unknown-first' });
    expect(pages[2]).toEqual({ tab: 'made', title: 'Page made', touchedAt: NOW - 200 * DAY });
    expect(total).toBe(5);
  });

  it('leaves out a page made in the last 90 days: it has not had them to be read', () => {
    expect(notReadPages([page('new', { createdAt: NOW - 89 * DAY })], NOW).total).toBe(0);
    expect(notReadPages([page('due', { createdAt: NOW - 90 * DAY })], NOW).total).toBe(1);
  });

  it('lists the first 10 and counts them all', () => {
    const many = Array.from({ length: 14 }, (_x, at) => page(`p${at}`, { order: at }));
    const { pages, total } = notReadPages(many, NOW);
    expect(pages).toHaveLength(NOT_READ_LISTED);
    expect(total).toBe(14);
  });
});
