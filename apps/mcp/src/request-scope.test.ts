import { describe, expect, it, vi } from 'vitest';
import { postTelemetry, reportApiFailure } from './api';
import type { Env } from './env';
import { runInRequest } from './request-scope';

// A telemetry post the runtime can cancel with the response is a post that may
// never land (spec/22 Mcp). Inside a request, every post, the tool's
// `Mcp·Used` and an `Error·Api` failure report alike, must be handed to the
// request's waitUntil.

function stubEnv() {
  return {
    API: { fetch: vi.fn(async () => new Response(null, { status: 204 })) },
  } as unknown as Env;
}

describe('telemetry posts outlive the response', () => {
  it('hands the Mcp·Used post to the request waitUntil', async () => {
    const env = stubEnv();
    const waitUntil = vi.fn();
    await runInRequest(waitUntil, async () => {
      await Promise.resolve();
      postTelemetry(env, 'Mcp', 'Used', 'ListTemplates');
    });
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(waitUntil.mock.calls[0]![0]).toBeInstanceOf(Promise);
  });

  it('hands an api failure report to it too', () => {
    const env = stubEnv();
    const waitUntil = vi.fn();
    runInRequest(waitUntil, () => reportApiFailure(env, 'Http503'));
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('still posts, unwatched, outside a request', () => {
    const env = stubEnv();
    postTelemetry(env, 'Mcp', 'Used', 'ListTemplates');
    runInRequest(null, () => postTelemetry(env, 'Mcp', 'Used', 'FindDiagrams'));
    expect(env.API.fetch).toHaveBeenCalledTimes(2);
  });

  it('never throws into the tool when the binding throws synchronously', () => {
    const env = {
      API: {
        fetch: () => {
          throw new Error('binding gone');
        },
      },
    } as unknown as Env;
    expect(() => runInRequest(vi.fn(), () => postTelemetry(env, 'Mcp', 'Used', 'X'))).not.toThrow();
  });
});
