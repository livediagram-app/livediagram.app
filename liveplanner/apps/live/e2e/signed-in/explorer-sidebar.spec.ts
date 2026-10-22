import type { Page } from '@playwright/test';
import { test, expect, expectNoPageErrors } from '../fixtures';
import { freshUserId, installSession, type StubUser } from './session';

// The Explorer sidebar on a deployment with sign-in (docs/specs/013-workspace/explorer-structure.md),
// against the signed-in export: a signed-in member sees each team as a root folder and New Team
// last; a signed-out visitor sees the sign-in nudge in New Team's place.

test.use({ colorScheme: 'dark', viewport: { width: 1280, height: 800 } });

const nav = (page: Page) => page.getByRole('navigation', { name: 'Explorer' }).first();
const rowNames = (page: Page, group: string) =>
  nav(page)
    .getByRole('tree', { name: group })
    .locator(':scope > [role="treeitem"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-tree-label')));

function member(id: string): StubUser {
  return {
    id,
    firstName: 'Webber',
    lastName: 'Takken',
    email: `${id}@example.com`,
  };
}

// Calls the api as the member, with a session token the e2e stack mints.
async function asMember(page: Page, userId: string, path: string, data: unknown) {
  const token = await (await page.request.get(`/e2e/token?sub=${userId}`)).text();
  const res = await page.request.post(`/api${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data,
  });
  expect(res.ok(), `${path} failed: ${res.status()}`).toBe(true);
}

test('a signed-in member sees teams as root folders and New Team last', async ({
  page,
  pageErrors,
}) => {
  const userId = freshUserId('sidebar');
  const team = crypto.randomUUID();
  await asMember(page, userId, '/teams', { id: team, name: 'Design guild' });
  await asMember(page, userId, '/teams', { id: crypto.randomUUID(), name: 'Platform' });
  await asMember(page, userId, '/folders', {
    id: crypto.randomUUID(),
    name: 'Roadmaps',
    teamId: team,
  });
  await installSession(page, member(userId));
  await page.goto('/explorer/home');
  await expect(nav(page).getByRole('treeitem', { name: 'Design guild' })).toBeVisible({
    timeout: 30_000,
  });

  expect(await rowNames(page, 'Spaces')).toEqual([
    'My Projects',
    'Design guild',
    'Platform',
    'New Team',
  ]);
  await expect(nav(page).getByRole('link', { name: /Sign in to access Teams/ })).toHaveCount(0);

  // A team with folders expands to them; New Team opens the form.
  const guild = nav(page).getByRole('treeitem', { name: 'Design guild' });
  await expect(guild).toHaveAttribute('aria-expanded', 'false');
  await guild.focus();
  await page.keyboard.press('ArrowRight');
  await expect(nav(page).getByRole('treeitem', { name: 'Roadmaps' })).toBeVisible();
  await nav(page).getByRole('treeitem', { name: 'New Team' }).click();
  await expect(page.getByRole('dialog', { name: /New Team/i })).toBeVisible();
  expectNoPageErrors(pageErrors);
});

test('a signed-out visitor sees the sign-in nudge instead of New Team', async ({
  page,
  pageErrors,
}) => {
  await installSession(page, null);
  await page.goto('/explorer/home');
  await expect(nav(page).getByRole('treeitem', { name: /^Home/ })).toBeVisible({
    timeout: 30_000,
  });
  expect(await rowNames(page, 'Spaces')).toEqual(['My Projects']);
  const spaces = nav(page).locator('section', { has: page.getByRole('tree', { name: 'Spaces' }) });
  await expect(spaces.getByRole('link', { name: /Sign in to access Teams/ })).toBeVisible();
  expectNoPageErrors(pageErrors);
});
