// Support for the workbench embed e2e (docs/specs/013-workspace/blueprints/workbench-embeds.md,
// "Testing"): the fake workbench served from its own loopback origin, the signed-in person the e2e
// stack mints (E2E_WORKBENCH=1 makes it act as Clerk), and the api calls the CLI would make.

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { APIRequestContext, BrowserContext, Page } from '@playwright/test';

const FAKE_WORKBENCH_HTML = readFileSync(
  new URL('./fixtures/fake-workbench.html', import.meta.url),
  'utf8',
);
const E2E_SESSION_KEY = 'livediagram:e2e:session';

export type FakeWorkbench = {
  origin: string;
  // The fake workbench's address, framing `frameUrl`.
  urlFor: (frameUrl: string, opts?: { silent?: boolean }) => string;
  close: () => Promise<void>;
};

// Serves the fake workbench on 127.0.0.1 at a free port: another origin than the live app's localhost. It frames
// only the live origin's workbench page.
export async function serveFakeWorkbench(liveOrigin: string): Promise<FakeWorkbench> {
  const html = FAKE_WORKBENCH_HTML.replaceAll('__LIVE_ORIGIN__', liveOrigin);
  const server: Server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    origin,
    urlFor: (frameUrl, opts = {}) =>
      `${origin}/?frame=${encodeURIComponent(frameUrl)}${opts.silent ? '&silent=1' : ''}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

export type Person = { userId: string; jwt: string; name: string };

// A signed-in person: a session token the stack mints and the api verifies.
export async function newPerson(request: APIRequestContext, name: string): Promise<Person> {
  const userId = `user_wb${randomUUID().replaceAll('-', '')}`;
  const res = await request.get(`/e2e/token?sub=${userId}`);
  if (!res.ok()) throw new Error(`minting a session token failed: ${res.status()}`);
  return { userId, jwt: await res.text(), name };
}

// Signs the person in on the live origin through the test-only auth bridge (E2EAuthBridge).
export async function signIn(context: BrowserContext, person: Person, liveOrigin: string) {
  await context.addInitScript(
    ([key, origin, session]) => {
      if (location.origin === origin) localStorage.setItem(key, session);
    },
    [
      E2E_SESSION_KEY,
      liveOrigin,
      JSON.stringify({
        token: person.jwt,
        userId: person.userId,
        email: `${person.userId}@example.test`,
        firstName: person.name,
      }),
    ] as const,
  );
}

async function call(
  request: APIRequestContext,
  method: string,
  path: string,
  bearer: string,
  body?: unknown,
) {
  return request.fetch(`/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${bearer}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { data: JSON.stringify(body) }),
  });
}

export async function apiJson<T>(
  request: APIRequestContext,
  method: string,
  path: string,
  bearer: string,
  body?: unknown,
): Promise<{ status: number; body: T }> {
  const res = await call(request, method, path, bearer, body);
  const text = await res.text();
  return { status: res.status(), body: (text ? JSON.parse(text) : null) as T };
}

export type Seeded = { documentId: string; tabId: string; token: string };

// A document of the person's with one labelled square, and an API token, as the CLI holds.
export async function seedDocumentAndToken(
  request: APIRequestContext,
  person: Person,
): Promise<Seeded> {
  const documentId = `wb-doc-${Date.now()}`;
  const tabId = `wb-tab-${Date.now()}`;
  const created = await apiJson(request, 'POST', '/documents', person.jwt, {
    id: documentId,
    name: 'Home screen',
    tabs: [
      {
        id: tabId,
        name: 'Wireframe',
        elements: [
          {
            id: 'el-play',
            type: 'shape',
            shape: 'square',
            x: 200,
            y: 200,
            width: 140,
            height: 80,
            label: 'Play',
          },
        ],
      },
    ],
  });
  if (created.status >= 300) throw new Error(`creating the document failed: ${created.status}`);
  const token = await apiJson<{ token: string }>(request, 'POST', '/tokens', person.jwt, {
    name: 'livediagram CLI',
  });
  if (token.status >= 300) throw new Error(`creating the token failed: ${token.status}`);
  return { documentId, tabId, token: token.body.token };
}

// `livediagram workbench open`: POST /api/workbench/tickets with the token.
export function mintTicket(
  request: APIRequestContext,
  seeded: Seeded,
  origin: string,
): Promise<{ status: number; body: { url?: string; pairingUrl?: string } }> {
  return apiJson(request, 'POST', '/workbench/tickets', seeded.token, {
    documentId: seeded.documentId,
    origin,
  });
}

export function ticketOf(url: string): string {
  return new URL(url).hash.replace('#ticket=', '');
}

// The fake workbench's record of what the frame sent.
export function received(page: Page): Promise<{ type: string; [k: string]: unknown }[]> {
  return page.evaluate(() => (window as unknown as { received: never[] }).received);
}
