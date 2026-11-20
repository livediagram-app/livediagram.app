import { expect, expectNoPageErrors, test } from '../fixtures';
import { nameOpenPage, openPageId, paragraphs, writeLines } from '../knowledgebase';
import { asPerson, openView, savedWith, signedInKnowledgebase } from './knowledge-session';

// AI Knowledge (docs/specs/030-knowledgebase/ai-knowledge.md; blueprints/ai-knowledge-ui.md): what agents know of
// the knowledgebase. Its sections with nothing in them, an agent's read arriving as its card, and an edit suggested
// through the api, accepted into the page.

test.use({ viewport: { width: 1440, height: 860 } });

test('every section shows, each with its empty state', async ({ page, pageErrors }) => {
  await signedInKnowledgebase(page);
  await openView(page, 'AI Knowledge');
  const empty: [string, string][] = [
    ['Connected Agents', 'No Agents Yet'],
    ['Pages That Disagree', 'This Needs a Claude Key'],
    ['Questions Nobody Could Answer', 'No Unanswered Questions Yet'],
    ['Edits Suggested by Agents', 'No Suggested Edits Yet'],
    ['Always in Context', 'No Pages in Context Yet'],
  ];
  for (const [section, words] of empty)
    await expect(page.getByRole('region', { name: section })).toContainText(words);
  await expect(
    page.getByRole('region', { name: 'Knowledge Health' }).getByRole('img'),
  ).toHaveAccessibleName('Of 1 page: 0 verified, 0 review due, 1 never verified.');
  await expect(page.getByRole('region', { name: 'What an Agent Sees' })).toBeVisible();
  expectNoPageErrors(pageErrors);
});

test("an agent's read of a page shows as its card under Connected Agents", async ({ page }) => {
  const { who, id } = await signedInKnowledgebase(page);
  const saved = savedWith(page, 'blue lever');
  await nameOpenPage(page, 'Runbook');
  await writeLines(page, 'Restart the queue worker with the blue lever.');
  await saved;
  const tab = openPageId(page);

  // The agent's API token, made on liveworkspace.app: the stack's accounts stand-in keeps it.
  const minted = await page.request.post('/e2e/accounts/__seed/token', {
    data: { userId: who.id, email: who.email, name: 'agent' },
  });
  expect(minted.ok()).toBe(true);
  const { secret } = (await minted.json()) as { secret: string };
  const read = await page.request.get(`/api/documents/${id}/pages/${tab}`, {
    headers: { Authorization: `Bearer ${secret}`, 'X-Liveknowledge-Agent': 'Coding Agent' },
  });
  expect(read.status()).toBe(200);
  expect(await read.text()).toContain('blue lever');

  await openView(page, 'AI Knowledge');
  const agents = page.getByRole('region', { name: 'Connected Agents' });
  await expect(agents.locator('[data-agent="Coding Agent"]')).toBeVisible();
  await expect(agents.locator('[data-agent="Coding Agent"]')).toContainText('Runbook');
  await expect(agents).not.toContainText('No Agents Yet');
});

test('an edit suggested through the api waits for an Editor, and Accept changes the page', async ({
  page,
  pageErrors,
}) => {
  const { who, id } = await signedInKnowledgebase(page);
  const saved = savedWith(page, 'blue lever');
  await nameOpenPage(page, 'Runbook');
  await writeLines(page, 'Restart the queue worker with the blue lever.');
  await saved;
  const tab = openPageId(page);

  const suggested = await page.request.post(`/api/documents/${id}/pages/${tab}/suggestions`, {
    headers: await asPerson(page, who, id),
    data: {
      reason: 'The lever was repainted in March.',
      before: 'Restart the queue worker with the blue lever.',
      after: 'Restart the queue worker with the green lever.',
    },
  });
  expect(suggested.status(), await suggested.text()).toBeLessThan(300);

  await openView(page, 'AI Knowledge');
  const suggestions = page.getByRole('region', { name: 'Edits Suggested by Agents' });
  const card = suggestions.locator('[data-suggestion]');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Runbook');
  await expect(card).toContainText('The lever was repainted in March.');
  const change = card.getByRole('group', { name: 'The change' });
  await expect(change).toContainText('blue lever');
  await expect(change).toContainText('green lever');
  // Nothing has changed yet.
  await card.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(card).toHaveCount(0);
  await expect(suggestions).toContainText('No Suggested Edits Yet');

  await openView(page, 'Pages');
  await expect(paragraphs(page).filter({ hasText: 'green lever' })).toBeVisible();
  await expect(paragraphs(page).filter({ hasText: 'blue lever' })).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});
