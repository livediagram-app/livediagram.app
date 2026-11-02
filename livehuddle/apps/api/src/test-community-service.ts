// The real liveworkspace Community service (liveworkspace/docs/specs/007-community/community.md) for tests, in this process: its Worker
// over an in-memory database with its migrations applied, answering this api's calls to it through a stubbed
// `fetch`. So a test of publishing, the sync or a community link runs both sides for real. Not a `.test.ts` file,
// so vitest doesn't collect it.

import { COMMUNITY_APP_PARAM } from '@livehuddle/api-schema';
import worker from '@liveworkspace/community-service';
import { testDb, type TestDb } from '@liveworkspace/community-service/testing';
import { vi } from 'vitest';
import { COMMUNITY_APP } from './community-service';
import type { Env } from './types';

const URL_BASE = 'https://community.test/api/community';
const KEY = 'ld-key';
const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

export type TestCommunityService = TestDb & {
  // A public read, as a page asks for it: `path` under the API, for this app.
  read: (path: string, init?: RequestInit) => Promise<Response>;
};

// Points `env` at a fresh service and routes its calls there. Undo with vi.unstubAllGlobals().
export function communityServiceFor(env: Env): TestCommunityService {
  const service = testDb({ COMMUNITY_KEY_LIVEDIAGRAM: KEY });
  env.COMMUNITY_URL = URL_BASE;
  env.COMMUNITY_KEY = KEY;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    if (!request.url.startsWith(URL_BASE)) throw new Error(`unexpected fetch ${request.url}`);
    return worker.fetch(request, service.env, ctx);
  });
  return {
    ...service,
    read: (path, init) => {
      const url = new URL(`${URL_BASE}${path}`);
      url.searchParams.set(COMMUNITY_APP_PARAM, COMMUNITY_APP);
      return worker.fetch(new Request(url, init), service.env, ctx);
    },
  };
}
