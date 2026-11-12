import {
  adoptGuest,
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  mintGuest,
  ownerHeaders,
  seedDocumentItem,
  test,
} from './fixtures';

// Work Tracker #266 (docs/specs/012-collaboration/speaker-note-cards.md "Writing note cards" and "Presenting"): a slide
// page's Notes popover adds, reorders and removes cards, and the presenter's card viewer flips through them.

const CANVAS = '[data-canvas-a11y-root]';

test('note cards are written, reordered and removed, then flipped through while presenting', async ({
  page,
  pageErrors,
  baseURL,
}) => {
  const owner = await mintGuest(page.request);
  const id = crypto.randomUUID();
  const tabId = crypto.randomUUID();
  const pages = [{ id: 'p0', orientation: 'landscape', kind: 'slide' }];
  const deck = {
    decks: [{ slides: [{ id: 'slide-0', tabId, elementIds: [], pageId: 'p0' }] }],
  };
  const seeded = await seedDocumentItem(
    page.request,
    ownerHeaders(owner, { Origin: new URL(baseURL!).origin }),
    {
      id,
      name: 'Talk',
      tabs: [{ id: tabId, name: 'Slides', elements: [], pages }],
      presentation: JSON.stringify(deck),
    },
  );
  expect(seeded.ok()).toBe(true);
  await adoptGuest(page, owner);
  await page.addInitScript(() => {
    localStorage.setItem('livedocuments:v2:name-confirmed', '1');
  });
  await page.goto(`/document/${id}`);
  await page.locator(CANVAS).waitFor();
  await dismissQuickTour(page);

  // Add: the empty slide offers a first card; Mod+Enter starts the next one.
  await page.getByRole('button', { name: 'Notes' }).first().click();
  await page.getByRole('button', { name: 'Add First Card' }).click();
  await page.getByRole('textbox', { name: 'Card 1' }).fill('Open with the problem');
  await page.getByRole('textbox', { name: 'Card 1' }).press('ControlOrMeta+Enter');
  await page.getByRole('textbox', { name: 'Card 2' }).fill('Show the rollout');
  await page.getByRole('textbox', { name: 'Card 2' }).press('Escape');
  const cards = page.locator('[data-note-card-text]');
  await expect(cards).toHaveText(['Open with the problem', 'Show the rollout']);

  // Reorder: Move Up on the second card puts it first.
  const second = page.getByRole('group', { name: 'Card 2 of 2' });
  await second.hover();
  await second.getByRole('button', { name: 'Move Up' }).click();
  await expect(cards).toHaveText(['Show the rollout', 'Open with the problem']);

  // Remove: the bin takes the first card, and Undo is offered.
  const first = page.getByRole('group', { name: 'Card 1 of 2' });
  await first.hover();
  await first.getByRole('button', { name: 'Remove Card' }).click();
  await expect(cards).toHaveText(['Open with the problem']);
  await expect(page.getByRole('status').getByRole('button', { name: 'Undo' })).toBeVisible();
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
  await expect(cards).toHaveText(['Show the rollout', 'Open with the problem']);
  await page.keyboard.press('Escape');

  // Presenting: the notes button opens the viewer on the first card, and the arrows flip through the cards.
  await page.getByRole('button', { name: 'Present', exact: true }).click();
  await page.getByRole('button', { name: 'Presenter notes' }).click();
  const viewer = page.getByRole('dialog', { name: 'Presenter notes' });
  await expect(viewer).toContainText('Show the rollout');
  await viewer.getByRole('button', { name: 'Next Card' }).click();
  await expect(viewer).toContainText('Open with the problem');
  await expect(viewer.getByRole('button', { name: 'Next Card' })).toBeDisabled();
  await page.keyboard.press('ArrowUp');
  await expect(viewer).toContainText('Show the rollout');
  await viewer.getByRole('button', { name: 'Go to Card 2' }).click();
  await expect(viewer).toContainText('Open with the problem');
  await expect(viewer.getByRole('button', { name: 'Previous Card' })).toBeEnabled();
  expectNoPageErrors(pageErrors);
});
