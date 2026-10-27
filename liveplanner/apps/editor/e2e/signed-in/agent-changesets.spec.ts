import { expect, test } from '../fixtures';
import { ADD_PAYMENTS_VIEW, ARRANGED_VIEW, RENAME_API_VIEW } from './agent-changeset-bodies';
import {
  agentSubmits,
  arrange,
  CANVAS,
  open,
  PERSON_BOX,
  storedIds,
  storedX,
  WEBBER,
} from './agent-session';
import { freshUserId, installSession } from './session';

// Agent changesets end to end (docs/specs/024-agents/agent-changesets.md; liveplanner #343): a
// person has their own, unshared project open; their agent changes it with an API token. Before
// changesets the change never reached the editor and the person's next autosave erased it. Now it
// arrives live, outlined in their colour, with a toast; it survives their save; Ctrl+Z leaves it;
// the toast's Undo reverts it; and an element they have selected is refused to the agent.
// An agent adds only what a Plan tab holds, so the project holds a Dashboard view and the agent adds
// another (agent-changeset-bodies.ts; the api's route test runs the same bodies).

test.use({ colorScheme: 'dark', viewport: { width: 1440, height: 860 } });

const PAYMENTS = '[data-element-id="payments"]';

test("an agent's changeset reaches the open editor, survives its save, and the toast's Undo reverts it", async ({
  page,
  baseURL,
  pageErrors,
}) => {
  test.setTimeout(90_000);
  const userId = freshUserId('webber');
  await installSession(page, { ...WEBBER, id: userId });
  const s = await arrange(page, baseURL!, userId);
  await open(page, s);

  // The agent writes; the person sees it arrive, outlined, with a toast naming them.
  expect((await agentSubmits(page, s, ADD_PAYMENTS_VIEW)).status()).toBe(200);
  await expect(page.locator(PAYMENTS)).toBeVisible();
  await expect(page.locator('[data-reveal-id="payments"]')).toBeVisible();
  const toast = page
    .getByRole('status')
    .filter({ hasText: 'Webber Takken changed 1 element: add payment service' });
  await expect(toast).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('agent-changeset-toast.png') });

  // Show frames what changed.
  await toast.getByRole('button', { name: "Show Webber Takken's changes" }).click();
  await expect(page.locator(PAYMENTS)).toBeInViewport();
  // The outline goes after its reveal time; the toast stays.
  await expect(page.locator('[data-reveal-id="payments"]')).toHaveCount(0, { timeout: 5_000 });
  await expect(toast).toBeVisible();

  // The person nudges their own view: their autosave keeps the agent's view.
  await page.locator('[data-element-id="api"]').click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await expect
    .poll(() => storedX(page, s, 'api'), { timeout: 10_000 })
    .toBeGreaterThan(ARRANGED_VIEW.x);
  expect(await storedIds(page, s)).toEqual(['api', PERSON_BOX.id, 'payments']);

  // Ctrl+Z undoes the person's own nudge, never the agent's change.
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => storedX(page, s, 'api'), { timeout: 10_000 }).toBe(ARRANGED_VIEW.x);
  expect(await storedIds(page, s)).toEqual(['api', PERSON_BOX.id, 'payments']);
  await expect(page.locator(PAYMENTS)).toBeVisible();

  // The toast's Undo reverts the changeset, for the person and in storage.
  await toast.getByRole('button', { name: "Undo Webber Takken's changes" }).click();
  await expect(page.getByRole('status').filter({ hasText: /^Undone/ })).toBeVisible();
  await expect(page.locator(PAYMENTS)).toHaveCount(0);
  await expect.poll(() => storedIds(page, s), { timeout: 10_000 }).toEqual(['api', PERSON_BOX.id]);
  expect(pageErrors).toEqual([]);
});

test('an element the person has selected is held from the agent', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  test.setTimeout(60_000);
  const userId = freshUserId('webber');
  await installSession(page, { ...WEBBER, id: userId });
  const s = await arrange(page, baseURL!, userId);
  // A second session of someone else would hold it; the owner's own selection never does, so the
  // person here opens the project as an edit-link visitor.
  const share = await page.request.post(`/api/projects/${s.id}/share`, {
    headers: s.session,
    data: { role: 'edit' },
  });
  const { link } = (await share.json()) as { link: { code: string } };
  const visitor = await page.context().browser()!.newContext({ baseURL, colorScheme: 'dark' });
  const bea = await visitor.newPage();
  await bea.addInitScript(() => localStorage.setItem('liveplanner:v2:name-confirmed', '1'));
  await bea.goto(`/project/shared?s=${link.code}`);
  const join = bea.getByRole('button', { name: /^join$/i });
  if (await join.isVisible({ timeout: 5_000 }).catch(() => false)) await join.click();
  await bea.locator(CANVAS).waitFor();
  await bea.locator('[data-element-id="api"]').click();

  await expect
    .poll(async () => (await agentSubmits(page, s, RENAME_API_VIEW)).status(), {
      timeout: 10_000,
    })
    .toBe(409);
  const refused = await agentSubmits(page, s, RENAME_API_VIEW);
  expect(await refused.json()).toMatchObject({ error: 'elements_held', held: [{ id: 'api' }] });
  await visitor.close();
  expect(pageErrors).toEqual([]);
});
