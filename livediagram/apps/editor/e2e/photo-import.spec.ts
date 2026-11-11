import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  startTemplateDocument,
  test,
} from './fixtures';
import { openPhotoBoard } from './fixtures/photo-board';
import {
  ORANGE,
  BLUE,
  importToReview,
  importPhoto,
  panBy,
  notes,
  drafts,
  bar,
} from './fixtures/photo-import';

// Importing a photographed wall (docs/specs/021-event-storming/event-storming.md Phase 8 + 9). The DETECTOR is real
// code; the READER is stubbed to answer blank, which is what a drawn wall with
// no lettering on it would read anyway. Which reader would have run is a
// capability decision (server model vs in-browser model), covered in unit
// tests — here it is stubbed so the suite never downloads a model. The
// boundary model is blocked: these walls are drawn, not photographed, and the
// hybrid is covered on its own in photo-model.spec.ts. What only a browser can answer: a real
// image file becomes real draft notes at the right kinds and places, the
// review overlay shows the photo and boxes, drawing a box adds a missed note,
// Add is one undo step, Discard leaves nothing, and a draft survives a reload.
test.use({ colorScheme: 'dark' });

test('a photo lands as a draft, Add is one undo step, and it survives a reload', async ({
  page,
  pageErrors,
}) => {
  await openPhotoBoard(page, { boundaryModel: false });
  await importPhoto(page, [{ fill: ORANGE, x: 300, y: 120, w: 180, h: 180 }]);

  await expect(bar(page)).toBeVisible();
  await expect(drafts(page)).toHaveCount(1);
  await expect(bar(page)).toContainText('1 read · 1 new · 0 already on the board');
  await expect(notes(page)).toHaveCount(4);

  // A draft note is an ORDINARY note: type into it before accepting.
  await notes(page).nth(3).dblclick();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Invoice raised');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /^Add 1 note$/ }).click();
  await expect(bar(page)).toHaveCount(0);
  await expect(drafts(page)).toHaveCount(0);
  await expect(notes(page)).toHaveCount(4);

  // ONE undo takes the whole import back — the landing AND the correction.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(notes(page)).toHaveCount(3);
  await page.keyboard.press('ControlOrMeta+Shift+z');
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
  await openPhotoBoard(page, { boundaryModel: false });
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
  await openPhotoBoard(page, { boundaryModel: false });
  await importPhoto(page, [{ fill: ORANGE, x: 300, y: 120, w: 180, h: 180 }]);

  await expect(bar(page)).toBeVisible();
  await expect(drafts(page)).toHaveCount(1);
  await page.getByRole('button', { name: /^Add 1 note$/ }).click();
  await expect(notes(page)).toHaveCount(4);

  expectNoPageErrors(pageErrors);
});

test('drawing a box adds a sticky the detector missed', async ({ page, pageErrors }) => {
  await openPhotoBoard(page, { boundaryModel: false });
  await importToReview(page, [{ fill: ORANGE, x: 300, y: 120, w: 180, h: 180 }]);

  const overlay = page.locator('[data-testid="photo-review-overlay"]');
  const img = overlay.locator('img');
  const box = (await img.boundingBox())!;
  // Drag a box over a bare part of the wall, below the detected note.
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.95, { steps: 8 });
  await page.mouse.up();

  // Two notes now: the detected one and the one just drawn. Counted by the
  // words each box carries — the surface IS the photograph, so there is no
  // list beside it to count rows in.
  await expect(overlay.locator('[data-testid^="note-words-"]')).toHaveCount(2);
  await page.getByRole('button', { name: /^Add 2 notes$/ }).click();
  await expect(drafts(page)).toHaveCount(2);

  expectNoPageErrors(pageErrors);
});

test('Discard leaves the board exactly as it was', async ({ page, pageErrors }) => {
  await openPhotoBoard(page, { boundaryModel: false });
  await importPhoto(page, [{ fill: ORANGE, x: 300, y: 120, w: 180, h: 180 }]);

  await expect(drafts(page)).toHaveCount(1);
  await expect(notes(page)).toHaveCount(4);

  await page.getByRole('button', { name: /^discard$/i }).click();
  await expect(bar(page)).toHaveCount(0);
  await expect(notes(page)).toHaveCount(3);
  // Nothing in the undo stack either: a discarded import never happened.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(notes(page)).toHaveCount(3);

  expectNoPageErrors(pageErrors);
});

test('a draft note can be deleted before it is added', async ({ page, pageErrors }) => {
  await openPhotoBoard(page, { boundaryModel: false });
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

test('a photo with no paper in it says so, and keeps the photo up', async ({
  page,
  pageErrors,
}) => {
  await openPhotoBoard(page, { boundaryModel: false });
  await importPhoto(page, []);
  await expect(page.getByText(/no stickies found in this photo/i).first()).toBeVisible();
  // The photo STAYS on screen with the advice: it is advice about THIS
  // photograph, and the author can still draw a box by hand (docs/specs/021-event-storming/event-storming.md).
  const overlay = page.locator('[data-testid="photo-review-overlay"]');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('img')).toBeVisible();
  await page.getByRole('button', { name: /^cancel$/i }).click();
  await expect(overlay).toBeHidden();
  await expect(bar(page)).toHaveCount(0);
  await expect(notes(page)).toHaveCount(3);

  expectNoPageErrors(pageErrors);
});

test('a draft survives a reload, and can still be added', async ({ page, pageErrors }) => {
  await openPhotoBoard(page, { boundaryModel: false });
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
  await startTemplateDocument(page, 'Software & IT', /^Event storming/i);
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);
  await expect(page.getByRole('button', { name: /add from photo/i })).toBeVisible();
  expectNoPageErrors(pageErrors);
});
