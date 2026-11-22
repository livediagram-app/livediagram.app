// @vitest-environment jsdom

// The Knowledgebase Home (docs/specs/030-knowledgebase/knowledgebase-home.md): who sees it, the hero and its
// illustration, the knowledgebases and their numbers, the search across them, what it hands the editor, and the
// first visit.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgeSearchResult, KnowledgeSummaryResponse } from '@liveknowledge/api-schema';

type Auth = {
  authLoaded: boolean;
  sessionAnswered?: boolean;
  accountUserId: string | null;
  accountDisplayName: string | null;
};
const auth = vi.hoisted(() => ({
  value: { authLoaded: true, accountUserId: 'me', accountDisplayName: 'Thomas McClean' } as Auth,
}));
vi.mock('@/hooks/persistence/useAccountBootstrap', () => ({
  useAccountBootstrap: () => auth.value,
}));
const index = vi.hoisted(() => ({ listItems: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({ indexClient: index }));
const api = vi.hoisted(() => ({
  apiKnowledgeSummary: vi.fn(),
  apiSearchKnowledge: vi.fn(),
  apiVerifyPage: vi.fn(),
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('@/lib/api/knowledge', async (actual) => ({
  ...(await actual<typeof import('@/lib/api/knowledge')>()),
  ...api,
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const hint = vi.hoisted(() => ({ signedIn: false }));
vi.mock('@/lib/signed-in-hint', () => ({ looksSignedIn: () => hint.signedIn }));
vi.mock('@/components/chrome/EditorHeader', () => ({ EditorHeader: () => <header /> }));
vi.mock('@/components/chrome/OpeningScreen', () => ({
  OpeningScreen: () => <div data-testid="opening" />,
}));

import { ARRIVAL_KEY } from '@/lib/knowledge-home/arrival-handoff';
import { recentQuestionsKey } from '@/lib/knowledge-ask/recent-questions';
import { HomeScreen, homeSignedOut } from './HomeScreen';
import { HOME_STRUCTURES, HomeReview } from './HomeSections';
import { setupStructure } from '@liveknowledge/knowledge';

const item = (id: string, title: string, updatedAt: number) => ({
  id,
  title,
  updatedAt,
  lastOpenedAt: null,
  trashedAt: null,
});
const summary = (over: Partial<KnowledgeSummaryResponse> = {}): KnowledgeSummaryResponse => ({
  pages: 64,
  reviewEvery: 90,
  health: { verified: 59, reviewDue: 3, neverVerified: 2, total: 64 },
  recent: [{ tab: 't1', title: 'Release Process', updatedAt: Date.now() - 3_600_000 }],
  yoursToReview: [],
  ...over,
});
const found = (id: string, over: Partial<KnowledgeSearchResult> = {}): KnowledgeSearchResult => ({
  id,
  tab: `tab-${id}`,
  isTitle: false,
  title: 'Release Process',
  titleMarked: '\u0002Release\u0003 Process',
  headings: ['Shipping'],
  snippet: 'We \u0002release\u0003 on Thursdays.',
  firstBlock: 'b1',
  lastBlock: 'b1',
  trust: 'verified',
  ...over,
});

const assign = vi.fn();
const replace = vi.fn();
beforeEach(() => {
  auth.value = { authLoaded: true, accountUserId: 'me', accountDisplayName: 'Thomas McClean' };
  // A fresh account each test, so the minute's cache of summaries never crosses tests.
  auth.value.accountUserId = `me-${Math.random()}`;
  index.listItems.mockResolvedValue({
    items: [item('a', 'Handbook', 2), item('b', 'Runbooks', 1)],
  });
  api.apiKnowledgeSummary.mockResolvedValue(summary());
  api.apiSearchKnowledge.mockResolvedValue([]);
  vi.stubGlobal('location', { ...window.location, assign, replace, search: '' });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});

const home = async () => {
  render(<HomeScreen />);
  await screen.findByRole('heading', { level: 1 });
};

describe('who sees Home', () => {
  it('holds the opening screen until who is here is known', () => {
    auth.value = { authLoaded: false, accountUserId: null, accountDisplayName: null };
    render(<HomeScreen />);
    expect(screen.getByTestId('opening')).toBeTruthy();
    expect(index.listItems).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends someone not signed in to /new, where the start sent everyone, and asks for nothing', () => {
    auth.value = { authLoaded: true, accountUserId: null, accountDisplayName: null };
    render(<HomeScreen />);
    expect(replace).toHaveBeenCalledWith('/new');
    expect(index.listItems).not.toHaveBeenCalled();
  });

  it('keeps the opening screen when the page gave up waiting on a browser that looks signed in', () => {
    hint.signedIn = true;
    auth.value = {
      authLoaded: true,
      sessionAnswered: false,
      accountUserId: null,
      accountDisplayName: null,
    };
    render(<HomeScreen />);
    expect(screen.getByTestId('opening')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    hint.signedIn = false;
  });
});

describe('homeSignedOut', () => {
  const state = { authLoaded: true, sessionAnswered: true, signedIn: false, looksSignedIn: false };

  it('is false while who is here is not known, and for someone signed in', () => {
    expect(homeSignedOut({ ...state, authLoaded: false, sessionAnswered: false })).toBe(false);
    expect(homeSignedOut({ ...state, signedIn: true })).toBe(false);
  });

  it('is true once the session itself says nobody is signed in', () => {
    expect(homeSignedOut(state)).toBe(true);
    expect(homeSignedOut({ ...state, looksSignedIn: true })).toBe(true);
  });

  it('waits for the session when the page gave up on a browser that looks signed in', () => {
    expect(homeSignedOut({ ...state, sessionAnswered: false, looksSignedIn: true })).toBe(false);
    expect(homeSignedOut({ ...state, sessionAnswered: false })).toBe(true);
  });
});

describe('the hero', () => {
  it('asks the person by their first name', async () => {
    await home();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'What do you need to know, Thomas?',
    );
  });

  it('draws the illustration as one labelled image', async () => {
    await home();
    const art = screen.getByRole('img', { name: /five other apps as small cubes/ });
    expect(art.tagName.toLowerCase()).toBe('svg');
    expect(art.getAttribute('viewBox')).toBe('0 0 560 400');
    // Everything inside is decoration: one hidden group, no gradient, and the six cubes' eighteen faces.
    expect([...art.children].every((child) => child.getAttribute('aria-hidden') === 'true')).toBe(
      true,
    );
    expect(art.querySelector('linearGradient, radialGradient')).toBeNull();
    const fills = [...art.querySelectorAll('polygon')].map((p) => p.getAttribute('class') ?? '');
    for (const colour of ['sky', 'violet', 'amber', 'rose', 'emerald'])
      expect(fills.filter((c) => c.includes(`fill-${colour}-`))).toHaveLength(3);
    expect(
      fills.filter((c) => /(?<![:\w-])(fill-brand-300|fill-\[#65a30d\]|fill-brand-700)/.test(c)),
    ).toHaveLength(3);
  });

  it('shows no example questions until the person has asked some, then three at most', async () => {
    await home();
    expect(document.querySelector('[data-home-examples]')).toBeNull();
    cleanup();
    localStorage.setItem(
      recentQuestionsKey(auth.value.accountUserId!, 'a'),
      JSON.stringify(
        ['One?', 'Two?', 'Three?', 'Four?'].map((question, at) => ({ question, askedAt: at })),
      ),
    );
    localStorage.setItem(
      recentQuestionsKey(auth.value.accountUserId!, 'gone'),
      JSON.stringify([{ question: 'From a knowledgebase no longer listed?', askedAt: 99 }]),
    );
    await home();
    const examples = within(
      await waitFor(() => document.querySelector<HTMLElement>('[data-home-examples]')!),
    );
    expect(examples.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Four?',
      'Three?',
      'Two?',
    ]);
    fireEvent.click(examples.getByRole('button', { name: 'Four?' }));
    expect(JSON.parse(sessionStorage.getItem(ARRIVAL_KEY)!)).toMatchObject({
      kind: 'ask',
      documentId: 'a',
      question: 'Four?',
    });
    expect(assign).toHaveBeenCalledWith('/document/a?view=ask');
  });
});

describe('the knowledgebases', () => {
  it('are read once from the index, with one summary each, in parallel', async () => {
    const answers: ((value: KnowledgeSummaryResponse) => void)[] = [];
    api.apiKnowledgeSummary.mockImplementation(
      () => new Promise((resolve) => answers.push(resolve)),
    );
    await home();
    await waitFor(() => expect(api.apiKnowledgeSummary).toHaveBeenCalledTimes(2));
    expect(index.listItems).toHaveBeenCalledTimes(1);
    // Both are out before either is answered; each card holds its room meanwhile.
    const card = () => document.querySelector<HTMLElement>('[data-home-knowledgebase="a"]')!;
    const height = card().className.match(/h-\[[^\]]+\]/)![0];
    expect(within(card()).getByRole('status', { name: 'Loading its numbers' })).toBeTruthy();
    await act(async () => answers.forEach((answer) => answer(summary())));
    expect(card().textContent).toContain('Handbook');
    expect(card().textContent).toContain('64 pages');
    expect(card().textContent).toContain('92% verified');
    expect(within(card()).getByRole('img', { name: '92 percent of pages verified' })).toBeTruthy();
    expect(card().className).toContain(height);
    expect(card().getAttribute('href')).toBe('/document/a');
  });

  it('shows twelve at most and offers See All when there are more', async () => {
    index.listItems.mockResolvedValue({
      items: Array.from({ length: 14 }, (_, i) => item(`k${i}`, `KB ${i}`, i)),
    });
    await home();
    await waitFor(() =>
      expect(document.querySelectorAll('[data-home-knowledgebase]')).toHaveLength(12),
    );
    expect(api.apiKnowledgeSummary).toHaveBeenCalledTimes(12);
    expect(screen.getByRole('link', { name: 'See All' }).getAttribute('href')).toBe(
      '/explorer/home',
    );
  });

  it('keeps a card whose summary failed, without numbers', async () => {
    api.apiKnowledgeSummary.mockImplementation((_who: unknown, id: string) =>
      id === 'a' ? Promise.reject(new Error('down')) : Promise.resolve(summary()),
    );
    await home();
    await screen.findByText('Its numbers could not be read.');
    expect(document.querySelector('[data-home-knowledgebase="b"]')!.textContent).toContain(
      '64 pages',
    );
  });

  it('lists the pages changed last, and leaves Yours to Review out while it has no rows', async () => {
    await home();
    const recent = await waitFor(() => {
      const rows = document.querySelectorAll('[data-home-recent]');
      expect(rows.length).toBe(2);
      return rows;
    });
    expect(recent[0]!.getAttribute('href')).toBe('/document/a#t=t1');
    expect(recent[0]!.textContent).toContain('Release Process');
    expect(screen.queryByRole('heading', { name: 'Yours to Review' })).toBeNull();
  });

  it('says so when the list cannot be read, and reads it again when asked', async () => {
    index.listItems.mockRejectedValueOnce(new Error('down'));
    await home();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Your Knowledgebases Could Not Be Read');
    fireEvent.click(within(alert).getByRole('button', { name: 'Try Again' }));
    await waitFor(() =>
      expect(document.querySelectorAll('[data-home-knowledgebase]')).toHaveLength(2),
    );
  });
});

describe('the field', () => {
  const type = (words: string) =>
    fireEvent.change(screen.getByRole('textbox', { name: 'Search or ask' }), {
      target: { value: words },
    });

  it('searches every knowledgebase at once and merges what they find', async () => {
    api.apiSearchKnowledge.mockImplementation((_who: unknown, id: string) =>
      Promise.resolve(
        id === 'a' ? [found('a1')] : [found('b1', { isTitle: true, title: 'Releases' })],
      ),
    );
    await home();
    await waitFor(() =>
      expect(document.querySelectorAll('[data-home-knowledgebase]')).toHaveLength(2),
    );
    fireEvent.focus(screen.getByRole('textbox', { name: 'Search or ask' }));
    type('release');
    const results = await waitFor(() => {
      const rows = document.querySelectorAll<HTMLElement>('[data-home-result]');
      expect(rows.length).toBe(2);
      return rows;
    });
    expect(api.apiSearchKnowledge).toHaveBeenCalledTimes(2);
    expect(results[0]!.getAttribute('href')).toBe('/document/b#t=tab-b1');
    expect(results[1]!.textContent).toContain('Handbook › Shipping');
    // The matched words are the page's own marks; the snippet is text.
    expect([...results[1]!.querySelectorAll('mark')].map((m) => m.textContent)).toEqual([
      'Release',
      'release',
    ]);
  });

  // A passage's result opens its page at the passage, as a result in the knowledgebase's own search does: Home
  // hands the editor the passage's first block (it opened the page at its top before). A title's result hands none.
  it('hands the editor the passage a result names, and nothing for a title', async () => {
    api.apiSearchKnowledge.mockImplementation(async (_who: unknown, id: string) =>
      id === 'a'
        ? [found('a1', { firstBlock: 'b7' }), found('a2', { isTitle: true, firstBlock: '' })]
        : [],
    );
    await home();
    fireEvent.focus(screen.getByRole('textbox', { name: 'Search or ask' }));
    type('release');
    const results = await waitFor(() => {
      const rows = document.querySelectorAll<HTMLElement>('[data-home-result]');
      expect(rows.length).toBe(2);
      return [...rows];
    });
    const title = results.find((row) => row.getAttribute('href') === '/document/a#t=tab-a2')!;
    const passage = results.find((row) => row.getAttribute('href') === '/document/a#t=tab-a1')!;
    // The link itself is followed by the browser: the handoff rides beside it.
    title.addEventListener('click', (e) => e.preventDefault());
    passage.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(title);
    expect(sessionStorage.getItem(ARRIVAL_KEY)).toBeNull();
    fireEvent.click(passage);
    expect(JSON.parse(sessionStorage.getItem(ARRIVAL_KEY)!)).toMatchObject({
      kind: 'passage',
      documentId: 'a',
      tab: 'tab-a1',
      block: 'b7',
    });
  });

  it('aborts the words before when new words are typed', async () => {
    const signals: AbortSignal[] = [];
    api.apiSearchKnowledge.mockImplementation(
      (_who: unknown, _id: string, _q: string, signal: AbortSignal) => {
        signals.push(signal);
        return new Promise(() => {});
      },
    );
    await home();
    await waitFor(() =>
      expect(document.querySelectorAll('[data-home-knowledgebase]')).toHaveLength(2),
    );
    type('rele');
    await waitFor(() => expect(signals).toHaveLength(2));
    type('release');
    await waitFor(() => expect(signals).toHaveLength(4));
    expect(signals.slice(0, 2).every((signal) => signal.aborted)).toBe(true);
    expect(signals.slice(2).every((signal) => !signal.aborted)).toBe(true);
  });

  it('searches nothing for one letter', async () => {
    await home();
    await waitFor(() =>
      expect(document.querySelectorAll('[data-home-knowledgebase]')).toHaveLength(2),
    );
    type('r');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(api.apiSearchKnowledge).not.toHaveBeenCalled();
  });

  it('asks the knowledgebase in the scope chip, handing the question to its Ask view', async () => {
    await home();
    const scope = await screen.findByRole<HTMLSelectElement>('combobox', { name: 'Ask goes to' });
    expect(scope.value).toBe('a');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Ask' }).disabled).toBe(true);
    fireEvent.change(scope, { target: { value: 'b' } });
    type('When do we release?');
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(JSON.parse(sessionStorage.getItem(ARRIVAL_KEY)!)).toMatchObject({
      kind: 'ask',
      documentId: 'b',
      question: 'When do we release?',
    });
    expect(assign).toHaveBeenCalledWith('/document/b?view=ask');
  });
});

describe('starting something', () => {
  it('offers three structures, each a whole new knowledgebase, and Import into the scoped one', async () => {
    await home();
    const start = within(await screen.findByRole('region', { name: 'Start a Knowledgebase From' }));
    expect(start.getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Team Handbook', '/new?structure=team-handbook'],
      ['Engineering Handbook', '/new?structure=engineering-handbook'],
      ['Support Knowledgebase', '/new?structure=support-knowledgebase'],
    ]);
    // Each is a structure the start has, under its own name, its emblem in its own group's colour.
    for (const s of HOME_STRUCTURES) {
      expect(setupStructure(s.id)?.name).toBe(s.label);
      expect(setupStructure(s.id)?.group).toBe(s.group);
    }
    fireEvent.click(start.getByRole('button', { name: 'Import' }));
    expect(JSON.parse(sessionStorage.getItem(ARRIVAL_KEY)!)).toMatchObject({
      kind: 'import',
      documentId: 'a',
    });
    expect(assign).toHaveBeenCalledWith('/document/a');
  });

  it('with no knowledgebases shows the hero and one card, Make Your First Knowledgebase, with Import', async () => {
    index.listItems.mockResolvedValue({ items: [] });
    await home();
    const first = within(
      await waitFor(() => document.querySelector<HTMLElement>('[data-home-first]')!),
    );
    expect(
      first.getByRole('link', { name: 'Make Your First Knowledgebase' }).getAttribute('href'),
    ).toBe('/new');
    expect(screen.queryByRole('region', { name: 'Knowledgebases' })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Search or ask' }).disabled).toBe(
      true,
    );
    fireEvent.click(first.getByRole('button', { name: 'Import' }));
    expect(JSON.parse(sessionStorage.getItem(ARRIVAL_KEY)!)).toMatchObject({
      kind: 'import',
      documentId: null,
    });
    expect(assign).toHaveBeenCalledWith('/new?blank=1');
  });
});

describe('Yours to Review', () => {
  const NOW = new Date(2026, 10, 20).getTime();
  const rows = [
    {
      documentId: 'a',
      knowledgebase: 'Handbook',
      tab: 't2',
      title: 'On Call',
      reviewAt: NOW - 86_400_000,
    },
    {
      documentId: 'a',
      knowledgebase: 'Handbook',
      tab: 't1',
      title: 'Releases',
      reviewAt: NOW - 9 * 86_400_000,
    },
  ];
  it('lists the due pages oldest first, each with Still Right and a link', () => {
    const onStillRight = vi.fn();
    render(
      <HomeReview
        rows={rows}
        now={NOW}
        verifying={new Set(['a:t2'])}
        onStillRight={onStillRight}
      />,
    );
    const section = within(screen.getByRole('region', { name: 'Yours to Review' }));
    expect(
      section.getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]),
    ).toEqual([
      ['Releases', '/document/a#t=t1'],
      ['On Call', '/document/a#t=t2'],
    ]);
    expect(section.getByText('Handbook · Review was due 11 Nov')).toBeTruthy();
    const buttons = section.getAllByRole('button', { name: 'Still Right' });
    fireEvent.click(buttons[0]!);
    expect(onStillRight).toHaveBeenCalledWith(rows[1]);
    expect(buttons[1]!.getAttribute('aria-busy')).toBe('true');
  });
  // The section on Home itself: the rows come with the summaries Home already reads, and Still Right is Verify.
  describe('on Home', () => {
    const DAY = 86_400_000;
    const due = (id: string) =>
      id === 'a'
        ? summary({
            yoursToReview: [
              { tab: 't2', title: 'On Call', reviewAt: Date.now() - DAY },
              { tab: 't1', title: 'Releases', reviewAt: Date.now() - 9 * DAY },
            ],
          })
        : summary({
            yoursToReview: [{ tab: 't9', title: 'Rotas', reviewAt: Date.now() - 4 * DAY }],
          });
    const listed = () =>
      within(screen.getByRole('region', { name: 'Yours to Review' }))
        .getAllByRole('link')
        .map((a) => [a.textContent, a.getAttribute('href')]);
    const still = (title: string) => {
      const row = screen.getByRole('link', { name: title }).closest('li')!;
      fireEvent.click(within(row).getByRole('button', { name: 'Still Right' }));
    };
    beforeEach(() => {
      api.apiKnowledgeSummary.mockImplementation(async (_who: unknown, id: string) => due(id));
    });

    it('lists the person’s own due pages of every knowledgebase, the longest overdue first, with no request of its own', async () => {
      await home();
      await waitFor(() =>
        expect(listed()).toEqual([
          ['Releases', '/document/a#t=t1'],
          ['Rotas', '/document/b#t=t9'],
          ['On Call', '/document/a#t=t2'],
        ]),
      );
      // One summary a knowledgebase, as before Yours to Review had rows.
      expect(api.apiKnowledgeSummary).toHaveBeenCalledTimes(2);
      expect(api.apiVerifyPage).not.toHaveBeenCalled();
    });

    it('verifies on Still Right: the row goes at once, then the knowledgebase’s numbers are read again, fresh', async () => {
      let land: () => void = () => {};
      api.apiVerifyPage.mockReturnValue(new Promise<void>((resolve) => (land = resolve)));
      await home();
      await waitFor(() => expect(listed()).toHaveLength(3));
      still('Releases');
      // Gone before the request has answered.
      expect(listed().map(([title]) => title)).toEqual(['Rotas', 'On Call']);
      expect(api.apiVerifyPage).toHaveBeenCalledExactlyOnceWith(
        { ownerId: auth.value.accountUserId, shareCode: null },
        'a',
        't1',
      );
      api.apiKnowledgeSummary.mockImplementation(async (_who: unknown, id: string) =>
        id === 'a'
          ? summary({
              yoursToReview: [{ tab: 't2', title: 'On Call', reviewAt: Date.now() - DAY }],
            })
          : due(id),
      );
      await act(async () => land());
      // The one knowledgebase, past every kept copy (`fresh`), and nothing else.
      await waitFor(() => expect(api.apiKnowledgeSummary).toHaveBeenCalledTimes(3));
      expect(api.apiKnowledgeSummary.mock.calls[2]).toEqual([
        { ownerId: auth.value.accountUserId, shareCode: null },
        'a',
        undefined,
        true,
      ]);
      expect(listed().map(([title]) => title)).toEqual(['Rotas', 'On Call']);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('puts the row back and says so when the verify fails', async () => {
      api.apiVerifyPage.mockRejectedValue(new Error('forbidden'));
      await home();
      await waitFor(() => expect(listed()).toHaveLength(3));
      still('Rotas');
      expect(listed().map(([title]) => title)).toEqual(['Releases', 'On Call']);
      await waitFor(() =>
        expect(listed().map(([title]) => title)).toEqual(['Releases', 'Rotas', 'On Call']),
      );
      expect(toast.error).toHaveBeenCalledExactlyOnceWith('Could not verify “Rotas”. Try again.');
      // Nothing is read again for a verify that did not land.
      expect(api.apiKnowledgeSummary).toHaveBeenCalledTimes(2);
    });

    it('takes the last row away with its section', async () => {
      api.apiKnowledgeSummary.mockImplementation(async (_who: unknown, id: string) =>
        id === 'b' ? due('b') : summary(),
      );
      api.apiVerifyPage.mockResolvedValue({});
      await home();
      await waitFor(() => expect(listed()).toHaveLength(1));
      api.apiKnowledgeSummary.mockResolvedValue(summary());
      still('Rotas');
      expect(screen.queryByRole('region', { name: 'Yours to Review' })).toBeNull();
    });
  });

  it('is nothing at all with no rows', () => {
    const { container } = render(
      <HomeReview rows={[]} now={NOW} verifying={new Set()} onStillRight={() => {}} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
