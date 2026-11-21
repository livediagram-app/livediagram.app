import type { Locator, Page } from '@playwright/test';
import { MAX_KNOWLEDGEBASE_PAGES } from '@liveknowledge/document';
import { writeZip } from '@liveworkspace/workbench/lib/zip-writer';
import { expect, expectNoPageErrors, test } from '../fixtures';
import { pageLinks, shownLinkText, titleOf, treeShape, writing } from '../knowledgebase';
import { person } from './knowledge-session';
import { installSession } from './session';

// Knowledgebase import (docs/specs/020-import-export/knowledgebase-import.md), end to end from Home: a Markdown
// folder as a .zip the test builds is read on the device, reviewed, and written into a knowledgebase of its own, its
// folders the page tree, its relative link a page link, and its picture counted (and, with no media service on
// this stack, reported as left out). A folder over the page limit is
// refused at the review, with nothing to import.

test.use({ viewport: { width: 1440, height: 860 } });

const utf8 = (text: string) => new TextEncoder().encode(text);

// From Home, for a person with no knowledgebase yet: Import opens the dialog in a new blank one.
async function importDialog(page: Page): Promise<Locator> {
  await installSession(page, person('Ada', 'Lovelace'));
  await page.goto('/home');
  await page.locator('[data-home]').getByRole('button', { name: 'Import' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import Into Page' });
  await dialog
    .getByRole('region', { name: 'A Whole Knowledgebase' })
    .getByRole('button', { name: /^Markdown Folder/ })
    .click();
  await expect(dialog.getByRole('region', { name: 'Drop a Folder or a .zip Here' })).toBeVisible();
  return dialog;
}

async function chooseZip(
  page: Page,
  dialog: Locator,
  name: string,
  files: { name: string; data: Uint8Array }[],
): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'Choose a .zip' }).click();
  await (
    await chooser
  ).setFiles({
    name,
    mimeType: 'application/zip',
    buffer: Buffer.from(writeZip(files)),
  });
}

test('a Markdown folder becomes a knowledgebase: its tree and its link, with its picture accounted for', async ({
  page,
  pageErrors,
}) => {
  const dialog = await importDialog(page);
  // A real picture: a few pixels of this page.
  const picture = await page.screenshot({ clip: { x: 0, y: 0, width: 16, height: 16 } });
  await chooseZip(page, dialog, 'team-docs.zip', [
    {
      name: 'Handbook.md',
      data: utf8(
        '# Handbook\n\nWelcome. Start with [the first week](Team/Onboarding.md).\n\n![Our logo](images/logo.png)\n',
      ),
    },
    { name: 'Team/Onboarding.md', data: utf8('# Onboarding\n\nYour first week.\n') },
    { name: 'Team/Offboarding.md', data: utf8('# Offboarding\n\nReturn the laptop.\n') },
    { name: 'images/logo.png', data: new Uint8Array(picture) },
  ]);

  // The review: what was found, before anything is written. The folder is a page too.
  const found = dialog.getByRole('region', { name: 'Found' });
  await expect(found).toContainText('4 Pages and 1 Picture Found');
  await expect(found.getByRole('list', { name: 'Pages Found' }).getByRole('listitem')).toHaveText([
    'Handbook',
    'Team',
    'Offboarding',
    'Onboarding',
  ]);
  await expect(dialog.getByRole('radio', { name: /^A New Knowledgebase/ })).toBeChecked();
  const before = page.url();
  await dialog.getByRole('button', { name: 'Import 4 Pages' }).click();

  const done = dialog.getByRole('status');
  await expect(done.getByRole('heading', { name: '4 Pages Imported' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(done.getByRole('region', { name: 'Pages Not Imported' })).toHaveCount(0);
  // This stack runs no media service, so no picture can be stored: the import says which one it left out and why,
  // and the page keeps the picture's description. (A picture placed needs the media service: not covered here.)
  await expect(done.getByRole('region', { name: 'Pictures Not Imported' })).toContainText(
    'logo.png · Pictures cannot be stored right now. Handbook keeps its description.',
  );
  await done.getByRole('button', { name: 'Open Handbook' }).click();

  // A knowledgebase of its own, named after the folder; the one the dialog opened in stays as it was.
  await expect(page).not.toHaveURL(before);
  await expect(titleOf(page)).toHaveText('Handbook');
  await expect(page.locator('[data-knowledgebase-name]')).toHaveText('team-docs');
  expect(await treeShape(page)).toEqual(['1 Handbook', '1 Team', '2 Offboarding', '2 Onboarding']);

  // The relative link is a page link, reading as its page's title; the picture is in the writing.
  const link = pageLinks(page);
  await expect(link).toHaveCount(1);
  await expect.poll(() => shownLinkText(link)).toBe('Onboarding');
  await expect(writing(page)).toContainText('Welcome. Start with');
  await expect(writing(page)).toContainText('Our logo');
  expectNoPageErrors(pageErrors);
});

test('a folder over the page limit is refused at the review, with nothing to import', async ({
  page,
}) => {
  const dialog = await importDialog(page);
  const tooMany = MAX_KNOWLEDGEBASE_PAGES + 1;
  await chooseZip(
    page,
    dialog,
    'too-many.zip',
    Array.from({ length: tooMany }, (_, i) => ({
      name: `page-${String(i).padStart(3, '0')}.md`,
      data: utf8(`# Page ${i}\n`),
    })),
  );
  const refusal = dialog.getByRole('alert');
  await expect(refusal).toBeVisible();
  await expect(refusal).toContainText(String(tooMany));
  await expect(dialog.getByRole('button', { name: /^Import/ })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Choose Another' })).toBeVisible();
});
