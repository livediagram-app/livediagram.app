import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from '../fixtures';
import { expectCaretInTitle, pageRow, titleOf, writeLines, writing } from '../knowledgebase';
import { openView, saveKey, savedWith, signedInKnowledgebase } from './knowledge-session';

// The toolbar's Save, then Edit: matched by how their names start (Save may carry its shortcut, "Save \u2318S"), so
// the spec follows the toolbar whichever way it is labelled. Readers, the tree and the index see only saved writing.
async function saveAndEdit(page: Page): Promise<void> {
  const save = page.getByRole('button', { name: /^Save(\s|$)/ });
  if (!(await save.isVisible())) return;
  await save.click();
  await page.getByRole('button', { name: /^Edit(\s|$)/ }).click();
  await expect(writing(page)).toHaveAttribute('contenteditable', 'true');
}

// Names the open page and saves it.
async function namePage(page: Page, name: string): Promise<void> {
  await expectCaretInTitle(page);
  await page.keyboard.type(name);
  await saveAndEdit(page);
  await expect(pageRow(page, name)).toBeVisible();
  await titleOf(page).click();
  await page.keyboard.press('End');
}

// AI Context in a page's right rail (docs/specs/030-knowledgebase/ai-knowledge.md "AI Context on a page"), end to
// end through the real Ask route and Page Health's read, with the stack's stand-in answering for Anthropic
// (scripts/e2e-claude-stand-in.mjs: a question that finds passages is answered citing the first).

test.use({ viewport: { width: 1440, height: 860 } });

const KEY = 'sk-ant-e2e-not-a-real-key-0000';
const QUESTION = 'How do I restart the queue worker?';
const rail = (page: Page) => page.getByRole('complementary', { name: 'Page Info' });
const aiContext = (page: Page) => rail(page).getByRole('region', { name: 'AI Context' });
// Read This Week's panel holds the page's 30-day trend; the questions Ask answered from the page sit under On This
// Page (ai-knowledge.md "Page Insights": merged into Read This Week, owner 2026-11-22).
const activity = (page: Page) => rail(page).getByRole('region', { name: 'Page Activity' });
const answeredFrom = (page: Page) =>
  rail(page).getByRole('region', { name: 'Answered From This Page' });

async function runbook(page: Page) {
  const made = await signedInKnowledgebase(page);
  await namePage(page, 'Runbook');
  const saved = savedWith(page, 'blue lever');
  await writeLines(page, 'Restart the queue worker with the blue lever.');
  await saveAndEdit(page);
  await saved;
  await saveKey(page, made.who, made.id, KEY);
  return made;
}

test('a question Ask answered from the page shows under Answered From This Page, and counts as cited', async ({
  page,
  pageErrors,
}) => {
  await runbook(page);
  // The owner is an Editor: the switch is theirs, off, with the page's size.
  const always = aiContext(page).getByRole('switch', { name: 'Always in Context' });
  await expect(always).toHaveAttribute('aria-checked', 'false');
  await expect(aiContext(page).getByText(/^About [\d,]+ tokens?$/)).toBeVisible();
  // A list with nothing in it is not shown.
  await expect(answeredFrom(page)).toHaveCount(0);
  // A page made today: Read This Week shows, and nothing in AI Context counts agents' reads.
  await expect(activity(page)).toBeVisible();
  await expect(aiContext(page).getByText('Read by Agents')).toHaveCount(0);

  for (let i = 0; i < 2; i++) {
    await openView(page, 'Ask');
    const field = page.getByRole('textbox', { name: /^Ask a (question|follow-up)$/ });
    if (i > 0) await page.getByRole('button', { name: 'New Question' }).first().click();
    await field.fill(QUESTION);
    await field.press('Enter');
    await expect(
      page.getByRole('region', { name: 'Ask' }).getByRole('article', { name: 'Answer' }).last(),
    ).toHaveAttribute('data-status', 'done');
  }

  // Page Health is read once a page a session: a reload reads it anew.
  await openView(page, 'Pages');
  await page.reload();
  const answered = answeredFrom(page).locator('[data-answered-question]');
  await expect(answered).toHaveCount(1);
  await expect(answered).toContainText(QUESTION);
  await expect(answered).toContainText('Asked 2 times');
  await expect(answeredFrom(page).getByText('Answered From This Page')).toBeVisible();
  await expect(aiContext(page).locator('[data-answered-question]')).toHaveCount(0);

  // Always in Context: on, then the tree row menu agrees.
  await always.click();
  await expect(always).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(aiContext(page).getByRole('switch', { name: 'Always in Context' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expectNoPageErrors(pageErrors);
});
