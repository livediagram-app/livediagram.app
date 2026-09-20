import type { Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  startTemplateDiagram,
  test,
} from './fixtures';
import { wallPhotoPng, type WallNote } from './fixtures/wall-photo';

// Importing a photographed wall (spec/139 Phase 8 + 9). The DETECTOR is real
// code; the READER is stubbed to answer blank, which is what a drawn wall with
// no lettering on it would read anyway. Which reader would have run is a
// capability decision (server model vs in-browser model), covered in unit
// tests — here it is stubbed so the suite never downloads a model. What only a browser can answer: a real
// image file becomes real draft notes at the right kinds and places, the
// review overlay shows the photo and boxes, drawing a box adds a missed note,
// Add is one undo step, Discard leaves nothing, and a draft survives a reload.
test.use({ colorScheme: 'dark' });

const ORANGE = '#fdba74'; // domain-event
const BLUE = '#93c5fd'; // command

// A wall, drawn: solid notes in a row, in reading order.
function wall(notes: WallNote[]) {
  return { name: 'wall.png', mimeType: 'image/png', buffer: wallPhotoPng(900, 400, notes) };
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
  // Capabilities say a model is configured, so the SERVER reader runs: stub it
  // to answer blank rather than calling a real provider from a test.
  await page.route('**/api/ai/read-notes', async (route) => {
    const crops = (JSON.parse(route.request().postData() ?? '{}').crops ?? []) as { id: number }[];
    await route.fulfill({
      json: { texts: crops.map((c) => ({ id: c.id, text: '', legible: false })) },
    });
  });
  // Safety net: no test may pull model weights down the wire.
  await page.route('**/huggingface.co/**', (r) => r.abort());
  await page.route('**/cdn.jsdelivr.net/**', (r) => r.abort());
  await startTemplateDiagram(page, /Browse Technical templates/, /^Event storming/i);
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);
  await page.waitForTimeout(500);
}

async function importToReview(page: Page, notes: WallNote[]) {
  await page.getByRole('button', { name: /add from photo/i }).click();
  await page.setInputFiles('input[type="file"]', wall(notes));
  // The review wizard (spec/139 Phase 9) appears after detection, unless the
  // photo had no paper in it — then a toast comes instead.
  const overlay = page.locator('[data-testid="photo-review-overlay"]');
  const emptyToast = page.getByText(/no stickies found in this photo/i);
  await Promise.race([
    overlay.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => false),
    emptyToast.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => false),
  ]);
  if (!(await overlay.isVisible().catch(() => false))) return;
  // The photo itself must be visible AND sized: a collapsed container renders
  // the overlay with the text list but no image and no boxes (a regression
  // this guards against).
  const img = overlay.locator('img');
  await expect(img).toBeVisible();
  const imgBox = (await img.boundingBox())!;
  expect(imgBox.width).toBeGreaterThan(50);
  expect(imgBox.height).toBeGreaterThan(50);
}

