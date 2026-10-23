import type { Page } from '@playwright/test';
import { apiBase } from './audit-screens';
import {
  createDocument,
  expect,
  expectNoPageErrors,
  guestSigFor,
  mintSignedGuest,
  ownerHeaders,
  test,
} from './fixtures';

// Default folders for a guest, in dark mode (docs/specs/013-workspace/default-folders.md
// "Surfaces"; folders.md "Deleting a folder"): set from the folder menu and shown by the marker,
// where /new files a new document without asking, listed in Settings, and left
// dangling (and said so) when the folder is deleted, its contents moving up to its parent.

type Seeded = { owner: string; headers: Record<string, string> };

// A signed guest, as production mints one: the stack signs guest ids, and the app would upgrade a
// hand-made unsigned id (moving its data) the moment it opens.
async function guest(page: Page, baseURL: string): Promise<Seeded> {
  const owner = await mintSignedGuest(page.request);
  await page.addInitScript(
    ({ id, sig }) => {
      localStorage.setItem('livedocuments:v2:ui-mode', 'dark');
      localStorage.setItem('livedocuments:v2:name-confirmed', '1');
      localStorage.setItem('livedocuments:v2:self-id', id);
      if (sig) localStorage.setItem('livedocuments:v2:self-sig', sig);
    },
    { id: owner, sig: guestSigFor(owner) },
  );
  return {
    owner,
    headers: ownerHeaders(owner, {
      Origin: new URL(baseURL).origin,
      'Content-Type': 'application/json',
    }),
  };
}

async function folder(page: Page, s: Seeded, name: string, parentId: string | null = null) {
  const id = crypto.randomUUID();
  const res = await page.request.post(`${apiBase}/folders`, {
    headers: s.headers,
    data: { id, name, parentId },
  });
  expect(res.ok(), `seeding ${name} failed: ${res.status()}`).toBe(true);
  return id;
}

async function setDefault(page: Page, s: Seeded, key: string, folderId: string) {
  const res = await page.request.put(`${apiBase}/placement-defaults/${key}`, {
    headers: s.headers,
    data: { folderId },
  });
  expect(res.status()).toBe(204);
}

async function defaults(page: Page, s: Seeded): Promise<Record<string, string>> {
  const res = await page.request.get(`${apiBase}/placement-defaults`, { headers: s.headers });
  const body = (await res.json()) as { defaults: { key: string; folderId: string }[] };
  return Object.fromEntries(body.defaults.map((d) => [d.key, d.folderId]));
}

async function documentFolder(page: Page, s: Seeded, id: string): Promise<string | null> {
  const res = await page.request.get(`${apiBase}/documents`, { headers: s.headers });
  const body = (await res.json()) as { documents: { id: string; folderId: string | null }[] };
  return body.documents.find((d) => d.id === id)?.folderId ?? null;
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Explorer' }).first();

test.describe('default folders', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('a folder becomes a default from its menu, and shows it', async ({
    page,
    pageErrors,
    baseURL,
  }) => {
    const s = await guest(page, baseURL!);
    const retros = await folder(page, s, 'Retros');
    await page.goto('/explorer/all');
    const row = nav(page).getByRole('treeitem', { name: 'Retros' });
    await expect(row).toBeVisible({ timeout: 30_000 });

    await row.locator('[data-tree-row]').first().click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Use as Default for' }).click();
    await expect(page.getByText('New documents that open as')).toBeVisible();
    await page.getByRole('menuitemcheckbox', { name: 'Documents' }).click();
    await expect(page.getByRole('menuitemcheckbox', { name: 'Documents' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect.poll(() => defaults(page, s)).toEqual({ 'mode:pages': retros });
    // The marker, and its words as the row's description.
    await page.keyboard.press('Escape');
    await expect(row.locator('[data-default-marker]').first()).toBeVisible();
    await expect(row).toHaveAccessibleDescription('Default folder for new documents');

    // My Work holds every key without a working default, and only clears: choosing Documents there clears it.
    await page.mouse.click(900, 600);
    // Its own line: the item's centre may sit on one of the folders it holds.
    await nav(page)
      .getByRole('treeitem', { name: 'My Work' })
      .locator('[data-tree-row]')
      .first()
      .click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Use as Default for' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Documents' }).click();
    await expect.poll(() => defaults(page, s)).toEqual({});
    expectNoPageErrors(pageErrors);
  });

  test('/new files a new document in its default folder without asking, else at the root', async ({
    page,
    pageErrors,
    baseURL,
  }) => {
    const s = await guest(page, baseURL!);
    const projects = await folder(page, s, 'Projects');
    const workshops = await folder(page, s, 'Workshops', projects);

    // No default yet: the root of My Work.
    const loose = await createDocument(page);
    expect(await documentFolder(page, s, loose)).toBeNull();
    // With one, the document is filed there without a question.
    await setDefault(page, s, 'mode:pages', workshops);
    const filed = await createDocument(page);
    expect(await documentFolder(page, s, filed)).toBe(workshops);
    expectNoPageErrors(pageErrors);
  });

  test('deleting a default folder moves its contents up and leaves the default dangling', async ({
    page,
    pageErrors,
    baseURL,
  }) => {
    const s = await guest(page, baseURL!);
    const projects = await folder(page, s, 'Projects');
    const workshops = await folder(page, s, 'Workshops', projects);
    const archive = await folder(page, s, 'Archive', workshops);
    await setDefault(page, s, 'mode:pages', workshops);

    // Visiting it while it exists lets Settings name it once it is gone.
    await page.goto(`/explorer/folder?id=${projects}`);
    const menu = page.getByRole('button', { name: /^Menu for (folder )?Workshops$/ }).last();
    await expect(menu).toBeVisible({ timeout: 30_000 });
    await menu.click();
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    const confirm = page.getByRole('dialog').filter({ hasText: 'Delete "Workshops"?' });
    await expect(confirm).toContainText('Its documents and subfolders move to "Projects".');
    await expect(confirm).toContainText('New documents are saved here by default.');
    await confirm.getByRole('button', { name: 'Delete folder' }).click();

    await expect
      .poll(async () => {
        const res = await page.request.get(`${apiBase}/folders`, { headers: s.headers });
        const body = (await res.json()) as { folders: { id: string; parentId: string | null }[] };
        return body.folders.find((f) => f.id === archive)?.parentId;
      })
      .toBe(projects);
    expect(await defaults(page, s)).toEqual({ 'mode:pages': workshops });

    await page.goto(`/explorer/folder?id=${projects}&settings=documents`);
    await expect(page.getByText('Workshops (deleted), using My Work')).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Clear default folder for documents' }).click();
    await expect.poll(() => defaults(page, s)).toEqual({});
    expectNoPageErrors(pageErrors);
  });

  test('a /new?folder= context files the document there, ahead of the default', async ({
    page,
    pageErrors,
    baseURL,
  }) => {
    const s = await guest(page, baseURL!);
    const projects = await folder(page, s, 'Projects');
    const sprints = await folder(page, s, 'Sprints', projects);
    const workshops = await folder(page, s, 'Workshops');
    await setDefault(page, s, 'mode:pages', workshops);
    const id = await createDocument(page, `/new?folder=${sprints}`);
    expect(await documentFolder(page, s, id)).toBe(sprints);
    expectNoPageErrors(pageErrors);
  });
});
