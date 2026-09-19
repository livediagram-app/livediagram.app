import type { Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  startTemplateDiagram,
  test,
} from './fixtures';
import { wallPhotoPng, type WallNote } from './fixtures/wall-photo';

// Importing a photographed wall (spec/139 Phase 8). The DETECTOR is real —
// it runs in the browser on a PNG this test draws, which is the half of the
// feature a mock would hide — and only the model's reading is stubbed.
//
// What only a browser can answer: whether a real image file becomes real
// draft notes at the right kinds and places, whether Add is one undo step,
// whether Discard leaves nothing, and what survives a reload.
test.use({ colorScheme: 'dark' });

const ORANGE = '#fdba74'; // domain-event
const BLUE = '#93c5fd'; // command

// A wall, drawn: three notes in a row, in reading order.
function wall(notes: WallNote[]) {
  return { name: 'wall.png', mimeType: 'image/png', buffer: wallPhotoPng(900, 400, notes) };
}

const THREE_EVENTS: WallNote[] = [
  { fill: ORANGE, x: 60, y: 120, w: 180, h: 180 },
  { fill: ORANGE, x: 340, y: 120, w: 180, h: 180 },
  { fill: ORANGE, x: 620, y: 120, w: 180, h: 180 },
];

// The reader, stubbed: the detector's ids are stable (rows top-down, then
// left-to-right), so a fixture can answer by index.
async function mockReader(page: Page, texts: string[]) {
  await page.route('**/api/ai/read-notes', async (route) => {
    const body = route.request().postDataJSON() as { crops: { id: number }[] };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        texts: body.crops.map((c) => ({
          id: c.id,
          text: texts[c.id] ?? '',
          legible: (texts[c.id] ?? '') !== '',
        })),
      }),
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

async function openBoard(page: Page) {
  await mockCapabilities(page);
  await startTemplateDiagram(page, /Browse Technical templates/, /^Event storming/i);
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);
  await page.waitForTimeout(500);
}

async function importPhoto(page: Page, notes: WallNote[]) {
  await page.getByRole('button', { name: /add from photo/i }).click();
  await page.setInputFiles('input[type="file"]', wall(notes));
  // The review wizard (spec/139 Phase 9) appears after detection + reading,
  // unless the photo had no paper in it — then a toast comes instead.
  const overlay = page.locator('[data-testid="photo-review-overlay"]');
  const emptyToast = page.getByText(/no stickies found in this photo/i);
  // Either the review opens, or (an empty photo) a toast says nothing was
  // found. Race both so an empty photo does not wait out the overlay timeout
  // while its toast comes and goes.
  await Promise.race([
    overlay.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => false),
    emptyToast.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => false),
  ]);
  if (await overlay.isVisible().catch(() => false)) {
    // The photo and boxes appear immediately; the words stream in behind them.
    // Wait for the reading stage to finish before adding, so the text lands.
    await page
      .getByText('Reading the words…')
      .waitFor({ state: 'hidden', timeout: 10_000 })
      .catch(() => {});
    await page.getByRole('button', { name: /^Add \d+ notes?$/ }).click();
  }
}

// Pan the canvas with Space + drag (the editor's own pan, whatever tool is
// active). The floating panels overlay the left and right edges, so a note the
// import placed at the right of the board can sit under the palette — as any
// note dropped there would. Panning is how a person would reach it too.
async function panBy(page: Page, dx: number, dy: number) {
  const canvas = await page.locator('[data-canvas-a11y-root]').boundingBox();
  const cx = canvas!.x + canvas!.width / 2;
  const cy = canvas!.y + canvas!.height / 2;
  await page.keyboard.down('Space');
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Space');
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
  // photo shows two of those plus one that is new.
  await mockReader(page, ['Order placed', 'Payment received', 'Invoice sent']);

  await importPhoto(page, THREE_EVENTS);

  await expect(bar(page)).toBeVisible();
  await expect(drafts(page)).toHaveCount(1);
  await expect(badges(page)).toHaveCount(2);
  await expect(bar(page)).toContainText('3 read · 1 new · 2 already on the board');
  await expect(notes(page)).toHaveCount(4);

  // A draft note is an ORDINARY note: type into it before accepting. Pan it
  // clear of the palette first, exactly as a person reaching for it would.
  await panBy(page, -260, 0);
  await notes(page).nth(3).dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('Invoice raised');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /^Add 1 note$/ }).click();
  await expect(bar(page)).toHaveCount(0);
  await expect(drafts(page)).toHaveCount(0);
  await expect(notes(page)).toHaveCount(4);

  // ONE undo takes the whole import back — the landing AND the correction.
  await page.keyboard.press('Control+z');
  await expect(notes(page)).toHaveCount(3);
  await page.keyboard.press('Control+Shift+z');
  await expect(notes(page)).toHaveCount(4);

  // …and it survives the round trip through the api, no longer a draft.
  await page.waitForTimeout(1500);
  await page.reload();
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await expect(notes(page)).toHaveCount(4);
  await expect(bar(page)).toHaveCount(0);

  expectNoPageErrors(pageErrors);
});

