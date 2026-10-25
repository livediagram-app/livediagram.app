// A scripted api for the verb suites: routes by path (and query), answering JSON, text, or what a function returns
// for the request (a POST, a refusal, a header); 404 otherwise. Each product binds it to its host and collection
// (its testing/fake-api.ts), so its suites read the routes its api serves.

import { createApiClient, type ApiClient } from '@liveworkspace/api-client';
import type { VerbContext } from '../define';
import type { AgentProduct } from '../product';

const isText = (a: unknown): a is { text: string } =>
  typeof a === 'object' && a !== null && 'text' in a && Object.keys(a).length === 1;

export const DOC_A = 'aaaa1111-0000-4000-8000-000000000001';
export const DOC_B = 'aaaa2222-0000-4000-8000-000000000002';
export const DOC_C = 'bbbb0000-0000-4000-8000-000000000003';

export type FakeContext<Ctx extends VerbContext<unknown>> = Ctx & {
  notices: string[];
  slept: number[];
  clock: { now: number };
};

type ListedFile = { id: string; name: string; savedAt: number; ownerId: string };
type TabbedFile = {
  id: string;
  name: string;
  tabs: { id: string; name: string; orderIndex: number }[];
};

export function createFakeApi<N extends string, C extends string>(
  product: Pick<AgentProduct<N, C>, 'noun' | 'collection'>,
  host: string,
) {
  function fakeApi(routes: Record<string, unknown>): ApiClient & { calls: string[] } {
    const calls: string[] = [];
    const api = createApiClient({
      baseUrl: `${host}/api`,
      headers: () => ({}),
      fetch: async (request) => {
        const url = new URL(request.url);
        const key = `${url.pathname.replace(/^\/api/, '')}${url.search}`;
        calls.push(key);
        const answer = key in routes ? routes[key] : routes[url.pathname.replace(/^\/api/, '')];
        if (answer === undefined) return Response.json({ error: 'not_found' }, { status: 404 });
        if (typeof answer === 'function')
          return (answer as (r: Request) => Response | Promise<Response>)(request);
        if (isText(answer)) return new Response(answer.text);
        return Response.json(answer);
      },
    });
    return Object.assign(api, { calls });
  }

  // The context's read copies are what `more` hands it; none (`never`, so null) fits any product's verbs.
  function contextOf<Copies = never>(
    api: ApiClient,
    shareCodes: string[] = [],
    logs: string[] = [],
    more: Partial<VerbContext<Copies>> = {},
  ): FakeContext<VerbContext<Copies>> {
    const notices: string[] = [];
    const slept: number[] = [];
    const clock = { now: Date.UTC(2026, 9, 5, 8) };
    let ids = 0;
    return {
      log: (line) => void logs.push(line),
      api,
      host,
      useShareCode: (code) => void shareCodes.push(code),
      notice: (line) => void notices.push(line),
      now: () => clock.now,
      newId: () => `new-${++ids}`,
      sleep: async (ms) => {
        slept.push(ms);
        clock.now += ms;
      },
      readInput: async (path) => {
        throw new Error(`no input ${path}`);
      },
      copies: null,
      ...more,
      notices,
      slept,
      clock,
    };
  }

  // A personal library of three files and no teams.
  const library = {
    [`/${product.collection}`]: {
      [product.collection]: [
        { id: DOC_A, name: 'Auth flow', savedAt: Date.UTC(2026, 9, 1), ownerId: 'u' },
        { id: DOC_B, name: 'Auth flow v2', savedAt: Date.UTC(2026, 9, 3), ownerId: 'u' },
        { id: DOC_C, name: 'Shop', savedAt: Date.UTC(2026, 9, 2), ownerId: 'u' },
      ],
    },
    '/teams': { teams: [] },
  } as { [K in `/${C}`]: { [L in C]: ListedFile[] } } & { '/teams': { teams: never[] } };

  const tabsOfA = {
    [`/${product.collection}/${DOC_A}`]: {
      [product.noun]: {
        id: DOC_A,
        name: 'Auth flow',
        tabs: [
          { id: 'tab-two-0000', name: 'Details', orderIndex: 1 },
          { id: 'tab-one-0000', name: 'Overview', orderIndex: 0 },
        ],
      },
    },
  } as { [K in `/${C}/${typeof DOC_A}`]: { [L in N]: TabbedFile } };

  return { fakeApi, contextOf, library, tabsOfA };
}
