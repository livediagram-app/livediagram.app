import { writeFileSync, mkdirSync } from 'node:fs';
import type { Server } from 'node:http';
import type { Page } from '@playwright/test';
import type { FakeGoogle } from '@livediagram/fake-google';
import { DRIVE_FILE_MIME } from '@livediagram/api-schema';
import { test, expect } from './fixtures';
import { routeGoogle, startFakeGoogle, TestIdentity } from './drive-support';

// Screenshots of every Google Drive mirror state, in light and dark
// (docs/specs/022-drive-mirror/drive-mirror.md): Settings > Account > Cloud Sync, Open with, and the Explorer following a change made in
// Drive. Against the fake Google, with deterministic data and no personal data.
// Opt-in: `pnpm --filter @livediagram/live test:e2e:drive-shots` (after the
// drive build), writing to E2E_DRIVE_PR_SHOTS (default /tmp/ld-drive-pr-shots).

test.describe.configure({ mode: 'serial' });
// E2E_DRIVE_SHOTS_SCALE=2 captures the same states at 2x, named `…@2x.png`.
const SCALE = Number(process.env.E2E_DRIVE_SHOTS_SCALE ?? 1);
// E2E_DRIVE_SHOTS_NARROW=1 uses a phone viewport, the narrowest Settings layout, named `…-narrow`.
const NARROW = process.env.E2E_DRIVE_SHOTS_NARROW === '1';
const AT = `${NARROW ? '-narrow' : ''}${SCALE === 1 ? '' : `@${SCALE}x`}`;
test.use({
  viewport: NARROW ? { width: 390, height: 844 } : { width: 1280, height: 800 },
  deviceScaleFactor: SCALE,
});

const OUT = process.env.E2E_DRIVE_PR_SHOTS ?? '/tmp/ld-drive-pr-shots';
const RUN = Math.random().toString(36).slice(2, 8);
const EMAIL = 'alex@example.com';
const THEMES = ['light', 'dark'] as const;

const shots: { file: string; shows: string }[] = [];

let identity: TestIdentity;
let jwks: Server;
let google: { fake: FakeGoogle; server: Server };

test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  identity = new TestIdentity();
  jwks = await identity.serve();
  google = await startFakeGoogle();
});

test.afterAll(async () => {
  await new Promise((r) => jwks.close(r));
  await new Promise((r) => google.server.close(r));
  const lines = shots.map(
    (s) => `- \`${s.file}\` - ${s.shows}. Source: FAKE Google (e2e harness).`,
  );
  writeFileSync(
    `${OUT}/README${AT}.md`,
    [
      '# Google Drive mirror screenshots',
      '',
      `Captured by \`apps/live/e2e/drive-shots.spec.ts\` at 1280 x 800, device scale ${SCALE}, light and dark, against the fake Google.`,
      '',
      ...lines,
      '',
    ].join('\n'),
  );
});

// The visible state wording (every wording is laid out, hidden but the current).
const pillOf = (row: import('@playwright/test').Locator) =>
  row.locator('[data-drive-status] [data-stable-option]:not(.invisible)');

// A sync pass now, the way another tab asks for one: syncing is automatic and
// the row has no Sync now, so the test uses the app's tab channel.
async function syncNow(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const channel = new BroadcastChannel('livediagram:drive-mirror');
    channel.postMessage({ type: 'sync-now' });
    channel.close();
  });
}
const detailOf = (row: import('@playwright/test').Locator) =>
  row.locator('[data-drive-detail] > div > :not(.invisible)');

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Holds matching requests back for `ms`, then lets the usual handler answer.
async function slow(page: Page, url: string, ms: number) {
  const handler = async (route: import('@playwright/test').Route) => {
    await pause(ms);
    await route.fallback();
  };
  await page.route(url, handler);
  return () => page.unroute(url, handler);
}

