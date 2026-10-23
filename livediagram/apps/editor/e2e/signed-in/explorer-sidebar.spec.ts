import type { Page } from '@playwright/test';
import { seedTeam } from '../accounts-stub';
import { test, expect, expectNoPageErrors } from '../fixtures';
import { freshUserId, installSession, type StubUser } from './session';

// The Explorer sidebar on a deployment with sign-in (docs/specs/013-workspace/explorer-structure.md),
// against the signed-in export: a signed-in member sees each team as a root folder and Manage Teams
// last; a signed-out visitor sees the sign-in nudge in its place.

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

test('a signed-in member sees teams as root folders and Manage Teams last', async ({
  page,
  pageErrors,
}) => {
  const userId = freshUserId('sidebar');
  const team = crypto.randomUUID();
  // Both teams are made on liveworkspace.app; the member's tokens name them, so the api picks them up.
  const admin = { userId, email: member(userId).email };
  await seedTeam(page.request, { id: team, name: 'Design guild', admin });
  await seedTeam(page.request, { name: 'Platform', admin });
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
    'My Work',
    'Design guild',
    'Platform',
    'Manage Teams',
  ]);
  await expect(nav(page).getByRole('link', { name: /Sign in to access Teams/ })).toHaveCount(0);

  // A team with folders expands to them; Manage Teams goes to liveworkspace.app, where teams are made.
  const guild = nav(page).getByRole('treeitem', { name: 'Design guild' });
  await expect(guild).toHaveAttribute('aria-expanded', 'false');
  await guild.focus();
  await page.keyboard.press('ArrowRight');
  await expect(nav(page).getByRole('treeitem', { name: 'Roadmaps' })).toBeVisible();
  await page.route('https://liveworkspace.app/account/teams', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Teams</title>' }),
  );
  await nav(page).getByRole('treeitem', { name: 'Manage Teams' }).click();
  await expect(page).toHaveURL('https://liveworkspace.app/account/teams');
  expectNoPageErrors(pageErrors);
});

test('a signed-out visitor sees the sign-in nudge instead of Manage Teams', async ({
  page,
  pageErrors,
}) => {
  await installSession(page, null);
  await page.goto('/explorer/home');
  await expect(nav(page).getByRole('treeitem', { name: /^Home/ })).toBeVisible({
    timeout: 30_000,
  });
  expect(await rowNames(page, 'Spaces')).toEqual(['My Work']);
  const spaces = nav(page).locator('section', { has: page.getByRole('tree', { name: 'Spaces' }) });
  await expect(spaces.getByRole('link', { name: /Sign in to access Teams/ })).toBeVisible();
  expectNoPageErrors(pageErrors);
});
