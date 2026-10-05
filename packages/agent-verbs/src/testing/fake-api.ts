// A scripted api for the verb suites: routes by path (and query), answering JSON, text, or what a function returns
// for the request (a POST, a refusal, a header); 404 otherwise.

import { createApiClient, type ApiClient } from '@livediagram/api-client';
import type { VerbContext } from '../define';

const isText = (a: unknown): a is { text: string } =>
  typeof a === 'object' && a !== null && 'text' in a && Object.keys(a).length === 1;

export function fakeApi(routes: Record<string, unknown>): ApiClient & { calls: string[] } {
  const calls: string[] = [];
  const api = createApiClient({
    baseUrl: 'https://livediagram.app/api',
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

export type FakeContext = VerbContext & {
  notices: string[];
  slept: number[];
  clock: { now: number };
};

export function contextOf(
  api: ApiClient,
  shareCodes: string[] = [],
  logs: string[] = [],
  more: Partial<VerbContext> = {},
): FakeContext {
  const notices: string[] = [];
  const slept: number[] = [];
  const clock = { now: Date.UTC(2026, 9, 5, 8) };
  return {
    log: (line) => void logs.push(line),
    api,
    host: 'https://livediagram.app',
    useShareCode: (code) => void shareCodes.push(code),
    notice: (line) => void notices.push(line),
    now: () => clock.now,
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

export const DOC_A = 'aaaa1111-0000-4000-8000-000000000001';
export const DOC_B = 'aaaa2222-0000-4000-8000-000000000002';
export const DOC_C = 'bbbb0000-0000-4000-8000-000000000003';

// A personal library of three documents and no teams.
export const library = {
  '/documents': {
    documents: [
      { id: DOC_A, name: 'Auth flow', savedAt: Date.UTC(2026, 9, 1), ownerId: 'u' },
      { id: DOC_B, name: 'Auth flow v2', savedAt: Date.UTC(2026, 9, 3), ownerId: 'u' },
      { id: DOC_C, name: 'Shop', savedAt: Date.UTC(2026, 9, 2), ownerId: 'u' },
    ],
  },
  '/teams': { teams: [] },
};

export const tabsOfA = {
  [`/documents/${DOC_A}`]: {
    document: {
      id: DOC_A,
      name: 'Auth flow',
      tabs: [
        { id: 'tab-two-0000', name: 'Details', orderIndex: 1 },
        { id: 'tab-one-0000', name: 'Overview', orderIndex: 0 },
      ],
    },
  },
};