for (const theme of THEMES) {
  test.describe(`${theme}`, () => {
    const USER = `user_e2e_shots_${theme}_${RUN}`;
    const PLAN = `shots-plan-${theme}-${RUN}`;
    const NOTES = `shots-notes-${theme}-${RUN}`;
    let token: string;

    async function shot(page: Page, name: string, shows: string) {
      const file = `${name}-${theme}${AT}.png`;
      await pause(350); // let fades finish
      await page.screenshot({ path: `${OUT}/${file}` });
      shots.push({ file, shows: `${shows} (${theme})` });
    }

    async function api(page: Page, method: string, path: string, data?: unknown) {
      const res = await page.request.fetch(`/api${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(data ? { data } : {}),
      });
      expect(res.ok(), `${method} ${path} ${res.status()}`).toBe(true);
    }

    async function setUp(page: Page) {
      token = identity.token(USER, EMAIL);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.addInitScript(
        ([session, mode]) => {
          localStorage.setItem('livediagram:e2e:session', session);
          localStorage.setItem('livediagram:v2:ui-mode', mode);
        },
        [JSON.stringify({ token, userId: USER, email: EMAIL, firstName: 'Alex' }), theme] as const,
      );
      await routeGoogle(page, google.fake, USER);
    }

    async function openCloudSync(page: Page) {
      await page.getByRole('button', { name: 'Account menu' }).click();
      await page.getByRole('menuitem', { name: 'Account' }).click();
      const row = page.locator('[data-cloud-sync="googleDrive"]');
      await expect(row).toBeVisible();
      await row.scrollIntoViewIfNeeded();
      return row;
    }

    async function closeSettings(page: Page) {
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0);
    }

    const fileNamed = (name: string) => google.fake.appFiles(USER).find((f) => f.name === name);

    test('Cloud Sync, Open with and the Explorer following Drive', async ({ page }) => {
      test.setTimeout(120_000);
      await setUp(page);
      await api(page, 'POST', '/folders', { id: `f-${PLAN}`, name: 'Work', parentId: null });
      const shape = (id: string, x: number, label: string) => ({
        id,
        type: 'shape',
        shape: 'square',
        x,
        y: 100,
        width: 160,
        height: 90,
        label,
      });
      await api(page, 'POST', '/diagrams', {
        id: PLAN,
        name: 'Quarterly plan',
        tabs: [
          {
            id: `t-${PLAN}`,
            name: 'Tab 1',
            elements: [shape('a', 100, 'Plan'), shape('b', 360, 'Ship')],
          },
        ],
      });
      await api(page, 'PUT', `/diagrams/${PLAN}/folder`, { folderId: `f-${PLAN}` });
      await api(page, 'POST', '/diagrams', {
        id: NOTES,
        name: 'Meeting notes',
        tabs: [{ id: `t-${NOTES}`, name: 'Tab 1', elements: [] }],
      });
      for (const [i, name] of ['Roadmap', 'Architecture', 'Onboarding', 'Retro'].entries()) {
        await api(page, 'POST', '/diagrams', {
          id: `shots-${i}-${theme}-${RUN}`,
          name,
          tabs: [
            { id: `t-${i}-${theme}-${RUN}`, name: 'Tab 1', elements: [shape('a', 100, name)] },
          ],
        });
      }

      await page.goto('/explorer/recent');
      let row = await openCloudSync(page);
      await expect(pillOf(row)).toHaveText('Not connected');
      await shot(
        page,
        'cloud-sync-1-not-connected',
        'Settings > Account > Cloud Sync before connecting',
      );

      // Connecting: the state request held back, so the button says so.
      const releaseState = await slow(page, '**/api/drive/state', 2500);
      await row.getByRole('button', { name: 'Connect Google Drive' }).click();
      await expect(row.getByRole('button', { name: 'Connecting…' })).toBeVisible();
      await shot(
        page,
        'cloud-sync-2-connecting',
        'Cloud Sync while the Google consent flow starts',
      );

      // The first copy, uploads held back so it can be seen.
      const releaseUploads = await slow(page, 'https://www.googleapis.com/upload/**', 1500);
      // Back where the user started, Cloud Sync open.
      await page.waitForURL(/\/explorer\/recent\?settings=account&section=cloud-sync/);
      await releaseState();
      row = page.locator('[data-cloud-sync="googleDrive"]');
      await expect(pillOf(row)).toHaveText(/^Copying \d+ of \d+…$/, { timeout: 15_000 });
      await shot(
        page,
        'cloud-sync-3-first-copy',
        'Cloud Sync during the first copy, with its progress bar',
      );
      await closeSettings(page);
      row = await openCloudSync(page);
      await releaseUploads();
      await expect(pillOf(row)).toHaveText(/^Synced /, { timeout: 30_000 });
      await shot(
        page,
        'cloud-sync-4-synced',
        'Cloud Sync once synced: the status at the top right, the folder, the rhythm, Disconnect',
      );
      await closeSettings(page);

      // Syncing: the change check held back.
      const releaseCheck = await slow(
        page,
        'https://www.googleapis.com/drive/v3/changes/startPageToken**',
        4000,
      );
      row = await openCloudSync(page);
      await syncNow(page);
      await expect(pillOf(row)).toHaveText('Syncing…');
      await shot(page, 'cloud-sync-5-syncing', 'Cloud Sync while a sync runs');
      await releaseCheck();
      await expect(pillOf(row)).toHaveText(/^Synced /, { timeout: 15_000 });
      await closeSettings(page);

      // The Explorer following a rename made in Drive.
      await shot(
        page,
        'explorer-follows-1-before',
        'The Explorer before a rename made in Google Drive',
      );
      google.fake.userRename(
        fileNamed('Meeting notes.livediagram')!.id,
        'Standup notes.livediagram',
      );
      row = await openCloudSync(page);
      await syncNow(page);
      await expect(pillOf(row)).toHaveText(/^Synced /);
      await closeSettings(page);
      await expect(page.getByText('Standup notes', { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      });
      await shot(
        page,
        'explorer-follows-2-after',
        'The Explorer after the rename in Drive reached it, without a reload',
      );

      // Needs attention: a file moved into a folder livediagram cannot see.
      const hidden = google.fake.userCreateFolder(
        USER,
        'Clients',
        fileNamed('livediagram (staging)')!.id,
      );
      google.fake.userMove(fileNamed('Quarterly plan.livediagram')!.id, hidden);
      row = await openCloudSync(page);
      await syncNow(page);
      await expect(detailOf(row)).toContainText("can't see");
      await shot(
        page,
        'cloud-sync-6-needs-attention',
        'Cloud Sync with a folder notice in place of the rhythm, and Show folder',
      );
      await closeSettings(page);

      // Open with.
      const theirs = google.fake.otherUserFile({
        owner: 'someone-else',
        name: 'Team roadmap.livediagram',
        mimeType: DRIVE_FILE_MIME,
        content: JSON.stringify({
          kind: 'livediagram.diagram',
          schemaVersion: 1,
          exportedAt: 1,
          diagram: {
            id: 'not-yours',
            name: 'Team roadmap',
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
      await expect(page.getByRole('button', { name: 'Import a copy' })).toBeVisible();
      await shot(
        page,
        'open-with-1-import-a-copy',
        'Open with on a file someone shared: Import a copy',
      );
      const copy = google.fake.userCopy(fileNamed('Roadmap.livediagram')!.id);
      await page.goto(
        `/drive/open?state=${encodeURIComponent(google.fake.openWithState(USER, copy))}`,
      );
      await expect(page.getByRole('button', { name: 'Import as new document' })).toBeVisible();
      await shot(
        page,
        'open-with-2-import-as-new-document',
        'Open with on a copy made in Drive: Import as new document',
      );
      const mine = fileNamed('Architecture.livediagram')!;
      await page.goto(
        `/drive/open?state=${encodeURIComponent(google.fake.openWithState(USER, mine.id))}`,
      );
      await page.waitForURL('**/diagram/**');
      await expect(page.getByText('Architecture').first()).toBeVisible();
      await shot(
        page,
        'open-with-3-opens-mirrored',
        'Open with on a mirrored file: it lands in the diagram',
      );

      // Needs reconnect: Google drops the grant.
      const settledPass = page.waitForEvent('console', (m) =>
        m.text().includes('[drive-mirror] pass-end'),
      );
      await page.goto('/explorer/recent');
      await settledPass;
      google.fake.revokeGrant(USER);
      google.fake.expireAccessTokens();
      row = await openCloudSync(page);
      await syncNow(page);
      await expect(row.getByRole('button', { name: 'Reconnect' })).toBeVisible({ timeout: 15_000 });
      await shot(
        page,
        'cloud-sync-7-needs-reconnect',
        'Cloud Sync after Google dropped the grant: Reconnect',
      );
      await closeSettings(page);
    });
  });
}
