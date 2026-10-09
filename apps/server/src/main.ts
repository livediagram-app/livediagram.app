import { serve } from '@hono/node-server';

import type { IncomingMessage } from 'node:http';
import { WebSocketServer } from 'ws';
import { pathToFileURL } from 'node:url';
import { fetchWithRuntime, type Runtime } from '@livediagram/api';
import { createNodeRuntime, resolveMigrationsDir, type NodeRuntime } from './runtime/node';
import type { Duplex } from 'node:stream';
import { applyAuthSchema, createAuth, type Auth } from './auth/better-auth';
import { createStaticSite } from './static';
import type { UpgradeClaims } from './rooms/node-room';
import { NodeSocket } from './rooms/node-socket';

// The app process: the api worker's own handler, mounted on a Node HTTP server
// (docs/specs/016-platform/blueprints/self-hosted-runtime.md, "Delivery").
//
// Nothing here re-implements the application. `fetchWithRuntime` is the worker's
// handler with the runtime resolved, so every route, every gate and every DB call
// is the code the hosted deployment runs. This file supplies the process around
// it: a port, an execution context, a shutdown path.

export type ServerOptions = {
  /** 0 asks the OS for a free port, which tests use. */
  port?: number;
  host?: string;
  databasePath?: string;
  objectsDir?: string;
  vars?: Record<string, string | undefined>;
};

export type StartedServer = {
  url: string;
  port: number;
  /** The base URL Better Auth was configured with. */
  authBaseUrl?: string;
  runtime: Runtime;
  /** The process's rooms, for diagnostics and tests. */
  rooms: NodeRuntime['rooms'];
  /** The identity provider, mounted at /api/auth/*. */
  auth: Auth | null;
  close(): Promise<void>;
};

/**
 * Start the api on a Node HTTP server. Resolves once the port is bound, so a
 * caller (or a test) can send a request straight away.
 */
