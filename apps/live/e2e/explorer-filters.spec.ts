import type { Page } from '@playwright/test';
import { apiBase, darkVisitor } from './audit-screens';
import { expect, expectNoPageErrors, mintSignedGuest, ownerHeaders, test } from './fixtures';

// The Explorer's filters for a guest (docs/specs/013-workspace/explorer-filters.md), in dark mode:
// the My documents root lists its documents directly, the chips and the field write one lens into
// `q`, a scoped lens reaches subfolders, typing on Home opens Search results, the lens rides
// between aggregate views, and the retired Unsorted and Generated addresses still answer. The
// signed-in team library is e2e/clerk-stub/explorer-filters.spec.ts.

test.use({ colorScheme: 'dark' });

type Seeded = { projects: string };

async function seed(page: Page, owner: string, origin: string): Promise<Seeded> {
  const headers = ownerHeaders(owner, { Origin: origin, 'Content-Type': 'application/json' });
  const post = async (path: string, data: unknown) => {
    const res = await page.request.post(`${apiBase}${path}`, { headers, data });
    expect(res.ok(), `seeding ${path} failed: ${res.status()}`).toBe(true);
  };
  const projects = crypto.randomUUID();
  const acme = crypto.randomUUID();
  await post('/folders', { id: projects, name: 'Projects' });
  await post('/folders', { id: acme, name: 'Acme', parentId: projects });
  const tabs = () => [{ id: crypto.randomUUID(), name: 'Tab 1', elements: [] }];
  const doc = (name: string, extra: Record<string, unknown>) =>
    post('/documents', { id: crypto.randomUUID(), name, tabs: tabs(), ...extra });
  await doc('Roadmap', { folderId: null, intent: { mode: 'diagram' } });
  await doc('Sprint retro', {
    folderId: null,
    intent: { mode: 'diagram', templateFamily: 'retrospective' },
  });
  await doc('Architecture by AI', { folderId: null, source: 'mcp', intent: { mode: 'diagram' } });
  await doc('Board in Acme', {
    folderId: acme,
    intent: { mode: 'diagram', templateFamily: 'kanban' },
  });
  await doc('AI payment flow', { folderId: projects, source: 'mcp', intent: { mode: 'diagram' } });
  return { projects };
}

const field = (page: Page) => page.getByRole('combobox', { name: 'Filter documents' });
const pane = (page: Page) => page.locator('main section');
const docLink = (page: Page, name: string) => pane(page).getByRole('link', { name, exact: true });
const filters = (page: Page) => page.getByRole('group', { name: 'Filters' });

async function arrive(page: Page, path: string) {
  await page.goto(path);
  await expect(field(page)).toBeVisible({ timeout: 30_000 });
}