test('the detector reads the KINDS off the paper', async ({ page, pageErrors }) => {
  await openBoard(page);
  await mockReader(page, ['Place order', 'Order placed']);
  // A blue command beside an orange event: two kinds, from colour alone.
  await importPhoto(page, [
    { fill: BLUE, x: 60, y: 120, w: 180, h: 180 },
    { fill: ORANGE, x: 340, y: 120, w: 180, h: 180 },
  ]);

  await expect(bar(page)).toBeVisible();
  // "Order placed" is on the board already; the command is new.
  await expect(drafts(page)).toHaveCount(1);
  await page.getByRole('button', { name: /^Add 1 note$/ }).click();

  // It arrived as a COMMAND — the notation's blue — without the model being
  // asked what colour anything was.
  const added = notes(page).nth(3);
  await expect(added).toBeVisible();
  const fill = await added.evaluate((node) => {
    const painted = node.querySelector('[style*="background"]') ?? node;
    return getComputedStyle(painted as Element).backgroundColor;
  });
  expect(fill).toContain('147, 197, 253');

  expectNoPageErrors(pageErrors);
});

test('an unreadable sticky still lands, empty', async ({ page, pageErrors }) => {
  await openBoard(page);
  // The model could not read the third one.
  await mockReader(page, ['Order placed', 'Payment received', '']);
  await importPhoto(page, THREE_EVENTS);

  await expect(bar(page)).toBeVisible();
  // The paper WAS there, so a note lands for it — with nothing on it.
  await expect(drafts(page)).toHaveCount(1);
  await page.getByRole('button', { name: /^Add 1 note$/ }).click();
  await expect(notes(page)).toHaveCount(4);

  expectNoPageErrors(pageErrors);
});

test('Discard leaves the board exactly as it was', async ({ page, pageErrors }) => {
  await openBoard(page);
  await mockReader(page, ['Invoice sent']);
  await importPhoto(page, [{ fill: ORANGE, x: 300, y: 120, w: 180, h: 180 }]);

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
  await mockReader(page, ['Invoice sent', 'Invoice paid']);
  await importPhoto(page, [
    { fill: ORANGE, x: 200, y: 120, w: 180, h: 180 },
    { fill: ORANGE, x: 500, y: 120, w: 180, h: 180 },
  ]);

  await expect(drafts(page)).toHaveCount(2);
  // Landing selects the whole batch, so clear that first: this is "delete
  // THIS one", not "delete what just arrived".
  await page.keyboard.press('Escape');
  await panBy(page, -200, 0);
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
  await mockReader(page, ['Invoice sent']);
  const one: WallNote[] = [{ fill: ORANGE, x: 300, y: 120, w: 180, h: 180 }];

  await importPhoto(page, one);
  await page.getByRole('button', { name: /^Add 1 note$/ }).click();
  await expect(notes(page)).toHaveCount(4);

  // The same wall again, against the board as it now is: nothing new, so no
  // draft at all — just the toast.
  await importPhoto(page, one);
  await expect(bar(page)).toHaveCount(0);
  await expect(notes(page)).toHaveCount(4);

  expectNoPageErrors(pageErrors);
});

test('a photo with no paper in it says so, and never calls the model', async ({
  page,
  pageErrors,
}) => {
  await openBoard(page);
  let called = 0;
  await page.route('**/api/ai/read-notes', async (route) => {
    called += 1;
    await route.fulfill({ status: 200, body: JSON.stringify({ texts: [] }) });
  });

  await importPhoto(page, []);
  await expect(page.getByText(/no stickies found in this photo/i)).toBeVisible();
  await expect(bar(page)).toHaveCount(0);
  await expect(notes(page)).toHaveCount(3);
  expect(called).toBe(0);

  expectNoPageErrors(pageErrors);
});

test('a draft survives a reload, and can still be added', async ({ page, pageErrors }) => {
  await openBoard(page);
  await mockReader(page, ['Invoice sent']);
  await importPhoto(page, [{ fill: ORANGE, x: 300, y: 120, w: 180, h: 180 }]);

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
  // Say it, rather than depending on whether whoever runs this has a key in
  // their .dev.vars: the assertion is about a deployment WITHOUT one, and a
  // developer with a real key configured was failing this test for the one
  // reason that is not a bug.
  await page.route('**/api/capabilities', (route) =>
    route.fulfill({ json: { aiEnabled: false, emailEnabled: false } }),
  );
  await startTemplateDiagram(page, /Browse Technical templates/, /^Event storming/i);
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);
  await expect(page.getByRole('button', { name: /add from photo/i })).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});