export async function startServer(options: ServerOptions = {}): Promise<StartedServer> {
  const vars = options.vars ?? process.env;
  const port = options.port ?? Number(vars.PORT ?? 8787);
  const host = options.host ?? vars.HOST ?? '127.0.0.1';

  const app = createNodeRuntime({
    databasePath: options.databasePath ?? vars.DATABASE_PATH ?? 'data/livediagram.sqlite',
    objectsDir: options.objectsDir ?? vars.OBJECTS_DIR ?? 'data/objects',
    migrationsDir: resolveMigrationsDir(import.meta.url, vars),
    vars,
  });

  if (app.migrations.applied.length > 0) {
    console.log(
      `[server] applied ${app.migrations.applied.length} migrations, up to ${app.migrations.applied.at(-1)}`,
    );
  }

  // One execution context for the process: `waitUntil` hands background work to
  // the scheduler, which the shutdown path drains.
  const executionCtx = {
    waitUntil: (promise: Promise<unknown>) => app.scheduler.waitUntil(promise),
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;

  // The identity provider is mounted in front of the api: /api/auth/* is Better
  // Auth's (sign-in, the one-time code, JWKS, /token), everything else is the
  // worker's own routes (docs/specs/016-platform/blueprints/self-hosted-runtime.md,
  // "Identity").
  let auth: Auth | null = null;
  // The built sites are optional: a deployment that only wants the api runs the
  // same image with no STATIC_ROOT, and every non-api path 404s as it did before.
  const staticRoot = vars.STATIC_ROOT;
  const serveStatic = staticRoot ? createStaticSite({ root: staticRoot }) : null;
  const server = serve(
    {
      fetch: async (request) => {
        const path = new URL(request.url).pathname;
        if (path === '/api/auth-methods') {
          return Response.json({ methods: authMethods }, { headers: { 'cache-control': 'no-store' } });
        }
        if (auth && path.startsWith('/api/auth/')) return auth.handler(request);
        const page = await serveStatic?.(request);
        if (page) return page;
        return fetchWithRuntime(request, app.runtime, executionCtx);
      },
      port,
      hostname: host,
    },
    (info) => {
      console.log(`[server] listening on http://${host}:${info.port}`);
    },
  );

  // WebSocket upgrades never reach the request handler, so they are taken here,
  // where the socket still exists, and handed to the api for verification first
  // (docs/specs/016-platform/blueprints/self-hosted-runtime.md, "Node runtime: the
  // rooms").
  const wss = new WebSocketServer({ noServer: true });
  // @hono/node-server registers its own 'upgrade' listener for its optional
  // websocket support. The upgrade is ours, so its listener goes first. (This is
  // correct regardless, and it is NOT the fix for the CLOSING socket traced in
  // realtime.test.ts — see the note there.)
  (server as unknown as { removeAllListeners(event: string): void }).removeAllListeners('upgrade');
  const upgrades = server as unknown as {
    on(
      event: 'upgrade',
      listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void,
    ): void;
  };
  upgrades.on('upgrade', (req, socket, head) => {
    void (async () => {
      const answer = await fetchWithRuntime(upgradeRequest(req), app.runtime, executionCtx);
      if (answer.status !== 200 || !app.rooms) {
        socket.write(
          `HTTP/1.1 ${answer.status} ${answer.statusText}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
        );
        socket.destroy();
        return;
      }
      const body = (await answer.json()) as {
        upgrade?: { documentId: string; claims: UpgradeClaims };
      };
      if (!body.upgrade) {
        socket.destroy();
        return;
      }
      const room = app.rooms.ensure(body.upgrade.documentId);
      await room.ready;
      wss.handleUpgrade(req, socket, head, (client) => {
        const nodeSocket = new NodeSocket(client);
        room.accept(nodeSocket, body.upgrade!.claims);
        client.on('message', (data) => room.message(nodeSocket, String(data)));
        client.on('close', () => room.leave(nodeSocket));
        client.on('error', () => room.failed(nodeSocket));
      });
    })().catch(() => socket.destroy());
  });

  const bound = await new Promise<number>((resolve, reject) => {
    server.once('listening', () => {
      const address = server.address();
      if (address && typeof address === 'object') resolve(address.port);
      else reject(new Error('the server started without a port'));
    });
    server.once('error', reject);
  });

  const url = `http://${host}:${bound}`;
  const configuredBase = vars.BETTER_AUTH_URL ?? url;
  if (!vars.BETTER_AUTH_SECRET) {
    console.warn(
      '[auth] BETTER_AUTH_SECRET is unset: sessions will not survive a restart. Set it to a stable value (openssl rand -base64 32).',
    );
  }
  const authConfig = {
    sql: app.sqlite.sql,
    baseUrl: configuredBase,
    secret: vars.BETTER_AUTH_SECRET ?? randomSecret(),
    ...(vars.AUTH_GOOGLE_CLIENT_ID && vars.AUTH_GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: vars.AUTH_GOOGLE_CLIENT_ID,
            clientSecret: vars.AUTH_GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    // Feishu (Lark): an operator creates a 自建应用 in the open platform, sets the
    // redirect URL to <origin>/api/auth/oauth2/callback/feishu, and fills these in.
    // Off until both are present, like every other provider here.
    ...(process.env.AUTH_FEISHU_APP_ID && process.env.AUTH_FEISHU_APP_SECRET
      ? {
          feishu: {
            clientId: process.env.AUTH_FEISHU_APP_ID,
            clientSecret: process.env.AUTH_FEISHU_APP_SECRET,
          },
        }
      : {}),
  };
  // The tables first: Better Auth checks its schema on every start and refuses to
  // serve without them.
  const createdTables = await applyAuthSchema(authConfig);
  if (createdTables.length > 0) {
    console.log(`[auth] created ${createdTables.join(', ')}`);
  }
  auth = createAuth(authConfig);
  // Which sign-in methods this deployment actually offers. The sign-in page asks, and
  // renders a button per answer — an unconfigured provider must not appear, and the
  // page cannot know that from a build-time flag (measured: NEXT_PUBLIC_* does not reach
  // this app's client bundle at all).
  const authMethods = [
    'email-otp',
    ...(authConfig.feishu ? ['feishu'] : []),
    ...(authConfig.google ? ['google'] : []),
  ];
  // A self-host verifies its OWN tokens unless the operator pointed it at someone
  // else's JWKS: the api reads `identity`, so this is the whole wiring.
  if (!vars.AUTH_JWKS_URL && !vars.CLERK_JWKS_URL) {
    // Over loopback, not over the public origin: the identity provider is in THIS
    // process, so the api can read its own keys directly — and must, because behind a
    // proxy the public origin need not resolve from inside the container (measured: a
    // container published on 8099 could not verify the tokens it had just issued,
    // while the same build run as a plain process could).
    app.runtime.identity = {
      ...app.runtime.identity,
      jwksUrl: `http://127.0.0.1:${bound}/api/auth/jwks`,
    };
  }

  return {
    url,
    port: bound,
    runtime: app.runtime,
    rooms: app.rooms,
    auth,
    close: async () => {
      await new Promise<void>((resolve) => {
        wss.close();
        server.close(() => resolve());
        // Keep-alive sockets would hold the process open otherwise. The adapter's
        // server type is a union that includes the HTTP/2 one, which has no such
        // method, so the call is narrowed rather than assumed.
        (server as { closeAllConnections?: () => void }).closeAllConnections?.();
      });
      await app.close();
    },
  };
}

/**
 * A throwaway signing secret for a deployment that set none. Web Crypto rather
 * than \`node:crypto\`: @cloudflare/workers-types shadows that module's types in
 * this package, and a generated secret has to be generated all the same.
 */
function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * A WebSocket upgrade as the api's routes see it: a Web-standard Request whose
 * \`Upgrade\` header survived. The verification that follows is the worker's own
 * (ticket, share code, owner), so a self-hosted deployment admits exactly who the
 * hosted one does.
 */
function upgradeRequest(req: IncomingMessage): Request {
  const host = req.headers.host ?? 'localhost';
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(name, value);
    else if (Array.isArray(value)) for (const one of value) headers.append(name, one);
  }
  return new Request(new URL(req.url ?? '/', `http://${host}`), {
    method: req.method ?? 'GET',
    headers,
  });
}

// The entry point, and only that: a module imported by a test must not bind a port.
const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  const started = await startServer();
  const shutdown = async (signal: string) => {
    console.log(`[server] ${signal}: draining`);
    await started.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