test.describe('explorer filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('My documents lists root folders and root documents, AI-made ones badged', async ({
    page,
    pageErrors,
    baseURL,
  }) => {
    const owner = await mintSignedGuest(page.request);
    await darkVisitor(page, owner);
    await seed(page, owner, new URL(baseURL!).origin);
    await arrive(page, '/explorer/all');
    await expect(docLink(page, 'Roadmap')).toBeVisible({ timeout: 30_000 });
    await expect(docLink(page, 'Architecture by AI')).toBeVisible();
    await expect(pane(page).getByText('Projects', { exact: true }).first()).toBeVisible();
    // No Unsorted or Generated bucket anywhere.
    await expect(page.getByText('Unsorted', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Generated', { exact: true })).toHaveCount(0);
    // What lives in a folder stays there until a lens reaches for it.
    await expect(docLink(page, 'AI payment flow')).toHaveCount(0);
    await expect(pane(page).locator('[data-made-by-ai]')).toHaveCount(1);
    await page.screenshot({ path: test.info().outputPath('my-documents-root.png') });
    // The chip row: no Space chip on a scoped view.
    await expect(filters(page).getByRole('button', { name: 'Opens in, any' })).toBeVisible();
    await expect(filters(page).getByRole('button', { name: /^Space/ })).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });

  test('a chip writes its token, reaches subfolders, and Clear empties it', async ({
    page,
    pageErrors,
    baseURL,
  }) => {
    const owner = await mintSignedGuest(page.request);
    await darkVisitor(page, owner);
    await seed(page, owner, new URL(baseURL!).origin);
    await arrive(page, '/explorer/all');
    await expect(docLink(page, 'Roadmap')).toBeVisible({ timeout: 30_000 });

    await filters(page).getByRole('button', { name: 'Made by AI' }).click();
    await expect(page).toHaveURL(/\/explorer\/all\?q=made-by%3Aai$/);
    await expect(filters(page).getByRole('button', { name: 'Made by AI' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // The lens reaches into Projects; the folder rows step aside.
    await expect(docLink(page, 'AI payment flow')).toBeVisible();
    await expect(docLink(page, 'Architecture by AI')).toBeVisible();
    await expect(docLink(page, 'Roadmap')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remove filter Made by AI' })).toBeVisible();
    // The live region counts what is left once the lens settles.
    await expect(page.getByRole('status').filter({ hasText: 'documents' })).toHaveText(
      '2 of 5 documents',
    );

    // A multi-select chip: Template, Kanban, from the listbox.
    await filters(page).getByRole('button', { name: 'Template, any' }).click();
    const listbox = page.getByRole('listbox', { name: 'Template' });
    await expect(listbox).toHaveAttribute('aria-multiselectable', 'true');
    await page.screenshot({ path: test.info().outputPath('chip-listbox.png') });
    await listbox.getByRole('option', { name: 'Kanban' }).click();
    await page.keyboard.press('Escape');
    // A chip adds its token after the ones already written.
    await expect(page).toHaveURL(/q=made-by%3Aai\+template%3Akanban$/);
    await expect(pane(page).getByText('No documents match these filters')).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('filtered-empty.png') });

    await filters(page).getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(page).toHaveURL(/\/explorer\/all$/);
    await expect(docLink(page, 'Roadmap')).toBeVisible();
    expectNoPageErrors(pageErrors);
  });

  test('the field suggests, accepts by keyboard and turns tokens into pills', async ({
    page,
    pageErrors,
    baseURL,
  }) => {
    const owner = await mintSignedGuest(page.request);
    await darkVisitor(page, owner);
    await seed(page, owner, new URL(baseURL!).origin);
    await arrive(page, '/explorer/all');
    await expect(docLink(page, 'Roadmap')).toBeVisible({ timeout: 30_000 });

    await field(page).click();
    await field(page).pressSequentially('temp');
    await expect(field(page)).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(field(page)).toHaveValue('template:');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('option', { name: 'Retrospective, Template' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.screenshot({ path: test.info().outputPath('suggestions.png') });
    await page.keyboard.press('Enter');
    await expect(field(page)).toHaveValue('');
    await expect(
      page.getByRole('button', { name: 'Remove filter Template: Retrospective' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/q=template%3Aretrospective$/);
    await expect(docLink(page, 'Sprint retro')).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('typed-token-pill.png') });
    await expect(docLink(page, 'Roadmap')).toHaveCount(0);
    // The chip lights for the typed token.
    await expect(
      filters(page).getByRole('button', { name: 'Template: Retrospective' }),
    ).toBeVisible();

    // An unknown token stays as text, and is named.
    await field(page).pressSequentially('colour:red ');
    await expect(
      pane(page).getByText('“colour:red” isn’t a filter, so it’s searched as text.'),
    ).toBeVisible();

    // Backspace at the start: once selects the last pill, twice removes it.
    await field(page).fill('');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await expect(page).toHaveURL(/\/explorer\/all$/);
    expectNoPageErrors(pageErrors);
  });

  test('typing on Home opens Search results, and the lens rides between aggregate views', async ({
    page,
    pageErrors,
    baseURL,
  }) => {
    const owner = await mintSignedGuest(page.request);
    await darkVisitor(page, owner);
    await seed(page, owner, new URL(baseURL!).origin);
    await arrive(page, '/explorer/home');
    await field(page).click();
    await field(page).pressSequentially('payment');
    await expect(page).toHaveURL(/\/explorer\/search\?q=payment$/);
    await expect(field(page)).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Search results', level: 1 })).toBeVisible();
    await expect(docLink(page, 'AI payment flow')).toBeVisible({ timeout: 30_000 });
    await expect(filters(page).getByRole('button', { name: 'Space, any' })).toBeVisible();

    const nav = page.getByRole('navigation', { name: 'Explorer' }).first();
    await nav.getByRole('treeitem', { name: /^Shared with me/ }).click();
    await expect(page).toHaveURL(/\/explorer\/shared\?q=payment$/);
    await nav.getByRole('treeitem', { name: /^Home/ }).click();
    await expect(page).toHaveURL(/\/explorer\/home$/);
    await expect(field(page)).toHaveValue('');
    // Back restores the lens of the entry it lands on.
    await page.goBack();
    await expect(page).toHaveURL(/\/explorer\/shared\?q=payment$/);
    await expect(field(page)).toHaveValue('payment');
    expectNoPageErrors(pageErrors);
  });

  // Each retired address is its own test: two full page loads and a seeded library share one
  // test's time budget badly on a busy runner.
  test('the retired Unsorted address opens the My documents root', async ({ page, pageErrors }) => {
    await darkVisitor(page, await mintSignedGuest(page.request));
    await page.goto('/explorer/unsorted');
    await expect(page).toHaveURL(/\/explorer\/all$/);
    await expect(page.getByRole('heading', { name: 'My documents', level: 1 })).toBeVisible();
    expectNoPageErrors(pageErrors);
  });

  test('the retired Generated address opens Made by AI', async ({ page, pageErrors, baseURL }) => {
    const owner = await mintSignedGuest(page.request);
    await darkVisitor(page, owner);
    await seed(page, owner, new URL(baseURL!).origin);
    await page.goto('/explorer/generated');
    await expect(page).toHaveURL(/\/explorer\/search\?q=made-by%3Aai$/);
    await expect(page.getByRole('button', { name: 'Remove filter Made by AI' })).toBeVisible();
    await expect(docLink(page, 'AI payment flow')).toBeVisible({ timeout: 30_000 });
    await expect(docLink(page, 'Roadmap')).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });

  test('on a phone the field takes its own row and the chips scroll', async ({
    page,
    pageErrors,
    baseURL,
  }) => {
    const owner = await mintSignedGuest(page.request);
    await darkVisitor(page, owner);
    await seed(page, owner, new URL(baseURL!).origin);
    await page.setViewportSize({ width: 390, height: 844 });
    await arrive(page, '/explorer/all');
    await expect(page.getByRole('heading', { name: 'My documents', level: 1 })).toBeVisible();
    const box = await field(page).boundingBox();
    expect(box!.width).toBeGreaterThan(250);
    await filters(page).getByRole('button', { name: 'Made by AI' }).click();
    await expect(docLink(page, 'AI payment flow')).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: test.info().outputPath('phone-made-by-ai.png') });
    expectNoPageErrors(pageErrors);
  });
});
