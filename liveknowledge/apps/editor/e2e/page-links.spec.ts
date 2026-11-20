import { expect, expectNoPageErrors, test } from './fixtures';
import {
  addPage,
  linkPicker,
  nameOpenPage,
  newKnowledgebase,
  newServerKnowledgebase,
  openPage,
  pageLinks,
  pageRow,
  pageTree,
  rowVerb,
  shownLinkText,
  titleOf,
  treeShape,
  writeLines,
  writing,
} from './knowledgebase';

// Page links and Linked From (docs/specs/030-knowledgebase/links-and-embeds.md; blueprints/knowledge-ui.md "Page
// links", "Backlinks"), in the real writing: the `[[` picker, a link that always reads as its page's current title,
// Create Page, a deleted target, and the backlinks the room keeps.

// Start Here renamed Handbook, then Onboarding and Offboarding at the top level, Handbook open again.
async function threePages(page: import('@playwright/test').Page): Promise<void> {
  await nameOpenPage(page, 'Handbook');
  await addPage(page, 'Onboarding');
  await addPage(page, 'Offboarding');
  await openPage(page, 'Handbook');
}

test('the [[ picker filters as it is typed in, Enter links, and the link follows a rename and opens its page', async ({
  page,
  pageErrors,
}) => {
  await newKnowledgebase(page);
  await threePages(page);

  await writeLines(page, 'See [[');
  const picker = linkPicker(page);
  // Every other page is offered; the open page is not linked to itself.
  await expect(picker.getByRole('group', { name: 'Pages' }).getByRole('option')).toHaveText([
    /^Onboarding/,
    /^Offboarding/,
  ]);
  await page.keyboard.type('Off');
  await expect(picker.getByRole('group', { name: 'Pages' }).getByRole('option')).toHaveText([
    /^Offboarding/,
  ]);
  await page.keyboard.press('Enter');
  await expect(picker).toBeHidden();

  const link = pageLinks(page);
  await expect(link).toHaveCount(1);
  expect(await shownLinkText(link)).toBe('Offboarding');
  // What was typed to find the page is gone from the writing: the link stands in its place.
  await expect(writing(page)).not.toContainText('[[');

  // Renamed in the tree, the link reads the new title with no change to this page's writing.
  await rowVerb(page, 'Offboarding', 'Rename');
  const field = pageTree(page).getByRole('textbox', { name: 'Page name' });
  await field.fill('Leaving');
  await page.keyboard.press('Enter');
  await expect(pageRow(page, 'Leaving')).toBeVisible();
  await expect.poll(() => shownLinkText(link)).toBe('Leaving');

  // Pressing the link opens its page.
  await link.click();
  await expect(pageRow(page, 'Leaving')).toHaveAttribute('aria-current', 'page');
  await expect(titleOf(page)).toHaveText('Leaving');
  expectNoPageErrors(pageErrors);
});

test('Create Page in the picker makes a subpage of the open page and links to it', async ({
  page,
  pageErrors,
}) => {
  await newKnowledgebase(page);
  await nameOpenPage(page, 'Handbook');

  await writeLines(page, 'Read [[Travel Policy');
  const create = linkPicker(page).getByRole('option', { name: /^Create Page/ });
  await expect(create).toContainText('Travel Policy');
  await create.click();

  // A subpage of the page it was made from, which stays open.
  await expect(pageRow(page, 'Travel Policy')).toBeVisible();
  expect(await treeShape(page)).toEqual(['1 Handbook', '2 Travel Policy']);
  await expect(pageRow(page, 'Handbook')).toHaveAttribute('aria-current', 'page');
  const link = pageLinks(page);
  await expect(link).toHaveCount(1);
  await expect.poll(() => shownLinkText(link)).toBe('Travel Policy');
  expectNoPageErrors(pageErrors);
});

test('a link to a deleted page reads Deleted Page and goes nowhere', async ({ page, pageErrors }) => {
  await newKnowledgebase(page);
  await threePages(page);
  await writeLines(page, 'See [[Onb');
  await page.keyboard.press('Enter');
  const link = pageLinks(page);
  await expect.poll(() => shownLinkText(link)).toBe('Onboarding');

  await rowVerb(page, 'Onboarding', 'Delete');
  await page
    .getByRole('dialog', { name: 'Delete Onboarding?' })
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await expect(pageRow(page, 'Onboarding')).toHaveCount(0);

  // The link stays in the writing, struck through, and pressing it opens nothing.
  await expect(link).toHaveCount(1);
  await expect.poll(() => shownLinkText(link)).toBe('Deleted Page');
  await expect(link).toHaveCSS('text-decoration-line', 'line-through');
  await link.click();
  await expect(pageRow(page, 'Handbook')).toHaveAttribute('aria-current', 'page');
  expectNoPageErrors(pageErrors);
});

// Backlinks are the room's (its link table, rewritten when a page's writing is saved), so this knowledgebase is on
// the server.
test('Linked From at the foot of a page lists the pages that link to it', async ({
  page,
  pageErrors,
}) => {
  await newServerKnowledgebase(page);
  await threePages(page);

  // The save that carries the link is what the room rewrites its link table from: Linked From is read when a page
  // opens, so the target is opened once that save has landed.
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === 'PUT' &&
      /\/api\/documents\/[^/]+\/tabs\//.test(r.url()) &&
      (r.request().postData() ?? '').includes('"page":'),
  );
  await writeLines(page, 'Start with [[Onb');
  await page.keyboard.press('Enter');
  await expect(pageLinks(page)).toHaveCount(1);
  expect((await saved).ok()).toBe(true);

  await openPage(page, 'Onboarding');
  const linkedFrom = page.getByRole('navigation', { name: 'Linked From' });
  await expect(linkedFrom.getByRole('link', { name: 'Handbook' })).toBeVisible();
  // A page nothing links to has no such section at all.
  await openPage(page, 'Offboarding');
  await expect(page.getByRole('navigation', { name: 'Linked From' })).toHaveCount(0);

  // The chip opens the page that links here.
  await openPage(page, 'Onboarding');
  await linkedFrom.getByRole('link', { name: 'Handbook' }).click();
  await expect(pageRow(page, 'Handbook')).toHaveAttribute('aria-current', 'page');
  expectNoPageErrors(pageErrors);
});
