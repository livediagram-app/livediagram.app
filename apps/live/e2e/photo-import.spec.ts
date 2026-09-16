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
// is whether a real file lands in a real dialog, whether the notes it commits
// survive a round trip through the api, and whether a second run of the SAME
// photo adds nothing — which is the whole claim of the word "incremental".
test.use({ colorScheme: 'dark' });

// A 1x1 JPEG. Nothing looks at the pixels: the model is mocked, and the
// browser only has to decode it far enough to re-encode it.
const TINY_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

type Detected = {
  id: number;
  text: string;
  kind: string;
  cx: number;
  cy: number;
  w?: number;
  h?: number;
  row?: number;
  order?: number;
};

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

// The model, replaced. `fulfill` rather than a stubbed fetch so the whole
// client path runs for real: prepare, encode, POST, parse, reconcile.
async function mockModel(page: Page, body: unknown) {
  await page.route('**/api/ai/photo-notes', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

// The deployment has a model key, as far as the editor is concerned.
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

test('a photo of the wall adds only the notes the board does not have', async ({
  page,
  pageErrors,
}) => {
  await openBoard(page);
  // The seed board already holds Order placed / Payment received / Order
  // shipped. The photo shows two of those plus one that is new.
  await mockModel(
    page,
    wallResponse([
      { id: 1, text: 'Order placed', kind: 'domain-event', cx: 0.15, cy: 0.2 },
      { id: 2, text: 'Payment received', kind: 'domain-event', cx: 0.4, cy: 0.2 },
      { id: 3, text: 'Invoice sent', kind: 'domain-event', cx: 0.65, cy: 0.2 },
    ]),
  );

  await page.getByRole('button', { name: /add from photo/i }).click();
  await choosePhoto(page);

  // The review says what it found, and what of it is new.
  await expect(page.getByText(/3 read · 1 new · 2 already on the board/)).toBeVisible();
  await expect(page.getByText(/already on the board/).first()).toBeVisible();
  const add = page.getByRole('button', { name: /^Add 1 note$/ });
  await expect(add).toBeEnabled();
  await add.click();

  // One note added, three still the originals.
  await expect(notes(page)).toHaveCount(4);
  await expect(page.getByText(/Added 1 note\./)).toBeVisible();
  await page.getByRole('button', { name: /^done$/i }).click();

  // It survives the round trip through the api.
  await page.waitForTimeout(1500);
  await page.reload();
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await expect(notes(page)).toHaveCount(4);

  expectNoPageErrors(pageErrors);
});

test('the same photo twice adds nothing the second time', async ({ page, pageErrors }) => {
  await openBoard(page);
  await mockModel(
    page,
    wallResponse([{ id: 1, text: 'Invoice sent', kind: 'domain-event', cx: 0.65, cy: 0.2 }]),
  );

  await page.getByRole('button', { name: /add from photo/i }).click();
  await choosePhoto(page);
  await page.getByRole('button', { name: /^Add 1 note$/ }).click();
  await expect(notes(page)).toHaveCount(4);

  // Straight into the next run, against the board as it now is.
  await page.getByRole('button', { name: /add another photo/i }).click();
  await choosePhoto(page);
  await expect(page.getByText(/1 read · 0 new · 1 already on the board/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Add 0 notes$/ })).toBeDisabled();
  await expect(notes(page)).toHaveCount(4);

  expectNoPageErrors(pageErrors);
});

test('a photo of something that is not a wall says so, and adds nothing', async ({
  page,
  pageErrors,
}) => {
  await openBoard(page);
  await mockModel(page, { wall: false, notes: [], hint: 'This looks like a cat.' });

  await page.getByRole('button', { name: /add from photo/i }).click();
  await choosePhoto(page);
  await expect(page.getByText(/no stickies found in this photo/i)).toBeVisible();
  await expect(page.getByText(/this looks like a cat/i)).toBeVisible();
  await expect(notes(page)).toHaveCount(3);

  expectNoPageErrors(pageErrors);
});

test('an import is one undoable step', async ({ page, pageErrors }) => {
  await openBoard(page);
  await mockModel(
    page,
    wallResponse([
      { id: 1, text: 'Invoice sent', kind: 'domain-event', cx: 0.6, cy: 0.2 },
      { id: 2, text: 'Invoice paid', kind: 'domain-event', cx: 0.8, cy: 0.2 },
    ]),
  );

  await page.getByRole('button', { name: /add from photo/i }).click();
  await choosePhoto(page);
  await page.getByRole('button', { name: /^Add 2 notes$/ }).click();
  await expect(notes(page)).toHaveCount(5);
  await page.getByRole('button', { name: /^done$/i }).click();

  await page.keyboard.press('Control+z');
  await expect(notes(page)).toHaveCount(3);

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
