// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiSourceLine } from '@liveworkspace/settings-ui/ai-source';
import type { AskPassage } from '../passages';
import type { AskRequestBody } from '../wire';
import type { AskOutcome } from './ask-client';

const mocks = vi.hoisted(() => ({
  track: vi.fn(),
  openSettings: vi.fn(),
  line: { kind: 'built-in', canChange: true } as unknown,
  canManage: true,
  calls: [] as {
    body: unknown;
    onDelta: (text: string) => void;
    signal: AbortSignal;
    end: (outcome: unknown) => void;
  }[],
}));
vi.mock('@liveworkspace/workbench/bindings', () => ({ workbench: { track: mocks.track } }));
vi.mock('@liveworkspace/workbench/components/ai/ai-source-scope', () => ({
  accountDoor: () => async () => ({ ok: false }),
  useEditorAiScope: () => ({ teamId: 'team_1', signedIn: true }),
}));
vi.mock('@liveworkspace/workbench/components/chrome/auth-routes', () => ({
  useAuthHrefs: () => ({ signInHref: '/sign-in/?return=here', signUpHref: '/get-started/' }),
}));
vi.mock('@liveworkspace/workbench/lib/open-settings', () => ({
  requestOpenSettings: mocks.openSettings,
}));
vi.mock('@liveworkspace/settings-ui/ai-source', () => ({
  useAiSource: (options: { openSettings: () => void }) => ({
    line: mocks.line,
    act: mocks.canManage ? () => options.openSettings() : null,
  }),
}));
vi.mock('./ask-client', async (original) => ({
  ...(await original<typeof import('./ask-client')>()),
  askSender:
    () => (body: unknown, opts: { onDelta: (text: string) => void; signal: AbortSignal }) =>
      new Promise((resolve, reject) => {
        opts.signal.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
        mocks.calls.push({ body, onDelta: opts.onDelta, signal: opts.signal, end: resolve });
      }),
}));

import { askAiChoiceStore } from './ask-ai-choice';
import { AskTool } from './AskTool';
import { resetConversations } from './conversation';
import type { AskHost } from './host';

const passages: AskPassage[] = [
  {
    id: 't1:a',
    tabId: 't1',
    tabName: 'Checkout Flow',
    elementId: 'a',
    kind: 'Shape',
    title: 'Payment Service',
    text: 'Waits for the payment provider.',
  },
  {
    id: 't1:b',
    tabId: 't1',
    tabName: 'Checkout Flow',
    elementId: 'b',
    kind: 'Shape',
    title: 'Retry Queue',
    text: 'Retry Queue',
  },
];
const hostOf = (over: Partial<AskHost> = {}): AskHost => ({
  app: 'livediagram',
  itemId: 'doc_1',
  accountId: 'acc_1',
  passages: () => passages,
  open: vi.fn(),
  suggestions: ['Summarise this canvas'],
  ...over,
});
const ctx = { back: () => {}, close: () => {}, sheet: false };
const settle = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));
const done = (text: string, numbers: number[] = [1, 2]): AskOutcome => ({
  type: 'done',
  text,
  sources: numbers.map((number) => ({ ...passages[number - 1]!, number })),
  provider: 'built-in',
  model: 'm',
});
const type = (text: string) =>
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });

