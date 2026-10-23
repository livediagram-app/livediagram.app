import type { Page } from '@playwright/test';
import { apiBase, darkVisitor } from './audit-screens';
import { expect, mintSignedGuest, ownerHeaders, test } from './fixtures';

// Tags (docs/specs/013-workspace/tags.md): tag a design from its menu, make a tag from the picker, see the chips on
// its row, and find it grouped on the Tags page and under the sidebar's Tags row.

async function seedDesign(page: Page, owner: string, origin: string, name: string) {
  const res = await page.request.post(`${apiBase}/designs`, {
    headers: ownerHeaders(owner, { Origin: origin }),
    data: {
      id: crypto.randomUUID(),
      name,
      tabs: [{ id: crypto.randomUUID(), name: 'Tab 1', elements: [] }],
    },
  });
  expect(res.ok(), `seeding ${name}: ${res.status()}`).toBe(true);
}

async function seedTag(page: Page, owner: string, origin: string, name: string, colour: string) {
  const res = await page.request.post(`${apiBase}/tags`, {
    headers: ownerHeaders(owner, { Origin: origin }),
    data: { id: crypto.randomUUID(), name, colour },
  });
  expect(res.ok(), `seeding tag ${name}: ${res.status()}`).toBe(true);
}

test.describe('tags', () => {
  test('tag a design from its menu and find it on the Tags page', async ({ page, baseURL }) => {
    const owner = await mintSignedGuest(page.request);
    const origin = new URL(baseURL!).origin;
    await darkVisitor(page, owner);
    await seedDesign(page, owner, origin, 'Roadmap');
    await seedDesign(page, owner, origin, 'Retro');
    await seedTag(page, owner, origin, 'Design', 'blue');

    await page.goto('/explorer/all');
    await page.getByRole('button', { name: 'Menu for Roadmap' }).first().click();
    await page.getByRole('menuitem', { name: 'Tags' }).click();
    const picker = page.getByRole('dialog', { name: 'Tags for Roadmap' });
    await expect(picker).toBeVisible();

    // Tick an existing tag, then make one from the field.
    await picker.getByRole('checkbox', { name: /Design/ }).click();
    await expect(picker.getByRole('checkbox', { name: /Design/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    const field = picker.getByRole('textbox', { name: 'Find or create a tag' });
    await field.fill('Q4 Launch');
    await expect(picker.getByRole('button', { name: /Create “Q4 Launch”/ })).toBeVisible();
    await field.press('Enter');
    await expect(picker.getByRole('checkbox', { name: /Q4 Launch/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.keyboard.press('Escape');
    await expect(picker).toBeHidden();

    // The row carries both chips; a chip opens its tag's page.
    await expect(page.getByRole('button', { name: 'Tag Design', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tag Q4 Launch', exact: true })).toBeVisible();

    // Saved: both links reach the api (the tag made a moment ago first), so a reload keeps them.
    await expect
      .poll(async () => {
        const res = await page.request.get(`${apiBase}/tags`, { headers: ownerHeaders(owner) });
        return ((await res.json()) as { links: unknown[] }).links.length;
      })
      .toBe(2);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Tag Q4 Launch', exact: true })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('button', { name: 'Tag Q4 Launch', exact: true }).click();
    await expect(page).toHaveURL(/\/explorer\/tags\?id=/);
    await expect(page.getByRole('heading', { level: 1, name: 'Q4 Launch' })).toBeVisible();
    await expect(page.getByText('Roadmap').first()).toBeVisible();
    await expect(page.getByText('Retro')).toHaveCount(0);

    // The Tags page groups by tag, and the sidebar lists each tag under Tags.
    await page.goto('/explorer/tags');
    await expect(page.locator('[data-tag-section]')).toHaveCount(2);
    const nav = page.getByRole('navigation', { name: 'Explorer' }).first();
    await expect(nav.getByRole('treeitem', { name: 'Design (1)' })).toBeVisible();
    await expect(nav.getByRole('treeitem', { name: 'Q4 Launch (1)' })).toBeVisible();
  });

  test('a new reader sees how to start, and makes a tag from the Tags page', async ({
    page,
    baseURL,
  }) => {
    const owner = await mintSignedGuest(page.request);
    void baseURL;
    await darkVisitor(page, owner);
    await page.goto('/explorer/tags');
    await expect(page.getByText('Group related designs with tags')).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'New Tag' }).last().click();
    const dialog = page.getByRole('dialog', { name: 'New Tag' });
    await dialog.getByRole('textbox').fill('Client: Acme');
    await dialog.getByRole('button', { name: 'Create Tag' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('[data-tag-section]')).toHaveCount(1);
    await expect(page.getByText('Nothing tagged yet.', { exact: false })).toBeVisible();
  });
});
