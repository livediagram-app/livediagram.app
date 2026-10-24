import { afterEach, describe, expect, it, vi } from 'vitest';
import { postTelemetry, reportApiFailure } from './api';
import type { Env } from './env';
import { runInRequest } from '@liveworkspace/mcp-kit/request-scope';

// A telemetry post the runtime can cancel with the response is a post that may
// never land (docs/specs/017-telemetry/telemetry.md Mcp). Inside a request, every post, the tool's
// `Mcp·Used` and an `Error·Api` failure report alike, must be handed to the
// request's waitUntil.

// The posts go to the central service over plain fetch, so that is what is stubbed.
function stubEnv() {
  const fetch = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetch);
  return { env: { API: { fetch }, TELEMETRY_KEY: 'k' } as unknown as Env, fetch };
}

afterEach(() => vi.unstubAllGlobals());

describe('telemetry posts outlive the response', () => {
  it('hands the Mcp·Used post to the request waitUntil', async () => {
    const { env } = stubEnv();
    const waitUntil = vi.fn();
    await runInRequest(waitUntil, async () => {
      await Promise.resolve();
      postTelemetry(env, 'Mcp', 'Used', 'ListTemplates');
    });
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(waitUntil.mock.calls[0]![0]).toBeInstanceOf(Promise);
  });

  it('hands an api failure report to it too', () => {
    const { env } = stubEnv();
    const waitUntil = vi.fn();
    runInRequest(waitUntil, () => reportApiFailure(env, 'Http503'));
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('still posts, unwatched, outside a request', () => {
    const { env, fetch } = stubEnv();
    postTelemetry(env, 'Mcp', 'Used', 'ListTemplates');
    runInRequest(null, () => postTelemetry(env, 'Mcp', 'Used', 'FindDocuments'));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('never throws into the tool when fetch throws synchronously', () => {
    vi.stubGlobal('fetch', () => {
      throw new Error('fetch gone');
    });
    const env = { API: {}, TELEMETRY_KEY: 'k' } as unknown as Env;
    expect(() => runInRequest(vi.fn(), () => postTelemetry(env, 'Mcp', 'Used', 'X'))).not.toThrow();
  });
});
