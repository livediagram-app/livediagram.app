import type { Server } from 'node:http';
import type { FakeGoogle } from '@livediagram/fake-google';
import { DRIVE_FILE_MIME } from '@livediagram/api-schema';
import { test, expect, expectNoPageErrors } from './fixtures';
import { routeGoogle, startFakeGoogle, TestIdentity } from './drive-support';

// The Google Drive mirror end to end (docs/specs/022-drive-mirror/drive-mirror.md):
// the real build and api worker, a signed-in session from the test's own
// JWKS, and the fake Google standing in for accounts.google.com and the Drive
// API. Opt-in: `pnpm --filter @livediagram/live test:e2e:drive`.

test.describe.configure({ mode: 'serial' });

// Fresh per run: the local D1 keeps what earlier runs made.
const RUN = crypto.randomUUID().slice(0, 6);
const USER = `user_e2e_drive_${RUN}`;
const FOLDER = `e2e-folder-${RUN}`;
const PLAN = `e2e-plan-${RUN}`;
const NOTES = `e2e-notes-${RUN}`;
const EMAIL = 'drive-e2e@example.com';
const apiBase = '/api';
// The e2e runs on a loopback host, which names the root like staging
// (docs/specs/022-drive-mirror/drive-mirror.md, "The root folder's name").
const ROOT_NAME = 'livediagram (staging)';
const SHOTS = process.env.E2E_DRIVE_SHOTS ?? '/tmp/livediagram-drive-e2e';

let identity: TestIdentity;
let jwks: Server;
let google: { fake: FakeGoogle; server: Server };
let token: string;

test.beforeAll(async () => {
  identity = new TestIdentity();
  jwks = await identity.serve();
  google = await startFakeGoogle();
  token = identity.token(USER, EMAIL);
});

test.afterAll(async () => {
  await new Promise((r) => jwks.close(r));
  await new Promise((r) => google.server.close(r));
});

async function api(
  page: import('@playwright/test').Page,
  method: string,
  path: string,
  data?: unknown,
  bearer = token,
) {
  const res = await page.request.fetch(`${apiBase}${path}`, {
    method,
    headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    ...(data ? { data } : {}),
  });
  expect(res.ok(), `${method} ${path} ${res.status()}`).toBe(true);
  return res.status() === 204 ? null : ((await res.json()) as Record<string, unknown>);
}

async function signIn(page: import('@playwright/test').Page, user = USER) {
  await page.addInitScript(
    (session: string) => localStorage.setItem('livediagram:e2e:session', session),
    JSON.stringify({
      token: user === USER ? token : identity.token(user, EMAIL),
      userId: user,
      email: EMAIL,
      firstName: 'Drive',
    }),
  );
  await routeGoogle(page, google.fake, user);
}

