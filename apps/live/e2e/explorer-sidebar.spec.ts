import type { Page } from '@playwright/test';
import { apiBase, darkVisitor } from './audit-screens';
import { expect, expectNoPageErrors, test } from './fixtures';

// The Explorer sidebar for a guest (docs/specs/013-workspace/explorer-structure.md), in dark
// mode: the three groups as ARIA trees, the keyboard model, Minimal chrome's separators, and the
// mobile drawer. The signed-in rows (teams, New team, the nudge) are e2e/clerk-stub/explorer-sidebar.

const nav = (page: Page) => page.getByRole('navigation', { name: 'Explorer' }).first();
const tree = (page: Page, name: string) => nav(page).getByRole('tree', { name });
const row = (page: Page, name: string | RegExp) => nav(page).getByRole('treeitem', { name });
const rowNames = (page: Page, group: string) =>
  tree(page, group)
    .locator(':scope > [role="treeitem"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-tree-label')));

async function seedFolder(page: Page, owner: string, origin: string, name: string) {
  const res = await page.request.post(`${apiBase}/folders`, {
    headers: { 'X-Owner-Id': owner, Origin: origin, 'Content-Type': 'application/json' },
    data: { id: crypto.randomUUID(), name },
  });
  expect(res.ok(), `seeding a folder failed: ${res.status()}`).toBe(true);
}

async function openExplorer(page: Page, path = '/explorer/timeline') {
  await page.goto(path);
  await expect(row(page, /^Home/)).toBeVisible({ timeout: 30_000 });
}

