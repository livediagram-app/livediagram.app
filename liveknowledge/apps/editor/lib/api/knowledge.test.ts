import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ContextBudgetError,
  apiDismissKnowledgeConflict,
  apiDismissKnowledgeQuestion,
  apiKnowledgeAi,
  apiKnowledgeOverview,
  apiKnowledgeSummary,
  apiPageBacklinks,
  apiPageHealth,
  apiRemoveKnowledgeAiKey,
  apiReportKnowledgeGap,
  apiSearchKnowledge,
  apiSetKnowledgeAiKey,
  apiSetKnowledgeAiModel,
  apiSetPageKnowledge,
  apiVerifyPage,
} from './knowledge';
import { ASK_CUT_SHORT, apiAskKnowledge, readAskEvents } from './knowledge-ask';

// The knowledge routes' client (docs/specs/015-api/api.md "Knowledge"), over a fake fetch.

type Call = { url: string; init: RequestInit };

function stub(answer: unknown, status = 200) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(
        status === 204 ? new Response(null, { status }) : Response.json(answer, { status }),
      );
    }),
  );
  return calls;
}

const who = { ownerId: 'owner-1', shareCode: 'code-1' };
const knowledge = { tab: 't1', state: 'verified', changedSinceVerified: false, tokens: 120 };
const bodyOf = (call: Call) => JSON.parse(call.init.body as string) as unknown;

afterEach(() => vi.unstubAllGlobals());

