import { afterEach, describe, expect, it, vi } from 'vitest';
import { ASK_MAX_QUESTION_CHARS, ASK_MAX_TURNS } from '../limits';
import type { AskPassage } from '../passages';
import type { AskRequestBody } from '../wire';
import { ASK_FAILED, type AskOutcome, type AskSend } from './ask-client';
import {
  AskConversation,
  conversationOf,
  resetConversations,
  type AskConversationDeps,
} from './conversation';

const passage = (id: string): AskPassage => ({
  id,
  tabId: 't',
  tabName: 'Flow',
  elementId: id,
  kind: 'Shape',
  title: `Title ${id}`,
  text: `Text ${id}`,
});

type Call = {
  body: AskRequestBody;
  onDelta: (text: string) => void;
  signal: AbortSignal;
  end: (outcome: AskOutcome) => void;
  fail: (error: unknown) => void;
};

function setup(over: Partial<AskConversationDeps> = {}) {
  const calls: Call[] = [];
  const frames: (() => void)[] = [];
  const send: AskSend = (body, { onDelta, signal }) =>
    new Promise<AskOutcome>((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      calls.push({ body, onDelta, signal, end: resolve, fail: reject });
    });
  const conversation = new AskConversation((paint) => void frames.push(paint));
  const deps: AskConversationDeps = {
    send,
    passages: () => [passage('a'), passage('b')],
    teamId: () => null,
    builtIn: () => false,
    nothingToRead: 'Nothing to read.',
    ...over,
  };
  conversation.bind(deps);
  const heard = vi.fn();
  conversation.subscribe(heard);
  const paint = () => frames.splice(0).forEach((frame) => frame());
  // The conversation's own awaits (its passages, the send) settle in microtasks.
  const settle = async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  };
  return { conversation, calls, paint, settle, heard, frames };
}

const done = (text: string): AskOutcome => ({
  type: 'done',
  text,
  sources: [{ ...passage('a'), number: 1 }],
  provider: 'built-in',
  model: 'm',
});

afterEach(() => resetConversations());

