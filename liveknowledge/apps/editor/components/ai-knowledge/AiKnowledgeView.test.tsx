// @vitest-environment jsdom

// AI Knowledge (docs/specs/030-knowledgebase/ai-knowledge.md, "Share roles"): one read when the view opens and one
// after each action, every section with its rows or its empty state, and each Editor action per role.
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
  type BoundFunctions,
  type queries,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeOverviewResponse } from '@liveknowledge/api-schema';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';

const api = vi.hoisted(() => ({
  apiKnowledgeOverview: vi.fn(),
  apiDismissKnowledgeConflict: vi.fn(),
  apiDismissKnowledgeQuestion: vi.fn(),
  apiSetPageKnowledge: vi.fn(),
}));
vi.mock('@/lib/api/knowledge', async (actual) => ({
  ...(await actual<typeof import('@/lib/api/knowledge')>()),
  ...api,
}));
const suggestionsApi = vi.hoisted(() => ({
  apiAcceptKnowledgeSuggestion: vi.fn(),
  apiDismissKnowledgeSuggestion: vi.fn(),
}));
vi.mock('@/lib/knowledge-ask/suggestions-api', async (actual) => ({
  ...(await actual<typeof import('@/lib/knowledge-ask/suggestions-api')>()),
  ...suggestionsApi,
}));
const ask = vi.hoisted(() => ({ apiAskKnowledge: vi.fn() }));
vi.mock('@/lib/api/knowledge-ask', () => ask);
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const offline = vi.hoisted(() => ({ value: false }));
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({
  useIsOfflineDocument: () => offline.value,
}));
const toast = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  action: vi.fn<(offer: { message: string }) => void>(),
}));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('@/lib/knowledge/go-to-block', () => ({ BLOCK_HIT_MS: 1600, goToBlock: vi.fn() }));

import { ContextBudgetError } from '@/lib/api/knowledge';
import { goToBlock } from '@/lib/knowledge/go-to-block';
import { closeAiSettings, useAiSettingsOpen } from '@/lib/knowledge-ask/ai-settings-open';
import { ROLES, chromeValue, renderInEditor, type Role } from '@/components/ask/test-chrome';
import { AiKnowledgeView } from './AiKnowledgeView';

const VERIFIED_AT = new Date(2026, 10, 8).getTime();
const full = (over: Partial<KnowledgeOverviewResponse> = {}): KnowledgeOverviewResponse => ({
  agents: [
    {
      name: 'Coding Agent',
      readsThisWeek: 12,
      topPages: [
        { tab: 'p1', title: 'Release Process' },
        { tab: 'p2', title: 'Hotfixes' },
      ],
    },
    { name: 'CLI', readsThisWeek: 1, topPages: [] },
  ],
  questions: [
    {
      key: 'approve release who',
      question: 'Who approves a release?',
      asked: 4,
      byPeople: 3,
      agents: [{ name: 'Coding Agent', asked: 1 }],
      lastAt: 5,
    },
  ],
  conflicts: [
    {
      id: 'c1',
      question: 'Which day do we release?',
      a: {
        passageId: 'p1:0',
        tab: 'p1',
        title: 'Release Process',
        text: 'We release on Thursdays.',
        trust: 'verified',
        verifiedAt: VERIFIED_AT,
      },
      b: {
        passageId: 'p2:0',
        tab: 'p2',
        title: 'Hotfixes',
        text: '<b>We release on Fridays.</b>',
        trust: 'never-verified',
      },
      foundAt: 6,
    },
  ],
  suggestions: [
    {
      id: 's1',
      tab: 'p2',
      title: 'Hotfixes',
      agent: 'Coding Agent',
      reason: 'The release day changed.\nSee the release page.',
      summary: 'The release day changed.',
      kind: 'replace',
      before: 'We release on Fridays.',
      after: 'We release on Thursdays.\nHotfixes go any day.',
      createdAt: 7,
    },
  ],
  context: {
    budget: 8000,
    used: 4410,
    pages: [{ tab: 'p1', title: 'Release Process', tokens: 4410 }],
  },
  health: { verified: 59, reviewDue: 3, neverVerified: 2, total: 64 },
  hasKey: true,
  ...over,
});
const empty = (): KnowledgeOverviewResponse =>
  full({
    agents: [],
    questions: [],
    conflicts: [],
    suggestions: [],
    context: { budget: 8000, used: 0, pages: [] },
    health: { verified: 0, reviewDue: 0, neverVerified: 0, total: 0 },
  });

beforeEach(() => {
  offline.value = false;
  api.apiKnowledgeOverview.mockResolvedValue(full());
  for (const fn of [
    api.apiDismissKnowledgeConflict,
    api.apiDismissKnowledgeQuestion,
    api.apiSetPageKnowledge,
    suggestionsApi.apiAcceptKnowledgeSuggestion,
    suggestionsApi.apiDismissKnowledgeSuggestion,
  ])
    fn.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  act(() => closeAiSettings());
  window.history.replaceState(null, '', '/document/d1');
  vi.clearAllMocks();
});

