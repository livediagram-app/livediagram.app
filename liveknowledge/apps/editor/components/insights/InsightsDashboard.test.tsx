// @vitest-environment jsdom

// The Insights dashboard (docs/specs/030-knowledgebase/blueprints/insights-ui.md "The dashboard"): the four topic
// tiles, their figures, previews and marks; a tile opening its page by the address, Back and the BackBar; a reload at
// a topic and at a filter; Needs Attention's figure tiles pressed and unpressed; the caps and Show All; Most Read and
// Not Read on their pages.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeOverviewResponse, KnowledgeQuestion } from '@liveknowledge/api-schema';
import type { AskRights } from '@/lib/knowledge-ask/ask-rights';
import { knowledgeSettingsStore } from '@/lib/knowledge-settings/knowledge-settings-store';
import { resetInsightsTopic } from '@/lib/knowledge-ask/insights-topic';
import { resetKnowledgeViewTrail } from '@/lib/knowledge-ask/knowledge-view';
import { track } from '@/lib/telemetry';
import { InsightsDashboard, type DashboardActions } from './InsightsDashboard';

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
  acceptSuggestions: true,
  context: true,
  grantAgents: true,
  emailOwners: true,
};

const SUGGESTION = {
  id: 's1',
  tab: 'p1',
  title: 'Release Process',
  agent: 'CLI',
  reason: 'Fix the day.',
  summary: 'Fix the day.',
  kind: 'replace' as const,
  before: 'Friday',
  after: 'Thursday',
  createdAt: 1,
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
    <div data-insights="">
      <InsightsDashboard
        overview={data}
        rights={rights}
        agents={data.agents}
        agentsBusy={new Set()}
        busy={new Set()}
        drafting={null}
        canEmailOwners={false}
        now={Date.UTC(2026, 10, 20)}
        actions={actions}
      />
    </div>,
  );
  return actions;
}

/** The address a topic's page is at, as a reload or a link would have it. */
const at = (query: string) =>
  window.history.replaceState(null, '', `/document/d1?view=insights${query}`);
const tile = (name: RegExp) => screen.getByRole('button', { name });
const region = (name: string) => screen.getByRole('region', { name });
const attention = () => region('Needs Attention');
const topicTile = (topic: string) =>
  document.querySelector<HTMLElement>(`[data-topic-tile="${topic}"]`)!;

beforeEach(() => at(''));
afterEach(() => {
  cleanup();
  resetInsightsTopic();
  resetKnowledgeViewTrail();
  vi.clearAllMocks();
});

