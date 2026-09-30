// Support for the Google Drive mirror e2e (docs/specs/022-drive-mirror/blueprints/drive-mirror.md,
// "Testing"): a throwaway RSA key and JWKS the api worker verifies sessions
// against (CLERK_JWKS_URL, set by scripts/e2e-stack.mjs under E2E_DRIVE=1),
// the fake Google served over HTTP for the worker's OAuth calls, and the
// browser's Google traffic routed into the same fake.

import { generateKeyPairSync, randomUUID, sign, type KeyObject } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { Page, Route } from '@playwright/test';
import { FakeGoogle } from '@livediagram/fake-google';
import { serveFakeGoogle } from '@livediagram/fake-google/server';

// The same defaults scripts/e2e-stack.mjs gives the api worker.
export const JWKS_PORT = Number(process.env.E2E_DRIVE_JWKS_PORT ?? 8795);
export const GOOGLE_PORT = Number(process.env.E2E_DRIVE_GOOGLE_PORT ?? 8796);
const KID = 'e2e-drive';

const b64url = (data: Buffer | string) => Buffer.from(data).toString('base64url');

export class TestIdentity {
  private readonly privateKey: KeyObject;
  readonly jwk: Record<string, unknown>;

  constructor() {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    this.privateKey = privateKey;
    this.jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' };
  }

  // A session JWT shaped like Clerk's: RS256, `sub`, `sid`, an hour to live.
  token(userId: string, email: string): string {
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: 'RS256', kid: KID, typ: 'JWT' }));
    const payload = b64url(
      JSON.stringify({
        sub: userId,
        sid: `sess_${randomUUID()}`,
        email,
        iat: now,
        nbf: now - 5,
        exp: now + 3600,
      }),
    );
    const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), this.privateKey);
    return `${header}.${payload}.${b64url(signature)}`;
  }

  serve(): Promise<Server> {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ keys: [this.jwk] }));
    });
    return new Promise((resolve) => server.listen(JWKS_PORT, '127.0.0.1', () => resolve(server)));
  }
}

export async function startFakeGoogle(): Promise<{ fake: FakeGoogle; server: Server }> {
  const fake = new FakeGoogle();
  return { fake, server: await serveFakeGoogle(fake, GOOGLE_PORT) };
}

async function fulfilFromFake(fake: FakeGoogle, route: Route): Promise<void> {
  const req = route.request();
  const body = req.postDataBuffer();
  const response = await fake.handle(
    new Request(req.url(), {
      method: req.method(),
      headers: req.headers(),
      body: body && req.method() !== 'GET' ? new Uint8Array(body) : undefined,
    }),
  );
  await route.fulfill({
    status: response.status,
    headers: Object.fromEntries(response.headers),
    body: Buffer.from(await response.arrayBuffer()),
  });
}

// A fake Google Picker: picks whatever folder the test names in
// `window.__e2ePickFolder`, straight away.
const FAKE_PICKER = `
window.gapi = { load: (_lib, cb) => cb() };
window.google = window.google || {};
window.google.picker = {
  ViewId: { FOLDERS: 'folders' },
  Action: { PICKED: 'picked', CANCEL: 'cancel' },
  DocsView: class { setSelectFolderEnabled() { return this; } setIncludeFolders() { return this; } setMimeTypes() { return this; } setParent() { return this; } },
  PickerBuilder: class {
    addView() { return this; } setOAuthToken() { return this; } setDeveloperKey() { return this; }
    setAppId() { return this; } setTitle() { return this; }
    setCallback(cb) { this.cb = cb; return this; }
    build() { const cb = this.cb; return { setVisible: () => setTimeout(() => cb({ action: 'picked', docs: [{ id: window.__e2ePickFolder }] }), 0) }; }
  },
};`;

// Every Google request the browser makes, answered by the fake: the Drive
// REST API, the consent screen (the user agrees at once), and the Picker.
export async function routeGoogle(page: Page, fake: FakeGoogle, user: string): Promise<void> {
  // Hermetic: the page's Google Fonts stylesheet would otherwise hold the load
  // event on the real network (a slow or failing DNS lookup timed a goto out).
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' }),
  );
  await page.route('https://www.googleapis.com/**', (route) => fulfilFromFake(fake, route));
  await page.route('https://accounts.google.com/o/oauth2/v2/auth**', async (route) => {
    const url = new URL(route.request().url());
    const back = new URL(url.searchParams.get('redirect_uri')!);
    back.searchParams.set('code', fake.consent(user));
    back.searchParams.set('state', url.searchParams.get('state')!);
    await route.fulfill({ status: 302, headers: { Location: back.toString() } });
  });
  await page.route('https://apis.google.com/js/api.js', (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_PICKER }),
  );
}