beforeEach(() => {
  mocks.calls.length = 0;
  mocks.line = { kind: 'built-in', canChange: true } satisfies AiSourceLine;
  mocks.canManage = true;
  localStorage.clear();
  askAiChoiceStore.reset();
  // jsdom has neither: the side popover reads the first, a lit card the second.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  resetConversations();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('Ask AI, signed out', () => {
  it('asks for a sign-in that comes back here', () => {
    render(<AskTool host={hostOf({ accountId: null })} ctx={ctx} />);
    expect(screen.getByText('Sign In to Ask AI')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign In' }).getAttribute('href')).toBe(
      '/sign-in/?return=here',
    );
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

describe('Ask AI, the conversation', () => {
  it('opens on the empty state, and a suggestion asks it', async () => {
    render(<AskTool host={hostOf()} ctx={ctx} />);
    expect(screen.getByText('Ask About This Canvas')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Ask this canvas a question' })).toBeTruthy();
    expect(screen.queryByText('New Chat')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Summarise this canvas/ }));
    await settle();
    expect(mocks.calls[0]!.body).toMatchObject({
      question: 'Summarise this canvas',
      passages,
      teamId: 'team_1',
    });
    expect(mocks.track).toHaveBeenCalledWith('UI', 'Used', 'AskAi');
    expect(screen.getByText('Reading…')).toBeTruthy();
    expect(screen.getByRole<HTMLTextAreaElement>('textbox').disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
  });

  it('sends on Enter, streams as text, then draws the answer with its chips, sources and who answered', async () => {
    render(<AskTool host={hostOf()} ctx={ctx} />);
    type('What happens on a timeout?');
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: true });
    expect(mocks.calls).toHaveLength(0);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    await settle();
    expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toBe('');
    await act(async () => {
      mocks.calls[0]!.onDelta('It **waits** [1]');
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    // Plain while it streams: the markers are held back, nothing is a chip yet.
    expect(screen.getByText('It **waits**')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Source 1/ })).toBeNull();
    await act(async () => mocks.calls[0]!.end(done('It **waits** [1], then retries [2].')));
    await settle();
    const answer = screen.getByRole('article', { name: 'Answer' });
    expect(within(answer).getByText('waits').tagName).toBe('STRONG');
    expect(within(answer).getByRole('button', { name: 'Source 1: Payment Service' })).toBeTruthy();
    expect(within(answer).getByRole('button', { name: 'Source 2: Retry Queue' })).toBeTruthy();
    expect(within(answer).getByRole('button', { name: /2 Sources/ })).toBeTruthy();
    expect(within(answer).getByText('Built-In AI')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Ask a follow-up' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New Chat' })).toBeTruthy();
  });

  it('copies the answer without its markers', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<AskTool host={hostOf()} ctx={ctx} />);
    type('Q?');
    fireEvent.submit(screen.getByRole('textbox').closest('form')!);
    await settle();
    await act(async () => mocks.calls[0]!.end(done('It waits [1].', [1])));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Copy Answer' }));
    await settle();
    expect(writeText).toHaveBeenCalledWith('It waits.');
    expect(mocks.track).toHaveBeenCalledWith('UI', 'Used', 'AskAiCopy');
    writeText.mockRejectedValueOnce(new Error('denied'));
    mocks.track.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Copy Answer' }));
    await settle();
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it('opens Sources beside Tools with the pressed citation lit, and a card goes to its place', async () => {
    const host = hostOf();
    render(<AskTool host={host} ctx={ctx} />);
    type('What does payment do on a timeout?');
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    await settle();
    await act(async () => mocks.calls[0]!.end(done('It waits [1], then retries [2].')));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Source 2: Retry Queue' }));
    const sources = screen.getByRole('dialog', { name: 'Sources' });
    expect(within(sources).getByText(/2 places for/)).toBeTruthy();
    const cards = within(sources).getAllByRole('button', { name: /Show in Canvas/ });
    expect(cards.map((card) => card.hasAttribute('data-lit'))).toEqual([false, true]);
    expect(document.activeElement).toBe(cards[1]);
    // The question's words are marked in the passage; a passage that only repeats its title is not said twice.
    expect(within(cards[0]!).getByText('payment').tagName).toBe('MARK');
    expect(within(cards[1]!).getAllByText('Retry Queue')).toHaveLength(1);
    fireEvent.click(cards[0]!);
    expect(host.open).toHaveBeenCalledWith({ ...passages[0], number: 1 });
    expect(mocks.track).toHaveBeenCalledWith('UI', 'Opened', 'AskAiSource');
    // Still open after going to a source; its own close shuts it.
    fireEvent.click(within(sources).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Sources' })).toBeNull();
    // The pill opens them all, none lit.
    fireEvent.click(screen.getByRole('button', { name: /2 Sources/ }));
    const again = within(screen.getByRole('dialog', { name: 'Sources' })).getAllByRole('button', {
      name: /Show in Canvas/,
    });
    expect(again.some((card) => card.hasAttribute('data-lit'))).toBe(false);
    expect(mocks.track).toHaveBeenCalledWith('UI', 'Opened', 'AskAiSources');
  });

  it('says a failure in its words with Ask Again, stops an answer, and starts a new chat', async () => {
    render(<AskTool host={hostOf()} ctx={ctx} />);
    type('Q?');
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    await settle();
    await act(async () =>
      mocks.calls[0]!.end({
        type: 'error',
        kind: 'ask_built_in_limit',
        message: 'Try again tomorrow.',
      }),
    );
    await settle();
    expect(screen.getByRole('alert').textContent).toContain('Try again tomorrow.');
    fireEvent.click(screen.getByRole('button', { name: 'Ask Again' }));
    await settle();
    expect(mocks.calls).toHaveLength(2);
    await act(async () => {
      mocks.calls[1]!.onDelta('Half');
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await settle();
    expect(screen.getByText('Stopped. What had arrived is kept.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'New Chat' }));
    expect(screen.getByText('Ask About This Canvas')).toBeTruthy();
  });

  it('counts the characters as the limit nears', () => {
    render(<AskTool host={hostOf()} ctx={ctx} />);
    type('q'.repeat(950));
    expect(screen.getByText('950 / 1,000')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Send' }).disabled).toBe(false);
    type('   ');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Send' }).disabled).toBe(true);
  });
});

describe('Ask AI, which AI answers', () => {
  it('says Built-In AI and offers a key of your own, in Settings', () => {
    render(<AskTool host={hostOf()} ctx={ctx} />);
    const pill = screen.getByRole('button', { name: 'Answer With: Built-In AI' });
    fireEvent.click(pill);
    const menu = screen.getByRole('dialog', { name: 'Answer With' });
    expect(within(menu).getByText('Included with livediagram, with daily limits')).toBeTruthy();
    expect(within(menu).getAllByRole('radio')).toHaveLength(1);
    fireEvent.click(within(menu).getByRole('button', { name: 'Use Your Own Key' }));
    expect(mocks.openSettings).toHaveBeenCalledWith('ai');
    expect(screen.queryByRole('dialog', { name: 'Answer With' })).toBeNull();
  });

  it('names the key in use and switches to built-in AI for the next question', async () => {
    mocks.line = {
      kind: 'key',
      owner: 'you',
      provider: 'anthropic',
      model: 'Claude Fable 5.2',
      canChange: true,
    } satisfies AiSourceLine;
    render(<AskTool host={hostOf()} ctx={ctx} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Answer With: Claude Fable 5.2 (Your Key)' }),
    );
    const menu = screen.getByRole('dialog', { name: 'Answer With' });
    expect(within(menu).getByText('Anthropic · Claude Fable 5.2 · No daily limits')).toBeTruthy();
    expect(within(menu).getByRole('button', { name: 'Manage Keys' })).toBeTruthy();
    const [builtIn, key] = within(menu).getAllByRole('radio');
    expect(key!.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(builtIn!);
    expect(askAiChoiceStore.get()).toBe('built-in');
    expect(mocks.track).toHaveBeenCalledWith('UI', 'Changed', 'AskAiBuiltIn');
    expect(screen.getByRole('button', { name: 'Answer With: Built-In AI' })).toBeTruthy();
    type('Q?');
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    await settle();
    expect((mocks.calls[0]!.body as AskRequestBody).ai).toBe('built-in');
    // And back to the key.
    fireEvent.click(screen.getByRole('button', { name: 'Answer With: Built-In AI' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Answer With' })).getAllByRole('radio')[1]!,
    );
    expect(askAiChoiceStore.get()).toBe('key');
    expect(mocks.track).toHaveBeenCalledWith('UI', 'Changed', 'AskAiKey');
  });

  it('turns amber on a key that failed, offering to fix it; a member cannot change a team key', () => {
    mocks.line = {
      kind: 'failed',
      owner: 'you',
      provider: 'anthropic',
      words: 'Claude did not accept the API key.',
      canChange: true,
    } satisfies AiSourceLine;
    const { unmount } = render(<AskTool host={hostOf()} ctx={ctx} />);
    fireEvent.click(screen.getByRole('button', { name: 'Answer With: Key Needs Attention' }));
    expect(screen.getByText('Claude did not accept the API key.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fix Key' })).toBeTruthy();
    unmount();
    mocks.line = {
      kind: 'key',
      owner: 'team',
      provider: 'openai',
      model: 'GPT',
      canChange: false,
    } satisfies AiSourceLine;
    mocks.canManage = false;
    render(<AskTool host={hostOf()} ctx={ctx} />);
    fireEvent.click(screen.getByRole('button', { name: 'Answer With: GPT (Your Team’s Key)' }));
    const menu = screen.getByRole('dialog', { name: 'Answer With' });
    expect(within(menu).getByText('Applies to your next question')).toBeTruthy();
    expect(within(menu).queryByRole('button', { name: 'Manage Keys' })).toBeNull();
  });

  it('holds its place while the keys are read', () => {
    mocks.line = { kind: 'loading' } satisfies AiSourceLine;
    const { container } = render(<AskTool host={hostOf()} ctx={ctx} />);
    expect(container.querySelector('[data-ask-ai="loading"]')).toBeTruthy();
  });
});
