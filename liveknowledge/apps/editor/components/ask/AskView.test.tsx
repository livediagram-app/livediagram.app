// @vitest-environment jsdom

// The Ask view (docs/specs/030-knowledgebase/search-and-ask.md "Ask", "Share roles"; blueprint ask-ui.md): its
// states, a question and its streamed answer, citations and Sources, gaps, the footer per role, each failure in
// words, and what a streaming answer costs React. The Claude API is never called: the client is a fake.
import { Profiler } from 'react';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AskRequest, AskSource, KnowledgeAiSettings } from '@liveknowledge/api-schema';
import type { Tab } from '@liveknowledge/document';
import type { AskOutcome } from '@/lib/api/knowledge-ask';

type Call = {
  request: AskRequest;
  delta: (text: string) => void;
  signal: AbortSignal | undefined;
  answer: (outcome: AskOutcome) => void;
};
const wire = vi.hoisted(() => ({ calls: [] as Call[], offline: false }));
vi.mock('@/lib/api/knowledge-ask', () => ({
  apiAskKnowledge: (
    _who: unknown,
    _id: string,
    request: AskRequest,
    opts: { onDelta?: (text: string) => void; signal?: AbortSignal } = {},
  ) =>
    new Promise<AskOutcome>((resolve, reject) => {
      opts.signal?.addEventListener('abort', () => reject(new DOMException('gone', 'AbortError')));
      wire.calls.push({
        request,
        delta: (text) => opts.onDelta?.(text),
        signal: opts.signal,
        answer: resolve,
      });
    }),
}));
const api = vi.hoisted(() => ({ apiKnowledgeAi: vi.fn() }));
vi.mock('@/lib/api/knowledge', async (actual) => ({
  ...(await actual<typeof import('@/lib/api/knowledge')>()),
  ...api,
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({
  useIsOfflineDocument: () => wire.offline,
}));
const toast = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  action: vi.fn<(offer: { message: string }) => void>(),
}));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('@/lib/knowledge/go-to-block', () => ({ BLOCK_HIT_MS: 1600, goToBlock: vi.fn() }));
vi.mock('@/components/chrome/auth-shared', () => ({
  useAuthHrefs: () => ({ signInHref: '/sign-in/?return=here', signUpHref: '/get-started/' }),
}));

import { goToBlock } from '@/lib/knowledge/go-to-block';
import { knowledgeSearch } from '@/lib/knowledge/search-open';
import { track } from '@/lib/telemetry';
import { aiSettingsStore } from '@/lib/knowledge-ask/ai-settings-store';
import { resetAskSession } from '@/lib/knowledge-ask/ask-session-store';
import { closeAiSettings, useAiSettingsOpen } from '@/lib/knowledge-ask/ai-settings-open';
import { recentQuestionsKey } from '@/lib/knowledge-ask/recent-questions';
import { handArrival } from '@/lib/knowledge-home/arrival-handoff';
import { AskView } from './AskView';
import { ROLES, chromeValue, renderInEditor, type Role } from './test-chrome';

const settings = (over: Partial<KnowledgeAiSettings> = {}): KnowledgeAiSettings => ({
  provider: 'anthropic',
  providers: [
    { id: 'anthropic', label: 'Anthropic (Claude)', keyPrefix: 'sk-ant-' },
    { id: 'openai', label: 'OpenAI', keyPrefix: 'sk-' },
  ],
  hasKey: true,
  keyHint: '4f2a',
  model: 'claude-fable-5-2',
  models: [{ id: 'claude-fable-5-2', label: 'Claude Fable 5.2' }],
  ...over,
});
const source = (number: number, over: Partial<AskSource> = {}): AskSource => ({
  number,
  passageId: `p${number}:0`,
  tab: 'p1',
  title: 'Release Process',
  headings: ['Shipping'],
  text: 'We release on Thursdays after the checks pass.',
  trust: 'verified',
  verifiedAt: new Date(2026, 10, 8).getTime(),
  firstBlock: `b${number}`,
  lastBlock: `b${number}`,
  ...over,
});
const done = (
  text: string,
  over: Partial<Extract<AskOutcome, { type: 'done' }>> = {},
): AskOutcome => ({
  type: 'done',
  text,
  sources: [],
  notUsed: [],
  gaps: [],
  model: 'claude-fable-5-2',
  ...over,
});

// Frames run when the test says so.
let frames: FrameRequestCallback[] = [];
const runFrame = () => act(() => frames.splice(0).forEach((run) => run(0)));

