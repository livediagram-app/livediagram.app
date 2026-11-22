import type { Locator, Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from '../fixtures';
import { knowledgebaseId, pageTree, startScreen, treeShape } from '../knowledgebase';
import { person, saveKey, signedInKnowledgebase } from './knowledge-session';
import { installSession } from './session';

// Describe to Set Up (docs/specs/030-knowledgebase/describe-to-set-up.md; blueprints/describe-to-set-up.md): a new
// knowledgebase opens on its start screen, which offers Describe to Set Up at its rail's foot as the sidebar does
// while it is empty, and the dialog's three steps turn a description into pages. No model is called: the stack's stand-in
// answers for both providers and for built-in AI (scripts/e2e-claude-stand-in.mjs `SETUP_STRUCTURE`), and the keys
// here are made up.

const KEY = 'sk-ant-e2e-not-a-real-key-7Qx2Lm9f3c';
const OPENAI_KEY = 'sk-proj-e2e-not-a-real-key-4Hd8Rt2v9c';
const DESCRIPTION =
  'The engineering handbook for a 12 person logistics startup: how we ship, on-call and decisions.';

const setupButton = (page: Page): Locator =>
  page.getByRole('button', { name: 'Describe to Set Up', exact: true });
const setupDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Describe to Set Up' });
const suggestedPages = (dialog: Locator): Locator =>
  dialog.getByRole('list', { name: 'Suggested Pages' }).getByRole('listitem');
const titlesOf = (dialog: Locator): Promise<string[]> =>
  suggestedPages(dialog)
    .getByRole('textbox', { name: 'Page Title' })
    .evaluateAll((fields) => fields.map((field) => (field as HTMLInputElement).value));

async function describeAndSuggest(dialog: Locator): Promise<void> {
  await dialog.getByRole('textbox', { name: 'What Is This Knowledgebase For?' }).fill(DESCRIPTION);
  await dialog.getByRole('button', { name: 'Suggest a Structure' }).click();
  await expect(suggestedPages(dialog)).toHaveCount(5);
}

test('a new knowledgebase opens on its start screen, whose Describe to Set Up turns a description into pages', async ({
  page,
  pageErrors,
}) => {
  // `/new` with nothing asked: the editor's address, the start screen over Start Here.
  const who = person('Ada', 'Lovelace');
  await installSession(page, who);
  await page.goto('/new');
  await page.waitForURL(/\/document\/[0-9a-f-]{36}/, { timeout: 30_000 });
  const start = startScreen(page);
  await expect(start).toBeVisible({ timeout: 30_000 });
  const id = knowledgebaseId(page);
  await expect(page.getByRole('button', { name: 'Share, Private' })).toBeVisible();
  expect(await treeShape(page)).toHaveLength(1);

  // Empty: the sidebar offers Describe to Set Up, directly above New Page, and so does the start's foot.
  await saveKey(page, who, id, KEY);
  const button = page
    .getByRole('complementary', { name: 'Pages' })
    .getByRole('button', { name: 'Describe to Set Up', exact: true });
  await expect(button).toBeVisible();
  // No line under it: what it does is its hover card's.
  await expect(
    page.getByText('Tell AI what this is for and get a page structure.').filter({ visible: true }),
  ).toHaveCount(0);
  const newPage = page.getByRole('button', { name: 'New Page', exact: true });
  expect((await button.boundingBox())!.y).toBeLessThan((await newPage.boundingBox())!.y);

  // The start's Describe to Set Up card closes it and opens the same dialog.
  await start.locator('[data-start-card="describe"]').click();
  await expect(start).toHaveCount(0);
  const dialog = setupDialog(page);
  await expect(dialog.getByRole('listitem').filter({ hasText: 'Describe' })).toHaveAttribute(
    'aria-current',
    'step',
  );
  const suggested = page.waitForResponse(
    (r) => r.request().method() === 'POST' && /\/setup\/suggest$/.test(new URL(r.url()).pathname),
  );
  await expect(dialog.locator('[data-setup-ai]')).toHaveText("Uses your team's key");
  await describeAndSuggest(dialog);
  expect((await suggested).ok()).toBe(true);
  expect(((await (await suggested).json()) as { provider: string }).provider).toBe('anthropic');
  expect(await titlesOf(dialog)).toEqual([
    'Getting Started',
    'Local Setup',
    'How We Ship',
    'On-Call',
    'Decisions',
  ]);
  await expect(dialog.getByRole('textbox', { name: 'Knowledgebase Name' })).toHaveValue(
    'Engineering Handbook',
  );
  await expect(dialog.getByRole('button', { name: 'Create 5 Pages' })).toBeVisible();
  // Nothing has been written yet.
  expect(await treeShape(page)).toHaveLength(1);

  // Untick one page, rename another.
  await dialog.getByRole('checkbox', { name: 'Create Decisions' }).uncheck();
  await suggestedPages(dialog).nth(2).getByRole('textbox', { name: 'Page Title' }).fill('Shipping');
  await dialog.getByRole('button', { name: 'Create 4 Pages' }).click();

  // The dialog closes on the first new page, and the tree is the structure: Start Here became its first page.
  await expect(dialog).toHaveCount(0);
  const tree = pageTree(page);
  for (const name of ['Getting Started', 'Local Setup', 'Shipping', 'On-Call'])
    await expect(tree.getByRole('treeitem', { name: new RegExp(`^${name}`) })).toBeVisible();
  await expect(tree.getByRole('treeitem')).toHaveCount(4);
  await expect(
    tree.getByRole('treeitem', { name: /Start Here|Decisions|How We Ship/ }),
  ).toHaveCount(0);
  await expect(page.locator('[data-knowledgebase-name]')).toHaveText('Engineering Handbook');
  // The page it opened on holds its title, its line and its headings.
  await expect(page.locator('.article-flow')).toContainText('What a new engineer needs');
  await expect(page.locator('.article-flow')).toContainText('Your First Change');
  // No longer empty: the control has left the sidebar.
  await expect(setupButton(page)).toHaveCount(0);

  // The pages are stored: a reload finds them.
  await page.reload();
  await expect(pageTree(page).getByRole('treeitem')).toHaveCount(4);
  expectNoPageErrors(pageErrors);
});

test('with no key it runs on built-in AI at once, and on an OpenAI key once one is set', async ({
  page,
  pageErrors,
}) => {
  const { who, id } = await signedInKnowledgebase(page);
  // What the control does is its hover card, not a line under it.
  await setupButton(page).hover();
  await expect(
    page.getByText('Tell AI what this is for and get a page structure.').filter({ visible: true }),
  ).toBeVisible();
  await setupButton(page).click();
  const dialog = setupDialog(page);
  // No key is no stop: step 1 is there, saying quietly which AI answers.
  await expect(
    dialog.getByRole('textbox', { name: 'What Is This Knowledgebase For?' }),
  ).toBeVisible();
  await expect(dialog.locator('[data-setup-ai]')).toHaveText('Uses built-in AI');
  await expect(dialog.getByRole('button', { name: 'Open AI Settings' })).toHaveCount(0);
  // Built-in AI answers (the stand-in's Workers AI route, as the binding would).
  const builtIn = page.waitForResponse(
    (r) => r.request().method() === 'POST' && /\/setup\/suggest$/.test(new URL(r.url()).pathname),
  );
  await describeAndSuggest(dialog);
  expect(((await (await builtIn).json()) as { provider: string }).provider).toBe('built-in');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  expect(await treeShape(page)).toHaveLength(1);

  // The team's OpenAI key set: the line says so, and the suggestion is made on OpenAI (the stand-in's Responses
  // route).
  await saveKey(page, who, id, OPENAI_KEY, 'openai');
  await page.reload();
  await setupButton(page).click();
  await expect(dialog.locator('[data-setup-ai]')).toHaveText("Uses your team's key");
  const onKey = page.waitForResponse(
    (r) => r.request().method() === 'POST' && /\/setup\/suggest$/.test(new URL(r.url()).pathname),
  );
  await describeAndSuggest(dialog);
  expect(((await (await onKey).json()) as { provider: string }).provider).toBe('openai');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  expect(await treeShape(page)).toHaveLength(1);
  expect(await page.content()).not.toContain(OPENAI_KEY);
  expectNoPageErrors(pageErrors);
});