// Settings > Account > Cloud Sync (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting"):
// through the account menu's Account item. The avatar carries no Drive state.
async function openCloudSync(page: import('@playwright/test').Page) {
  await expect(page.getByRole('button', { name: /Google Drive/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Account menu' }).click();
  // The account menu has no Drive entry; Settings does.
  await expect(page.getByRole('menuitem', { name: /Google Drive/ })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Account' }).click();
  const row = page.locator('[data-cloud-sync="googleDrive"]');
  await expect(row).toBeVisible();
  return row;
}

async function closeSettings(page: import('@playwright/test').Page) {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0);
}

// The visible wording of the state pill (StableLabel keeps every wording laid out).
const pillOf = (panel: import('@playwright/test').Locator) =>
  panel.locator('[data-drive-status] [data-stable-option]:not(.invisible)');

// A sync pass now, the way another tab asks for one: syncing is automatic and
// the row has no Sync now, so the test uses the app's tab channel.
async function syncNow(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const channel = new BroadcastChannel('livediagram:drive-mirror');
    channel.postMessage({ type: 'sync-now' });
    channel.close();
  });
}

// The second line, only while there is a problem.
const problemOf = (panel: import('@playwright/test').Locator) =>
  panel.locator('[data-drive-problem]');

// The row's shape: its width, and where the status and the button sit in its
// one row. It holds within each phase (docs/specs/022-drive-mirror/drive-mirror.md,
// "Nothing moves within a phase"); the problem line below may come and go. A
// part a phase does not have is null.
type Loc = import('@playwright/test').Locator;
async function shapeOf(panel: Loc) {
  const card = (await panel.boundingBox())!;
  const rel = async (selector: string) => {
    const l = panel.locator(selector);
    if ((await l.count()) === 0) return null;
    const b = (await l.boundingBox())!;
    return { x: b.x - card.x, y: b.y - card.y, width: b.width, height: b.height };
  };
  return {
    width: card.width,
    row: await rel(':scope > div:first-child'),
    status: await rel('[data-drive-status]'),
    actions: await rel('[data-drive-actions]'),
    primary: await rel('[data-drive-primary]'),
    disconnect: await rel('[data-drive-disconnect]'),
  };
}
const phaseShapes = new Map<string, Awaited<ReturnType<typeof shapeOf>>>();

// The first shape seen in a phase is the one every later state of it keeps.
async function expectStable(panel: Loc) {
  const phase = (await panel.getAttribute('data-drive-phase'))!;
  const shape = await shapeOf(panel);
  const first = phaseShapes.get(phase);
  if (first) expect(shape, phase).toEqual(first);
  else phaseShapes.set(phase, shape);
  await expectNoOverlap(panel);
}

// No button covers the label, the status or the problem's words, another
// button, or leaves the card.
async function expectNoOverlap(panel: Loc) {
  const overlaps = await panel.evaluate((card) => {
    const buttons = [...card.querySelectorAll('button')].map((e) => e.getBoundingClientRect());
    const words = [
      card.querySelector(':scope > div:first-child > span:first-child'),
      card.querySelector('[data-drive-status] [data-stable-option]:not(.invisible)'),
      card.querySelector('[data-drive-problem] p'),
    ]
      .filter((e): e is Element => !!e)
      .map((e) => e.getBoundingClientRect());
    const hit = (p: DOMRect, q: DOMRect) =>
      p.left < q.right - 0.5 &&
      q.left < p.right - 0.5 &&
      p.top < q.bottom - 0.5 &&
      q.top < p.bottom - 0.5;
    const c = card.getBoundingClientRect();
    const out: string[] = [];
    buttons.forEach((p, i) => {
      if (words.some((q) => hit(p, q))) out.push(`button ${i} covers words`);
      if (buttons.slice(i + 1).some((q) => hit(p, q))) out.push(`button ${i} covers a button`);
      if (p.left < c.left - 0.5 || p.right > c.right + 0.5) out.push(`button ${i} leaves the card`);
    });
    return out;
  });
  expect(overlaps).toEqual([]);
}

// Holds matching requests back for `ms`, then lets the usual handler answer.
async function slow(page: import('@playwright/test').Page, url: string, ms: number) {
  const handler = async (route: import('@playwright/test').Route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.fallback();
  };
  await page.route(url, handler);
  return () => page.unroute(url, handler);
}

// Waits out the Settings dialog's entrance, so boxes are measured at rest.
async function settled(page: import('@playwright/test').Page) {
  await page.getByRole('dialog', { name: 'Settings' }).evaluate((el) =>
    // A cancelled animation rejects its promise; it has settled all the same.
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => null))),
  );
  // And the section's smooth scroll into view.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const pane = document.querySelector('[data-settings-pane]')!;
          const before = pane.scrollTop;
          await new Promise((r) => setTimeout(r, 150));
          return pane.scrollTop === before;
        }),
      { timeout: 5000 },
    )
    .toBe(true);
}

const fileNamed = (name: string) => google.fake.appFiles(USER).find((f) => f.name === name);