async function importPhoto(page: Page, notes: WallNote[]) {
  await importToReview(page, notes);
  const overlay = page.locator('[data-testid="photo-review-overlay"]');
  if (!(await overlay.isVisible().catch(() => false))) return;
  // The words stream in behind the photo; wait for them before adding.
  await page
    .getByText('Reading the words…')
    .waitFor({ state: 'hidden', timeout: 10_000 })
    .catch(() => {});
  await page.getByRole('button', { name: /^Add \d+ notes?$/ }).click();
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
const bar = (page: Page) => page.locator('[data-testid="photo-draft-bar"]');

test('a photo lands as a draft, Add is one undo step, and it survives a reload', async ({
  page,
  pageErrors,
}) => {
  await openBoard(page);
  await importPhoto(page, [{ fill: ORANGE, x: 300, y: 120, w: 180, h: 180 }]);

  await expect(bar(page)).toBeVisible();
  await expect(drafts(page)).toHaveCount(1);
  await expect(bar(page)).toContainText('1 read · 1 new · 0 already on the board');
  await expect(notes(page)).toHaveCount(4);

  // A draft note is an ORDINARY note: type into it before accepting.
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
  // A blue command: its kind comes from colour alone, no model asked.
  await importPhoto(page, [{ fill: BLUE, x: 300, y: 120, w: 180, h: 180 }]);

  await expect(bar(page)).toBeVisible();
  await expect(drafts(page)).toHaveCount(1);
  await page.getByRole('button', { name: /^Add 1 note$/ }).click();

  const added = notes(page).nth(3);
  await expect(added).toBeVisible();
  const fill = await added.evaluate((node) => {
    const painted = node.querySelector('[style*="background"]') ?? node;
    return getComputedStyle(painted as Element).backgroundColor;
  });
  expect(fill).toContain('147, 197, 253');

  expectNoPageErrors(pageErrors);
});

test('a note still lands empty when the reader reads nothing', async ({ page, pageErrors }) => {
  await openBoard(page);
  await importPhoto(page, [{ fill: ORANGE, x: 300, y: 120, w: 180, h: 180 }]);

  await expect(bar(page)).toBeVisible();
  await expect(drafts(page)).toHaveCount(1);
  await page.getByRole('button', { name: /^Add 1 note$/ }).click();
  await expect(notes(page)).toHaveCount(4);

  expectNoPageErrors(pageErrors);
});

test('drawing a box adds a sticky the detector missed', async ({ page, pageErrors }) => {
  await openBoard(page);
  await importToReview(page, [{ fill: ORANGE, x: 300, y: 120, w: 180, h: 180 }]);

  const overlay = page.locator('[data-testid="photo-review-overlay"]');
  const img = overlay.locator('img');
  const box = (await img.boundingBox())!;
  // Drag a box over a bare part of the wall, below the detected note.
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.95, { steps: 8 });
  await page.mouse.up();

  // Two notes now: the detected one and the one just drawn.
  await expect(overlay.locator('input[type="text"]')).toHaveCount(2);
  await page.getByRole('button', { name: /^Add 2 notes$/ }).click();
  await expect(drafts(page)).toHaveCount(2);

  expectNoPageErrors(pageErrors);
});

test('Discard leaves the board exactly as it was', async ({ page, pageErrors }) => {
  await openBoard(page);
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

test('a photo with no paper in it says so', async ({ page, pageErrors }) => {
  await openBoard(page);
  await importPhoto(page, []);
  await expect(page.getByText(/no stickies found in this photo/i)).toBeVisible();
  await expect(bar(page)).toHaveCount(0);
  await expect(notes(page)).toHaveCount(3);

  expectNoPageErrors(pageErrors);
});

test('a draft survives a reload, and can still be added', async ({ page, pageErrors }) => {
  await openBoard(page);
  await importPhoto(page, [{ fill: ORANGE, x: 300, y: 120, w: 180, h: 180 }]);

  await expect(drafts(page)).toHaveCount(1);
  await page.waitForTimeout(1500);
  await page.reload();
  await page.locator('[data-canvas-a11y-root]').waitFor();

  // The notes are still drafts, so the decision comes back with them.
  await expect(bar(page)).toBeVisible();
  await expect(drafts(page)).toHaveCount(1);
  await page.getByRole('button', { name: /^Add 1 note$/ }).click();
  await expect(drafts(page)).toHaveCount(0);
  await expect(notes(page)).toHaveCount(4);

  expectNoPageErrors(pageErrors);
});

test('the photo import needs no model key', async ({ page, pageErrors }) => {
  // A deployment WITHOUT a key: detection and reading are both in-browser, so
  // the entry point is still there.
  await page.route('**/api/capabilities', (route) =>
    route.fulfill({ json: { aiEnabled: false, emailEnabled: false } }),
  );
  await startTemplateDiagram(page, /Browse Technical templates/, /^Event storming/i);
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);
  await expect(page.getByRole('button', { name: /add from photo/i })).toBeVisible();
  expectNoPageErrors(pageErrors);
});
