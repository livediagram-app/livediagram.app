import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { askCountName, spendAskIn } from '@liveworkspace/ask/server';
import { fakeSubscription } from '@liveworkspace/subscription/testing';
import type { PageDraftResponse } from '@livedocuments/api-schema';
import type { Env } from '../types';
import { handlePageDrafts, PAGE_DRAFT_WORDS } from './page-drafts';
import { makeTestRouteContext } from './test-route-context';

// Whose key applies (ai-keys.md "Every AI feature honours the choice"): built-in AI unless a test says otherwise.
const keyFor = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => null));
vi.mock('@liveworkspace/auth-client/ai-key', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/auth-client/ai-key')>()),
  personAiKey: keyFor,
}));

// The index's grant on the document: only an Editor may make a page there (describe-a-page.md "The button").
const granted = vi.hoisted(() => ({
  grant: { level: 'edit', tab: null, trashed: false } as Record<string, unknown> | null,
  refusal: null as Response | null,
}));
vi.mock('./document-grant', () => ({
  resolveDocumentGrant: vi.fn(
    async (_ctx: unknown, itemId: string) =>
      granted.refusal ??
      (granted.grant ? { item: itemId, owner: 'user_owner', team: null, ...granted.grant } : null),
  ),
}));

// docs/specs/007-editor/describe-a-page.md "Which AI makes it": who may ask, the two asks of a laid-out page and the
// one of a written page, Ask's day, the credit after the words, and every refusal in fixed words. No network.
let replies: string[];
let asked: { messages: { role: string; content: string }[] }[];
let stores: Map<string, Map<string, unknown>>;
let env: Env;
beforeEach(() => {
  keyFor.mockReset();
  keyFor.mockResolvedValue(null);
  granted.grant = { level: 'edit', tab: null, trashed: false };
  granted.refusal = null;
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  replies = [];
  asked = [];
  stores = new Map();
  const rooms = {
    idFromName: (name: string) => name,
    get: (name: string) => {
      const map = stores.get(name) ?? new Map<string, unknown>();
      stores.set(name, map);
      const storage = {
        get: async <T>(k: string) => map.get(k) as T | undefined,
        put: async <T>(k: string, v: T) => void map.set(k, v),
      };
      return { spendAsk: (day: string, cap: number) => spendAskIn(storage, day, cap) };
    },
  };
  env = {
    AI: {
      run: async (_model: string, input: { messages: { role: string; content: string }[] }) => {
        asked.push(input);
        const next = replies.shift();
        if (next === undefined) throw new Error('model down');
        return { response: next };
      },
    },
    DOCUMENT_ROOM: rooms,
  } as unknown as Env;
});
afterEach(() => vi.restoreAllMocks());

type Who = 'account' | 'guest' | 'nobody';
const body = (over: Record<string, unknown> = {}) => ({
  prompt: 'Our three pricing plans',
  documentId: 'doc_1',
  tabId: 't1',
  kind: 'slide',
  ...over,
});
const draft = (
  over: Record<string, unknown> = {},
  {
    who = 'account',
    path = '/api/page-drafts',
    method = 'POST',
    extra = {},
  }: { who?: Who; path?: string; method?: string; extra?: Partial<Env> } = {},
) =>
  handlePageDrafts(
    makeTestRouteContext(method, path, {
      ...(who === 'account'
        ? { owner: 'user_a', accountUserId: 'user_a' }
        : who === 'guest'
          ? { owner: 'guest_1' }
          : {}),
      ...(method === 'POST' ? { body: body(over) } : {}),
      env: { ...env, ...extra },
    }),
  );