describe('the dashboard', () => {
  it('draws a tile a topic, in order, each opening its page', () => {
    draw();
    expect(
      [...document.querySelectorAll<HTMLElement>('[data-topic-tile]')].map(
        (t) => t.dataset.topicTile,
      ),
    ).toEqual(['attention', 'health', 'reads', 'agents']);
    expect(
      ['Open Needs Attention', 'Open Page Health', 'Open Reading', 'Open Agents'].map(
        (name) => screen.getByRole('button', { name }).dataset.topicOpen,
      ),
    ).toEqual(['attention', 'health', 'reads', 'agents']);
    // Each tile is named by its topic.
    expect(region('Needs Attention')).toBe(topicTile('attention'));
  });

  it('Needs Attention: how many wait, the three counts and the most urgent first', () => {
    draw(overview({ suggestions: [SUGGESTION] }));
    const card = within(topicTile('attention'));
    expect(card.getByText('3')).toBeTruthy();
    expect(card.getByText('waiting for someone, most urgent first')).toBeTruthy();
    expect(card.getByRole('button', { name: 'Questions: 2' })).toBeTruthy();
    expect(card.getByRole('button', { name: 'Disagreements: 0' })).toBeTruthy();
    expect(card.getByRole('button', { name: 'Suggested Edits: 1' })).toBeTruthy();
    expect(
      within(card.getByRole('list', { name: 'Most urgent' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Release Process: Fix the day.', 'Question number 2?', 'Question number 1?']);
    expect(topicTile('attention').querySelector('[data-attention]')).not.toBeNull();
  });

  it('Needs Attention past three says how many more, and with none what lands there', () => {
    draw(overview({ questions: Array.from({ length: 5 }, (_, n) => question(n + 1)) }));
    expect(within(topicTile('attention')).getByText('2 more')).toBeTruthy();
    cleanup();
    draw(overview({ questions: [] }));
    const card = within(topicTile('attention'));
    expect(card.getByText('Nothing waiting for anyone')).toBeTruthy();
    expect(card.getByText(/land here/)).toBeTruthy();
    expect(topicTile('attention').querySelector('[data-attention]')).toBeNull();
  });

  it('Page Health: the verified share, the lowest pages and the pages nobody read', () => {
    draw(
      overview({
        health: { verified: 2, reviewDue: 1, neverVerified: 0, total: 3, average: 71 },
        lowHealth: [
          {
            tab: 'l1',
            title: 'Old Page',
            score: 30,
            label: 'needs-work',
            reason: 'Never verified',
          },
        ],
        notRead: { pages: [], total: 4 },
      }),
    );
    const card = within(topicTile('health'));
    expect(card.getByText('66%')).toBeTruthy();
    expect(card.getByText('of 3 pages verified, average health 71')).toBeTruthy();
    expect(card.getByRole('list', { name: 'Lowest health' }).textContent).toContain('Old Page');
    expect(card.getByText('4 pages not read in 90 days')).toBeTruthy();
    expect(topicTile('health').querySelector('[data-tile-visual="verified"]')).not.toBeNull();
    expect(topicTile('health').querySelector('[data-attention]')).not.toBeNull();
  });

  it('Page Health with every page healthy, or no pages, says so', () => {
    draw(overview({ lowHealth: [] }));
    expect(within(topicTile('health')).getByText('Every page scores 75 or more.')).toBeTruthy();
    cleanup();
    draw(overview({ health: { verified: 0, reviewDue: 0, neverVerified: 0, total: 0 } }));
    expect(within(topicTile('health')).getByText('None')).toBeTruthy();
    expect(within(topicTile('health')).getByText('No pages yet')).toBeTruthy();
  });

  it('Page Health under a Review Period of Never leads with the average, and no bar', () => {
    draw(
      overview({
        reviewEvery: 'never',
        health: { verified: 2, reviewDue: 1, neverVerified: 0, total: 3, average: 74 },
      }),
    );
    const card = within(topicTile('health'));
    expect(card.getByText('74')).toBeTruthy();
    expect(card.getByText('average health across 3 pages')).toBeTruthy();
    expect(topicTile('health').querySelector('[data-tile-visual="verified"]')).toBeNull();
    expect(topicTile('health').querySelector('[data-attention]')).toBeNull();
  });

  it('Reading: the week, said apart and as a sparkline, and the pages read most', () => {
    draw(
      overview({
        requiredReading: [{ tab: 'r1', title: 'Rules', audience: 'everyone', done: 1, total: 4 }],
      }),
    );
    const card = within(topicTile('reads'));
    expect(card.getByText('28')).toBeTruthy();
    expect(topicTile('reads').textContent).toContain('21 by people');
    expect(topicTile('reads').textContent).toContain('7 by agents');
    expect(
      within(card.getByRole('list', { name: 'Read most this week' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Release Process24 reads', 'Untitled Page1 read']);
    expect(card.getByText('1 page asked to be read')).toBeTruthy();
    const about = screen
      .getByRole('button', { name: 'Open Reading' })
      .getAttribute('aria-describedby')!;
    expect(document.getElementById(about)!.textContent).toContain(
      'Reads by day over the last 14 days: 21 by people, 7 by agents.',
    );
    cleanup();
    draw(overview({ reads: { days: overview().reads.days, mostRead: [] } }));
    expect(within(topicTile('reads')).getByText(/No reads yet/)).toBeTruthy();
  });

  it('Agents: how many, how many may write, who reads most and the context budget', () => {
    draw(
      overview({
        context: { budget: 8000, used: 4410, pages: [{ tab: 'p1', title: 'A', tokens: 4410 }] },
      }),
    );
    const card = within(topicTile('agents'));
    expect(card.getByText('2')).toBeTruthy();
    expect(card.getByText('connected in 30 days, 1 may write')).toBeTruthy();
    expect(
      within(card.getByRole('list', { name: 'Agents and context' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      'Coding Agent3 reads',
      'CLI1 read',
      'Always in Context: 1 page4,410 of 8,000 tokens',
    ]);
    cleanup();
    draw(overview({ agents: [] }));
    expect(within(topicTile('agents')).getByText('No agents connected yet')).toBeTruthy();
    cleanup();
    draw(
      overview({
        agents: [{ id: 'a', name: 'R', scopes: ['read'], readsThisWeek: 0, topPages: [] }],
      }),
    );
    expect(
      within(topicTile('agents')).getByText('connected in 30 days, all read and suggest'),
    ).toBeTruthy();
  });
});

describe('opening a topic', () => {
  it('opens its page as a new entry, focused, with the BackBar, and Back returns to the dashboard', async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollTo = scrolled;
    draw();
    const length = window.history.length;
    fireEvent.click(screen.getByRole('button', { name: 'Open Page Health' }));
    expect(window.location.search).toBe('?view=insights&topic=health');
    expect(window.history.length).toBe(length + 1);
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'InsightsTopic');
    expect(document.activeElement).toBe(region('Insights, Page Health'));
    expect(scrolled).toHaveBeenCalledWith({ top: 0 });
    expect(region('Knowledge Health')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open Reading' })).toBeNull();
    const back = screen.getByRole('button', { name: /^Insights/ });
    expect(back.textContent).toBe('InsightsPage Health');
    fireEvent.click(back);
    await vi.waitFor(() => expect(window.location.search).toBe('?view=insights'));
    expect(await screen.findByRole('button', { name: 'Open Reading' })).toBeTruthy();
  });

  it('opens Needs Attention at a count’s filter', () => {
    draw(overview({ suggestions: [SUGGESTION] }));
    fireEvent.click(screen.getByRole('button', { name: 'Suggested Edits: 1' }));
    expect(window.location.search).toBe('?view=insights&topic=attention&show=suggestions');
    expect(
      within(attention()).getByRole('button', { name: 'Edits' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(attention().querySelectorAll('[data-attention-item]')).toHaveLength(1);
    for (const [count, show] of [
      ['Questions: 2', 'questions'],
      ['Disagreements: 0', 'conflicts'],
    ] as const) {
      cleanup();
      at('');
      draw(overview({ suggestions: [SUGGESTION] }));
      fireEvent.click(screen.getByRole('button', { name: count }));
      expect(window.location.search).toBe(`?view=insights&topic=attention&show=${show}`);
    }
  });

  it('a topic opened by its address goes back to the dashboard in its own entry', () => {
    at('&topic=agents');
    draw();
    expect(region('Connected Agents')).toBeTruthy();
    expect(region('Always in Context')).toBeTruthy();
    expect(region('What an Agent Sees')).toBeTruthy();
    const length = window.history.length;
    fireEvent.click(screen.getByRole('button', { name: /^Insights/ }));
    expect(window.location.search).toBe('?view=insights');
    expect(window.history.length).toBe(length);
    expect(screen.getByRole('button', { name: 'Open Agents' })).toBeTruthy();
  });

  it('an unknown topic is the dashboard, and an unknown filter All', () => {
    at('&topic=nowhere');
    draw();
    expect(screen.getByRole('button', { name: 'Open Needs Attention' })).toBeTruthy();
    cleanup();
    at('&topic=attention&show=nothing');
    draw();
    expect(
      within(attention()).getByRole('button', { name: 'All' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });
});

describe('Needs Attention’s page', () => {
  it('filters from a figure tile, replacing the address, and shows All again when pressed twice', () => {
    at('&topic=attention');
    draw(overview({ suggestions: [SUGGESTION] }));
    const kinds = () =>
      [...attention().querySelectorAll<HTMLElement>('[data-attention-item]')].map(
        (li) => li.dataset.attentionItem,
      );
    // Suggestions before questions, the most asked question first.
    expect(kinds()).toEqual(['suggestion', 'question', 'question']);
    const tiles = within(screen.getByRole('group', { name: 'Needs Attention at a glance' }))
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'));
    expect(tiles).toEqual([
      'Open Questions: 2, needs attention',
      'Pages That Disagree: 0',
      'Suggested Edits: 1, needs attention',
    ]);
    expect(tile(/^Open Questions/).textContent).toContain('Asked 6 times');
    const length = window.history.length;
    fireEvent.click(tile(/^Open Questions/));
    expect(window.location.search).toBe('?view=insights&topic=attention&show=questions');
    expect(window.history.length).toBe(length);
    expect(tile(/^Open Questions/).getAttribute('aria-pressed')).toBe('true');
    expect(kinds()).toEqual(['question', 'question']);
    expect(document.activeElement).toBe(attention());
    fireEvent.click(tile(/^Open Questions/));
    expect(tile(/^Open Questions/).getAttribute('aria-pressed')).toBe('false');
    expect(window.location.search).toBe('?view=insights&topic=attention');
    expect(kinds()).toHaveLength(3);
    fireEvent.click(tile(/^Pages That Disagree/));
    expect(window.location.search).toBe('?view=insights&topic=attention&show=conflicts');
    expect(kinds()).toEqual([]);
    fireEvent.click(tile(/^Suggested Edits/));
    expect(window.location.search).toBe('?view=insights&topic=attention&show=suggestions');
    expect(kinds()).toEqual(['suggestion']);
  });

  it('keeps the filter through a reload, and the card’s own switch sets it too', () => {
    at('&topic=attention&show=questions');
    draw(overview({ suggestions: [SUGGESTION] }));
    expect(attention().querySelectorAll('[data-attention-item]')).toHaveLength(2);
    fireEvent.click(within(attention()).getByRole('button', { name: 'Edits' }));
    expect(window.location.search).toBe('?view=insights&topic=attention&show=suggestions');
  });

  it('shows ten before Show All, and Show Fewer folds them', () => {
    at('&topic=attention');
    draw(overview({ questions: Array.from({ length: 13 }, (_, n) => question(n + 1)) }));
    const rows = () => attention().querySelectorAll('[data-attention-item]').length;
    expect(rows()).toBe(10);
    const more = within(attention()).getByRole('button', { name: 'Show All 13' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(more);
    expect(rows()).toBe(13);
    fireEvent.click(within(attention()).getByRole('button', { name: 'Show Fewer' }));
    expect(rows()).toBe(10);
  });
});

describe('the other pages', () => {
  it('Agents caps the cards at four, and offers Connect an Agent', () => {
    at('&topic=agents');
    const agents = Array.from({ length: 6 }, (_, n) => ({
      id: `a${n}`,
      name: `Agent ${n}`,
      readsThisWeek: 0,
      topPages: [],
    }));
    const actions = draw(overview({ agents }));
    const card = within(region('Connected Agents'));
    expect(document.querySelectorAll('[data-agent]')).toHaveLength(4);
    fireEvent.click(card.getByRole('button', { name: 'Show All 6' }));
    expect(document.querySelectorAll('[data-agent]')).toHaveLength(6);
    fireEvent.click(card.getByRole('button', { name: 'Connect an Agent' }));
    expect(actions.connect).toHaveBeenCalled();
  });

  it('Reading: the 14 days drawn tall, Most Read by its reads opening its page, and Required Reading', () => {
    at('&topic=reads');
    const actions = draw(overview({ requiredReading: [] }));
    const trend = within(region('Reads Over 14 Days'));
    expect(trend.getByText('28')).toBeTruthy();
    expect(trend.getByRole('img').getAttribute('aria-label')).toBe(
      'Reads by day over the last 14 days: 21 by people, 7 by agents.',
    );
    // Seven quiet days are hairlines; seven read days are bars.
    expect(document.querySelectorAll('[data-spark-day]')).toHaveLength(7);
    const card = within(region('Most Read'));
    const rows = card.getAllByRole('listitem').filter((li) => li.dataset.mostRead);
    expect(rows.map((li) => li.textContent)).toEqual([
      'Release Process2420 reads by people, 4 by agents',
      'Untitled Page11 read by people, 0 by agents',
    ]);
    fireEvent.click(within(rows[0]!).getByRole('button'));
    expect(actions.openPage).toHaveBeenCalledWith('p1');
    expect(region('Required Reading')).toBeTruthy();
  });

  it('Reading with no reads says how one is counted', () => {
    at('&topic=reads');
    draw(overview({ reads: { days: overview().reads.days, mostRead: [] } }));
    expect(within(region('Most Read')).getByText('No Reads Yet')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Required Reading' })).toBeNull();
  });

  it('Not Read in 90 Days: each page oldest first, its last edit, opening its page, and the rest counted', () => {
    at('&topic=health');
    const now = Date.UTC(2026, 10, 20);
    const actions = draw(
      overview({
        notRead: {
          pages: [
            { tab: 'n1', title: 'Old Onboarding' },
            { tab: 'n2', title: '', touchedAt: now - 150 * 86_400_000 },
            { tab: 'n3', title: 'Vendors', touchedAt: now - 100 * 86_400_000 },
          ],
          total: 7,
        },
      }),
    );
    const card = within(region('Not Read in 90 Days'));
    const rows = card.getAllByRole('listitem').filter((li) => li.dataset.notRead);
    expect(rows.map((li) => li.textContent)).toEqual([
      'Old OnboardingLast edit not kept',
      'Untitled PageLast edited 5 months ago',
      'VendorsLast edited 100 days ago',
    ]);
    expect(card.getByText('4 more not listed')).toBeTruthy();
    expect(card.getByText('7')).toBeTruthy();
    fireEvent.click(within(rows[2]!).getByRole('button'));
    expect(actions.openPage).toHaveBeenCalledWith('n3');
  });

  it('Not Read in 90 Days says every page was read, and is not drawn from an older api', () => {
    at('&topic=health');
    draw(overview({ notRead: { pages: [], total: 0 } }));
    expect(screen.getByText('Every Page Was Read')).toBeTruthy();
    cleanup();
    draw();
    expect(screen.queryByRole('region', { name: 'Not Read in 90 Days' })).toBeNull();
  });

  it('Not Read names the days the tier keeps reads, where fewer than 90', () => {
    at('&topic=health');
    draw(overview({ notRead: { pages: [], total: 0, days: 30 } }));
    expect(region('Not Read in 30 Days')).toBeTruthy();
    expect(
      screen.getByText(
        'Each page older than 30 days was opened, or read by an agent, in that time.',
      ),
    ).toBeTruthy();
  });

  it('shows Knowledge Health as a verified share, and under Never the average', () => {
    at('&topic=health');
    draw();
    const health = within(region('Knowledge Health'));
    expect(health.getByText('66%')).toBeTruthy();
    expect(health.getByText('of 3 pages verified')).toBeTruthy();
    cleanup();
    draw(
      overview({
        reviewEvery: 'never',
        health: { verified: 2, reviewDue: 1, neverVerified: 0, total: 3, average: 74 },
      }),
    );
    const never = within(region('Knowledge Health'));
    expect(never.queryByText('of 3 pages verified')).toBeNull();
    expect(never.getByText('74')).toBeTruthy();
  });
});

it('follows a change of the Review Period at once, from the live settings store, with no new read', () => {
  const data = overview({
    health: { verified: 2, reviewDue: 1, neverVerified: 0, total: 3, average: 74 },
  });
  const read = vi.fn(() => data);
  knowledgeSettingsStore.take('kb-live', { reviewEvery: 90 });
  render(
    <InsightsDashboard
      overview={read()}
      documentId="kb-live"
      rights={RIGHTS}
      agents={data.agents}
      agentsBusy={new Set()}
      busy={new Set()}
      drafting={null}
      canEmailOwners={false}
      now={Date.UTC(2026, 10, 20)}
      actions={{} as DashboardActions}
    />,
  );
  const health = () => within(topicTile('health'));
  expect(health().getByText('66%')).toBeTruthy();
  act(() => void knowledgeSettingsStore.take('kb-live', { reviewEvery: 'never' }));
  expect(health().getByText('average health across 3 pages')).toBeTruthy();
  expect(health().queryByText('66%')).toBeNull();
  act(() => void knowledgeSettingsStore.take('kb-live', { reviewEvery: 90 }));
  expect(health().getByText('66%')).toBeTruthy();
  expect(read).toHaveBeenCalledTimes(1);
});