beforeEach(() => {
  wire.calls = [];
  wire.offline = false;
  frames = [];
  api.apiKnowledgeAi.mockResolvedValue(settings());
  vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => frames.push(run));
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  cleanup();
  act(() => closeAiSettings());
  resetAskSession();
  aiSettingsStore.reset();
  knowledgeSearch.close();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/document/d1');
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function open(role: Role = 'edit', over: Record<string, unknown> = {}) {
  const utils = renderInEditor(<AskView />, chromeValue(role, over));
  await waitFor(() => expect(document.querySelector('[data-ask-state="loading"]')).toBeNull());
  return utils;
}
const field = () => screen.getByRole<HTMLTextAreaElement>('textbox');
function ask(question: string) {
  fireEvent.change(field(), { target: { value: question } });
  fireEvent.keyDown(field(), { key: 'Enter' });
  return wire.calls[wire.calls.length - 1]!;
}
const answer = async (call: Call, outcome: AskOutcome) => {
  await act(async () => call.answer(outcome));
};

describe('when this session cannot ask', () => {
  it.each(ROLES)('with no key, as %s', async (role) => {
    api.apiKnowledgeAi.mockResolvedValue(settings({ hasKey: false, keyHint: '' }));
    await open(role);
    expect(screen.getByText("Ask Needs Your Team's AI Key")).toBeTruthy();
    const settingsButton = screen.queryByRole('button', { name: 'Open AI Settings' });
    expect(settingsButton !== null).toBe(role === 'edit');
    if (role !== 'edit') expect(screen.getByText(/Ask an Editor to add one/)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    // Search needs no key.
    fireEvent.click(
      within(document.querySelector('[data-ask-state]')!).getByRole('button', {
        name: 'Search the Pages',
      }),
    );
    expect(knowledgeSearch.isOpen()).toBe(true);
  });

  it('opens AI Settings from the no-key state', async () => {
    api.apiKnowledgeAi.mockResolvedValue(settings({ hasKey: false }));
    const Open = () => <output data-testid="open">{String(useAiSettingsOpen())}</output>;
    renderInEditor(
      <>
        <AskView />
        <Open />
      </>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Open AI Settings' }));
    expect(screen.getByTestId('open').textContent).toBe('true');
  });

  it('is off for anyone not signed in, and says why', async () => {
    await open('view', { accountUserId: null, sessionShareCode: 'abc' });
    expect(screen.getByText('Sign In to Ask')).toBeTruthy();
    expect(screen.getByText(/off for anyone who is not signed in/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign In' }).getAttribute('href')).toContain(
      '/sign-in/',
    );
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('is off in a knowledgebase kept Offline, with no request made', async () => {
    wire.offline = true;
    await open('edit');
    expect(screen.getByText('No Ask in an Offline Knowledgebase')).toBeTruthy();
    expect(api.apiKnowledgeAi).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'AI Settings' })).toBeNull();
  });

  it('says so when the settings cannot be read, and reads them again when asked', async () => {
    api.apiKnowledgeAi.mockRejectedValueOnce(new Error('network'));
    await open();
    expect(screen.getByRole('alert').textContent).toContain('Ask Could Not Be Reached');
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await screen.findByRole('textbox');
  });
});

describe('a question and its answer', () => {
  it('shows the question, streams the answer in, then draws citations, the trust line and Sources', async () => {
    await open();
    const call = ask('When do we release?');
    expect(call.request).toEqual({ question: 'When do we release?' });
    expect(
      within(screen.getByRole('region', { name: 'Conversation' })).getByText('When do we release?'),
    ).toBeTruthy();
    expect(field().disabled).toBe(true);
    expect(field().value).toBe('');
    expect(screen.getByText('Reading the pages…')).toBeTruthy();
    act(() => call.delta('We release on '));
    act(() => call.delta('Thursdays'));
    // Nothing is drawn until the frame.
    expect(document.querySelector('[data-ask-stream]')!.textContent).toBe('');
    runFrame();
    expect(document.querySelector('[data-ask-stream]')!.textContent).toBe(
      'We release on Thursdays',
    );
    await answer(
      call,
      done('We release on Thursdays [1]. Hotfixes go any day [2].', {
        sources: [
          source(1),
          source(2, { tab: 'p2', title: 'Hotfixes', trust: 'review-due', headings: [] }),
        ],
      }),
    );
    const card = screen.getByRole('article', { name: 'Answer' });
    expect(card.getAttribute('aria-busy')).toBe('false');
    expect(card.querySelector('[data-ask-answer]')!.textContent).toBe(
      'We release on Thursdays1. Hotfixes go any day2.',
    );
    expect(screen.getByRole('button', { name: 'Source 1: Release Process' })).toBeTruthy();
    expect(card.querySelector('[data-ask-trust]')!.textContent).toBe(
      'Answered From 1 Verified PageOf the others, 1 is due a review.',
    );
    const rail = within(screen.getByRole('complementary', { name: 'Sources' }));
    expect(rail.getAllByRole('button')).toHaveLength(2);
    expect(rail.getByText(/Release Process · Verified 8 Nov/)).toBeTruthy();
    expect(
      rail.getByText('Release Process / Hotfixes · Review Due, Last Verified 8 Nov'),
    ).toBeTruthy();
    // The matched word is marked by the page.
    expect([...document.querySelectorAll('mark')].map((m) => m.textContent)).toContain('release');
    expect(field().disabled).toBe(false);
  });

  it('draws the answer and the passages as text, whatever they hold', async () => {
    await open();
    const call = ask('Q?');
    act(() => call.delta('<img src=x onerror=alert(1)>'));
    runFrame();
    expect(document.querySelector('[data-ask-stream] img')).toBeNull();
    await answer(
      call,
      done('<b>bold</b> <script>alert(1)</script> [1]', {
        sources: [source(1, { text: '<img src=x onerror=alert(2)>', title: '<i>T</i>' })],
        gaps: ['<u>gap</u>'],
      }),
    );
    const region = screen.getByRole('region', { name: 'Conversation' });
    expect(region.querySelector('b, script, img, u')).toBeNull();
    expect(
      screen.getByRole('complementary', { name: 'Sources' }).querySelector('img, i'),
    ).toBeNull();
    expect(region.textContent).toContain('<b>bold</b> <script>alert(1)</script>');
  });

  it('lights the source a citation names, in the answer it was pressed in', async () => {
    await open();
    await answer(ask('One?'), done('First [1].', { sources: [source(1)] }));
    await answer(
      ask('Two?'),
      done('Second [1].', { sources: [source(1, { title: 'Hotfixes', tab: 'p2' })] }),
    );
    // The newest answer's sources show.
    const rail = () => within(screen.getByRole('complementary', { name: 'Sources' }));
    expect(rail().getByText('Hotfixes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Source 1: Release Process' }));
    const lit = document.querySelector('[data-source="1"]')!;
    expect(lit.hasAttribute('data-lit')).toBe(true);
    expect(lit.textContent).toContain('Release Process');
    expect(document.activeElement).toBe(lit);
  });

  it('opens a source page at its passage, as a history entry', async () => {
    await open();
    await answer(ask('One?'), done('First [1].', { sources: [source(1)] }));
    window.history.replaceState(null, '', '/document/d1?view=ask');
    fireEvent.click(document.querySelector('[data-source="1"]')!);
    expect(window.location.search).toBe('');
    expect(vi.mocked(goToBlock).mock.calls[0]!.slice(1)).toEqual(['p1', 'b1']);
  });

  it('says so when a source page has gone', async () => {
    await open();
    await answer(ask('One?'), done('First [1].', { sources: [source(1, { tab: 'gone' })] }));
    fireEvent.click(document.querySelector('[data-source="1"]')!);
    expect(toast.info).toHaveBeenCalledWith('That page is no longer in this knowledgebase.');
    expect(goToBlock).not.toHaveBeenCalled();
  });

  it('shows what was found but not used, as stale, with the reason', async () => {
    await open();
    await answer(
      ask('One?'),
      done('First [1].', {
        sources: [source(1)],
        notUsed: [
          {
            ...source(2, { title: 'Old Release Notes', trust: 'review-due' }),
            reason: 'It says Fridays, and a newer verified page says Thursdays.',
          },
        ],
      }),
    );
    const rail = within(screen.getByRole('complementary', { name: 'Sources' }));
    expect(rail.getByText('Found but Not Used')).toBeTruthy();
    const stale = document.querySelector('[data-source="2"]')!;
    expect(stale.textContent).toContain('Stale');
    expect(stale.textContent).toContain('It says Fridays');
  });

  it('keeps the conversation when the view is left and shown again', async () => {
    const first = await open();
    await answer(ask('One?'), done('First.'));
    first.unmount();
    await open();
    expect(screen.getByText('First.')).toBeTruthy();
  });
});

describe('what a streaming answer costs', () => {
  it('renders nothing in React for 2,000 pieces, and appends once a frame', async () => {
    let commits = 0;
    renderInEditor(
      <Profiler id="ask" onRender={() => commits++}>
        <AskView />
      </Profiler>,
    );
    await screen.findByRole('textbox');
    const call = ask('When do we release?');
    const stream = document.querySelector('[data-ask-stream]')!;
    const node = stream.firstChild as Text;
    const append = vi.spyOn(node, 'appendData');
    commits = 0;
    for (let frame = 0; frame < 20; frame++) {
      for (let i = 0; i < 100; i++) call.delta('word ');
      frames.splice(0).forEach((run) => run(0));
    }
    expect(stream.textContent).toHaveLength(2000 * 5);
    expect(append).toHaveBeenCalledTimes(20);
    expect(commits).toBe(0);
  });
});

describe('the parts the pages do not cover', () => {
  const gaps = () =>
    done('We release on Thursdays [1].', {
      sources: [source(1)],
      gaps: ['Who approves a release?'],
    });

  it.each(ROLES)(
    'as %s: an amber note, a Knowledge Gap card, Draft a Page for an Editor',
    async (role) => {
      await open(role);
      await answer(ask('Q?'), gaps());
      expect(screen.getByText('One thing the knowledgebase does not cover.')).toBeTruthy();
      const card = within(screen.getByRole('region', { name: 'Knowledge Gap' }));
      expect(card.getByText('Who approves a release?')).toBeTruthy();
      expect(card.getByText('No page answers it.')).toBeTruthy();
      expect(card.queryByRole('button', { name: 'Draft a Page From What We Know' }) !== null).toBe(
        role === 'edit',
      );
      // Email is not built: nothing offers to ask the owner.
      expect(screen.queryByRole('button', { name: /to Write It/ })).toBeNull();
    },
  );

  it('drafts a page with one more Ask call, marked Draft, Not Verified', async () => {
    const commitTabs = vi.fn();
    await open('edit', { commitTabs });
    await answer(ask('Q?'), gaps());
    fireEvent.click(screen.getByRole('button', { name: 'Draft a Page From What We Know' }));
    const draftCall = wire.calls[1]!;
    expect(draftCall.request).toEqual({ question: 'Who approves a release?' });
    await answer(draftCall, done('The release manager [1].', { sources: [source(1)] }));
    await waitFor(() => expect(commitTabs).toHaveBeenCalledTimes(1));
    const added = (commitTabs.mock.calls[0]![0] as (tabs: Tab[]) => Tab[])([]);
    expect(added[0]!.name).toBe('Who approves a release?');
    expect(JSON.stringify(added[0])).toContain('Draft, Not Verified');
    expect(JSON.stringify(added[0])).toContain('The release manager.');
    expect(toast.action.mock.calls[0]![0].message).toBe('Drafted “Who approves a release?”');
    expect(track).toHaveBeenCalledWith('Tab', 'Created', 'FromGap');
  });

  it('still drafts the page, with the question alone, when that call fails', async () => {
    const commitTabs = vi.fn();
    await open('edit', { commitTabs });
    await answer(ask('Q?'), gaps());
    fireEvent.click(screen.getByRole('button', { name: 'Draft a Page From What We Know' }));
    await answer(wire.calls[1]!, { type: 'error', kind: 'overloaded', message: 'busy' });
    await waitFor(() => expect(commitTabs).toHaveBeenCalledTimes(1));
    const added = (commitTabs.mock.calls[0]![0] as (tabs: Tab[]) => Tab[])([]);
    expect(JSON.stringify(added[0])).toContain('Draft, Not Verified');
  });
});

describe('the answer footer', () => {
  it.each(ROLES)(
    'as %s: helpful, not helpful and Copy Answer; Save as Page for an Editor',
    async (role) => {
      await open(role);
      await answer(ask('Q?'), done('An answer [1].', { sources: [source(1)] }));
      const helpful = screen.getByRole('button', { name: 'Helpful' });
      fireEvent.click(helpful);
      expect(helpful.getAttribute('aria-pressed')).toBe('true');
      expect(track).toHaveBeenCalledWith('UI', 'Used', 'AskHelpful');
      fireEvent.click(screen.getByRole('button', { name: 'Not Helpful' }));
      expect(screen.getByRole('button', { name: 'Helpful' }).getAttribute('aria-pressed')).toBe(
        'false',
      );
      expect(screen.getByRole('button', { name: 'Copy Answer' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Save as Page' }) !== null).toBe(role === 'edit');
    },
  );

  it('copies the answer as Markdown with its sources', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await open();
    await answer(ask('Q?'), done('An answer [1].', { sources: [source(1)] }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Answer' }));
    await screen.findByText('Copied');
    expect(writeText).toHaveBeenCalledWith('An answer [1].\n\n## Sources\n\n1. Release Process');
  });

  it('saves the answer as a subpage of the page chosen', async () => {
    const commitTabs = vi.fn();
    await open('edit', { commitTabs });
    await answer(ask('When do we release?'), done('On Thursdays [1].', { sources: [source(1)] }));
    fireEvent.click(screen.getByRole('button', { name: 'Save as Page' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Save as Page' }));
    // The open page is chosen to begin with; another is picked.
    expect(
      dialog.getByRole('option', { name: 'Release Process' }).getAttribute('aria-selected'),
    ).toBe('true');
    fireEvent.click(dialog.getByRole('option', { name: 'Hotfixes' }));
    fireEvent.click(dialog.getByRole('button', { name: 'Save as Page' }));
    expect(commitTabs).toHaveBeenCalledTimes(1);
    const tabs = (commitTabs.mock.calls[0]![0] as (tabs: Tab[]) => Tab[])(chromeValue().tabs);
    const made = tabs.find((t) => t.name === 'When do we release?')!;
    expect(made.parent).toBe('p2');
    expect(toast.action.mock.calls[0]![0].message).toBe('Saved as “When do we release?”');
    expect(track).toHaveBeenCalledWith('Tab', 'Created', 'FromAnswer');
  });
});

describe('the question field', () => {
  it('sends on Enter, makes a line on Shift and Enter, and waits out an input method', async () => {
    await open();
    fireEvent.change(field(), { target: { value: 'One?' } });
    fireEvent.keyDown(field(), { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(field(), { key: 'Enter', isComposing: true });
    expect(wire.calls).toHaveLength(0);
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(wire.calls).toHaveLength(1);
  });

  it('holds 1,000 characters and counts as the limit nears', async () => {
    await open();
    expect(field().maxLength).toBe(1000);
    fireEvent.change(field(), { target: { value: 'x'.repeat(899) } });
    expect(document.querySelector('[data-ask-count]')).toBeNull();
    fireEvent.change(field(), { target: { value: 'x'.repeat(940) } });
    expect(document.querySelector('[data-ask-count]')!.textContent).toBe('940 / 1,000');
  });

  it('stops the answer on its way, aborting the request and keeping what arrived', async () => {
    await open();
    const call = ask('One?');
    act(() => call.delta('Partly'));
    runFrame();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(call.signal!.aborted).toBe(true);
    expect(screen.getByText('Partly')).toBeTruthy();
    expect(screen.getByText('Stopped. What had arrived is kept.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy();
    expect(field().disabled).toBe(false);
  });

  it('keeps a follow-up in the conversation, and after ten says to start a new question', async () => {
    await open();
    for (let i = 0; i < 10; i++) await answer(ask(`Question ${i}?`), done(`Answer ${i}.`));
    expect(wire.calls[9]!.request.turns).toHaveLength(9);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText(/This conversation has its 10 questions/)).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Conversation' })).getByRole('button', {
        name: 'New Question',
      }),
    );
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(screen.queryByText('Answer 0.')).toBeNull();
  });
});

describe('a failure, in words with the next step', () => {
  const fail = async (kind: string, role: Role = 'edit') => {
    await open(role);
    await answer(ask('Q?'), { type: 'error', kind, message: 'RAW upstream 529 overloaded_error' });
    return screen.getByRole('alert');
  };
  it.each([
    ['bad-key', 'Claude Did Not Accept the Key', 'Open AI Settings'],
    ['no-credit', 'The Claude Account Is Out of Credit', 'Ask Again'],
    ['rate-limited', 'The Claude Account Is at Its Rate Limit', 'Ask Again'],
    ['overloaded', 'Claude Is Busy Right Now', 'Ask Again'],
    ['refused', 'Claude Declined to Answer This', null],
    ['person-limit', 'You Have Asked 20 Questions This Hour', null],
    ['knowledgebase-limit', 'This Knowledgebase Has Had Its 200 Questions Today', null],
    ['network', 'The Question Could Not Be Sent', 'Ask Again'],
  ])('%s', async (kind, title, action) => {
    const alert = await fail(kind);
    expect(alert.textContent).toContain(title);
    expect(alert.textContent).not.toContain('RAW');
    expect(alert.textContent).not.toContain('529');
    const button = within(alert).queryByRole('button');
    expect(button?.textContent ?? null).toBe(action);
    // The field is there for the next question.
    expect(field().disabled).toBe(false);
  });

  it.each([
    ['bad-key', 'OpenAI Did Not Accept the Key'],
    ['no-credit', 'The OpenAI Account Is Out of Credit'],
    ['rate-limited', 'The OpenAI Account Is at Its Rate Limit'],
    ['overloaded', 'OpenAI Is Busy Right Now'],
    ['refused', 'OpenAI Declined to Answer This'],
  ])('names OpenAI when the key is an OpenAI one: %s', async (kind, title) => {
    api.apiKnowledgeAi.mockResolvedValue(settings({ provider: 'openai' }));
    const alert = await fail(kind);
    expect(alert.textContent).toContain(title);
    expect(alert.textContent).not.toContain('Claude');
  });

  it('asks again in place', async () => {
    const alert = await fail('overloaded');
    fireEvent.click(within(alert).getByRole('button', { name: 'Ask Again' }));
    expect(wire.calls).toHaveLength(2);
    expect(wire.calls[1]!.request).toEqual({ question: 'Q?' });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each(['participate', 'view'] as const)(
    'tells a %s session who can fix a bad key, with no way into the controls',
    async (role) => {
      const alert = await fail('bad-key', role);
      expect(alert.textContent).toContain('Ask an Editor to replace it');
      expect(within(alert).queryByRole('button')).toBeNull();
    },
  );

  it('reads the settings again when the key has gone', async () => {
    await open();
    api.apiKnowledgeAi.mockResolvedValue(settings({ hasKey: false, keyHint: '' }));
    await answer(ask('Q?'), { type: 'error', kind: 'ask_unavailable', message: 'no key' });
    await screen.findByText("Ask Needs Your Team's AI Key");
  });
});

describe('recent questions', () => {
  it('keeps what was asked in this browser, for this person and knowledgebase, and asks it again as new', async () => {
    await open();
    await answer(ask('When do we release?'), done('On Thursdays.'));
    const stored = JSON.parse(localStorage.getItem(recentQuestionsKey('me', 'd1'))!) as unknown[];
    expect(stored).toHaveLength(1);
    expect(JSON.stringify(stored)).not.toContain('On Thursdays');
    const mine = within(screen.getByRole('complementary', { name: 'Your Questions' }));
    expect(mine.getByRole('region', { name: 'Today' })).toBeTruthy();
    fireEvent.click(mine.getByRole('button', { name: 'When do we release?' }));
    expect(wire.calls).toHaveLength(2);
    expect(wire.calls[1]!.request).toEqual({ question: 'When do we release?' });
    expect(screen.queryByText('On Thursdays.')).toBeNull();
    expect(track).toHaveBeenCalledWith('UI', 'Used', 'AskQuestion');
    expect(JSON.stringify(vi.mocked(track).mock.calls)).not.toContain('release');
  });

  it('starts a new question from New Question', async () => {
    await open();
    await answer(ask('One?'), done('First.'));
    fireEvent.click(
      within(screen.getByRole('complementary', { name: 'Your Questions' })).getByRole('button', {
        name: 'New Question',
      }),
    );
    expect(screen.queryByText('First.')).toBeNull();
    expect(screen.getByText('No Questions Yet')).toBeTruthy();
  });
});

// knowledgebase-home.md "Hero": a question typed on Home is asked here, once.
describe('a question handed over by the Knowledgebase Home', () => {
  it('is asked as a new question when the view opens, and not again', async () => {
    handArrival({ kind: 'ask', documentId: 'd1', question: 'When do we release?' });
    const first = await open();
    await waitFor(() => expect(wire.calls).toHaveLength(1));
    expect(wire.calls[0]!.request).toEqual({ question: 'When do we release?' });
    first.unmount();
    await open();
    expect(wire.calls).toHaveLength(1);
  });

  it('is left alone when it is for another knowledgebase', async () => {
    handArrival({ kind: 'ask', documentId: 'elsewhere', question: 'Not here?' });
    await open();
    expect(wire.calls).toHaveLength(0);
  });
});
