// @vitest-environment jsdom

// Page Insights in the right rail (docs/specs/030-knowledgebase/ai-knowledge.md "Page Insights"), from plain props.
// Everyone who can read the page sees the same section: it has no control, so no role changes it.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { PageInsightsWire } from '@liveknowledge/api-schema';
import {
  PageInsights,
  askedTimes,
  readsSoFarText,
  timesText,
  type PageInsightsProps,
} from './PageInsights';

afterEach(cleanup);

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 20, 12);
const days = (reads: (day: number) => [number, number]): PageInsightsWire['days'] =>
  Array.from({ length: 30 }, (_x, at) => {
    const [people, agents] = reads(at);
    return { day: `d${at}`, people, agents };
  });
const READ = days((at) => (at % 3 === 0 ? [2, 1] : [0, 0]));
const ANSWERED = [
  { question: 'How do we roll back a deploy?', asked: 6 },
  { question: 'Who approves a release?', asked: 1 },
];

const view = (props: Partial<PageInsightsProps> = {}) =>
  render(
    <PageInsights
      insights={{ days: READ, cited: 12 }}
      answered={ANSWERED}
      createdAt={NOW - 200 * DAY}
      now={NOW}
      {...props}
    />,
  );
const section = () => within(screen.getByRole('region', { name: 'Page Insights' }));

describe('Page Insights', () => {
  it('says the 30 days of reads, people and agents apart, with the bars said in words', () => {
    view();
    expect(document.querySelector('[data-page-insights-total]')!.textContent).toBe('30');
    expect(section().getByText('reads in 30 days')).toBeTruthy();
    expect(section().getByRole('img').getAttribute('aria-label')).toMatch(/20 .*10/);
    const key = section().getByRole('list', { name: 'Key' });
    expect(key.textContent).toBe('People 20Agents 10');
  });

  it('says how many times Ask cited it and agents read it', () => {
    view();
    expect(section().getByText('Cited by Ask').closest('div')!.textContent).toBe(
      'Cited by Ask12 times',
    );
    expect(section().getByText('Read by Agents').closest('div')!.textContent).toBe(
      'Read by Agents10 times',
    );
  });

  it('quotes the questions answered from the page, most asked first, as text', () => {
    view({ answered: [...ANSWERED, { question: '<img src=x onerror=alert(1)>?', asked: 2 }] });
    const items = section()
      .getAllByRole('listitem')
      .filter((li) => li.dataset.answeredQuestion !== undefined);
    expect(items.map((li) => li.textContent)).toEqual([
      '“How do we roll back a deploy?Asked 6 times',
      '“Who approves a release?Asked once',
      '“<img src=x onerror=alert(1)>?Asked 2 times',
    ]);
    expect(document.querySelector('[data-page-insights] img')).toBeNull();
  });

  it('shows New This Week for a page in its first week with no reads, never a row of zeros', () => {
    view({ insights: { days: days(() => [0, 0]), cited: 0 }, createdAt: NOW - 2 * DAY });
    expect(section().getByText('New This Week')).toBeTruthy();
    expect(document.querySelector('[data-page-insights-total]')).toBeNull();
    expect(section().queryByRole('img')).toBeNull();
    expect(section().queryByText('Cited by Ask')).toBeNull();
  });

  it('shows New This Week with its reads so far for a page in its first week, its maker’s opening counted', () => {
    view({
      insights: { days: days((at) => (at === 29 ? [2, 1] : [0, 0])), cited: 0 },
      createdAt: NOW - DAY,
    });
    expect(section().getByText('New This Week')).toBeTruthy();
    expect(document.querySelector('[data-page-insights-so-far]')!.textContent).toBe(
      '3 reads so far: 2 by people, 1 by an agent',
    );
    expect(section().queryByRole('img')).toBeNull();
    // Counts that say something still show in the first week; none for a page with nothing to count.
    expect(section().getByText('Read by Agents').closest('div')!.textContent).toBe(
      'Read by AgentsOnce',
    );
    expect(readsSoFarText(1, 0)).toBe('1 read so far: 1 by a person');
    expect(readsSoFarText(0, 4)).toBe('4 reads so far: 4 by agents');
  });

  it('says No reads in 30 days for an older page nobody read, and Not yet for each count', () => {
    view({ insights: { days: days(() => [0, 0]), cited: 0 }, answered: [] });
    expect(section().getByText('No reads in 30 days')).toBeTruthy();
    expect(section().getAllByText('Not yet')).toHaveLength(2);
    expect(document.querySelector('[data-answered-from-page]')).toBeNull();
  });

  it('says one read as one', () => {
    view({ insights: { days: days((at) => (at === 29 ? [1, 0] : [0, 0])), cited: 1 } });
    expect(section().getByText('read in 30 days')).toBeTruthy();
    expect(section().getByText('Cited by Ask').closest('div')!.textContent).toBe(
      'Cited by AskOnce',
    );
  });

  it('a link confined to one page has no Ask, so nothing cited is said', () => {
    view({ insights: { days: READ } });
    expect(section().queryByText('Cited by Ask')).toBeNull();
    expect(section().getByText('Read by Agents')).toBeTruthy();
  });

  it('holds placeholders of its own height before Page Health is read', () => {
    view({ insights: undefined, answered: undefined });
    expect(document.querySelector('[data-page-insights-placeholder]')).not.toBeNull();
    expect(section().queryByText('New This Week')).toBeNull();
  });

  it('counts in words', () => {
    expect(askedTimes(1)).toBe('Asked once');
    expect(askedTimes(1234)).toBe('Asked 1,234 times');
    expect(timesText(0)).toBe('Not yet');
    expect(timesText(1)).toBe('Once');
    expect(timesText(1500)).toBe('1,500 times');
  });
});
