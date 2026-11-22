// @vitest-environment jsdom

// The AI Knowledge dashboard (docs/specs/030-knowledgebase/blueprints/ai-knowledge-ui.md "The dashboard"): each
// tile's figure and name, the amber mark, a filter tile pressed and unpressed, a tile bringing its card into view,
// the sparkline said in words, the caps and Show All, and Most Read.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeOverviewResponse, KnowledgeQuestion } from '@liveknowledge/api-schema';
import type { AskRights } from '@/lib/knowledge-ask/ask-rights';
import { AiDashboard, type DashboardActions } from './AiDashboard';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const question = (n: number, asked = n): KnowledgeQuestion => ({
  key: `q${n}`,
  question: `Question number ${n}?`,
  asked,
  byPeople: asked,
  agents: [],
  lastAt: n,
});

const overview = (over: Partial<KnowledgeOverviewResponse> = {}): KnowledgeOverviewResponse => ({
  agents: [
    {
      id: 'a1',
      name: 'Coding Agent',
      scopes: ['read', 'suggest', 'write'],
      readsThisWeek: 3,
      topPages: [],
    },
    { id: 'a2', name: 'CLI', readsThisWeek: 1, topPages: [] },
  ],
  questions: [question(1), question(2, 5)],
  conflicts: [],
  suggestions: [],
  context: { budget: 8000, used: 0, pages: [] },
  health: { verified: 2, reviewDue: 1, neverVerified: 0, total: 3 },
  reviewEvery: 90,
  hasKey: true,
  hasAi: true,
  reviewEmails: { available: false },
  reads: {
    // Seven quiet days, then a week of 3 people and 1 agent a day.
    days: Array.from({ length: 14 }, (_, at) => ({
      day: `2026-11-${String(at + 7).padStart(2, '0')}`,
      people: at < 7 ? 0 : 3,
      agents: at < 7 ? 0 : 1,
    })),
    mostRead: [
      { tab: 'p1', title: 'Release Process', people: 20, agents: 4 },
      { tab: 'p2', title: '', people: 1, agents: 0 },
    ],
  },
  ...over,
});

const RIGHTS: AskRights = {
  askOff: null,
  manageAi: true,
  makePages: true,
  resolve: true,
  context: true,
  grantAgents: true,
  emailOwners: true,
};

function draw(data = overview(), rights = RIGHTS) {
  const actions = Object.fromEntries(
    [
      'openPage',
      'connect',
      'openAiSettings',
      'dismissConflict',
      'askOwners',
      'draft',
      'dismissQuestion',
      'accept',
      'dismissSuggestion',
      'remindOwners',
      'addContext',
      'removeContext',
      'askWrite',
    ].map((name) => [name, vi.fn()]),
  ) as unknown as DashboardActions & Record<string, ReturnType<typeof vi.fn>>;
  render(
    <AiDashboard
      overview={data}
      rights={rights}
      agents={data.agents}
      agentsBusy={new Set()}
      busy={new Set()}
      drafting={null}
      canEmailOwners={false}
      now={Date.UTC(2026, 10, 20)}
      actions={actions}
    />,
  );
  return actions;
}

const tile = (name: RegExp) => screen.getByRole('button', { name });
const attention = () => screen.getByRole('region', { name: 'Needs Attention' });

afterEach(() => {
  cleanup();
});

