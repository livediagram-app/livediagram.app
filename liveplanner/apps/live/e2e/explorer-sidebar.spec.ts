import type { Page } from '@playwright/test';
import { apiBase, darkVisitor } from './audit-screens';
import { expect, expectNoPageErrors, mintSignedGuest, ownerHeaders, test } from './fixtures';

// The Explorer sidebar for a guest (docs/specs/013-workspace/explorer-structure.md), in dark
// mode: the three groups as ARIA trees, the keyboard model, Minimal chrome's separators, and the
// mobile drawer. The signed-in rows (teams, New Team, the nudge) are e2e/signed-in/explorer-sidebar.

const nav = (page: Page) => page.getByRole('navigation', { name: 'Explorer' }).first();
const tree = (page: Page, name: string) => nav(page).getByRole('tree', { name });
const row = (page: Page, name: string | RegExp) => nav(page).getByRole('treeitem', { name });
const rowNames = (page: Page, group: string) =>
  tree(page, group)
    .locator(':scope > [role="treeitem"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-tree-label')));

async function seedFolder(page: Page, owner: string, origin: string, name: string) {
  const res = await page.request.post(`${apiBase}/folders`, {
    headers: ownerHeaders(owner, { Origin: origin, 'Content-Type': 'application/json' }),
    data: { id: crypto.randomUUID(), name },
  });
  expect(res.ok(), `seeding a folder failed: ${res.status()}`).toBe(true);
}

async function openExplorer(page: Page, path = '/explorer/home') {
  await page.goto(path);
  await expect(row(page, /^Home/)).toBeVisible({ timeout: 30_000 });
}