describe('POST /api/page-drafts', () => {
  it('makes a slide in two asks: the layout, then its words, counted once on built-in AI', async () => {
    replies = ['{"layout":"agenda"}', '{"title":"Offsite","body":["Welcome","Plans"]}'];
    const res = await draft({ teamId: 'team_1' });
    expect(res.status).toBe(200);
    const answer = await res.json<PageDraftResponse>();
    expect(answer).toMatchObject({
      provider: 'built-in',
      draft: { kind: 'layout', layout: 'agenda', label: 'Agenda', text: { title: 'Offsite' } },
    });
    expect(asked).toHaveLength(2);
    expect(asked[0]!.messages.at(-1)!.content).toContain('- agenda: Agenda');
    expect(asked[1]!.messages.at(-1)!.content).toContain('<slots>');
    expect(keyFor.mock.calls[0]![2]).toBe('team_1');
    expect(stores.get(askCountName('user_a'))!.get('ask-ai')).toMatchObject({ count: 1 });
  });

  it('writes an article or a card in one ask, as Markdown', async () => {
    replies = ['{"title":"Remote Work","subtitle":"A guide","markdown":"Intro"}'];
    const res = await draft({ kind: 'article' });
    expect((await res.json<PageDraftResponse>()).draft).toEqual({
      kind: 'writing',
      markdown: '---\ntitle: Remote Work\nsubtitle: A guide\n---\n\nIntro',
    });
    replies = ['{"title":"Open","markdown":"- Hello"}'];
    const card = await draft({ kind: 'flashcard' });
    expect(card.status).toBe(200);
    expect(asked).toHaveLength(2);
  });

  it('asks once more when a reply holds placeholders, keeping the better reply, the day spent once', async () => {
    replies = [
      '{"layout":"key-stats"}',
      '{"title":"Our Year","figures":["12k","N/A","TBD","[Insert]","4","5"]}',
      '{"title":"Our Year","figures":["12k","40","4.8","99%","",""]}',
    ];
    const res = await draft();
    const answer = await res.json<PageDraftResponse>();
    expect(asked).toHaveLength(3);
    expect(asked[2]!.messages.at(-1)!.content).toContain('Your last reply held placeholders');
    expect(answer.draft).toMatchObject({
      kind: 'layout',
      name: 'Our Year',
      text: { figures: ['12k', '40', '4.8', '99%', '', ''] },
    });
    expect(stores.get(askCountName('user_a'))!.get('ask-ai')).toMatchObject({ count: 1 });
    // A worse second reply, or a failed one: the first is kept, its placeholders dropped.
    asked = [];
    replies = [
      '{"layout":"key-stats"}',
      '{"title":"Our Year","figures":["12k","N/A"]}',
      'nonsense',
    ];
    expect((await (await draft()).json<PageDraftResponse>()).draft).toMatchObject({
      text: { figures: ['12k', '', '', '', '', ''] },
    });
    replies = ['{"layout":"key-stats"}', '{"title":"Our Year","figures":["12k","N/A"]}'];
    expect((await draft()).status).toBe(200);
  });

  it('writes a card again when it holds placeholders, and drops their lines either way', async () => {
    replies = [
      '{"title":"Key Point","markdown":"- Example 1: [Insert first example here]"}',
      '{"title":"Key Point","markdown":"- Small teams ship faster"}',
    ];
    const res = await draft({ kind: 'flashcard' });
    expect((await res.json<PageDraftResponse>()).draft).toEqual({
      kind: 'writing',
      markdown: '---\ntitle: Key Point\n---\n\n- Small teams ship faster',
    });
    replies = ['{"title":"Key Point","markdown":"- [Insert here]\\n- Real"}'];
    expect((await (await draft({ kind: 'flashcard' })).json<PageDraftResponse>()).draft).toEqual({
      kind: 'writing',
      markdown: '---\ntitle: Key Point\n---\n\n- Real',
    });
  });

  it('says off topic, or a reply it cannot read, in its own words', async () => {
    replies = ['{"layout":null}'];
    const off = await draft();
    expect(off.status).toBe(422);
    expect(await off.json()).toEqual({
      error: 'page_draft_off_topic',
      message: PAGE_DRAFT_WORDS.offTopic('slide'),
    });
    replies = ['nonsense'];
    expect(await (await draft()).json()).toMatchObject({ error: 'page_draft_unreadable' });
    replies = ['{"layout":"agenda"}', '{"title": 3}'];
    expect(await (await draft()).json()).toMatchObject({ error: 'page_draft_unreadable' });
    replies = ['{"title":null}'];
    expect(await (await draft({ kind: 'article' })).json()).toMatchObject({
      error: 'page_draft_off_topic',
      message: PAGE_DRAFT_WORDS.offTopic('article'),
    });
    replies = ['{}'];
    expect(await (await draft({ kind: 'flashcard' })).json()).toMatchObject({
      error: 'page_draft_unreadable',
    });
  });

  it('answers a failed model call in fixed words, at either ask', async () => {
    const first = await draft();
    expect(first.status).toBe(502);
    expect(await first.json()).toMatchObject({ error: 'page_draft_failed' });
    replies = ['{"layout":"agenda"}'];
    expect((await draft()).status).toBe(502);
    expect((await draft({ kind: 'article' })).status).toBe(502);
  });

  it('refuses a guest, nobody, bad words or kinds, and anyone not an Editor of the tab', async () => {
    const guest = await draft({}, { who: 'guest' });
    expect(guest.status).toBe(403);
    expect(await guest.json()).toMatchObject({ error: 'page_draft_needs_account' });
    expect((await draft({}, { who: 'nobody' })).status).toBe(401);
    for (const bad of [
      { prompt: '  ' },
      { prompt: 'x'.repeat(501) },
      { kind: 'poster' },
      { documentId: '' },
      { tabId: 7 },
    ])
      expect(await (await draft(bad)).json()).toMatchObject({ error: 'page_draft_invalid' });
    for (const grant of [
      null,
      { level: 'participate', tab: null },
      { level: 'view', tab: null },
      { level: 'edit', tab: 'other_tab' },
      { level: 'edit', tab: null, trashed: true },
    ]) {
      granted.grant = grant;
      const res = await draft();
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ error: 'page_draft_forbidden' });
    }
    granted.grant = { level: 'edit', tab: 't1' };
    replies = ['{"layout":"agenda"}', '{"title":"Fine"}'];
    expect((await draft()).status).toBe(200);
    granted.refusal = new Response(null, { status: 503 });
    expect((await draft()).status).toBe(503);
    expect(asked).toHaveLength(2);
  });

  it('is one path and one verb, and reads a JSON body', async () => {
    expect((await draft({}, { path: '/api/page-drafts/more' })).status).toBe(404);
    expect((await draft({}, { method: 'GET' })).status).toBe(405);
    const res = await handlePageDrafts(
      makeTestRouteContext('POST', '/api/page-drafts', {
        owner: 'user_a',
        accountUserId: 'user_a',
        rawBody: 'not json',
        env,
      }),
    );
    expect(res.status).toBe(400);
  });

  it('on a key, asks it and counts nothing; with built-in AI chosen, asks built-in AI', async () => {
    keyFor.mockResolvedValue({
      status: 'key',
      source: 'personal',
      provider: 'anthropic',
      model: null,
      key: 'sk-test',
    });
    replies = ['{"layout":"agenda"}', '{"title":"Fine"}'];
    const res = await draft({ ai: 'built-in' });
    expect((await res.json<PageDraftResponse>()).provider).toBe('built-in');
    expect(stores.get(askCountName('user_a'))!.get('ask-ai')).toMatchObject({ count: 1 });
  });

  it("refuses past Ask's day, and where built-in AI is not set up", async () => {
    const none = await draft({}, { extra: { AI: undefined } });
    expect(none.status).toBe(503);
    expect(await none.json()).toEqual({
      error: 'page_draft_unavailable',
      message: PAGE_DRAFT_WORDS.notSetUp,
    });
    stores.set(askCountName('user_a'), new Map([['ask-ai', { day: today(), count: 10_000 }]]));
    const capped = await draft();
    expect(capped.status).toBe(429);
    expect(await capped.json()).toMatchObject({ error: 'page_draft_built_in_limit' });
    expect(asked).toHaveLength(0);
  });

  it('with Pro on, spends 1 credit once the words are in hand, and refuses a used month', async () => {
    const service = fakeSubscription();
    const pro = {
      PRO_ENABLED: 'true',
      SUBSCRIPTION_KEY: 'app-key',
      SUBSCRIPTION_URL: 'https://subscription.test/ask',
      SUBSCRIPTION: service.fetcher,
    } as Partial<Env>;
    replies = ['{"layout":null}'];
    expect((await draft({}, { extra: pro })).status).toBe(422);
    expect(service.to('spend')).toHaveLength(0);
    replies = ['{"layout":"agenda"}', '{"title":"Fine"}'];
    expect((await draft({}, { extra: pro })).status).toBe(200);
    expect(service.to('spend').map((s) => [s.owner, s.meter, s.amount])).toEqual([
      ['p:user_owner', 'aiCredits', 1],
    ]);
    service.spent.set('p:user_owner:aiCredits', 50);
    replies = ['{"layout":"agenda"}', '{"title":"Fine"}'];
    const used = await draft({}, { extra: pro });
    expect(used.status).toBe(429);
    expect(await used.json()).toMatchObject({
      error: 'ai_credits_used',
      message: PAGE_DRAFT_WORDS.used,
    });
  });
});

const today = () => new Date().toISOString().slice(0, 10);
