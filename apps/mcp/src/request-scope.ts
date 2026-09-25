// The running request's `waitUntil` (spec/22 Mcp, spec/62 §4.12), so a
// fire-and-forget telemetry post outlives the response.
//
// The MCP transport returns its JSON response as soon as the tool resolves,
// and the Workers runtime may cancel any subrequest still in flight once the
// response is sent unless it was handed to `ctx.waitUntil`. postTelemetry
// never awaited its post, so an event could be dropped at exactly that
// moment, with nothing anywhere to notice (production once showed no
// `Mcp·Used·ListTemplates` in 60 days, the tool every client is told to call
// first). The post sits several calls below the Hono handler (tools, apiJson,
// the team-library sweep), so, like tool-scope.ts, the context rides in
// AsyncLocalStorage rather than being threaded through every helper.
import { AsyncLocalStorage } from 'node:async_hooks';

type WaitUntil = (promise: Promise<unknown>) => void;

const scope = new AsyncLocalStorage<WaitUntil>();

/** Run `fn` (the MCP transport's request handling) with the request's waitUntil. */
export function runInRequest<T>(waitUntil: WaitUntil | null, fn: () => T): T {
  return waitUntil ? scope.run(waitUntil, fn) : fn();
}

/**
 * Keep `promise` alive past the response when a request is running; outside
 * one (tests, a call with no execution context) it just runs unwatched.
 */
export function keepAlive(promise: Promise<unknown>): void {
  scope.getStore()?.(promise);
}
