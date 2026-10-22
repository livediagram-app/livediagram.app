import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { arrange, open, type Setup, WEBBER } from './agent-session';
import { freshUserId, installClerkStub } from './clerk-stub';

// Agent presence end to end (docs/specs/024-agents/agent-presence.md): Webber has his own unshared document open
// while his agent works on it with an API token. The agent shows itself with a status line and a focus; his stack
// shows it on his own avatar, a ring marks what it is looking at, a short ttl takes it away, and the comments it
// writes through the REST thread verbs land live.

test.use({ colorScheme: 'dark', viewport: { width: 1440, height: 860 } });

const agent = (s: Setup) => ({ Authorization: `Bearer ${s.token}`, 'X-Livediagram-Client': 'cli' });

function setPresence(page: Page, s: Setup, data: unknown) {
  return page.request.put(`/api/documents/${s.id}/tabs/${s.tabId}/presence`, {
    headers: agent(s),
    data,
  });
}

function comments(page: Page, s: Setup, path: string, data?: unknown) {
  return page.request.post(`/api/documents/${s.id}/tabs/${s.tabId}/comments${path}`, {
    headers: agent(s),
    ...(data === undefined ? {} : { data }),
  });
}

test('an agent shows its status and focus to its owner, expires on its ttl, and comments live', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  test.setTimeout(90_000);
  const userId = freshUserId('webber');
  await installClerkStub(page, { ...WEBBER, id: userId });
  const s = await arrange(page, baseURL!, userId);
  await open(page, s);

  // The agent shows itself: on Webber's own tab, its status goes on his own avatar, and a ring marks its focus.
  const set = await setPresence(page, s, {
    status: 'Adding the payment flow',
    focus: ['api'],
    ttl: 60_000,
  });
  expect(set.status()).toBe(200);
  const avatar = page.getByRole('img', { name: /, Adding the payment flow$/ });
  await expect(avatar.first()).toBeVisible();
  await expect(page.locator('[data-agent-focus-id="api"]')).toBeVisible();
  await avatar.first().hover();
  await expect(page.getByText(/^Adding the payment flow · Online/)).toBeInViewport();
  // The card fades in; the screenshot waits for it.
  await page
    .locator('[data-hint="hover-card"]')
    .evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)));
  await page.screenshot({ path: test.info().outputPath('agent-presence.png') });

  // The Collaborators modal counts Webber alone and shows the status line on his row.
  await avatar.first().click();
  const dialog = page.getByRole('dialog', { name: 'Collaborators' });
  await expect(dialog.getByText('Just you so far')).toBeVisible();
  await expect(dialog.getByText(/^Adding the payment flow · Online/)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('agent-presence-collaborators.png') });
  await page.keyboard.press('Escape');

  // A short ttl: the room takes the entry away on its own, and the ring with it.
  expect((await setPresence(page, s, { status: 'Almost done', ttl: 1_000 })).status()).toBe(200);
  await expect(page.getByRole('img', { name: /, Almost done$/ }).first()).toBeVisible();
  await expect(page.getByRole('img', { name: /, Almost done$/ })).toHaveCount(0, {
    timeout: 10_000,
  });
  await expect(page.locator('[data-agent-focus-id]')).toHaveCount(0);

  // Comments through the REST verbs land live: the add, a reply, then the resolve takes the badge away.
  const added = await comments(page, s, '', {
    elementId: 'api',
    text: 'Should this be idempotent?',
  });
  expect(added.status()).toBe(201);
  const { comment } = (await added.json()) as { comment: { id: string } };
  await expect(page.getByRole('button', { name: 'Open 1 comment' })).toBeVisible();
  expect(
    (await comments(page, s, `/${comment.id}/reply`, { text: 'Yes, keyed by order id.' })).status(),
  ).toBe(201);
  await expect(page.getByRole('button', { name: 'Open 2 comments' })).toBeVisible();
  expect((await comments(page, s, `/${comment.id}/resolve`)).status()).toBe(204);
  await expect(page.getByRole('button', { name: /^Open \d+ comments?$/ })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
