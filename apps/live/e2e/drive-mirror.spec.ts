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

async function signIn(page: import('@playwright/test').Page) {
  await page.addInitScript(
    (session: string) => localStorage.setItem('livediagram:e2e:session', session),
    JSON.stringify({ token, userId: USER, email: EMAIL, firstName: 'Drive' }),
  );
  await routeGoogle(page, google.fake, USER);
}

async function openDrivePanel(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Google Drive' }).click();
  return page.getByRole('dialog', { name: 'Google Drive' });
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
  let panel = await openDrivePanel(page);
  await expect(panel).toContainText('Keep a copy of your Personal Space');
  await page.screenshot({ path: `${SHOTS}/01-connect.png` });
  await panel.getByRole('button', { name: 'Connect Google Drive' }).click();

  // Google's consent (the fake agrees), /drive/connected, back to the Explorer.
  await page.waitForURL('**/explorer/recent');
  await expect.poll(() => fileNamed(ROOT_NAME)?.appProperties.ldRoot).toBeTruthy();
  await expect
    .poll(() => fileNamed('Quarterly plan.livediagram')?.parents[0])
    .toBe(fileNamed('Work')?.id);
  expect(fileNamed('Meeting notes.livediagram')).toMatchObject({
    mimeType: DRIVE_FILE_MIME,
    trashed: false,
  });
  expect(fileNamed('Quarterly plan.livediagram')?.thumbnail).toMatchObject({
    mimeType: 'image/png',
  });

  panel = await openDrivePanel(page);
  await expect(panel).toContainText('Mirroring to the livediagram folder');
  await expect(panel).toContainText('Last synced: Just now');
  await page.screenshot({ path: `${SHOTS}/02-connected.png` });

  // A rename made in Drive reaches livediagram on Sync now.
  google.fake.userRename(fileNamed('Meeting notes.livediagram')!.id, 'Standup notes.livediagram');
  // Into a folder livediagram cannot see: Unsorted, and a notice.
  const hidden = google.fake.userCreateFolder(USER, 'Clients', fileNamed(ROOT_NAME)!.id);
  google.fake.userMove(fileNamed('Quarterly plan.livediagram')!.id, hidden);
  await panel.getByRole('button', { name: 'Sync now' }).click();
  await expect(panel).toContainText(
    "Quarterly plan: Moved in Drive to a folder livediagram can't see.",
  );
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
  await expect(panel).not.toContainText("can't see", { timeout: 15_000 });
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

test('disconnect revokes and leaves the Drive files in place', async ({ page, pageErrors }) => {
  await signIn(page);
  const before = google.fake.appFiles(USER).length;
  await page.goto('/explorer/recent');
  const panel = await openDrivePanel(page);
  await expect(panel).toContainText('Mirroring');
  await panel.getByRole('button', { name: 'Disconnect' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Disconnect' }).last().click();
  await expect(panel.getByRole('button', { name: 'Connect Google Drive' })).toBeVisible();
  expect(await api(page, 'GET', '/drive/connection')).toEqual({ connection: null });
  expect(google.fake.appFiles(USER).length).toBe(before);
  expectNoPageErrors(pageErrors);
});