test.describe('explorer sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('shows Overview, Spaces and More with their rows', async ({ page, pageErrors, baseURL }) => {
    const owner = await mintSignedGuest(page.request);
    await darkVisitor(page, owner);
    await seedFolder(page, owner, new URL(baseURL!).origin, 'Projects');
    await openExplorer(page);

    await expect(nav(page).getByRole('heading')).toHaveText(['Overview', 'Spaces', 'More']);
    expect(await rowNames(page, 'Overview')).toEqual(['Home', 'Inbox', 'Shared With Me']);
    // A guest on a deployment without sign-in: My Documents only, no teams, no New Team.
    expect((await rowNames(page, 'Spaces'))[0]).toBe('My Documents');
    await expect(row(page, 'New Team')).toHaveCount(0);
    // This Browser holds nothing yet, so it is hidden.
    expect(await rowNames(page, 'More')).toEqual(['Library', 'Trash']);
    // My Documents starts open on its root folders: no Unsorted or Generated bucket.
    const myDocuments = row(page, 'My Documents');
    await expect(row(page, 'Projects')).toBeVisible();
    await expect(myDocuments).toHaveAttribute('aria-expanded', 'true');
    const children = await myDocuments
      .locator(':scope > [role="group"] > [role="treeitem"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-tree-label')));
    expect(children).toEqual(['Projects']);
    // Home is the current view.
    await expect(row(page, /^Home/)).toHaveAttribute('aria-selected', 'true');
    await expect(nav(page).getByText('Favourites')).toHaveCount(0);
    await expect(nav(page).getByText('Recent', { exact: true })).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });

  test('lines every top-level icon up on one column', async ({ page, pageErrors }) => {
    await darkVisitor(page, await mintSignedGuest(page.request));
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
    await darkVisitor(page, await mintSignedGuest(page.request));
    await openExplorer(page);
    await row(page, /^Home/).focus();
    await page.keyboard.press('ArrowDown');
    await expect(row(page, /^Inbox/)).toBeFocused();
    await page.keyboard.press('End');
    await expect(row(page, 'Trash')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(row(page, 'Library')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(row(page, 'Library')).toHaveAttribute('aria-expanded', 'true');
    // Library's first row is Tags (tags.md "The sidebar"), then its pages.
    await page.keyboard.press('ArrowRight');
    await expect(row(page, 'Tags')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(row(page, 'Themes')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/explorer\/themes\/?$/);
    await expect(row(page, 'Themes')).toHaveAttribute('aria-selected', 'true');
    // Only one row is in the tab order.
    expect(await nav(page).locator('[role="treeitem"][tabindex="0"]').count()).toBe(1);
    expectNoPageErrors(pageErrors);
  });

  test('opens a folder menu from the keyboard', async ({ page, pageErrors, baseURL }) => {
    const owner = await mintSignedGuest(page.request);
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

  test('shows This Browser while it holds a document', async ({ page, pageErrors }) => {
    await darkVisitor(page, await mintSignedGuest(page.request));
    // Seeded through the store the app upgrades on load (e2e/legacy-offline-store.spec.ts).
    await page.goto('/icon.svg');
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const del = indexedDB.deleteDatabase('liveplanner-offline');
          del.onsuccess = () => {
            const req = indexedDB.open('liveplanner-offline', 1);
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
              tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
            };
            req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
          };
        }),
    );
    await openExplorer(page);
    await expect(row(page, 'This Browser (1)')).toBeVisible();
    expect(await rowNames(page, 'More')).toEqual(['This Browser', 'Library', 'Trash']);
    expectNoPageErrors(pageErrors);
  });

  test('swaps titles for hairlines under Minimal chrome', async ({ page, pageErrors }) => {
    await darkVisitor(page, await mintSignedGuest(page.request));
    await page.addInitScript(() =>
      localStorage.setItem(
        'liveplanner:user-preferences:v1',
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
    await darkVisitor(page, await mintSignedGuest(page.request));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/explorer/home');
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

// The editor's Explorer popover, opened from the menu button, builds the same groups
// (docs/specs/013-workspace/explorer-structure.md#the-editors-explorer).
test.describe('editor Explorer panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('shows a rail of sections beside a pane, and every section in place', async ({
    page,
    pageErrors,
    baseURL,
  }) => {
    const owner = await mintSignedGuest(page.request);
    const origin = new URL(baseURL!).origin;
    await darkVisitor(page, owner);
    await page.addInitScript(() => localStorage.setItem('liveplanner:v2:tour-seen', '1'));
    const id = crypto.randomUUID();
    const make = async (docId: string, name: string) => {
      const res = await page.request.post(`${apiBase}/documents`, {
        headers: ownerHeaders(owner, { Origin: origin }),
        data: { id: docId, name, tabs: [{ id: crypto.randomUUID(), name: 'Tab 1', elements: [] }] },
      });
      expect(res.ok()).toBe(true);
    };
    await make(id, 'Open one');
    await make(crypto.randomUUID(), 'Another');
    await page.goto(`/document/${id}`);
    await page.getByRole('button', { name: 'Explorer', exact: true }).click();
    const rail = page.getByRole('navigation', { name: 'Explorer sections' });
    await expect(rail.getByRole('button', { name: 'Home' })).toBeVisible({ timeout: 30_000 });
    await expect(rail.getByRole('heading')).toHaveText(['Overview', 'Spaces', 'More']);
    // Opens on Home; My Documents lists its documents as rows, the open one current.
    await expect(rail.getByRole('button', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await rail.getByRole('button', { name: 'My Documents' }).click();
    // The pane's list (the header's title is a button of the same name).
    const list = page.getByRole('list', { name: 'My Documents' });
    await expect(list.getByRole('button', { name: 'Another', exact: true })).toBeVisible();
    await expect(list.getByRole('button', { name: 'Open one', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    );
    // The keyboard walks the rail; a pick shows the section in the pane, never leaving the editor.
    await rail.getByRole('button', { name: 'Home' }).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    // Shared With Me, now current.
    await expect(page.getByRole('heading', { name: 'Shared With Me', exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/document/${id}`));
    // The product's links live in the panel's footer, not the header.
    await expect(
      page.getByRole('navigation', { name: 'Go to' }).getByRole('link', { name: 'Help' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /^Switch section/ })).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });
});