test('connect, first mirror, then changes in Drive come back', async ({ page, pageErrors }) => {
  await signIn(page);
  await api(page, 'POST', '/folders', { id: FOLDER, name: 'Work', parentId: null });
  await api(page, 'POST', '/documents', {
    id: PLAN,
    name: 'Quarterly plan',
    // Content, so the document has an SVG snapshot for the Drive thumbnail.
    tabs: [
      {
        id: `e2e-tab-1-${RUN}`,
        name: 'Tab 1',
        elements: [
          {
            id: 's1',
            type: 'shape',
            shape: 'square',
            x: 100,
            y: 100,
            width: 160,
            height: 90,
            label: 'Plan',
          },
          {
            id: 's2',
            type: 'shape',
            shape: 'square',
            x: 360,
            y: 100,
            width: 160,
            height: 90,
            label: 'Ship',
          },
        ],
      },
    ],
  });
  await api(page, 'PUT', `/documents/${PLAN}/folder`, { folderId: FOLDER });
  await api(page, 'POST', '/documents', {
    id: NOTES,
    name: 'Meeting notes',
    tabs: [{ id: `e2e-tab-2-${RUN}`, name: 'Tab 1', elements: [] }],
  });

  await page.goto('/explorer/recent');
  let panel = await openCloudSync(page);
  await expect(pillOf(panel)).toHaveText('Not connected');
  await expect(problemOf(panel)).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/01-connect.png` });
  await settled(page);
  await expectStable(panel);

  // A Connect that cannot start says so, back at Not connected, and moves nothing.
  await page.route('**/api/drive/state', (route) => route.abort(), { times: 1 });
  await panel.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(problemOf(panel)).toHaveText(
    "Couldn't reach Google. Check your connection and try again.",
  );
  await expect(pillOf(panel)).toHaveText('Not connected');
  await expectStable(panel);

  // Connecting shows at once, and holds while the state is fetched and the
  // page leaves for Google.
  await slow(page, '**/api/drive/state', 1500);
  await panel.getByRole('button', { name: 'Connect', exact: true }).click();
  // Said once, in the status; the button keeps its word and is held.
  await expect(pillOf(panel)).toHaveText('Connecting…', { timeout: 300 });
  await expect(panel.getByRole('button', { name: 'Connect', exact: true })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await expectStable(panel);

  // Google's consent (the fake agrees), /drive/connected, back where the user
  // started: the Explorer with Cloud Sync open, copying (uploads held back so
  // the first copy can be seen) in the same shape.
  const releaseUploads = await slow(page, 'https://www.googleapis.com/upload/**', 800);
  await page.waitForURL(/\/explorer\/recent\?settings=account&section=cloud-sync/);
  panel = page.locator('[data-cloud-sync="googleDrive"]');
  await expect(pillOf(panel)).toHaveText(/^Copying \d+ of \d+…$/, { timeout: 15_000 });
  await settled(page);
  await expectStable(panel);
  await releaseUploads();
  await expect(pillOf(panel)).toHaveText(/^Last synced /, { timeout: 20_000 });
  await closeSettings(page);
  await expect.poll(() => fileNamed(ROOT_NAME)?.appProperties.ldRoot).toBeTruthy();
  await expect
    .poll(() => fileNamed('Quarterly plan.livediagram')?.parents[0])
    .toBe(fileNamed('Work')?.id);
  // The first mirror uploads one file at a time, oldest first.
  await expect.poll(() => fileNamed('Meeting notes.livediagram')?.mimeType).toBe(DRIVE_FILE_MIME);
  expect(fileNamed('Meeting notes.livediagram')).toMatchObject({
    mimeType: DRIVE_FILE_MIME,
    trashed: false,
  });
  expect(fileNamed('Quarterly plan.livediagram')?.thumbnail).toMatchObject({
    mimeType: 'image/png',
  });

  // Sync status lives in Cloud Sync only.
  panel = await openCloudSync(page);
  // Connected: the description under the card says where, and no problem line.
  await expect(
    page.getByText(`Your documents are synced to “${ROOT_NAME}” in Google Drive.`),
  ).toBeVisible();
  await expect(problemOf(panel)).toHaveCount(0);
  await expect(pillOf(panel)).toHaveText(/^Last synced (just now|\d+ \w+ ago)$/);
  await settled(page);
  await expectStable(panel);
  await page.screenshot({ path: `${SHOTS}/02-connected.png` });

  // Synced to Syncing and back moves nothing: the status, Disconnect and the
  // card keep their boxes.
  const boxes = async () =>
    Promise.all([
      panel.locator('[data-drive-status]').boundingBox(),
      panel.getByRole('button', { name: 'Disconnect' }).boundingBox(),
      panel.boundingBox(),
    ]);
  await expect(pillOf(panel)).toHaveText(/^Last synced /);
  await settled(page);
  // In view first: the click would otherwise scroll the pane to reach it.
  await panel.getByRole('button', { name: 'Disconnect' }).scrollIntoViewIfNeeded();
  const synced = await boxes();
  const release = await slow(
    page,
    'https://www.googleapis.com/drive/v3/changes/startPageToken**',
    1500,
  );
  await syncNow(page);
  await expect(pillOf(panel)).toHaveText('Syncing…');
  expect(await boxes()).toEqual(synced);
  await expectStable(panel);
  await release();
  await expect(pillOf(panel)).toHaveText(/^Last synced /, { timeout: 15_000 });
  expect(await boxes()).toEqual(synced);

  // A rename made in Drive reaches livediagram on the next pass.
  google.fake.userRename(fileNamed('Meeting notes.livediagram')!.id, 'Standup notes.livediagram');
  // Into a folder livediagram cannot see: Unsorted, and a notice.
  const hidden = google.fake.userCreateFolder(USER, 'Clients', fileNamed(ROOT_NAME)!.id);
  google.fake.userMove(fileNamed('Quarterly plan.livediagram')!.id, hidden);
  await syncNow(page);
  await expect(problemOf(panel)).toContainText(
    "Quarterly plan: Moved to a Drive folder livediagram can't see.",
  );
  await expect(pillOf(panel)).toHaveText('Needs attention');
  await expectStable(panel);
  await page.screenshot({ path: `${SHOTS}/03-notice.png` });
  await expect
    .poll(
      async () =>
        ((await api(page, 'GET', `/documents/${NOTES}`)) as { document: { name: string } }).document
          .name,
    )
    .toBe('Standup notes');
  expect(
    (
      (await api(page, 'GET', `/documents/${PLAN}`)) as {
        document: { folderId: string | null };
      }
    ).document.folderId,
  ).toBeNull();

  // Show the folder to livediagram (the Picker picks it): adopted, and the
  // document moves into the new Personal Space folder.
  google.fake.grantAccess(USER, hidden);
  await page.evaluate(
    (id) => ((window as unknown as { __e2ePickFolder: string }).__e2ePickFolder = id),
    hidden,
  );
  await panel.getByRole('button', { name: 'Show folder' }).click();
  await expect(problemOf(panel)).toHaveCount(0, { timeout: 15_000 });
  const folders = (await api(page, 'GET', '/folders')) as {
    folders: { id: string; name: string }[];
  };
  const clients = folders.folders.find((f) => f.name === 'Clients')!;
  expect(clients).toBeDefined();
  expect(
    ((await api(page, 'GET', `/documents/${PLAN}`)) as { document: { folderId: string } }).document
      .folderId,
  ).toBe(clients.id);

  // Binned in Drive: the document goes to the Trash.
  google.fake.userTrash(fileNamed('Standup notes.livediagram')!.id);
  await syncNow(page);
  await expect
    .poll(async () =>
      ((await api(page, 'GET', '/trash')) as { trash: { id: string }[] }).trash.map((t) => t.id),
    )
    .toContain(NOTES);
  await page.screenshot({ path: `${SHOTS}/04-synced.png` });
  expectNoPageErrors(pageErrors);
});

test('Open with: your document opens; a file shared with you offers a copy', async ({
  page,
  pageErrors,
}) => {
  await signIn(page);
  const mine = fileNamed('Quarterly plan.livediagram')!;
  await page.goto(
    `/drive/open?state=${encodeURIComponent(google.fake.openWithState(USER, mine.id))}`,
  );
  await page.waitForURL(`**/document/${PLAN}**`);

  const theirs = google.fake.otherUserFile({
    owner: 'someone-else',
    name: 'Their roadmap.livediagram',
    mimeType: DRIVE_FILE_MIME,
    content: JSON.stringify({
      kind: 'livediagram.document',
      schemaVersion: 1,
      exportedAt: 1,
      document: {
        id: 'not-yours',
        name: 'Their roadmap',
        presentation: null,
        tabs: [{ id: 't', name: 'Tab 1', elements: [] }],
      },
    }),
    appProperties: { ldDocumentId: 'not-yours', ldOrigin: new URL(page.url()).host },
    shareWith: USER,
  });
  await page.goto(
    `/drive/open?state=${encodeURIComponent(google.fake.openWithState(USER, theirs))}`,
  );
  await expect(page.getByRole('heading', { name: 'Their roadmap' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/05-import.png` });
  await page.getByRole('button', { name: 'Import a copy' }).click();
  await page.waitForURL('**/document/**');
  expect(page.url()).not.toContain('not-yours');
  expectNoPageErrors(pageErrors);
});