describe('search', () => {
  it('sends the query encoded, with the share code and a signal', async () => {
    const calls = stub({ results: [{ id: 'p1', tab: 't1' }] });
    const results = await apiSearchKnowledge(who, 'd1', 'deploy & roll back');
    expect(results.map((r) => r.id)).toEqual(['p1']);
    expect(calls[0]!.url).toMatch(/\/documents\/d1\/search\?q=deploy%20%26%20roll%20back$/);
    expect(new Headers(calls[0]!.init.headers).get('X-Share-Code')).toBe('code-1');
    expect(calls[0]!.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('throws the 200 character and rate-limit refusals with their codes', async () => {
    stub({ error: 'query_too_long' }, 400);
    await expect(apiSearchKnowledge(who, 'd1', 'x')).rejects.toMatchObject({
      status: 400,
      code: 'query_too_long',
    });
    stub({ error: 'rate_limited' }, 429);
    await expect(apiSearchKnowledge(who, 'd1', 'x')).rejects.toMatchObject({ status: 429 });
  });

  it('is aborted by the caller: the request carries a signal that follows it', async () => {
    const calls = stub({ results: [] });
    const controller = new AbortController();
    await apiSearchKnowledge(who, 'd1', 'x', controller.signal);
    expect(calls[0]!.init.signal!.aborted).toBe(false);
    controller.abort();
    expect(calls[0]!.init.signal!.aborted).toBe(true);
  });
});

describe("a page's reads", () => {
  it('reads the summary, backlinks and health', async () => {
    let calls = stub({ pages: 3, health: { total: 3 }, recent: [] });
    expect((await apiKnowledgeSummary(who, 'd1')).pages).toBe(3);
    expect(calls[0]!.url).toMatch(/\/documents\/d1\/summary$/);
    calls = stub({ backlinks: [{ tab: 't2', title: 'Releases' }] });
    expect(await apiPageBacklinks(who, 'd1', 't/1')).toEqual([{ tab: 't2', title: 'Releases' }]);
    expect(calls[0]!.url).toMatch(/\/documents\/d1\/pages\/t%2F1\/backlinks$/);
    calls = stub({ knowledge, reads: { people: 4, agents: 9 } });
    expect((await apiPageHealth(who, 'd1', 't1')).reads).toEqual({ people: 4, agents: 9 });
    expect(calls[0]!.url).toMatch(/\/pages\/t1\/health$/);
  });
});

describe('verify and the fields', () => {
  it('verifies with a POST and no body', async () => {
    const calls = stub({ knowledge });
    expect((await apiVerifyPage(who, 'd1', 't1')).state).toBe('verified');
    expect(calls[0]!.url).toMatch(/\/pages\/t1\/verify$/);
    expect(calls[0]!.init.method).toBe('POST');
    expect(calls[0]!.init.body).toBeUndefined();
  });

  it('throws 403 for a session that may not verify', async () => {
    stub({ error: 'forbidden' }, 403);
    await expect(apiVerifyPage(who, 'd1', 't1')).rejects.toMatchObject({ status: 403 });
  });

  it('sets the fields with a PUT of the patch', async () => {
    const calls = stub({ knowledge });
    await apiSetPageKnowledge(who, 'd1', 't1', { owner: null, reviewEvery: 'never' });
    expect(calls[0]!.init.method).toBe('PUT');
    expect(calls[0]!.url).toMatch(/\/pages\/t1\/knowledge$/);
    expect(bodyOf(calls[0]!)).toEqual({ owner: null, reviewEvery: 'never' });
    expect(new Headers(calls[0]!.init.headers).get('Content-Type')).toBe('application/json');
  });

  it('answers the context budget refusal with its sizes', async () => {
    stub({ error: 'context_budget', tokens: 3000, used: 6000, budget: 8000 }, 409);
    const err = await apiSetPageKnowledge(who, 'd1', 't1', { context: true }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ContextBudgetError);
    expect(err).toMatchObject({ code: 'context_budget', tokens: 3000, used: 6000, budget: 8000 });
  });

  it('throws another 409, and an owner without access, by code', async () => {
    stub({ error: 'tab_busy' }, 409);
    await expect(apiSetPageKnowledge(who, 'd1', 't1', { context: true })).rejects.toMatchObject({
      code: 'tab_busy',
    });
    stub({ error: 'owner_no_access' }, 400);
    await expect(apiSetPageKnowledge(who, 'd1', 't1', { owner: 'u9' })).rejects.toMatchObject({
      code: 'owner_no_access',
    });
  });
});

describe('the AI settings and the AI Knowledge tab', () => {
  const ai = { hasKey: true, keyHint: '4f2a', model: 'claude-fable-5-2', models: [] };

  it('reads and writes the key and the model', async () => {
    let calls = stub(ai);
    expect((await apiKnowledgeAi(who, 'd1')).keyHint).toBe('4f2a');
    expect(calls[0]!.url).toMatch(/\/documents\/d1\/ai$/);
    calls = stub(ai);
    await apiSetKnowledgeAiKey(who, 'd1', 'openai', 'sk-test');
    expect(calls[0]!.url).toMatch(/\/ai\/key$/);
    expect(calls[0]!.init.method).toBe('PUT');
    expect(bodyOf(calls[0]!)).toEqual({ provider: 'openai', key: 'sk-test' });
    calls = stub({ ...ai, hasKey: false });
    expect((await apiRemoveKnowledgeAiKey(who, 'd1')).hasKey).toBe(false);
    expect(calls[0]!.init.method).toBe('DELETE');
    calls = stub(ai);
    await apiSetKnowledgeAiModel(who, 'd1', 'claude-haiku-5-5');
    expect(calls[0]!.url).toMatch(/\/ai\/model$/);
    expect(bodyOf(calls[0]!)).toEqual({ model: 'claude-haiku-5-5' });
  });

  it('says when Ask is unavailable', async () => {
    stub({ error: 'ask_unavailable' }, 503);
    await expect(apiSetKnowledgeAiKey(who, 'd1', 'anthropic', 'sk-test')).rejects.toMatchObject({
      status: 503,
      code: 'ask_unavailable',
    });
  });

  it('reads the overview, reports a gap and dismisses', async () => {
    let calls = stub({ agents: [], questions: [], conflicts: [], hasKey: false });
    expect((await apiKnowledgeOverview(who, 'd1')).hasKey).toBe(false);
    expect(calls[0]!.url).toMatch(/\/documents\/d1\/knowledge$/);
    calls = stub({ key: 'deploy roll' }, 201);
    expect(await apiReportKnowledgeGap(who, 'd1', 'How do we roll back?')).toBe('deploy roll');
    expect(bodyOf(calls[0]!)).toEqual({ question: 'How do we roll back?' });
    calls = stub(null, 204);
    await apiDismissKnowledgeQuestion(who, 'd1', 'deploy roll');
    expect(calls[0]!.url).toMatch(/\/questions\/deploy%20roll$/);
    expect(calls[0]!.init.method).toBe('DELETE');
    calls = stub(null, 204);
    await apiDismissKnowledgeConflict(who, 'd1', 'c1');
    expect(calls[0]!.url).toMatch(/\/conflicts\/c1\/dismiss$/);
    expect(calls[0]!.init.method).toBe('POST');
    stub({ error: 'forbidden' }, 403);
    await expect(apiDismissKnowledgeConflict(who, 'd1', 'c1')).rejects.toMatchObject({
      status: 403,
    });
  });
});

function sse(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

const done = { type: 'done', text: 'Tag it [1].', sources: [], notUsed: [], gaps: [], model: 'm' };
const eventText = (event: { type: string }) =>
  `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

function stubStream(body: ReadableStream<Uint8Array>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(
        new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }),
      );
    }),
  );
  return calls;
}

describe('the Ask stream', () => {
  it('reads events split across chunks, and one cut mid character', async () => {
    const text = eventText({ type: 'delta', text: 'Tag it é' } as never) + eventText(done);
    const bytes = new TextEncoder().encode(text);
    // Cut inside the two bytes of "é".
    const cut = bytes.indexOf(0xc3) + 1;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 5));
        controller.enqueue(bytes.slice(5, cut));
        controller.enqueue(bytes.slice(cut));
        controller.close();
      },
    });
    const events = [];
    for await (const event of readAskEvents(stream)) events.push(event);
    expect(events).toEqual([{ type: 'delta', text: 'Tag it é' }, done]);
  });

  it('ignores comments, other fields and data that is no event, and reads CRLF', async () => {
    const stream = sse(
      ': keep-alive\n\n',
      'event: delta\r\ndata: {"type":"delta","text":"a"}\r\n\r\n',
      'data: not json\n\n',
      'data: {"type":"other"}\n\n',
      'data: {"type":"delta",\ndata: "text":"b"}\n\n',
      'data: {"type":"delta","text":"c"}',
    );
    const texts = [];
    for await (const event of readAskEvents(stream)) texts.push((event as { text: string }).text);
    expect(texts).toEqual(['a', 'b', 'c']);
  });

  it('hands on each piece and answers the done event', async () => {
    const calls = stubStream(
      sse(
        eventText({ type: 'delta', text: 'Tag ' } as never),
        eventText({ type: 'delta', text: 'it [1].' } as never),
        eventText(done),
      ),
    );
    const pieces: string[] = [];
    const outcome = await apiAskKnowledge(
      who,
      'd1',
      { question: 'How do we release?', turns: [] },
      { onDelta: (text) => pieces.push(text) },
    );
    expect(pieces).toEqual(['Tag ', 'it [1].']);
    expect(outcome).toEqual(done);
    expect(calls[0]!.url).toMatch(/\/documents\/d1\/ask$/);
    expect(calls[0]!.init.method).toBe('POST');
    expect(bodyOf(calls[0]!)).toEqual({ question: 'How do we release?', turns: [] });
  });

  it("answers the stream's own error event", async () => {
    const error = { type: 'error', kind: 'bad-key', message: 'The key was refused.' };
    stubStream(sse(eventText(error)));
    expect(await apiAskKnowledge(who, 'd1', { question: 'q' })).toEqual(error);
  });

  it("answers a refusal before the stream in the server's words", async () => {
    stub({ error: 'person-limit', message: 'You have asked 20 questions this hour.' }, 429);
    expect(await apiAskKnowledge(who, 'd1', { question: 'q' })).toEqual({
      type: 'error',
      kind: 'person-limit',
      message: 'You have asked 20 questions this hour.',
    });
  });

  it('says so when the stream ends early or the request never lands', async () => {
    stubStream(sse(eventText({ type: 'delta', text: 'Tag' } as never)));
    expect(await apiAskKnowledge(who, 'd1', { question: 'q' })).toMatchObject({
      type: 'error',
      message: ASK_CUT_SHORT,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('offline'))),
    );
    expect(await apiAskKnowledge(who, 'd1', { question: 'q' })).toMatchObject({
      type: 'error',
      kind: 'network',
    });
  });

  it('rejects when the caller aborts it', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        controller.abort();
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      }),
    );
    await expect(
      apiAskKnowledge(who, 'd1', { question: 'q' }, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
