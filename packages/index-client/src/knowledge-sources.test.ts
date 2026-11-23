import { describe, expect, it, vi } from 'vitest';
import { createKnowledgeSourcesClient } from './knowledge-client';
import {
  ASK_CITATION_QUESTION_MAX,
  KNOWLEDGE_CHUNKS_PER_SOURCE,
  KNOWLEDGE_CHUNK_MAX_CHARS,
  KNOWLEDGE_PLACE_ELEMENTS_MAX,
  askCitationOf,
  isKnowledgePlace,
  isKnowledgeSourceApp,
  isKnowledgeText,
  knowledgePlaceHash,
  readKnowledgeSourceChange,
} from './knowledge-sources';

const chunk = (text = 'Checkout calls the payments service', place: object = { tabId: 't1' }) => ({
  ref: 't1:0',
  title: 'Checkout',
  text,
  place,
});

describe('knowledge source contract', () => {
  it('names the five source apps and nothing else', () => {
    expect(isKnowledgeSourceApp('livediagram')).toBe(true);
    expect(isKnowledgeSourceApp('livehuddle')).toBe(true);
    expect(isKnowledgeSourceApp('liveknowledge')).toBe(false);
    expect(isKnowledgeSourceApp(7)).toBe(false);
  });

  it('takes a place with a tab or a card, and bounded elements', () => {
    expect(isKnowledgePlace({ tabId: 't' })).toBe(true);
    expect(isKnowledgePlace({ cardId: 'c' })).toBe(true);
    expect(isKnowledgePlace({ tabId: 't', elementIds: ['a', 'b'] })).toBe(true);
    expect(isKnowledgePlace({})).toBe(false);
    expect(isKnowledgePlace({ elementIds: ['a'] })).toBe(false);
    expect(isKnowledgePlace({ tabId: '' })).toBe(false);
    expect(isKnowledgePlace({ tabId: 't', cardId: 5 })).toBe(false);
    expect(isKnowledgePlace({ tabId: 't', elementIds: 'a' })).toBe(false);
    expect(
      isKnowledgePlace({
        tabId: 't',
        elementIds: Array.from({ length: KNOWLEDGE_PLACE_ELEMENTS_MAX + 1 }, (_, i) => `e${i}`),
      }),
    ).toBe(false);
    expect(isKnowledgePlace(null)).toBe(false);
  });

  it('checks a door answer whole, refusing one past any cap', () => {
    expect(isKnowledgeText({ name: 'Flow', version: 3, chunks: [chunk()] })).toBe(true);
    expect(isKnowledgeText({ name: 'Flow', version: 3, chunks: [] })).toBe(true);
    expect(isKnowledgeText({ name: 'Flow', version: Number.NaN, chunks: [] })).toBe(false);
    expect(isKnowledgeText({ name: 1, version: 3, chunks: [] })).toBe(false);
    expect(isKnowledgeText({ name: 'Flow', version: 3, chunks: {} })).toBe(false);
    expect(
      isKnowledgeText({
        name: 'F',
        version: 1,
        chunks: [chunk('x'.repeat(KNOWLEDGE_CHUNK_MAX_CHARS + 1))],
      }),
    ).toBe(false);
    expect(
      isKnowledgeText({
        name: 'F',
        version: 1,
        chunks: Array.from({ length: KNOWLEDGE_CHUNKS_PER_SOURCE + 1 }, () => chunk('x')),
      }),
    ).toBe(false);
    // 60,000 characters in all: 51 full chunks pass it.
    expect(
      isKnowledgeText({
        name: 'F',
        version: 1,
        chunks: Array.from({ length: 51 }, () => chunk('x'.repeat(KNOWLEDGE_CHUNK_MAX_CHARS))),
      }),
    ).toBe(false);
    expect(isKnowledgeText({ name: 'F', version: 1, chunks: [chunk('x', {})] })).toBe(false);
    expect(
      isKnowledgeText({ name: 'F', version: 1, chunks: [{ ...chunk(), title: 'x'.repeat(201) }] }),
    ).toBe(false);
  });

  it('reads a change signal defensively', () => {
    expect(readKnowledgeSourceChange({ app: 'liveplanner', itemId: 'abc' })).toEqual({
      app: 'liveplanner',
      itemId: 'abc',
    });
    expect(readKnowledgeSourceChange({ app: 'liveplanner', itemId: 'abc', gone: true })).toEqual({
      app: 'liveplanner',
      itemId: 'abc',
      gone: true,
    });
    expect(readKnowledgeSourceChange({ app: 'liveplanner', itemId: 'a/b' })).toBeNull();
    expect(readKnowledgeSourceChange({ app: 'liveknowledge', itemId: 'abc' })).toBeNull();
    expect(readKnowledgeSourceChange('x')).toBeNull();
  });

  it('builds a landing fragment the citation bar reads back', () => {
    const hash = knowledgePlaceHash(
      { tabId: 'tab 1', elementIds: ['a,1', 'b', 'c'] },
      { question: 'How does checkout pay?', from: 'kb_1' },
    );
    expect(hash.startsWith('#t=tab+1&el=a%2C1&els=')).toBe(true);
    expect(askCitationOf(hash)).toEqual({
      question: 'How does checkout pay?',
      from: 'kb_1',
      elementIds: ['a,1', 'b', 'c'],
    });
    expect(knowledgePlaceHash({ cardId: 'c1' })).toBe('#item=c1');
    // Elements ride only beside a tab.
    expect(knowledgePlaceHash({ cardId: 'c1', elementIds: ['e'] })).toBe('#item=c1');
  });

  it('refuses a landing with no question or a bad knowledgebase id, and cuts a long question', () => {
    expect(askCitationOf('#t=x&el=y')).toBeNull();
    expect(askCitationOf('#ask=hi&from=a%2Fb')).toBeNull();
    expect(askCitationOf('ask=%20%20&from=kb')).toBeNull();
    const long = askCitationOf(
      `#ask=${'q'.repeat(ASK_CITATION_QUESTION_MAX + 50)}&from=kb&els=%E0%A4%A`,
    );
    expect(long?.question.length).toBe(ASK_CITATION_QUESTION_MAX);
    expect(long?.elementIds).toEqual([]);
  });
});

