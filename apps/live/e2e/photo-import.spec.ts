import type { Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  startTemplateDiagram,
  test,
} from './fixtures';

// Importing a photographed wall (spec/139 Phase 8), with the MODEL mocked. The
// reconciliation is unit-tested to exhaustion; what only a browser can answer
// is whether the draft lands ON the canvas as ordinary notes the author can
// correct, whether Add is one undo step, whether Discard leaves nothing behind,
// and whether what survives a reload is what should.
test.use({ colorScheme: 'dark' });

// A 1x1 JPEG. Nothing looks at the pixels: the model is mocked, and the browser
// only has to decode it far enough to re-encode it.
const TINY_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

type Detected = { id: number; text: string; kind: string; cx: number; cy: number; order?: number };

function wallResponse(notes: Detected[]) {
  return {
    wall: true,
    notes: notes.map((n, i) => ({
      colour: '#fdba74',
      size: 'square',
      w: 0.1,
      h: 0.1,
      row: 0,
      order: i,
      confidence: 0.9,
      ...n,
    })),
  };
}

async function mockModel(page: Page, body: unknown) {
  await page.route('**/api/ai/photo-notes', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function mockCapabilities(page: Page) {
  await page.route('**/api/capabilities', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ aiEnabled: true, emailEnabled: false }),
    });
  });
}

async function choosePhoto(page: Page) {
  await page.getByRole('button', { name: /add from photo/i }).click();
  await page.setInputFiles('input[type="file"]', {
    name: 'wall.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(TINY_JPEG_BASE64, 'base64'),
  });
}

async function openBoard(page: Page) {
  await mockCapabilities(page);
  await startTemplateDiagram(page, /Browse Technical templates/, /^Event storming/i);
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);
  await page.waitForTimeout(500);
}

const notes = (page: Page) =>
  page.locator('[data-canvas-a11y-root]').getByRole('img', { name: /^Sticky note/ });
const drafts = (page: Page) => page.locator('[data-photo-draft]');
const badges = (page: Page) => page.locator('[data-photo-matched]');
const bar = (page: Page) => page.locator('[data-testid="photo-draft-bar"]');

test('a photo lands as a draft on the canvas, and Add is one undo step', async ({
  page,
  pageErrors,
}) => {
  await openBoard(page);
  // The seed board holds Order placed / Payment received / Order shipped. The
  // photo shows two of those plus two that are new.
  await mockModel(
    page,
    wallResponse([
      { id: 1, text: 'Order placed', kind: 'domain-event', cx: 0.15, cy: 0.2 },
      { id: 2, text: 'Payment received', kind: 'domain-event', cx: 0.35, cy: 0.2 },
      { id: 3, text: 'Invoice sent', kind: 'domain-event', cx: 0.55, cy: 0.2 },
      { id: 4, text: 'Invoice paid', kind: 'domain-event', cx: 0.75, cy: 0.2 },
    ]),
  );

  await choosePhoto(page);

  // The draft is ON the board: two new notes outlined, the two it matched
  // badged, and the bar saying what was read.
  await expect(bar(page)).toBeVisible();
  await expect(drafts(page)).toHaveCount(2);
  await expect(badges(page)).toHaveCount(2);
  await expect(bar(page)).toContainText('4 read · 2 new · 2 already on the board');
  await expect(notes(page)).toHaveCount(5);

  // A draft note is an ORDINARY note: type into one.
  const draftNote = notes(page).nth(3);
  await draftNote.dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('Invoice raised');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /^Add 2 notes$/ }).click();
  await expect(bar(page)).toHaveCount(0);
  await expect(drafts(page)).toHaveCount(0);
  await expect(notes(page)).toHaveCount(5);

  // ONE undo takes the whole import back — the landing AND the correction.
  await page.keyboard.press('Control+z');
  await expect(notes(page)).toHaveCount(3);
  await page.keyboard.press('Control+Shift+z');
  await expect(notes(page)).toHaveCount(5);

  // …and it survives the round trip through the api, no longer a draft.
  await page.waitForTimeout(1500);
  await page.reload();
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await expect(notes(page)).toHaveCount(5);
  await expect(bar(page)).toHaveCount(0);

  expectNoPageErrors(pageErrors);
});