describe('a conversation with Ask AI', () => {
  it('asks, streams a frame at a time, and ends with the answer and its sources', async () => {
    const { conversation, calls, paint, settle, heard, frames } = setup({ teamId: () => 'team_1' });
    expect(conversation.turns()).toEqual([]);
    expect(conversation.ask('  What happens?  ')).toBe(true);
    expect(conversation.streaming).toBe(true);
    expect(conversation.turns()).toMatchObject([
      { question: 'What happens?', status: 'streaming', text: '' },
    ]);
    // A second question waits for the first.
    expect(conversation.ask('And then?')).toBe(false);
    await settle();
    expect(calls[0]!.body).toEqual({
      question: 'What happens?',
      passages: [passage('a'), passage('b')],
      teamId: 'team_1',
    });
    const before = conversation.turns();
    calls[0]!.onDelta('It ');
    calls[0]!.onDelta('waits');
    // Two pieces, one frame.
    expect(frames).toHaveLength(1);
    expect(conversation.turns()).toBe(before);
    paint();
    expect(conversation.turns()[0]!.text).toBe('It waits');
    calls[0]!.onDelta(' [1].');
    calls[0]!.end(done('It waits [1].'));
    await settle();
    // A frame that lands after the answer ended adds nothing.
    const ended = conversation.turns();
    paint();
    expect(conversation.turns()).toBe(ended);
    expect(conversation.streaming).toBe(false);
    expect(conversation.turns()[0]).toMatchObject({
      status: 'done',
      text: 'It waits [1].',
      provider: 'built-in',
      model: 'm',
      sources: [{ number: 1, id: 'a' }],
    });
    expect(heard).toHaveBeenCalled();
    expect(conversation.keyFailure()).toBeNull();
  });

  it('sends the finished turns with a follow-up, and built-in AI when chosen', async () => {
    const { conversation, calls, settle } = setup({ builtIn: () => true });
    conversation.ask('First?');
    await settle();
    calls[0]!.end(done('One [1].'));
    await settle();
    conversation.ask('Second?');
    await settle();
    expect(calls[1]!.body).toMatchObject({
      question: 'Second?',
      turns: [{ question: 'First?', answer: 'One [1].' }],
      ai: 'built-in',
    });
    expect(calls[1]!.body).not.toHaveProperty('teamId');
  });

  it('does not take an empty or too long question, or one asked before it is bound', () => {
    const { conversation } = setup();
    expect(conversation.ask('   ')).toBe(false);
    expect(conversation.ask('q'.repeat(ASK_MAX_QUESTION_CHARS + 1))).toBe(false);
    expect(new AskConversation().ask('Hello?')).toBe(false);
    expect(conversation.turns()).toEqual([]);
  });

  it("says a refusal in the server's words, with a key failure for the pill", async () => {
    const { conversation, calls, settle } = setup();
    conversation.ask('Q?');
    await settle();
    calls[0]!.onDelta('Part');
    calls[0]!.end({
      type: 'error',
      kind: 'ai_key_failed',
      message: 'Claude did not accept the API key.',
      aiKey: { source: 'account', provider: 'anthropic', kind: 'bad-key' },
    });
    await settle();
    expect(conversation.turns()[0]).toMatchObject({
      status: 'failed',
      text: 'Part',
      failure: { kind: 'ai_key_failed', message: 'Claude did not accept the API key.' },
    });
    expect(conversation.keyFailure()).toEqual({
      source: 'account',
      provider: 'anthropic',
      kind: 'bad-key',
    });
    // Asked again, the failed turn leaves and its question is asked afresh.
    const failedId = conversation.turns()[0]!.id;
    expect(conversation.askAgain('nope')).toBe(false);
    expect(conversation.askAgain(failedId)).toBe(true);
    expect(conversation.turns()).toHaveLength(1);
    expect(conversation.turns()[0]!.id).not.toBe(failedId);
    expect(conversation.askAgain(conversation.turns()[0]!.id)).toBe(false);
    await settle();
    calls[1]!.end({ type: 'error', kind: 'other', message: 'No.' });
    await settle();
    expect(conversation.turns()[0]!.failure).toEqual({ kind: 'other', message: 'No.' });
    expect(conversation.keyFailure()).toBeNull();
  });

  it('fails in words when the item holds nothing to read, or the send breaks', async () => {
    const empty = setup({ passages: () => [] });
    empty.conversation.ask('Q?');
    await empty.settle();
    expect(empty.conversation.turns()[0]).toMatchObject({
      status: 'failed',
      failure: { kind: 'ask_nothing_to_read', message: 'Nothing to read.' },
    });
    expect(empty.calls).toHaveLength(0);
    const broken = setup();
    broken.conversation.ask('Q?');
    await broken.settle();
    broken.calls[0]!.fail(new Error('boom'));
    await broken.settle();
    expect(broken.conversation.turns()[0]!.failure).toEqual({ kind: 'other', message: ASK_FAILED });
    expect(broken.conversation.streaming).toBe(false);
  });

  it('stops an answer, keeping what had arrived', async () => {
    const { conversation, calls, settle } = setup();
    conversation.stop();
    conversation.ask('Q?');
    await settle();
    calls[0]!.onDelta('Half an');
    conversation.stop();
    await settle();
    expect(conversation.turns()[0]).toMatchObject({ status: 'stopped', text: 'Half an' });
    expect(conversation.streaming).toBe(false);
  });

  it('stopped while the item is still being read, sends nothing', async () => {
    let release: (passages: AskPassage[]) => void = () => {};
    const { conversation, calls, settle } = setup({
      passages: () => new Promise<AskPassage[]>((resolve) => (release = resolve)),
    });
    conversation.ask('Q?');
    conversation.stop();
    release([passage('a')]);
    await settle();
    expect(conversation.turns()[0]!.status).toBe('stopped');
    expect(calls).toHaveLength(0);
  });

  it('starts a new chat: the turns go, and a streaming answer is stopped', async () => {
    const { conversation, calls, settle } = setup();
    conversation.ask('Q?');
    await settle();
    conversation.clear();
    expect(calls[0]!.signal.aborted).toBe(true);
    await settle();
    expect(conversation.turns()).toEqual([]);
    expect(conversation.streaming).toBe(false);
    expect(conversation.ask('Again?')).toBe(true);
  });

  it('keeps its newest turns', async () => {
    const { conversation, calls, settle } = setup();
    for (let at = 0; at < ASK_MAX_TURNS + 2; at += 1) {
      conversation.ask(`Q${at}?`);
      await settle();
      calls[at]!.end(done(`A${at}`));
      await settle();
    }
    expect(conversation.turns()).toHaveLength(ASK_MAX_TURNS);
    expect(conversation.turns()[0]!.question).toBe('Q2?');
  });

  it('paints on the next frame by default', async () => {
    vi.useFakeTimers();
    const raf = vi.fn((paint: FrameRequestCallback) => (setTimeout(() => paint(0), 0), 1));
    vi.stubGlobal('requestAnimationFrame', raf);
    const calls: Call[] = [];
    const run = async (conversation: AskConversation) => {
      conversation.bind({
        send: (body, { onDelta, signal }) =>
          new Promise<AskOutcome>(
            (resolve, reject) =>
              void calls.push({ body, onDelta, signal, end: resolve, fail: reject }),
          ),
        passages: () => [passage('a')],
        teamId: () => null,
        builtIn: () => false,
        nothingToRead: '',
      });
      conversation.ask('Q?');
      await vi.advanceTimersByTimeAsync(0);
      calls.at(-1)!.onDelta('Hi');
      await vi.advanceTimersByTimeAsync(20);
      expect(conversation.turns()[0]!.text).toBe('Hi');
    };
    await run(new AskConversation());
    expect(raf).toHaveBeenCalled();
    vi.stubGlobal('requestAnimationFrame', undefined);
    await run(new AskConversation());
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});

describe('the conversations of a page', () => {
  it('are one per item, the few most recent kept', () => {
    const first = conversationOf('item-1');
    expect(conversationOf('item-1')).toBe(first);
    for (let at = 2; at <= 7; at += 1) conversationOf(`item-${at}`);
    // item-1 was used before the others: it is the one that left.
    expect(conversationOf('item-1')).not.toBe(first);
    const kept = conversationOf('item-7');
    expect(conversationOf('item-7')).toBe(kept);
  });
});