describe('createKnowledgeSourcesClient', () => {
  const setup = (answer: (url: string, body: unknown) => Response) => {
    const calls: { url: string; body: unknown; headers: Headers }[] = [];
    const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      calls.push({ url: String(url), body, headers: new Headers(init?.headers) });
      return answer(String(url), body);
    });
    const client = createKnowledgeSourcesClient({
      app: 'liveknowledge',
      key: 'k',
      baseUrl: 'https://index.test/api/index/',
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    return { client, calls };
  };
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  it('posts each route with the app key and reads its list', async () => {
    const { client, calls } = setup((url) =>
      url.endsWith('knowledge-sources')
        ? ok({ sources: [{ itemId: 'd1' }] })
        : url.endsWith('knowledge-reach')
          ? ok({ itemIds: ['d1', 7] })
          : ok({ items: [{ itemId: 'p1' }] }),
    );
    expect(await client.sources('kb', null)).toEqual([{ itemId: 'd1' }]);
    expect(await client.reach('kb', { personId: 'u', teams: ['t'] }, ['d1'], 'f')).toEqual(['d1']);
    expect(await client.likely('kb', { personId: 'u', teams: [] }, ['pay'], [])).toEqual([
      { itemId: 'p1' },
    ]);
    expect(calls[0]!.url).toBe('https://index.test/api/index/app/items/kb/knowledge-sources');
    expect(calls[0]!.headers.get('Authorization')).toBe('Bearer k');
    expect(calls[1]!.body).toEqual({ personId: 'u', teams: ['t'], itemIds: ['d1'], folderId: 'f' });
  });

  it('asks nothing for no ids or no words', async () => {
    const { client, calls } = setup(() => ok({}));
    expect(await client.reach('kb', { personId: 'u', teams: [] }, [], null)).toEqual([]);
    expect(await client.likely('kb', { personId: 'u', teams: [] }, [], [])).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('answers null for a 404 and for a text past the caps, and throws on a refusal', async () => {
    const { client } = setup((url, body) =>
      (body as { itemId?: string }).itemId === 'gone'
        ? new Response('{}', { status: 404 })
        : (body as { itemId?: string }).itemId === 'big'
          ? ok({ name: 'x', version: 1, chunks: [chunk('x'.repeat(5000))] })
          : url.endsWith('knowledge-text')
            ? ok({ name: 'Flow', version: 2, chunks: [chunk()] })
            : new Response(JSON.stringify({ error: 'nope' }), { status: 403 }),
    );
    expect(await client.text('kb', 'gone', null)).toBeNull();
    expect(await client.text('kb', 'big', null)).toBeNull();
    expect((await client.text('kb', 'd1', null))?.name).toBe('Flow');
    await expect(client.sources('kb', null)).rejects.toThrow();
  });
});
