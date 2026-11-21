import { describe, expect, it, vi } from 'vitest';
import type { AskRequest } from '@liveknowledge/api-schema';
import { ASK_MAX_TURNS } from '@liveknowledge/knowledge';
import type { AskOutcome } from '@/lib/api/knowledge-ask';
import { createAskConversation, type AskSend } from './ask-conversation';

// A send the test drives: each call's request, its delta sink, its signal and its promise's two ends.
function wire() {
  const calls: {
    request: AskRequest;
    delta: (text: string) => void;
    signal: AbortSignal;
    answer: (outcome: AskOutcome) => void;
  }[] = [];
  const send: AskSend = (request, opts) =>
    new Promise((resolve, reject) => {
      opts.signal.addEventListener('abort', () =>
        reject(new DOMException('aborted', 'AbortError')),
      );
      calls.push({ request, delta: opts.onDelta, signal: opts.signal, answer: resolve });
    });
  // Frames run when the test says so.
  const frames: (() => void)[] = [];
  const frame = {
    request: (run: () => void) => frames.push(run),
    cancel: (id: number) => void (frames[id - 1] = () => {}),
  };
  const runFrame = () => frames.splice(0).forEach((run) => run());
  let n = 0;
  const conversation = createAskConversation({ send, frame, newId: () => `t${++n}` });
  return { conversation, calls, runFrame, frames };
}
const done = (
  text: string,
  over: Partial<Extract<AskOutcome, { type: 'done' }>> = {},
): AskOutcome => ({
  type: 'done',
  text,
  sources: [],
  notUsed: [],
  provider: 'anthropic',
  gaps: [],
  model: 'claude-fable-5-2',
  ...over,
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('asking', () => {
  it('adds a streaming turn and ends it with the answer', async () => {
    const { conversation, calls } = wire();
    expect(conversation.ask('  How do we release?  ')).toBe(true);
    expect(conversation.getTurns()).toMatchObject([
      { id: 't1', question: 'How do we release?', status: 'streaming', text: '' },
    ]);
    expect(conversation.isStreaming()).toBe(true);
    calls[0]!.answer(done('On Thursdays [1].', { gaps: ['Who approves?'] }));
    await settle();
    expect(conversation.getTurns()[0]).toMatchObject({
      status: 'done',
      text: 'On Thursdays [1].',
      gaps: ['Who approves?'],
    });
    expect(conversation.isStreaming()).toBe(false);
  });

  it('sends nothing for an empty question, one too long, or while an answer is on its way', () => {
    const { conversation, calls } = wire();
    expect(conversation.ask('   ')).toBe(false);
    expect(conversation.ask('x'.repeat(1001))).toBe(false);
    expect(conversation.ask('One?')).toBe(true);
    expect(conversation.ask('Two?')).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('sends the earlier answers with a follow-up, and not a failed turn', async () => {
    const { conversation, calls } = wire();
    conversation.ask('One?');
    calls[0]!.answer(done('First [1].'));
    await settle();
    conversation.ask('Two?');
    calls[1]!.answer({ type: 'error', kind: 'overloaded', message: 'busy' });
    await settle();
    conversation.ask('Three?');
    expect(calls[0]!.request).toEqual({ question: 'One?' });
    expect(calls[2]!.request).toEqual({
      question: 'Three?',
      turns: [{ question: 'One?', answer: 'First [1].' }],
    });
  });

  it(`takes ${ASK_MAX_TURNS} turns, then says the conversation is full`, async () => {
    const { conversation, calls } = wire();
    for (let i = 0; i < ASK_MAX_TURNS; i++) {
      expect(conversation.ask(`Question ${i}?`)).toBe(true);
      calls[i]!.answer(done('Answer.'));
      await settle();
    }
    expect(conversation.isFull()).toBe(true);
    expect(conversation.ask('One more?')).toBe(false);
    conversation.reset();
    expect(conversation.isFull()).toBe(false);
    expect(conversation.getTurns()).toEqual([]);
  });
});

describe('a failed answer', () => {
  it('keeps the kind, and asks again in the same place', async () => {
    const { conversation, calls } = wire();
    conversation.ask('One?');
    calls[0]!.answer({ type: 'error', kind: 'rate-limited', message: 'slow down' });
    await settle();
    expect(conversation.getTurns()[0]).toMatchObject({ status: 'failed', failure: 'rate-limited' });
    conversation.askAgain('t1');
    expect(conversation.getTurns()).toMatchObject([{ id: 't1', status: 'streaming' }]);
    expect(conversation.getTurns()[0]!.failure).toBeUndefined();
    expect(calls[1]!.request).toEqual({ question: 'One?' });
  });
});

describe('stopping', () => {
  it('aborts the request and keeps what arrived', async () => {
    const { conversation, calls, runFrame } = wire();
    conversation.ask('One?');
    calls[0]!.delta('On Thurs');
    runFrame();
    conversation.stop();
    expect(calls[0]!.signal.aborted).toBe(true);
    await settle();
    expect(conversation.getTurns()[0]).toMatchObject({ status: 'stopped', text: 'On Thurs' });
    // A piece that arrives after the stop is not this turn's.
    calls[0]!.delta('days');
    expect(conversation.getTurns()[0]!.text).toBe('On Thurs');
    expect(conversation.ask('Two?')).toBe(true);
  });

  it('a new question aborts the answer on its way', () => {
    const { conversation, calls } = wire();
    conversation.ask('One?');
    conversation.reset();
    expect(calls[0]!.signal.aborted).toBe(true);
    expect(conversation.getTurns()).toEqual([]);
  });
});

describe('the stream', () => {
  it('hands the pieces over once a frame, and tells no listener of the turn list', () => {
    const { conversation, calls, runFrame, frames } = wire();
    conversation.ask('One?');
    const heard = vi.fn();
    conversation.subscribe(heard);
    const drawn: string[] = [];
    conversation.watchStream('t1', (text) => drawn.push(text));
    for (let i = 0; i < 500; i++) calls[0]!.delta(`w${i} `);
    // 500 pieces, one frame asked for, nothing drawn until it runs.
    expect(frames).toHaveLength(1);
    expect(drawn).toEqual([]);
    runFrame();
    expect(drawn).toHaveLength(1);
    expect(drawn[0]!.startsWith('w0 w1 ')).toBe(true);
    calls[0]!.delta('tail');
    runFrame();
    expect(drawn).toHaveLength(2);
    expect(drawn[1]).toBe('tail');
    expect(heard).not.toHaveBeenCalled();
  });

  it('hands a late watcher what was already shown', () => {
    const { conversation, calls, runFrame } = wire();
    conversation.ask('One?');
    calls[0]!.delta('Hello ');
    runFrame();
    calls[0]!.delta('there');
    const drawn: string[] = [];
    conversation.watchStream('t1', (text) => drawn.push(text));
    expect(drawn).toEqual(['Hello ']);
    runFrame();
    expect(drawn).toEqual(['Hello ', 'there']);
  });

  it('streams 20,000 pieces within a budget of processor time', () => {
    const { conversation, calls, runFrame } = wire();
    conversation.ask('One?');
    let length = 0;
    conversation.watchStream('t1', (text) => (length += text.length));
    const before = process.cpuUsage();
    for (let i = 0; i < 20_000; i++) {
      calls[0]!.delta('word ');
      if (i % 20 === 19) runFrame();
    }
    const spent = process.cpuUsage(before);
    expect(length).toBe(100_000);
    if (process.env.MEASURE) console.log(`MEASURE stream ${(spent.user + spent.system) / 1000} ms`);
    // Linear: one append a piece and one hand-over a frame. Measured at about 6 ms; 250 ms is the guard.
    expect((spent.user + spent.system) / 1000).toBeLessThan(250);
  });
});

describe('feedback', () => {
  it('is kept on the turn and can be taken back', async () => {
    const { conversation, calls } = wire();
    conversation.ask('One?');
    calls[0]!.answer(done('Answer.'));
    await settle();
    conversation.setFeedback('t1', 'helpful');
    expect(conversation.getTurns()[0]!.feedback).toBe('helpful');
    conversation.setFeedback('t1', undefined);
    expect(conversation.getTurns()[0]!.feedback).toBeUndefined();
  });
});
