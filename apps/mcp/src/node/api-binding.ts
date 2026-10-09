// The service binding to the api worker, replaced by an HTTP call
// (docs/specs/016-platform/self-hosted-runtime.md, "MCP process").
//
// Application code addresses the api by a fixed internal host — `https://livediagram-api/api`
// in api.ts — because a service binding routes on the path and ignores the host.
// A self-hosted deployment has no binding, so the same request goes to the app
// process's own origin instead (`http://app:8787` in Compose), with the path and
// every header preserved: the caller's `Authorization: Bearer lvd_…` token is the
// whole authorization, and the api applies exactly the checks it applies to any
// other caller.

import type { Env } from '../env';

/** Node's fetch streams a request body only when told the stream is half-duplex. */
type StreamingInit = RequestInit & { duplex: 'half' };

export function apiOverHttp(origin: string): Env['API'] {
  const base = origin.replace(/\/+$/, '');
  return {
    async fetch(input: Parameters<Env['API']['fetch']>[0], init?: RequestInit) {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      const target = new URL(`${url.pathname}${url.search}`, base);

      const headers = new Headers(request.headers);
      // Both are recomputed for the new connection, and Node refuses a request
      // that carries them.
      headers.delete('host');
      headers.delete('content-length');

      const outbound: StreamingInit = {
        method: request.method,
        headers,
        body: request.body,
        // The api's own redirects are part of its contract; follow none of them here.
        redirect: 'manual',
        duplex: 'half',
      };
      return fetch(target, outbound);
    },
  } as unknown as Env['API'];
}
