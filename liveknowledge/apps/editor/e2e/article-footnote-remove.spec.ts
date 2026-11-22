import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from './fixtures';
import { newKnowledgebase, writeLines, writing } from './knowledgebase';

// Removing a footnote (docs/specs/007-editor/article-pages.md "Footnotes", "Removing one"): every way a person reaches
// for, in the writing and on the note at the page's foot, each one edit that Undo brings back whole. The owner could
// not remove one from its note line; only the real editor, its notes box and its host's history show that.

// The key that takes the caret to the start of the line: Cmd and Left on a Mac, Home elsewhere.
const LINE_START = process.platform === 'darwin' ? 'Meta+ArrowLeft' : 'Home';
const refs = (page: Page) => writing(page).locator('.article-footnote-ref');
const notes = (page: Page) => page.locator('li.article-footnote');
const noteText = (page: Page, n: number) =>
  page.locator(`li.article-footnote[data-n="${n}"] .article-footnote-text`);

/** A page with one paragraph and one footnote on its end, the note's text typed and left. */
async function withFootnote(page: Page, note = 'A note'): Promise<void> {
  await newKnowledgebase(page);
  await page.keyboard.type('Footnotes');
  await writeLines(page, 'Some writing here');
  await page.keyboard.press('ControlOrMeta+Alt+f');
  await expect(noteText(page, 1)).toBeFocused();
  if (note) await page.keyboard.type(note);
  await page.keyboard.press('Enter');
  await expect(writing(page)).toBeFocused();
  await expect(refs(page)).toHaveCount(1);
}

/** Undo brings the footnote back whole, its note's text and number in place. */
async function undoBringsItBack(page: Page, note = 'A note'): Promise<void> {
  await page.keyboard.press('ControlOrMeta+z');
  await expect(refs(page)).toHaveCount(1);
  await expect(notes(page)).toHaveCount(1);
  await expect(noteText(page, 1)).toHaveText(note);
}

async function expectGone(page: Page): Promise<void> {
  await expect(refs(page)).toHaveCount(0);
  await expect(notes(page)).toHaveCount(0);
  await expect(writing(page)).toContainText('Some writing here');
}

test('Backspace after a reference and Delete before it remove the footnote', async ({
  page,
  pageErrors,
}) => {
  await withFootnote(page);
  await page.keyboard.press('Backspace');
  await expectGone(page);
  await undoBringsItBack(page);
  await writing(page).focus();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Delete');
  await expectGone(page);
  await undoBringsItBack(page);
  expectNoPageErrors(pageErrors);
});

test('an empty note goes on Backspace, the caret back where its reference stood', async ({
  page,
  pageErrors,
}) => {
  await withFootnote(page, '');
  await refs(page).click();
  await expect(noteText(page, 1)).toBeFocused();
  await page.keyboard.press('Backspace');
  await expectGone(page);
  await expect(writing(page)).toBeFocused();
  // The caret stands where the reference was: typing goes on at the paragraph's end.
  await page.keyboard.type('!');
  await expect(writing(page)).toContainText('Some writing here!');
  expectNoPageErrors(pageErrors);
});

test('a note with text: Backspace at its start selects it, a second removes it; a selected note goes on Delete', async ({
  page,
  pageErrors,
}) => {
  await withFootnote(page);
  await noteText(page, 1).click();
  await page.keyboard.press(LINE_START);
  await page.keyboard.press('Backspace');
  // The first press only selects the note: one stray key never loses it.
  await expect(notes(page)).toHaveCount(1);
  expect(await page.evaluate(() => getSelection()?.toString())).toBe('A note');
  await page.keyboard.press('Backspace');
  await expectGone(page);
  await undoBringsItBack(page);

  await noteText(page, 1).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await expectGone(page);
  await undoBringsItBack(page);
  expectNoPageErrors(pageErrors);
});

test("a note's Remove Footnote button removes it", async ({ page, pageErrors }) => {
  await withFootnote(page);
  await notes(page).hover();
  const remove = page.getByRole('button', { name: 'Remove Footnote' });
  await expect(remove).toBeVisible();
  await remove.click();
  await expectGone(page);
  await undoBringsItBack(page);
  expectNoPageErrors(pageErrors);
});