describe('the figures band', () => {
  it('names each tile by its words and its figure, and marks what asks for someone', () => {
    draw();
    const tiles = within(screen.getByRole('group', { name: 'AI Knowledge at a glance' }))
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    expect(tiles).toEqual([
      'Reads This Week: 28',
      'Connected Agents: 2',
      'Open Questions: 2, needs attention',
      'Pages That Disagree: 0',
      'Suggested Edits: 0',
      'Verified: 66%, needs attention',
    ]);
    expect(tile(/^Connected Agents/).textContent).toContain('1 may write');
    expect(tile(/^Open Questions/).textContent).toContain('Asked 6 times');
    expect(tile(/^Verified/).textContent).toContain('1 due for review');
    expect(document.querySelectorAll('[data-attention]')).toHaveLength(2);
  });

  it('says the reads apart and describes the sparkline in words', () => {
    draw();
    const reads = tile(/^Reads This Week/);
    expect(reads.textContent).toContain('21 people');
    expect(reads.textContent).toContain('7 agents');
    // Its line and the sparkline's words describe it (beside the hover card's own line).
    const about = reads
      .getAttribute('aria-describedby')!
      .split(' ')
      .map((id) => document.getElementById(id)!.textContent)
      .join(' ');
    expect(about).toContain('Reads by day over the last 14 days: 21 by people, 7 by agents.');
    // Seven quiet days are hairlines; seven read days are bars.
    expect(document.querySelectorAll('[data-spark-day]')).toHaveLength(7);
  });

  it('says plainly when there is nothing yet', () => {
    draw(
      overview({
        agents: [],
        questions: [],
        health: { verified: 0, reviewDue: 0, neverVerified: 0, total: 0 },
      }),
    );
    expect(tile(/^Connected Agents/).textContent).toContain('None connected yet');
    expect(tile(/^Open Questions/).textContent).toContain('Every question answered');
    expect(tile(/^Verified/).getAttribute('aria-label')).toBe('Verified: None');
  });

  it('filters Needs Attention from a tile, and shows All again when pressed twice', () => {
    draw(
      overview({
        suggestions: [
          {
            id: 's1',
            tab: 'p1',
            title: 'Release Process',
            agent: 'CLI',
            reason: 'Fix the day.',
            summary: 'Fix the day.',
            kind: 'replace',
            before: 'Friday',
            after: 'Thursday',
            createdAt: 1,
          },
        ],
      }),
    );
    const kinds = () =>
      [...attention().querySelectorAll<HTMLElement>('[data-attention-item]')].map(
        (li) => li.dataset.attentionItem,
      );
    // Suggestions before questions, the most asked question first.
    expect(kinds()).toEqual(['suggestion', 'question', 'question']);
    expect(attention().querySelector('[data-question]')!.textContent).toContain(
      'Question number 2?',
    );
    fireEvent.click(tile(/^Open Questions/));
    expect(tile(/^Open Questions/).getAttribute('aria-pressed')).toBe('true');
    expect(kinds()).toEqual(['question', 'question']);
    expect(
      within(attention()).getByRole('button', { name: 'Questions' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(document.activeElement).toBe(attention());
    fireEvent.click(tile(/^Open Questions/));
    expect(tile(/^Open Questions/).getAttribute('aria-pressed')).toBe('false');
    expect(kinds()).toHaveLength(3);
  });

  it('brings its card into view and focuses it', () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    draw();
    fireEvent.click(tile(/^Connected Agents/));
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Connected Agents' }));
    fireEvent.click(tile(/^Reads This Week/));
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Most Read' }));
    fireEvent.click(tile(/^Verified/));
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Knowledge Health' }));
    expect(scrolled).toHaveBeenCalledTimes(3);
  });
});

describe('the cards', () => {
  it('caps a long list, with Show All and Show Fewer', () => {
    draw(overview({ questions: Array.from({ length: 7 }, (_, at) => question(at + 1)) }));
    const rows = () => attention().querySelectorAll('[data-attention-item]').length;
    expect(rows()).toBe(4);
    const more = within(attention()).getByRole('button', { name: 'Show All 7' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    expect(rows()).toBe(7);
    fireEvent.click(within(attention()).getByRole('button', { name: 'Show Fewer' }));
    expect(rows()).toBe(4);
    // Another filter starts folded.
    fireEvent.click(within(attention()).getByRole('button', { name: 'Show All 7' }));
    fireEvent.click(within(attention()).getByRole('button', { name: 'Questions' }));
    expect(rows()).toBe(4);
  });

  it('caps the agents at four, and offers Connect an Agent from the card', () => {
    const agents = Array.from({ length: 6 }, (_, at) => ({
      id: `a${at}`,
      name: `Agent ${at}`,
      readsThisWeek: 0,
      topPages: [],
    }));
    const actions = draw(overview({ agents }));
    const card = within(screen.getByRole('region', { name: 'Connected Agents' }));
    expect(document.querySelectorAll('[data-agent]')).toHaveLength(4);
    fireEvent.click(card.getByRole('button', { name: 'Show All 6' }));
    expect(document.querySelectorAll('[data-agent]')).toHaveLength(6);
    fireEvent.click(card.getByRole('button', { name: 'Connect an Agent' }));
    expect(actions.connect).toHaveBeenCalled();
  });

  it('Most Read: each page by its reads, said apart, opening its page', () => {
    const actions = draw();
    const card = within(screen.getByRole('region', { name: 'Most Read' }));
    const rows = card.getAllByRole('listitem').filter((li) => li.dataset.mostRead);
    expect(rows.map((li) => li.textContent)).toEqual([
      'Release Process2420 people, 4 agents',
      'Untitled Page11 person, 0 agents',
    ]);
    fireEvent.click(within(rows[0]!).getByRole('button'));
    expect(actions.openPage).toHaveBeenCalledWith('p1');
  });

  it('Most Read with no reads says how one is counted', () => {
    draw(overview({ reads: { days: overview().reads.days, mostRead: [] } }));
    const card = within(screen.getByRole('region', { name: 'Most Read' }));
    expect(card.getByText('No Reads Yet')).toBeTruthy();
  });

  it('shows Knowledge Health as a verified share', () => {
    draw();
    const health = within(screen.getByRole('region', { name: 'Knowledge Health' }));
    expect(health.getByText('66%')).toBeTruthy();
    expect(health.getByText('of 3 pages verified')).toBeTruthy();
  });
});