test('Open with on a copy made in Drive imports it as a new document', async ({
  page,
  pageErrors,
}) => {
  // docs/specs/022-drive-mirror/drive-mirror.md, "Copies made in Drive".
  await signIn(page);
  const original = fileNamed('Quarterly plan.livediagram')!;
  const copyId = google.fake.userCopy(original.id);
  await page.goto(
    `/drive/open?state=${encodeURIComponent(google.fake.openWithState(USER, copyId))}`,
  );
  await expect(page.getByRole('heading', { name: 'Copy of Quarterly plan' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/05b-import-copy.png` });
  await page.getByRole('button', { name: 'Import as new document' }).click();
  await page.waitForURL('**/document/**');
  const newId = decodeURIComponent(new URL(page.url()).pathname.split('/').filter(Boolean).pop()!);
  expect(newId).not.toBe(PLAN);
  // The original is untouched; the copy now mirrors the new document.
  expect(google.fake.get(original.id)!.appProperties.ldDocumentId).toBe(PLAN);
  expect(google.fake.get(copyId)!.appProperties.ldDocumentId).toBe(newId);
  expect(
    ((await api(page, 'GET', `/documents/${newId}`)) as { document: { name: string } }).document
      .name,
  ).toBe('Copy of Quarterly plan');
  expectNoPageErrors(pageErrors);
});

test('a change made in Drive reaches the open Explorer within two minutes, no reload', async ({
  page,
  pageErrors,
}) => {
  // Drive's 2-minute check (docs/specs/022-drive-mirror/drive-mirror.md, "Cadence") and the
  // views that follow it ("Other views follow"), driven by the page's clock.
  await page.clock.install();
  await signIn(page);
  // The arrival pass has read Drive's page token before the rename.
  const arrived = page.waitForEvent('console', (m) => m.text().includes('[drive-mirror] pass-end'));
  await page.goto('/explorer/recent');
  await arrived;
  const plan = google.fake.appFiles(USER).find((f) => f.appProperties.ldDocumentId === PLAN)!;
  google.fake.userRename(plan.id, 'Renamed in Drive.livediagram');
  await expect(page.getByText('Renamed in Drive', { exact: true })).toHaveCount(0);
  await page.clock.fastForward('02:05');
  await expect(page.getByText('Renamed in Drive', { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.screenshot({ path: `${SHOTS}/06-followed.png` });
  expectNoPageErrors(pageErrors);
});

test('disconnect revokes and leaves the Drive files in place', async ({ page, pageErrors }) => {
  await signIn(page);
  const before = google.fake.appFiles(USER).length;
  await page.goto('/explorer/recent');
  const panel = await openCloudSync(page);
  await settled(page);

  // Google drops the grant: Needs reconnect, in the same shape.
  google.fake.revokeGrant(USER);
  google.fake.expireAccessTokens();
  await syncNow(page);
  await expect(panel.getByRole('button', { name: 'Reconnect' })).toBeVisible({ timeout: 15_000 });
  await expect(pillOf(panel)).toHaveText('Needs reconnecting');
  await expectStable(panel);
  await page.route('**/api/drive/state', (route) => route.abort(), { times: 1 });
  await panel.getByRole('button', { name: 'Reconnect' }).click();
  await expect(problemOf(panel)).toContainText(
    "Couldn't reach Google. Check your connection and try again.",
  );
  await expectStable(panel);

  await panel.getByRole('button', { name: 'Disconnect' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Disconnect' }).last().click();
  await expect(panel.getByRole('button', { name: 'Connect', exact: true })).toBeVisible();
  await closeSettings(page);
  expect(await api(page, 'GET', '/drive/connection')).toEqual({ connection: null });
  expect(google.fake.appFiles(USER).length).toBe(before);

  expectNoPageErrors(pageErrors);
});

test('leaving for Google comes back to Cloud Sync: a cancel, and Back', async ({
  page,
  pageErrors,
}) => {
  // docs/specs/022-drive-mirror/drive-mirror.md, "Leaving for Google and coming back".
  // A user of its own, clear of the token rate limit the tests above spend.
  await signIn(page, `${USER}_back`);
  await page.goto('/explorer/recent');
  let panel: import('@playwright/test').Locator;
  // A cancel at Google comes back to exactly where it started, Cloud Sync
  // open, saying so calmly.
  await page.route(
    'https://accounts.google.com/o/oauth2/v2/auth**',
    async (route) => {
      const url = new URL(route.request().url());
      const back = new URL(url.searchParams.get('redirect_uri')!);
      back.searchParams.set('error', 'access_denied');
      back.searchParams.set('state', url.searchParams.get('state')!);
      await route.fulfill({ status: 302, headers: { Location: back.toString() } });
    },
    { times: 1 },
  );
  panel = await openCloudSync(page);
  await panel.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.waitForURL(/\/explorer\/recent\?settings=account&section=cloud-sync/);
  panel = page.locator('[data-cloud-sync="googleDrive"]');
  await expect(problemOf(panel)).toHaveText("Connection cancelled. Connect whenever you're ready.");
  await expect(pillOf(panel)).toHaveText('Not connected');
  await expect(page.getByRole('heading', { name: 'Cloud Sync' })).toBeFocused();
  await page.screenshot({ path: `${SHOTS}/07-cancelled.png` });

  // Back from Google's own page reopens the page the user left, Cloud Sync open.
  await page.route(
    'https://accounts.google.com/o/oauth2/v2/auth**',
    (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Google</title>Google' }),
    { times: 1 },
  );
  await panel.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.waitForURL(/accounts\.google\.com/);
  await page.goBack();
  await page.waitForURL(/\/explorer\/recent\?settings=account&section=cloud-sync/);
  panel = page.locator('[data-cloud-sync="googleDrive"]');
  await expect(pillOf(panel)).toHaveText('Not connected');
  await expect(page.getByRole('heading', { name: 'Cloud Sync' })).toBeFocused();
  // Closing Settings takes it out of the URL.
  await closeSettings(page);
  expect(new URL(page.url()).search).toBe('');

  expectNoPageErrors(pageErrors);
});

test('a connection made in one tab starts syncing at once while another tab runs the mirror', async ({
  context,
  page,
  pageErrors,
}) => {
  // The tab that runs the mirror is elected per browser (Web Locks): here the
  // first tab, so the tab that connects is not it. The row must reach the first
  // copy without waiting for a focus, visibility or poll trigger.
  const user = `${USER}_tabs`;
  const other = await context.newPage();
  await signIn(other, user);
  await other.goto('/explorer/recent');
  await expect(other.getByRole('button', { name: 'Account menu' })).toBeVisible();
  await signIn(page, user);
  await api(
    page,
    'POST',
    '/documents',
    {
      id: `${PLAN}-tabs`,
      name: 'Tabs plan',
      tabs: [{ id: `e2e-tab-tabs-${RUN}`, name: 'Tab 1', elements: [] }],
    },
    identity.token(user, EMAIL),
  );
  await page.goto('/explorer/recent');
  const panel = await openCloudSync(page);
  await expect(pillOf(panel)).toHaveText('Not connected');
  await panel.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.waitForURL(/\/explorer\/recent\?settings=account&section=cloud-sync/);
  const row = page.locator('[data-cloud-sync="googleDrive"]');
  // Never "Not connected" once the connection exists: Connecting until the
  // mirror reports, then the first copy or Last synced, without any focus.
  await expect(row).toBeVisible();
  let sawNotConnected = false;
  await expect
    .poll(
      async () => {
        const text = (await pillOf(row).allTextContents())[0] ?? '';
        if (text === 'Not connected') sawNotConnected = true;
        return /^(Copying .+|Last synced .+)$/.test(text);
      },
      { timeout: 10_000, intervals: [100] },
    )
    .toBe(true);
  expect(sawNotConnected).toBe(false);
  await expect
    .poll(() => google.fake.appFiles(user).some((f) => f.name === 'Tabs plan.livediagram'), {
      timeout: 10_000,
    })
    .toBe(true);
  await other.close();
  expectNoPageErrors(pageErrors);
});

test('a visible tab is never left unsynced while a hidden tab runs the mirror', async ({
  context,
  page,
  pageErrors,
}) => {
  // docs/specs/022-drive-mirror/drive-mirror.md, "A visible tab is never left unsynced".
  // The user the test above connected. The first tab runs the mirror, then hides.
  const user = `${USER}_tabs`;
  const elected = await context.newPage();
  await elected.clock.install();
  await signIn(elected, user);
  const arrived = elected.waitForEvent('console', (m) =>
    m.text().includes('[drive-mirror] pass-end'),
  );
  await elected.goto('/explorer/recent');
  await arrived;
  // Both tabs on one clock, as in a real browser.
  await page.clock.install();
  await signIn(page, user);
  const ready = page.waitForEvent('console', (m) => m.text().includes('[drive-mirror] tab-ready'));
  await page.goto('/explorer/recent');
  await ready;
  await elected.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  // Past the focus guard, then the user returns to the visible tab.
  const focusDone = elected.waitForEvent('console', (m) =>
    m.text().includes('[drive-mirror] pass-end {kind: focus}'),
  );
  await Promise.all([elected.clock.fastForward('00:40'), page.clock.fastForward('00:40')]);
  const checked = elected.waitForRequest(/drive\/v3\/changes\/startPageToken/, { timeout: 5000 });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await checked;
  await focusDone;

  // Opening Cloud Sync checks too, saying so, then Last synced just now.
  await Promise.all([elected.clock.fastForward('00:40'), page.clock.fastForward('00:40')]);
  const viewed = elected.waitForRequest(/drive\/v3\/changes\/startPageToken/, { timeout: 5000 });
  const row = await openCloudSync(page);
  // The check is for the row coming into view.
  await row.scrollIntoViewIfNeeded();
  await viewed;
  await expect(pillOf(row)).toHaveText('Last synced just now', { timeout: 5000 });
  await elected.close();
  expectNoPageErrors(pageErrors);
});

test('the Cloud Sync buttons never cover anything, at three widths', async ({
  browser,
  page,
  pageErrors,
}) => {
  // Connected (the user the test above connected) and not connected (a user
  // of its own), wide, medium and the phone layout, the narrowest Settings has.
  const connected = `${USER}_tabs`;
  for (const user of [connected, `${USER}_widths`]) {
    // Another user is another browser: tabs of one browser share the mirror.
    const other =
      user === connected
        ? null
        : await browser.newContext({
            baseURL: test.info().project.use.baseURL,
            colorScheme: 'dark',
          });
    const tab = other ? await other.newPage() : page;
    await signIn(tab, user);
    for (const width of [1280, 900, 390]) {
      await tab.setViewportSize({ width, height: 800 });
      await tab.goto('/explorer/recent?settings=account&section=cloud-sync');
      const row = tab.locator('[data-cloud-sync="googleDrive"]');
      await expect(pillOf(row)).toHaveText(
        user === connected ? /^(Last synced .+|Syncing…)$/ : 'Not connected',
        {
          timeout: 15_000,
        },
      );
      await row.scrollIntoViewIfNeeded();
      await expectNoOverlap(row);
      await tab.screenshot({
        path: `${SHOTS}/08-${user === connected ? 'connected' : 'not-connected'}-${width}.png`,
      });
    }
    await other?.close();
  }
  expectNoPageErrors(pageErrors);
});

test('a document row lines up its visibility badge, its time and its sync mark on one centre line', async ({
  page,
  pageErrors,
}) => {
  // docs/specs/004-interface-design/optical-alignment.md: every optical offset within 0.5 CSS px.
  // The user an earlier test connected and left connected.
  await signIn(page, `${USER}_tabs`);
  for (const [mode, minimal] of [
    ['card', false],
    ['card', true],
    ['list', false],
    ['list', true],
  ] as const) {
    await page.addInitScript(
      ([m, min]) => {
        localStorage.setItem('livediagram:explorer-view', m as string);
        localStorage.setItem(
          'livediagram:user-preferences:v1',
          JSON.stringify(min ? { powerUserMode: true } : {}),
        );
      },
      [mode, minimal],
    );
    await page.goto('/explorer/recent');
    const mark = page.locator('[data-document-sync]').first();
    await expect(mark).toBeVisible({ timeout: 15_000 });
    const centres = await mark.evaluate((node) => {
      const mid = (el: Element) => {
        const b = el.getBoundingClientRect();
        return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height };
      };
      // The row or card holding this mark.
      const badgeIn = (el: Element) =>
        Array.from(el.querySelectorAll('span')).find(
          (s) => s.className.includes('ring-1') && /Private/.test(s.textContent ?? ''),
        );
      // The smallest ancestor holding the time and the visibility badge too.
      let row: Element | null = node;
      while (row && !(row.querySelector('.text-optical-line.text-slate-400') && badgeIn(row)))
        row = row.parentElement;
      const time = row!.querySelector('.text-optical-line.text-slate-400')!;
      const badge = badgeIn(row!)!;
      const icon = node.querySelector('svg')!;
      const badgeIcon = badge.querySelector('svg')!;
      return {
        mark: mid(node),
        markInk: mid(icon),
        time: mid(time),
        badge: mid(badge),
        badgeInk: mid(badgeIcon),
      };
    });
    const label = `${mode}${minimal ? ' minimal' : ''}`;
    expect(Math.abs(centres.mark.y - centres.time.y), `${label}: mark vs time`).toBeLessThanOrEqual(
      0.5,
    );
    expect(
      Math.abs(centres.badge.y - centres.time.y),
      `${label}: badge vs time`,
    ).toBeLessThanOrEqual(0.5);
    expect(Math.abs(centres.markInk.y - centres.mark.y), `${label}: mark ink`).toBeLessThanOrEqual(
      0.5,
    );
    if (minimal) {
      // The icon-only badge is a circle with its lock in the middle.
      expect(Math.abs(centres.badge.w - centres.badge.h), `${label}: circle`).toBeLessThanOrEqual(
        0.5,
      );
      expect(
        Math.abs(centres.badgeInk.x - centres.badge.x),
        `${label}: lock x`,
      ).toBeLessThanOrEqual(0.5);
      expect(
        Math.abs(centres.badgeInk.y - centres.badge.y),
        `${label}: lock y`,
      ).toBeLessThanOrEqual(0.5);
    }
    await page.screenshot({ path: `${SHOTS}/09-row-${mode}${minimal ? '-minimal' : ''}.png` });
  }
  expectNoPageErrors(pageErrors);
});
