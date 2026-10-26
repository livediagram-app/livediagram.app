import type { Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  pageOwnerHeaders,
  startBlankDocument,
  test,
} from './fixtures';

// What livediagram owns of the shared Explorer (@liveworkspace/explorer, liveworkspace/docs/one-explorer.md): the
// editor's Explorer panel around the open canvas, This Browser in it for the canvases the index never sees (the old
// /offline page only redirects to the Explorer's This Browser view), and a canvas opened from the Explorer at /explorer (liveworkspace's page, from its site build, listing what the
// index holds through /api/index on this origin).

const CANVAS = '[data-canvas-a11y-root]';

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Sections' });

// Recent and Favourites are the Library's pages, folded under it until it is opened.
const LIBRARY_PAGES = new Set(['Recent', 'Favourites']);

async function showView(page: Page, name: string): Promise<void> {
  if (LIBRARY_PAGES.has(name)) {
    const library = sidebar(page).getByRole('treeitem', { name: 'Library', exact: true });
    await expect(library).toBeVisible();
    if ((await library.getAttribute('aria-expanded')) !== 'true') {
      await sidebar(page).getByRole('button', { name: 'Expand Library', exact: true }).click();
    }
  }
  await sidebar(page).getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

const row = (page: Page, title: string) =>
  page.locator('main').getByRole('link', { name: title, exact: true });

async function openExplorerPanel(page: Page) {
  await page.getByRole('button', { name: 'Explorer', exact: true }).click();
  const current = page.getByRole('region', { name: 'Current canvas' });
  await expect(current).toBeVisible();
  return current;
}

test('the panel names the open canvas, and the Explorer opens it again', async ({
  page,
  pageErrors,
}) => {
  test.setTimeout(60_000);
  await startBlankDocument(page);
  await dismissQuickTour(page);
  const id = new URL(page.url()).pathname.split('/').pop()!;
  // startBlankDocument files it in a folder of its own (serverNewUrl): out to My Work's root, where this looks.
  const moved = await page.request.patch(`/api/index/items/${id}`, {
    headers: await pageOwnerHeaders(page),
    data: { folderId: null },
  });
  expect(moved.ok(), `move to the root: ${moved.status()}`).toBe(true);

  // The panel's card is the open canvas as the index has it; renaming it there renames it at the index.
  const current = await openExplorerPanel(page);
  await current.getByRole('button', { name: /^Rename / }).click();
  const input = current.getByRole('textbox', { name: /^Rename / });
  await input.fill('Payments flow');
  await input.press('Enter');
  await expect(current.getByRole('button', { name: 'Rename Payments flow' })).toBeVisible();

  // The Explorer lists it in My Work under that name, and its row is the canvas's address in the editor.
  await page.goto('/explorer');
  await showView(page, 'My Work');
  await expect(row(page, 'Payments flow')).toBeVisible({ timeout: 15_000 });
  await row(page, 'Payments flow').click();
  await page.waitForURL(new RegExp(`/document/${id}`));
  await page.locator(CANVAS).waitFor({ timeout: 30_000 });

  // The open is recorded, so it is in Recent.
  await page.goto('/explorer');
  await showView(page, 'Recent');
  await expect(row(page, 'Payments flow')).toBeVisible();
  expectNoPageErrors(pageErrors);
});

// A canvas kept only in this browser, written to its offline store before the app loads (the app opens and
// upgrades the store itself; legacy-offline-store.spec.ts covers the upgrade).
async function keepInThisBrowser(page: Page, name: string): Promise<void> {
  await page.goto('/icon.svg');
  await page.evaluate(
    (docName) =>
      new Promise<void>((resolve, reject) => {
        const del = indexedDB.deleteDatabase('livediagram-offline');
        del.onsuccess = () => {
          const req = indexedDB.open('livediagram-offline', 1);
          req.onupgradeneeded = () => req.result.createObjectStore('diagrams', { keyPath: 'id' });
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('diagrams', 'readwrite');
            tx.objectStore('diagrams').put({
              id: 'offline-this-browser-1',
              name: docName,
              folderId: null,
              createdAt: Date.now(),
              savedAt: Date.now(),
              tabs: [{ id: 't1', name: 'Tab 1', kind: 'diagram', elements: [] }],
            });
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
          };
          req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
        };
      }),
    name,
  );
}

test('This Browser lists the canvases kept here, opens one, and deletes one after asking', async ({
  page,
  pageErrors,
}) => {
  test.setTimeout(60_000);
  await keepInThisBrowser(page, 'Kept on this laptop');
  await startBlankDocument(page);
  await dismissQuickTour(page);

  // The panel's rail has This Browser with their count, and its pane lists them in place: the editor stays.
  await openExplorerPanel(page);
  const rail = page.getByRole('navigation', { name: 'Explorer sections' });
  const thisBrowser = rail.getByRole('button', { name: 'This Browser (1)' });
  await thisBrowser.click();
  await expect(page.getByRole('list', { name: 'This Browser' })).toBeVisible();
  expect(page.url()).not.toMatch(/\/offline/);

  // Each opens in the editor.
  const kept = page.getByRole('button', { name: 'Kept on this laptop', exact: true });
  await kept.click();
  await page.waitForURL(/\/document\/offline-this-browser-1/);
  await page.locator(CANVAS).waitFor({ timeout: 30_000 });

  // Nothing else holds it, so Delete asks first, then removes it for good, and the section goes with it.
  await openExplorerPanel(page);
  await rail.getByRole('button', { name: 'This Browser (1)' }).click();
  await page.getByRole('button', { name: 'Delete Kept on this laptop' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete this canvas?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(rail.getByRole('button', { name: /^This Browser/ })).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});

test('the old This Browser page sends people to the Explorer, its query kept', async ({ page }) => {
  await page.goto('/offline?convert=sync&item=x');
  await page.waitForURL(/\/explorer\/offline\?convert=sync&item=x$/);
});