test.describe('explorer sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('shows Overview, Spaces and More with their rows', async ({ page, pageErrors, baseURL }) => {
    const owner = crypto.randomUUID();
    await darkVisitor(page, owner);
    await seedFolder(page, owner, new URL(baseURL!).origin, 'Projects');
    await openExplorer(page);

    await expect(nav(page).getByRole('heading')).toHaveText(['Overview', 'Spaces', 'More']);
    expect(await rowNames(page, 'Overview')).toEqual(['Home', 'Activity', 'Shared with me']);
    // A guest on a deployment without sign-in: My documents only, no teams, no New team.
    expect((await rowNames(page, 'Spaces'))[0]).toBe('My documents');
    await expect(row(page, 'New team')).toHaveCount(0);
    // This browser holds nothing yet, so it is hidden.
    expect(await rowNames(page, 'More')).toEqual(['Library', 'Trash']);
    // My documents starts open: Unsorted and Generated first, then the folders.
    const myDocuments = row(page, 'My documents');
    await expect(row(page, 'Projects')).toBeVisible();
    await expect(myDocuments).toHaveAttribute('aria-expanded', 'true');
    const children = await myDocuments
      .locator(':scope > [role="group"] > [role="treeitem"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-tree-label')));
    expect(children).toEqual(['Unsorted', 'Generated', 'Projects']);
    // Home is the current view.
    await expect(row(page, /^Home/)).toHaveAttribute('aria-selected', 'true');
    await expect(nav(page).getByText('Favourites')).toHaveCount(0);
    await expect(nav(page).getByText('Recent', { exact: true })).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });

  test('lines every top-level icon up on one column', async ({ page, pageErrors }) => {
    await darkVisitor(page, crypto.randomUUID());
    await openExplorer(page);
    const lefts = await nav(page)
      .locator(
        '[role="tree"] > [role="treeitem"] > [data-tree-row] [data-tree-activate] > span:first-child',
      )
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
    expect(lefts.length).toBeGreaterThan(5);
    expect(new Set(lefts).size).toBe(1);
    expectNoPageErrors(pageErrors);
  });

  test('is one tab stop, walked with the arrow keys', async ({ page, pageErrors }) => {
    await darkVisitor(page, crypto.randomUUID());
    await openExplorer(page);
    await row(page, /^Home/).focus();
    await page.keyboard.press('ArrowDown');
    await expect(row(page, /^Activity/)).toBeFocused();
    await page.keyboard.press('End');
    await expect(row(page, 'Trash')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(row(page, 'Library')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(row(page, 'Library')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(row(page, 'Image gallery')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/explorer\/images\/?$/);
    await expect(row(page, 'Image gallery')).toHaveAttribute('aria-selected', 'true');
    // Only one row is in the tab order.
    expect(await nav(page).locator('[role="treeitem"][tabindex="0"]').count()).toBe(1);
    expectNoPageErrors(pageErrors);
  });

  test('opens a folder menu from the keyboard', async ({ page, pageErrors, baseURL }) => {
    const owner = crypto.randomUUID();
    await darkVisitor(page, owner);
    await seedFolder(page, owner, new URL(baseURL!).origin, 'Projects');
    await openExplorer(page);
    const projects = row(page, 'Projects');
    await expect(projects).toBeVisible();
    await projects.focus();
    await page.keyboard.press('Shift+F10');
    await expect(page.getByRole('menu')).toBeVisible();
    // Only the folder's own menu opens, never an ancestor's.
    await expect(page.getByRole('menu')).toHaveCount(1);
    expectNoPageErrors(pageErrors);
  });

  test('shows This browser while it holds a document', async ({ page, pageErrors }) => {
    await darkVisitor(page, crypto.randomUUID());
    // Seeded through the store the app upgrades on load (e2e/legacy-offline-store.spec.ts).
    await page.goto('/icon.svg');
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const del = indexedDB.deleteDatabase('livediagram-offline');
          del.onsuccess = () => {
            const req = indexedDB.open('livediagram-offline', 1);
            req.onupgradeneeded = () => req.result.createObjectStore('diagrams', { keyPath: 'id' });
            req.onsuccess = () => {
              const db = req.result;
              const tx = db.transaction('diagrams', 'readwrite');
              tx.objectStore('diagrams').put({
                id: 'offline-sidebar-1',
                name: 'Only here',
                folderId: null,
                createdAt: Date.now(),
                savedAt: Date.now(),
                tabs: [{ id: 't1', name: 'Tab 1', kind: 'diagram', elements: [] }],
              });
              tx.oncomplete = () => {
                db.close();
                resolve();
              };
              tx.onerror = () => reject(tx.error);
            };
            req.onerror = () => reject(req.error);
          };
        }),
    );
    await openExplorer(page);
    await expect(row(page, 'This browser (1)')).toBeVisible();
    expect(await rowNames(page, 'More')).toEqual(['This browser', 'Library', 'Trash']);
    expectNoPageErrors(pageErrors);
  });

  test('swaps titles for hairlines under Minimal chrome', async ({ page, pageErrors }) => {
    await darkVisitor(page, crypto.randomUUID());
    await page.addInitScript(() =>
      localStorage.setItem(
        'livediagram:user-preferences:v1',
        JSON.stringify({ powerUserMode: true, minimalChrome: true }),
      ),
    );
    await openExplorer(page);
    await expect(nav(page).locator('[data-sidebar-separator]')).toHaveCount(2);
    // The titles stay as names for assistive technology, visually hidden.
    await expect(tree(page, 'Spaces')).toBeVisible();
    await expect(nav(page).getByRole('heading', { name: 'Spaces' }).locator('.sr-only')).toHaveText(
      'Spaces',
    );
    expectNoPageErrors(pageErrors);
  });

  test('opens as a drawer on a phone and closes on a pick', async ({ page, pageErrors }) => {
    await darkVisitor(page, crypto.randomUUID());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/explorer/timeline');
    await page.getByRole('button', { name: 'Browse sections' }).click();
    const drawerNav = page.getByRole('navigation', { name: 'Explorer' }).last();
    await expect(drawerNav.getByRole('treeitem', { name: /^Home/ })).toBeVisible();
    await expect(drawerNav.getByRole('heading')).toHaveText(['Overview', 'Spaces', 'More']);
    await drawerNav.getByRole('treeitem', { name: 'Trash' }).click();
    await expect(page).toHaveURL(/\/explorer\/trash\/?$/);
    await expect(drawerNav).toBeHidden();
    expectNoPageErrors(pageErrors);
  });
});