async function open(role: Role = 'edit', over: Record<string, unknown> = {}) {
  const utils = renderInEditor(<AiKnowledgeView />, chromeValue(role, over));
  await waitFor(() =>
    expect(screen.queryByRole('status', { name: 'Loading AI Knowledge' })).toBeNull(),
  );
  return utils;
}
const section = (name: string): BoundFunctions<typeof queries> =>
  within(screen.getByRole('region', { name }));
const WHO = { ownerId: 'me', shareCode: null };

describe('reading it', () => {
  it('asks once when the view opens, and again only after an action', async () => {
    await open();
    expect(api.apiKnowledgeOverview).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(api.apiKnowledgeOverview).toHaveBeenCalledTimes(1);
    fireEvent.click(section('Pages That Disagree').getByRole('button', { name: 'Not a Conflict' }));
    await waitFor(() => expect(api.apiKnowledgeOverview).toHaveBeenCalledTimes(2));
    expect(api.apiDismissKnowledgeConflict).toHaveBeenCalledWith(WHO, 'd1', 'c1');
  });

  it('gives every section a proper empty state', async () => {
    api.apiKnowledgeOverview.mockResolvedValue(empty());
    await open();
    for (const title of [
      'No Agents Yet',
      'No Disagreements Yet',
      'No Unanswered Questions Yet',
      'No Suggested Edits Yet',
      'No Pages Yet',
      'No Pages in Context Yet',
    ])
      expect(screen.getByText(title)).toBeTruthy();
    expect(document.querySelectorAll('[data-empty-state]')).toHaveLength(6);
    // A static sample still shows what an agent sees.
    expect(
      section('What an Agent Sees').getByLabelText('A sample search result').textContent,
    ).toContain('search_knowledge("release process")');
  });

  it('says so when it cannot be read, and reads it again when asked', async () => {
    api.apiKnowledgeOverview.mockRejectedValueOnce(new Error('down'));
    await open();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('AI Knowledge Could Not Be Read');
    fireEvent.click(within(alert).getByRole('button', { name: 'Try Again' }));
    await screen.findByRole('region', { name: 'Connected Agents' });
  });

  it('reads nothing for a knowledgebase kept Offline', async () => {
    offline.value = true;
    renderInEditor(<AiKnowledgeView />);
    expect(screen.getByText('No AI Knowledge in an Offline Knowledgebase')).toBeTruthy();
    expect(api.apiKnowledgeOverview).not.toHaveBeenCalled();
  });
});

