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
const RUN = Math.random().toString(36).slice(2, 8);
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
) {
  const res = await page.request.fetch(`${apiBase}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
// through the account menu's Account item, or the cloud badge once connected.
async function openCloudSync(page: import('@playwright/test').Page, via: 'menu' | 'badge') {
  if (via === 'menu') {
    await page.getByRole('button', { name: 'Account menu' }).click();
    // The account menu has no Drive entry; Settings does.
    await expect(page.getByRole('menuitem', { name: /Google Drive/ })).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Account' }).click();
  } else {
    await page.getByRole('button', { name: /Google Drive/ }).click();
  }
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
  panel.locator('[data-drive-state] [data-stable-option]:not(.invisible)');

// The row's visible text and detail: every wording is laid out, hidden but
// for the current one (Layout stability), so assertions read the visible one.
const textOf = (panel: import('@playwright/test').Locator) =>
  panel.locator('[data-drive-text] [data-stable-option]:not(.invisible)');
const detailOf = (panel: import('@playwright/test').Locator) =>
  panel.locator('[data-drive-detail] > div > :not(.invisible)');

// The row's shape: its size, and where each part sits inside it. Every state
// has the same one (docs/specs/022-drive-mirror/drive-mirror.md, "Nothing moves").
async function shapeOf(panel: import('@playwright/test').Locator) {
  const card = (await panel.boundingBox())!;
  const rel = async (l: import('@playwright/test').Locator) => {
    const b = (await l.boundingBox())!;
    return { x: b.x - card.x, y: b.y - card.y, width: b.width, height: b.height };
  };
  return {
    card: { width: card.width, height: card.height },
    pill: await rel(panel.locator('[data-drive-state]')),
    text: await rel(panel.locator('[data-drive-text]')),
    detail: await rel(panel.locator('[data-drive-detail]')),
    buttons: await rel(panel.locator('[data-drive-actions]')),
    primary: await rel(panel.locator('[data-drive-primary]')),
    disconnect: await rel(panel.locator('[data-drive-disconnect]')),
  };
}
let rowShape: Awaited<ReturnType<typeof shapeOf>>;

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
  await page
    .getByRole('dialog', { name: 'Settings' })
    .evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
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
  await api(page, 'POST', '/diagrams', {
    id: PLAN,
    name: 'Quarterly plan',
    // Content, so the diagram has an SVG snapshot for the Drive thumbnail.
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
  await api(page, 'PUT', `/diagrams/${PLAN}/folder`, { folderId: FOLDER });
  await api(page, 'POST', '/diagrams', {
    id: NOTES,
    name: 'Meeting notes',
    tabs: [{ id: `e2e-tab-2-${RUN}`, name: 'Tab 1', elements: [] }],
  });

  await page.goto('/explorer/recent');
  let panel = await openCloudSync(page, 'menu');
  await expect(pillOf(panel)).toHaveText('Not connected');
  await expect(textOf(panel)).toContainText('Keep a copy of your documents');
  await page.screenshot({ path: `${SHOTS}/01-connect.png` });
  await settled(page);
  rowShape = await shapeOf(panel);

  // A Connect that cannot start says so, back at Not connected, and moves nothing.
  await page.route('**/api/drive/state', (route) => route.abort(), { times: 1 });
  await panel.getByRole('button', { name: 'Connect Google Drive' }).click();
  await expect(textOf(panel)).toHaveText(
    "Couldn't start connecting to Google Drive. Check your connection and try again.",
  );
  await expect(pillOf(panel)).toHaveText('Not connected');
  expect(await shapeOf(panel)).toEqual(rowShape);

  // Connecting shows at once, and holds while the state is fetched and the
  // page leaves for Google.
  await slow(page, '**/api/drive/state', 1500);
  await panel.getByRole('button', { name: 'Connect Google Drive' }).click();
  await expect(panel.getByRole('button', { name: 'Connecting…' })).toBeVisible({ timeout: 300 });
  await expect(pillOf(panel)).toHaveText('Connecting');
  expect(await shapeOf(panel)).toEqual(rowShape);

  // Google's consent (the fake agrees), /drive/connected, back where the user
  // started: the Explorer with Cloud Sync open, copying (uploads held back so
  // the first copy can be seen) in the same shape.
  const releaseUploads = await slow(page, 'https://www.googleapis.com/upload/**', 800);
  await page.waitForURL(/\/explorer\/recent\?settings=account&section=cloud-sync/);
  panel = page.locator('[data-cloud-sync="googleDrive"]');
  await expect(pillOf(panel)).toHaveText('Copying', { timeout: 15_000 });
  await settled(page);
  expect(await shapeOf(panel)).toEqual(rowShape);
  await expect(detailOf(panel)).toContainText('documents copied');
  await releaseUploads();
  await expect(pillOf(panel)).toHaveText('Synced', { timeout: 20_000 });
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

  // The cloud badge says so without opening anything, with its words on
  // focus, and opens Cloud Sync with the section's heading focused.
  const badge = page.getByRole('button', { name: /^Synced to Google Drive/ });
  await expect(badge).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Synced to Google Drive' })).toHaveCount(
    1,
  );
  await badge.focus();
  await expect(page.getByRole('tooltip')).toContainText('Synced to Google Drive');
  await page.screenshot({ path: `${SHOTS}/02b-badge.png` });
  panel = await openCloudSync(page, 'badge');
  await expect(page.getByRole('heading', { name: 'Cloud Sync' })).toBeFocused();
  await expect(textOf(panel)).toHaveText(
    `Your documents are copied to Google Drive, in the folder “${ROOT_NAME}”.`,
  );
  await expect(detailOf(panel)).toContainText('Checks for changes every 2 minutes');
  await expect(panel).toContainText('Last synced');
  await settled(page);
  expect(await shapeOf(panel)).toEqual(rowShape);
  await page.screenshot({ path: `${SHOTS}/02-connected.png` });

  // Synced to Syncing and back moves nothing: the pill, Sync now and the card
  // keep their boxes.
  const boxes = async () =>
    Promise.all([
      panel.locator('[data-drive-state]').boundingBox(),
      panel.getByRole('button', { name: /Sync now|Syncing…/ }).boundingBox(),
      panel.boundingBox(),
    ]);
  await expect(pillOf(panel)).toHaveText('Synced');
  await settled(page);
  const synced = await boxes();
  const release = await slow(
    page,
    'https://www.googleapis.com/drive/v3/changes/startPageToken**',
    1500,
  );
  await panel.getByRole('button', { name: 'Sync now' }).click();
  await expect(pillOf(panel)).toHaveText('Syncing');
  expect(await boxes()).toEqual(synced);
  expect(await shapeOf(panel)).toEqual(rowShape);
  await release();
  await expect(pillOf(panel)).toHaveText('Synced', { timeout: 15_000 });
  expect(await boxes()).toEqual(synced);

  // A rename made in Drive reaches livediagram on Sync now.
  google.fake.userRename(fileNamed('Meeting notes.livediagram')!.id, 'Standup notes.livediagram');
  // Into a folder livediagram cannot see: Unsorted, and a notice.
  const hidden = google.fake.userCreateFolder(USER, 'Clients', fileNamed(ROOT_NAME)!.id);
  google.fake.userMove(fileNamed('Quarterly plan.livediagram')!.id, hidden);
  await panel.getByRole('button', { name: 'Sync now' }).click();
  await expect(detailOf(panel)).toContainText(
    "Quarterly plan: Moved in Drive to a folder livediagram can't see.",
  );
  await expect(pillOf(panel)).toHaveText('Needs attention');
  expect(await shapeOf(panel)).toEqual(rowShape);
  await page.screenshot({ path: `${SHOTS}/03-notice.png` });
  await expect
    .poll(
      async () =>
        ((await api(page, 'GET', `/diagrams/${NOTES}`)) as { diagram: { name: string } }).diagram
          .name,
    )
    .toBe('Standup notes');
  expect(
    (
      (await api(page, 'GET', `/diagrams/${PLAN}`)) as {
        diagram: { folderId: string | null };
      }
    ).diagram.folderId,
  ).toBeNull();

  // Show the folder to livediagram (the Picker picks it): adopted, and the
  // diagram moves into the new Personal Space folder.
  google.fake.grantAccess(USER, hidden);
  await page.evaluate(
    (id) => ((window as unknown as { __e2ePickFolder: string }).__e2ePickFolder = id),
    hidden,
  );
  await panel.getByRole('button', { name: 'Show this folder to livediagram' }).click();
  await expect(detailOf(panel)).not.toContainText("can't see", { timeout: 15_000 });
  const folders = (await api(page, 'GET', '/folders')) as {
    folders: { id: string; name: string }[];
  };
  const clients = folders.folders.find((f) => f.name === 'Clients')!;
  expect(clients).toBeDefined();
  expect(
    ((await api(page, 'GET', `/diagrams/${PLAN}`)) as { diagram: { folderId: string } }).diagram
      .folderId,
  ).toBe(clients.id);

  // Binned in Drive: the diagram goes to the Trash.
  google.fake.userTrash(fileNamed('Standup notes.livediagram')!.id);
  await panel.getByRole('button', { name: 'Sync now' }).click();
  await expect
    .poll(async () =>
      ((await api(page, 'GET', '/trash')) as { trash: { id: string }[] }).trash.map((t) => t.id),
    )
    .toContain(NOTES);
  await page.screenshot({ path: `${SHOTS}/04-synced.png` });
  expectNoPageErrors(pageErrors);
});

test('Open with: your diagram opens; a file shared with you offers a copy', async ({
  page,
  pageErrors,
}) => {
  await signIn(page);
  const mine = fileNamed('Quarterly plan.livediagram')!;
  await page.goto(
    `/drive/open?state=${encodeURIComponent(google.fake.openWithState(USER, mine.id))}`,
  );
  await page.waitForURL(`**/diagram/${PLAN}**`);

  const theirs = google.fake.otherUserFile({
    owner: 'someone-else',
    name: 'Their roadmap.livediagram',
    mimeType: DRIVE_FILE_MIME,
    content: JSON.stringify({
      kind: 'livediagram.diagram',
      schemaVersion: 1,
      exportedAt: 1,
      diagram: {
        id: 'not-yours',
        name: 'Their roadmap',
        presentation: null,
        tabs: [{ id: 't', name: 'Tab 1', elements: [] }],
      },
    }),
    appProperties: { ldDiagramId: 'not-yours', ldOrigin: new URL(page.url()).host },
    shareWith: USER,
  });
  await page.goto(
    `/drive/open?state=${encodeURIComponent(google.fake.openWithState(USER, theirs))}`,
  );
  await expect(page.getByRole('heading', { name: 'Their roadmap' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/05-import.png` });
  await page.getByRole('button', { name: 'Import a copy' }).click();
  await page.waitForURL('**/diagram/**');
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
  await page.waitForURL('**/diagram/**');
  const newId = decodeURIComponent(new URL(page.url()).pathname.split('/').filter(Boolean).pop()!);
  expect(newId).not.toBe(PLAN);
  // The original is untouched; the copy now mirrors the new document.
  expect(google.fake.get(original.id)!.appProperties.ldDiagramId).toBe(PLAN);
  expect(google.fake.get(copyId)!.appProperties.ldDiagramId).toBe(newId);
  expect(
    ((await api(page, 'GET', `/diagrams/${newId}`)) as { diagram: { name: string } }).diagram.name,
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
  await page.goto('/explorer/recent');
  await expect(page.getByRole('button', { name: /^Synced to Google Drive/ })).toBeVisible();
  const plan = google.fake.appFiles(USER).find((f) => f.appProperties.ldDiagramId === PLAN)!;
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
  const account = page.getByRole('button', { name: 'Account menu' });
  await expect(page.getByRole('button', { name: /Google Drive/ })).toBeVisible();
  const marked = await account.boundingBox();
  const panel = await openCloudSync(page, 'badge');
  await settled(page);

  // Google drops the grant: Needs reconnect, in the same shape.
  google.fake.revokeGrant(USER);
  google.fake.expireAccessTokens();
  await panel.getByRole('button', { name: 'Sync now' }).click();
  await expect(panel.getByRole('button', { name: 'Reconnect' })).toBeVisible({ timeout: 15_000 });
  await expect(pillOf(panel)).toHaveText('Needs attention');
  expect(await shapeOf(panel)).toEqual(rowShape);

  await panel.getByRole('button', { name: 'Disconnect' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Disconnect' }).last().click();
  await expect(panel.getByRole('button', { name: 'Connect Google Drive' })).toBeVisible();
  await closeSettings(page);
  // The badge is gone and the avatar did not move: it only ever overlaid it.
  await expect(page.getByRole('button', { name: /Google Drive/ })).toHaveCount(0);
  expect(await account.boundingBox()).toEqual(marked);
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
  panel = await openCloudSync(page, 'menu');
  await panel.getByRole('button', { name: 'Connect Google Drive' }).click();
  await page.waitForURL(/\/explorer\/recent\?settings=account&section=cloud-sync/);
  panel = page.locator('[data-cloud-sync="googleDrive"]');
  await expect(textOf(panel)).toHaveText(
    "You cancelled at Google, so Google Drive isn't connected. Connect again whenever you like.",
  );
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
  await panel.getByRole('button', { name: 'Connect Google Drive' }).click();
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
