// The real liveworkspace media service (liveworkspace/docs/media.md) for tests, in this process: its Worker over
// an in-memory database and bucket, answering this api's calls to it through a stubbed `fetch`. So a test of an
// upload, a byte read or the reference sync runs both sides for real. Not a `.test.ts` file, so vitest doesn't
// collect it.

import worker from '@liveworkspace/media-service';
import { testDb, type TestDb } from '@liveworkspace/media-service/testing';
import { vi } from 'vitest';
import type { Env } from './types';

const URL_BASE = 'https://media.test/api/media';
const KEY = 'ldoc-media-key';

export type TestMediaService = TestDb & {
  // Every call this api made to the service, by method and path.
  calls: string[];
};

// Points `env` at a fresh service and routes its calls there. Undo with vi.unstubAllGlobals(). `passOn`: any other
// call goes to the fetch stubbed before this one (stubAccounts, say) instead of failing the test.
export function mediaServiceFor(env: Env, opts: { passOn?: boolean } = {}): TestMediaService {
  const before = globalThis.fetch;
  const service = testDb({ MEDIA_KEY_LIVEDOCUMENTS: KEY });
  const calls: string[] = [];
  env.MEDIA_URL = URL_BASE;
  env.MEDIA_KEY = KEY;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    if (!request.url.startsWith(URL_BASE)) {
      if (opts.passOn) return before(input, init);
      throw new Error(`unexpected fetch ${request.url}`);
    }
    calls.push(
      `${request.method} ${new URL(request.url).pathname.slice(URL_BASE.length - 'https://media.test'.length)}`,
    );
    return worker.fetch(request, service.env);
  });
  return { ...service, calls };
}
