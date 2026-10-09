// The MCP process: the same Hono app the Worker runs, on a Node HTTP server
// (docs/specs/016-platform/self-hosted-runtime.md, "MCP process").
//
// Nothing here re-implements the MCP. `app` is the whole application — the
// Streamable-HTTP transport, the tools and the OAuth authorization server — and
// this file supplies the process around it: a port, the two bindings a Worker
// used to provide (`API`, `OAUTH_KV`), and a shutdown path.

import { serve } from '@hono/node-server';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Env } from '../env';
import app from '../index';
import { apiOverHttp } from './api-binding';
import { openKv } from './kv-sqlite';

export type McpServerOptions = {
  /** 0 asks the OS for a free port, which tests use. */
  port?: number;
  host?: string;
  /** The MCP's own SQLite file: OAuth state, and nothing else. */
  databasePath?: string;
  /** The app process, as this process reaches it. */
  apiOrigin?: string;
  consentBaseUrl?: string;
  internalEventsKey?: string;
  vars?: Record<string, string | undefined>;
};

export type StartedMcpServer = {
  url: string;
  port: number;
  close(): Promise<void>;
};

/** How often rows nobody will read again (rate-limit counters) are swept. */
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Start the MCP on a Node HTTP server. Resolves once the port is bound, so a
 * caller (or a test) can send a request straight away.
 */
export async function startMcpServer(options: McpServerOptions = {}): Promise<StartedMcpServer> {
  const vars = options.vars ?? process.env;
  const port = options.port ?? Number(vars.PORT ?? 8788);
  const host = options.host ?? vars.HOST ?? '127.0.0.1';
  const databasePath = options.databasePath ?? vars.MCP_DATABASE_PATH ?? 'data/mcp.sqlite';
  const apiOrigin = options.apiOrigin ?? vars.MCP_API_ORIGIN ?? 'http://127.0.0.1:8787';
  const consentBaseUrl = options.consentBaseUrl ?? vars.CONSENT_BASE_URL;
  const internalEventsKey = options.internalEventsKey ?? vars.INTERNAL_EVENTS_KEY;

  mkdirSync(dirname(databasePath), { recursive: true });
  const kv = openKv(databasePath);

  const env: Env = {
    API: apiOverHttp(apiOrigin),
    OAUTH_KV: kv.binding,
    ...(consentBaseUrl ? { CONSENT_BASE_URL: consentBaseUrl } : {}),
    ...(internalEventsKey ? { INTERNAL_EVENTS_KEY: internalEventsKey } : {}),
  };

  // One execution context for the process. `waitUntil` is what keeps a telemetry
  // post alive past its response (request-scope.ts) — in Node nothing cancels it,
  // but the shutdown path still waits for whatever is in flight.
  const pending = new Set<Promise<unknown>>();
  const executionCtx = {
    waitUntil: (promise: Promise<unknown>) => {
      pending.add(promise);
      void promise.catch(() => {}).finally(() => pending.delete(promise));
    },
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;

  const listener = serve(
    { fetch: (request) => app.fetch(request, env, executionCtx), port, hostname: host },
    (info) => console.log(`[mcp] listening on http://${host}:${info.port}`),
  );

  const bound = await new Promise<number>((resolve, reject) => {
    listener.once('listening', () => {
      const address = listener.address();
      if (address && typeof address === 'object') resolve(address.port);
      else reject(new Error('the MCP server started without a port'));
    });
    listener.once('error', reject);
  });

  const sweeper = setInterval(() => kv.sweep(), SWEEP_INTERVAL_MS);
  // The timer must not hold the process open on its own.
  sweeper.unref();

  return {
    url: `http://${host}:${bound}`,
    port: bound,
    close: async () => {
      clearInterval(sweeper);
      await new Promise<void>((resolve) => {
        listener.close(() => resolve());
        // Keep-alive sockets would hold the process open otherwise. The adapter's
        // server type is a union that includes the HTTP/2 one, which has no such
        // method, so the call is narrowed rather than assumed.
        (listener as { closeAllConnections?: () => void }).closeAllConnections?.();
      });
      await Promise.allSettled([...pending]);
      kv.close();
    },
  };
}

// The entry point, and only that: a module imported by a test must not bind a port.
const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  const started = await startMcpServer();
  const shutdown = async (signal: string) => {
    console.log(`[mcp] ${signal}: draining`);
    await started.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
