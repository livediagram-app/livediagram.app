// @vitest-environment jsdom

// Page Insights (docs/specs/030-knowledgebase/ai-knowledge.md "Page Insights"), from plain props: the 30 days of reads
// drawn inside Read This Week, and the questions Ask answered from the page. Everyone who can read the page sees the
// same: it has no control, so no role changes it.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { PageInsightsWire } from '@liveknowledge/api-schema';
import { AnsweredQuestions, ReadsTrend, askedTimes, readsSoFarText } from './PageInsights';

afterEach(cleanup);

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 20, 12);
const days = (reads: (day: number) => [number, number]): PageInsightsWire['days'] =>
  Array.from({ length: 30 }, (_x, at) => {
    const [people, agents] = reads(at);
    return { day: `d${at}`, people, agents };
  });
const READ = days((at) => (at % 3 === 0 ? [2, 1] : [0, 0]));

describe('Read This Week’s trend', () => {
  it('draws the 30 days of reads, people and agents apart, said in words, with no cited or agent figures', () => {
    render(
      <ReadsTrend insights={{ days: READ, cited: 12 }} createdAt={NOW - 200 * DAY} now={NOW} />,
    );
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/20 .*10/);
    expect(screen.getByText('30 days ago')).toBeTruthy();
    expect(screen.queryByText('Cited by Ask')).toBeNull();
    expect(screen.queryByText('Read by Agents')).toBeNull();
  });

  it('says a new page’s reads so far instead of bars, its maker’s opening counted', () => {
    render(
      <ReadsTrend
        insights={{ days: days((at) => (at === 29 ? [2, 1] : [0, 0])), cited: 0 }}
        createdAt={NOW - DAY}
        now={NOW}
      />,
    );
    expect(document.querySelector('[data-page-insights-new]')!.textContent).toBe(
      'New this week, 3 reads so far: 2 by people, 1 by an agent',
    );
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('says a new page with no reads will show them', () => {
    render(
      <ReadsTrend
        insights={{ days: days(() => [0, 0]), cited: 0 }}
        createdAt={NOW - DAY}
        now={NOW}
      />,
    );
    expect(screen.getByText(/New this week: reads show here/)).toBeTruthy();
  });

  it('holds a placeholder of its own height before Page Health is read', () => {
    render(<ReadsTrend insights={undefined} createdAt={undefined} now={NOW} />);
    expect(document.querySelector('[data-page-insights-placeholder]')).not.toBeNull();
  });
});

describe('Answered From This Page', () => {
  it('quotes the questions answered from the page, most asked first, as text', () => {
    render(
      <AnsweredQuestions
        answered={[
          { question: 'How do we roll back a deploy?', asked: 6 },
          { question: 'Who approves a release?', asked: 1 },
          { question: '<img src=x onerror=alert(1)>?', asked: 2 },
        ]}
      />,
    );
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '“How do we roll back a deploy?Asked 6 times',
      '“Who approves a release?Asked once',
      '“<img src=x onerror=alert(1)>?Asked 2 times',
    ]);
    expect(document.querySelector('[data-answered-from-page] img')).toBeNull();
  });

  it('counts in words', () => {
    expect(askedTimes(1)).toBe('Asked once');
    expect(askedTimes(1234)).toBe('Asked 1,234 times');
    expect(readsSoFarText(1, 0)).toBe('1 read so far: 1 by a person');
    expect(readsSoFarText(0, 4)).toBe('4 reads so far: 4 by agents');
  });
});
