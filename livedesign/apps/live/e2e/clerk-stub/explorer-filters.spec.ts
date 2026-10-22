import type { Page } from '@playwright/test';
import { test, expect, expectNoPageErrors } from '../fixtures';
import { freshUserId, installClerkStub, type StubUser } from './clerk-stub';

// The Explorer's filters for a signed-in member (docs/specs/013-workspace/explorer-filters.md),
// against the Clerk-enabled export: a team's root lists its documents directly, the team's lens
// reaches its subfolders, and the Space chip names teams by name, never by id.

test.use({ colorScheme: 'dark', viewport: { width: 1280, height: 800 } });

function member(id: string): StubUser {
  return {
    id,
    firstName: 'Webber',
    lastName: 'Takken',
    email: `${id}@example.com`,
    hasImage: false,
    imageUrl: '',
    externalAccounts: [],
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

async function seedTeam(page: Page, userId: string) {
  const team = crypto.randomUUID();
  const folder = crypto.randomUUID();
  const tabs = () => [{ id: crypto.randomUUID(), name: 'Tab 1', elements: [] }];
  await asMember(page, userId, '/teams', { id: team, name: 'Design guild' });
  await asMember(page, userId, '/folders', { id: folder, name: 'Roadmaps', teamId: team });
  const doc = (name: string, extra: Record<string, unknown>) =>
    asMember(page, userId, '/documents', {
      id: crypto.randomUUID(),
      name,
      tabs: tabs(),
      intent: { mode: 'diagram' },
      ...extra,
    });
  await doc('Team charter', { teamId: team, folderId: null });
  await doc('Team AI plan', { teamId: team, folderId: folder, source: 'mcp' });
  await doc('My own notes', { folderId: null });
  return { team };
}

const field = (page: Page) => page.getByRole('combobox', { name: 'Filter documents' });
const filters = (page: Page) => page.getByRole('group', { name: 'Filters' });
const docLink = (page: Page, name: string) =>
  page.locator('main section').getByRole('link', { name, exact: true });

test('a team root lists its documents, and its lens reaches its folders', async ({
  page,
  pageErrors,
}) => {
  const userId = freshUserId('filters');
  const { team } = await seedTeam(page, userId);
  await installClerkStub(page, member(userId));
  await page.goto(`/explorer/team?id=${team}`);
  await expect(docLink(page, 'Team charter')).toBeVisible({ timeout: 30_000 });
  // No Unsorted bucket at the team's root; the folder sits beside the document.
  await expect(page.getByText('Unsorted', { exact: true })).toHaveCount(0);
  await expect(page.locator('main section').getByText('Roadmaps').first()).toBeVisible();
  await expect(docLink(page, 'Team AI plan')).toHaveCount(0);
  // A scoped view: no Space chip.
  await expect(filters(page).getByRole('button', { name: /^Space/ })).toHaveCount(0);

  await filters(page).getByRole('button', { name: 'Made by AI' }).click();
  await expect(page).toHaveURL(/q=made-by%3Aai/);
  await expect(docLink(page, 'Team AI plan')).toBeVisible();
  await expect(docLink(page, 'Team charter')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('team-made-by-ai.png') });
  // The same on a phone: the field on its own row, the chips scrolling under the title.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(docLink(page, 'Team AI plan')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('team-made-by-ai-phone.png') });
  expectNoPageErrors(pageErrors);
});

test('Search results names a team in the Space chip, its pill by name', async ({
  page,
  pageErrors,
}) => {
  const userId = freshUserId('filters');
  const { team } = await seedTeam(page, userId);
  await installClerkStub(page, member(userId));
  await page.goto('/explorer/search');
  await expect(docLink(page, 'My own notes')).toBeVisible({ timeout: 30_000 });
  await expect(docLink(page, 'Team charter')).toBeVisible({ timeout: 30_000 });

  await filters(page).getByRole('button', { name: 'Space, any' }).click();
  const listbox = page.getByRole('listbox', { name: 'Space' });
  await listbox.getByRole('option', { name: 'Design guild' }).click();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(new RegExp(`q=space%3Ateam%3A${team}$`));
  await expect(
    page.getByRole('button', { name: 'Remove filter Space: Design guild' }),
  ).toBeVisible();
  await expect(docLink(page, 'Team charter')).toBeVisible();
  await expect(docLink(page, 'My own notes')).toHaveCount(0);
  // A team row carries what the filters read: its provenance badges it Made by AI here too.
  await expect(page.locator('main section [data-made-by-ai]')).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath('search-space-team.png') });

  // A team id that is not the reader's reads as text and is reported, never probed.
  await field(page).click();
  await field(page).press('End');
  await field(page).pressSequentially('space:team:nope ');
  await expect(
    page.getByText('That team isn’t one of yours, so it’s searched as text.').first(),
  ).toBeVisible();
  expectNoPageErrors(pageErrors);
});