test('Discard leaves the board exactly as it was', async ({ page, pageErrors }) => {
  await openBoard(page);
  await mockModel(
    page,
    wallResponse([{ id: 1, text: 'Invoice sent', kind: 'domain-event', cx: 0.6, cy: 0.2 }]),
  );

  await choosePhoto(page);
  await expect(drafts(page)).toHaveCount(1);
  await expect(notes(page)).toHaveCount(4);

  await page.getByRole('button', { name: /^discard$/i }).click();
  await expect(bar(page)).toHaveCount(0);
  await expect(notes(page)).toHaveCount(3);
  // Nothing in the undo stack either: a discarded import never happened.
  await page.keyboard.press('Control+z');
  await expect(notes(page)).toHaveCount(3);

  expectNoPageErrors(pageErrors);
});

test('a draft note can be deleted before it is added', async ({ page, pageErrors }) => {
  await openBoard(page);
  await mockModel(
    page,
    wallResponse([
      { id: 1, text: 'Invoice sent', kind: 'domain-event', cx: 0.6, cy: 0.2 },
      { id: 2, text: 'Invoice paid', kind: 'domain-event', cx: 0.8, cy: 0.2 },
    ]),
  );

  await choosePhoto(page);
  await expect(drafts(page)).toHaveCount(2);
  await notes(page).nth(4).click();
  await page.keyboard.press('Delete');
  await expect(drafts(page)).toHaveCount(1);
  await expect(bar(page)).toContainText('Add 1 note');
  await page.getByRole('button', { name: /^Add 1 note$/ }).click();
  await expect(notes(page)).toHaveCount(4);

  expectNoPageErrors(pageErrors);
});

test('the same photo twice adds nothing the second time', async ({ page, pageErrors }) => {
  await openBoard(page);
  await mockModel(
    page,
    wallResponse([{ id: 1, text: 'Invoice sent', kind: 'domain-event', cx: 0.6, cy: 0.2 }]),
  );

  await choosePhoto(page);
  await page.getByRole('button', { name: /^Add 1 note$/ }).click();
  await expect(notes(page)).toHaveCount(4);

  // The same wall again, against the board as it now is.
  await choosePhoto(page);
  // Nothing new to land, so there is no draft at all — just the toast.
  await expect(bar(page)).toHaveCount(0);
  await expect(notes(page)).toHaveCount(4);

  expectNoPageErrors(pageErrors);
});

test('a photo of something that is not a wall says so, and lands nothing', async ({
  page,
  pageErrors,
}) => {
  await openBoard(page);
  await mockModel(page, { wall: false, notes: [], hint: 'This looks like a cat.' });

  await choosePhoto(page);
  await expect(page.getByText(/no stickies found in this photo/i)).toBeVisible();
  await expect(bar(page)).toHaveCount(0);
  await expect(notes(page)).toHaveCount(3);

  expectNoPageErrors(pageErrors);
});

test('a draft survives a reload, and can still be added', async ({ page, pageErrors }) => {
  await openBoard(page);
  await mockModel(
    page,
    wallResponse([{ id: 1, text: 'Invoice sent', kind: 'domain-event', cx: 0.6, cy: 0.2 }]),
  );

  await choosePhoto(page);
  await expect(drafts(page)).toHaveCount(1);
  await page.waitForTimeout(1500);
  await page.reload();
  await page.locator('[data-canvas-a11y-root]').waitFor();

  // The notes are still drafts, so the decision comes back with them — but the
  // fade and the badges do not: they were this session's reading aid.
  await expect(bar(page)).toBeVisible();
  await expect(drafts(page)).toHaveCount(1);
  await expect(badges(page)).toHaveCount(0);
  await page.getByRole('button', { name: /^Add 1 note$/ }).click();
  await expect(drafts(page)).toHaveCount(0);
  await expect(notes(page)).toHaveCount(4);

  expectNoPageErrors(pageErrors);
});

test('the reader is nowhere to be seen without a model key', async ({ page, pageErrors }) => {
  // No capabilities mock: the local api has no key, so aiEnabled is false.
  await startTemplateDiagram(page, /Browse Technical templates/, /^Event storming/i);
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);
  await expect(page.getByRole('button', { name: /add from photo/i })).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});
