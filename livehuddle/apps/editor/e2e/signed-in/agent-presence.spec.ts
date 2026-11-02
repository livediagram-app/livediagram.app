import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { arrange, open, type Setup, WEBBER } from './agent-session';
import { freshUserId, installSession } from './session';

// Agent presence end to end (docs/specs/024-agents/agent-presence.md): Webber has his own unshared document open
// while his agent works on it with an API token. The agent shows itself with a status line and a focus, as an
// avatar of its own, "Webber Takken's Agent", beside his; a ring marks what it is looking at, a short ttl takes it
// away, its reads show it on the last tab it read, and the comments it writes through the REST thread verbs land
// live.

test.use({ colorScheme: 'dark', viewport: { width: 1440, height: 860 } });

const agent = (s: Setup) => ({ Authorization: `Bearer ${s.token}`, 'X-Livehuddle-Client': 'cli' });

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

test('an agent shows itself beside its owner, expires on its ttl, follows its reads, and comments live', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  test.setTimeout(90_000);
  const userId = freshUserId('webber');
  await installSession(page, { ...WEBBER, id: userId });
  const s = await arrange(page, baseURL!, userId);
  // A second tab, for the agent's reads to move it to.
  const notesId = crypto.randomUUID();
  const notes = await page.request.put(`/api/documents/${s.id}/tabs/${notesId}`, {
    headers: s.session,
    data: { id: notesId, name: 'Notes', elements: [] },
  });
  expect(notes.ok()).toBe(true);
  await open(page, s);
  const pill = (name: string) => page.locator('div[draggable]', { hasText: name });

  // The agent shows itself: an avatar of its own beside Webber's, and a ring marking its focus.
  const set = await setPresence(page, s, {
    status: 'Adding the payment flow',
    focus: ['api'],
    ttl: 60_000,
  });
  expect(set.status()).toBe(200);
  const avatar = page.getByRole('img', {
    name: "Webber Takken's Agent (Online), Adding the payment flow",
  });
  await expect(avatar.first()).toBeVisible();
  // Webber's own avatar stays as it is, beside it.
  await expect(pill('Board').getByRole('img', { name: 'Webber Takken (Online)' })).toBeVisible();
  await expect(page.locator('[data-agent-focus-id="api"]')).toBeVisible();
  await avatar.first().hover();
  // In the card itself: the avatar also carries the line in a hidden copy it is described by.
  const card = page.locator('[data-hint="hover-card"]');
  await expect(card.getByText('Adding the payment flow', { exact: true })).toBeInViewport();
  await expect(card.getByText('Agent', { exact: true })).toBeInViewport();
  // The card fades in; the screenshot waits for it.
  await card.evaluate((el) =>
    Promise.all(el.getAnimations().map((animation) => animation.finished)),
  );
  await page.screenshot({ path: test.info().outputPath('agent-presence.png') });

  // The Collaborators modal counts Webber alone and lists his agent on a row of its own, with its status line.
  await avatar.first().click();
  const dialog = page.getByRole('dialog', { name: 'Collaborators' });
  await expect(dialog.getByText('Just you so far')).toBeVisible();
  await expect(dialog.getByText("Webber Takken's Agent", { exact: true })).toBeVisible();
  await expect(dialog.getByText('Adding the payment flow', { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('agent-presence-collaborators.png') });
  await page.keyboard.press('Escape');

  // A short ttl: the room takes the entry away on its own, and the ring with it.
  expect((await setPresence(page, s, { status: 'Almost done', ttl: 1_000 })).status()).toBe(200);
  await expect(page.getByRole('img', { name: /, Almost done$/ }).first()).toBeVisible();
  await expect(page.getByRole('img', { name: /, Almost done$/ })).toHaveCount(0, {
    timeout: 10_000,
  });
  await expect(page.locator('[data-agent-focus-id]')).toHaveCount(0);

  // The agent's reads show it too, on the last tab it read only: Notes, then back on Board.
  const read = (tabId: string) =>
    page.request.get(`/api/documents/${s.id}/tabs/${tabId}?view=outline`, {
      headers: agent(s),
    });
  expect((await read(notesId)).status()).toBe(200);
  const working = "Webber Takken's Agent (Online)";
  await expect(pill('Notes').getByRole('img', { name: working })).toBeVisible();
  await expect(pill('Board').getByRole('img', { name: working })).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('agent-presence-read-notes.png') });
  expect((await read(s.tabId)).status()).toBe(200);
  await expect(pill('Board').getByRole('img', { name: working })).toBeVisible();
  await expect(pill('Notes').getByRole('img', { name: working })).toHaveCount(0);
  await pill('Board').getByRole('img', { name: working }).hover();
  await expect(card.getByText('Working on this tab', { exact: true })).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath('agent-presence-read-board.png') });
  await page.mouse.move(700, 600);

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