describe('what it shows', () => {
  it('an agent card: its name, how it connects, what it does, its reads and top pages', async () => {
    await open();
    const card = within(document.querySelector<HTMLElement>('[data-agent="Coding Agent"]')!);
    expect(card.getByText('Connected')).toBeTruthy();
    expect(card.getByText('Through the MCP server, the command line or a token')).toBeTruthy();
    expect(
      within(card.getByRole('list', { name: 'What it may do' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Reads', 'Suggests Edits']);
    expect(card.getByText('12 pages read this week')).toBeTruthy();
    fireEvent.click(card.getByRole('button', { name: 'Hotfixes' }));
    expect(vi.mocked(goToBlock).mock.calls[0]!.slice(1)).toEqual(['p2', '']);
    const cli = within(document.querySelector<HTMLElement>('[data-agent="CLI"]')!);
    expect(cli.getByText('Through the command line')).toBeTruthy();
    expect(cli.getByText('1 page read this week')).toBeTruthy();
  });

  it('a conflict: the question and both passages as text, each with its page trust', async () => {
    await open();
    const conflicts = section('Pages That Disagree');
    expect(conflicts.getByText('Which day do we release?')).toBeTruthy();
    expect(conflicts.getByText('Verified 8 Nov')).toBeTruthy();
    expect(conflicts.getByText('Never Verified')).toBeTruthy();
    expect(conflicts.getByText('<b>We release on Fridays.</b>')).toBeTruthy();
    expect(document.querySelector('[data-conflict] b')).toBeNull();
    // Email is not built.
    expect(screen.queryByRole('button', { name: /Ask Both Owners|Remind the Owners/ })).toBeNull();
  });

  it('a question: how often it was asked and by whom', async () => {
    await open();
    expect(
      section('Questions Nobody Could Answer').getByText(
        'Asked 4 times by people and the Coding Agent',
      ),
    ).toBeTruthy();
  });

  it('a suggestion: the page, the agent, the reason and the lines taken out and put in', async () => {
    await open();
    const card = document.querySelector<HTMLElement>('[data-suggestion="s1"]')!;
    expect(card.textContent).toContain('The release day changed.');
    expect([...card.querySelectorAll('del')].map((el) => el.textContent)).toEqual([
      '−Removed: We release on Fridays.',
    ]);
    expect([...card.querySelectorAll('ins')].map((el) => el.textContent)).toEqual([
      '+Added: We release on Thursdays.',
      '+Added: Hotfixes go any day.',
    ]);
  });

  it('Knowledge Health as one labelled bar, its parts sized by their pages, with a legend', async () => {
    await open();
    const bar = section('Knowledge Health').getByRole('img');
    expect(bar.getAttribute('aria-label')).toBe(
      'Of 64 pages: 59 verified, 3 review due, 2 never verified.',
    );
    const parts = [...bar.querySelectorAll<HTMLElement>('[data-health-part]')];
    expect(parts.map((p) => [p.dataset.healthPart, p.style.flexGrow])).toEqual([
      ['verified', '59'],
      ['reviewDue', '3'],
      ['neverVerified', '2'],
    ]);
    expect(
      within(section('Knowledge Health').getByRole('list', { name: 'Legend' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Verified59', 'Review Due3', 'Never Verified2']);
  });

  it('Always in Context: each page with its size, against the budget', async () => {
    await open();
    const context = section('Always in Context');
    expect(context.getByText('4,410 of 8,000 tokens')).toBeTruthy();
    expect(context.getByText('4,410 tokens')).toBeTruthy();
    expect(context.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('4410');
  });

  it('What an Agent Sees, from a real passage when there is one', async () => {
    await open();
    const sample =
      section('What an Agent Sees').getByLabelText('A sample search result').textContent;
    expect(sample).toContain('1. Release Process');
    expect(sample).toContain('trust: verified 8 Nov');
    expect(sample).toContain('"We release on Thursdays."');
  });

  it('without a key, says the conflicts need one', async () => {
    api.apiKnowledgeOverview.mockResolvedValue(full({ hasKey: false, conflicts: [] }));
    const Open = () => <output data-testid="open">{String(useAiSettingsOpen())}</output>;
    renderInEditor(
      <>
        <AiKnowledgeView />
        <Open />
      </>,
    );
    const note = within(await screen.findByRole('note'));
    expect(note.getByText('This Needs a Claude Key')).toBeTruthy();
    fireEvent.click(note.getByRole('button', { name: 'Open AI Settings' }));
    expect(screen.getByTestId('open').textContent).toBe('true');
  });
});

// ai-knowledge.md "Share roles": everyone sees it; every action below is an Editor's.
describe.each(ROLES)('as %s', (role) => {
  const editor = role === 'edit';
  const has = (scope: ReturnType<typeof section>, name: string | RegExp) =>
    scope.queryByRole('button', { name }) !== null;

  it(`${editor ? 'offers' : 'hides'} every Editor action, and shows everything else`, async () => {
    await open(role);
    const conflicts = section('Pages That Disagree');
    expect(has(conflicts, 'Release Process Is Right, Fix the Other')).toBe(editor);
    expect(has(conflicts, 'Hotfixes Is Right, Fix the Other')).toBe(editor);
    expect(has(conflicts, 'Not a Conflict')).toBe(editor);
    const questions = section('Questions Nobody Could Answer');
    expect(has(questions, 'Draft a Page')).toBe(editor);
    expect(has(questions, 'Dismiss: Who approves a release?')).toBe(editor);
    const suggestions = section('Edits Suggested by Agents');
    expect(has(suggestions, 'Accept')).toBe(editor);
    expect(has(suggestions, 'Dismiss')).toBe(editor);
    expect(has(suggestions, 'Open the Page')).toBe(true);
    const context = section('Always in Context');
    expect(has(context, 'Add a Page')).toBe(editor);
    expect(has(context, /Remove .* from Always in Context/)).toBe(editor);
    // Everyone may see how to connect an agent and how the key stands.
    expect(screen.getAllByRole('button', { name: 'Connect an Agent' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'AI Settings' })).toBeTruthy();
  });

  it('without a key, an Editor gets Open AI Settings and anyone else is told who can add one', async () => {
    api.apiKnowledgeOverview.mockResolvedValue(full({ hasKey: false }));
    await open(role);
    const note = within(screen.getByRole('note'));
    expect(note.queryByRole('button', { name: 'Open AI Settings' }) !== null).toBe(editor);
    expect(/Ask an Editor to add one/.test(screen.getByRole('note').textContent)).toBe(!editor);
  });
});

describe('an Editor’s actions', () => {
  it('opens the other page to fix, whichever is right', async () => {
    await open();
    const conflicts = section('Pages That Disagree');
    fireEvent.click(
      conflicts.getByRole('button', { name: 'Release Process Is Right, Fix the Other' }),
    );
    expect(vi.mocked(goToBlock).mock.calls[0]!.slice(1)).toEqual(['p2', '']);
  });

  it('dismisses a question, then reads again', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss: Who approves a release?' }));
    await waitFor(() => expect(api.apiKnowledgeOverview).toHaveBeenCalledTimes(2));
    expect(api.apiDismissKnowledgeQuestion).toHaveBeenCalledWith(WHO, 'd1', 'approve release who');
  });

  it('drafts a page for a question with one Ask call when there is a key', async () => {
    ask.apiAskKnowledge.mockResolvedValue({
      type: 'done',
      text: 'The release manager.',
      sources: [],
      notUsed: [],
      gaps: [],
      model: 'm',
    });
    const commitTabs = vi.fn();
    await open('edit', { commitTabs });
    fireEvent.click(screen.getByRole('button', { name: 'Draft a Page' }));
    await waitFor(() => expect(commitTabs).toHaveBeenCalledTimes(1));
    expect(ask.apiAskKnowledge.mock.calls[0]![2]).toEqual({ question: 'Who approves a release?' });
    expect(toast.action.mock.calls[0]![0].message).toBe('Drafted “Who approves a release?”');
  });

  it('drafts the page with no Ask call when there is no key', async () => {
    api.apiKnowledgeOverview.mockResolvedValue(full({ hasKey: false }));
    const commitTabs = vi.fn();
    await open('edit', { commitTabs });
    fireEvent.click(screen.getByRole('button', { name: 'Draft a Page' }));
    await waitFor(() => expect(commitTabs).toHaveBeenCalledTimes(1));
    expect(ask.apiAskKnowledge).not.toHaveBeenCalled();
  });

  it('accepts and dismisses a suggestion, and says in words when one no longer fits', async () => {
    await open();
    fireEvent.click(section('Edits Suggested by Agents').getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(api.apiKnowledgeOverview).toHaveBeenCalledTimes(2));
    expect(suggestionsApi.apiAcceptKnowledgeSuggestion).toHaveBeenCalledWith(WHO, 'd1', 's1');
    fireEvent.click(section('Edits Suggested by Agents').getByRole('button', { name: 'Dismiss' }));
    await waitFor(() =>
      expect(suggestionsApi.apiDismissKnowledgeSuggestion).toHaveBeenCalledWith(WHO, 'd1', 's1'),
    );
    await waitFor(() => expect(api.apiKnowledgeOverview).toHaveBeenCalledTimes(3));
    suggestionsApi.apiAcceptKnowledgeSuggestion.mockRejectedValue(
      new ApiError('accept suggestion', 409, 'suggestion_stale'),
    );
    fireEvent.click(section('Edits Suggested by Agents').getByRole('button', { name: 'Accept' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'The page has changed since this was suggested',
    );
    expect(api.apiKnowledgeOverview).toHaveBeenCalledTimes(3);
  });

  it('adds a page to Always in Context from the page picker, and takes one out', async () => {
    await open();
    fireEvent.click(section('Always in Context').getByRole('button', { name: 'Add a Page' }));
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Add a Page to Always in Context' }),
    );
    // The page already in is there, dimmed, saying why.
    const already = dialog.getByRole('option', { name: /Release Process/ });
    expect(already.getAttribute('aria-disabled')).toBe('true');
    expect(already.textContent).toContain('Already In');
    fireEvent.click(dialog.getByRole('option', { name: 'Hotfixes' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Add to Context' }));
    await waitFor(() =>
      expect(api.apiSetPageKnowledge).toHaveBeenCalledWith(WHO, 'd1', 'p2', { context: true }),
    );
    await waitFor(() => expect(api.apiKnowledgeOverview).toHaveBeenCalledTimes(2));
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Release Process from Always in Context' }),
    );
    await waitFor(() =>
      expect(api.apiSetPageKnowledge).toHaveBeenCalledWith(WHO, 'd1', 'p1', { context: false }),
    );
  });

  it('refuses a page that would pass the budget, in words', async () => {
    api.apiSetPageKnowledge.mockRejectedValue(
      new ContextBudgetError('set knowledge', { tokens: 4000, used: 4410, budget: 8000 }),
    );
    await open();
    fireEvent.click(section('Always in Context').getByRole('button', { name: 'Add a Page' }));
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Add a Page to Always in Context' }),
    );
    fireEvent.click(dialog.getByRole('option', { name: 'Hotfixes' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Add to Context' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'This page is 4,000 tokens and 4,410 of 8,000 are in use. Take another page out of Always in Context first.',
    );
  });

  it('opens the connection instructions from Connect an Agent', async () => {
    const openSettingsOn = vi.fn();
    await open('view', { openSettingsOn });
    fireEvent.click(screen.getAllByRole('button', { name: 'Connect an Agent' })[0]!);
    expect(openSettingsOn).toHaveBeenCalledWith('tokens');
  });
});
