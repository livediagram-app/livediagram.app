import { expect, expectNoPageErrors, test } from './fixtures';
import { openPhotoBoard } from './fixtures/photo-board';
import { ORANGE, BLUE, importToReview } from './fixtures/photo-import';

// Importing a photographed wall: the review's own tools (docs/specs/021-event-storming/event-storming.md
// Phase 9). Ground-truth export, ticks, moving, resizing and re-kinding boxes, the unread and
// spent-budget paths, and a moved box read again. The reader is stubbed and the boundary model
// blocked, as in photo-import.spec.ts.
test.use({ colorScheme: 'dark' });

// Labelling a wall from the review (docs/research/vision/sticky-detection.md). The
// detector is tuned against photographs somebody labelled note by note, and
// the corrections the author makes here ARE that labelling — so it can be
// handed back as a file rather than done twice. Armed by hand, so a normal
// author never meets it; only a browser can prove the download actually
// happens and carries what is on screen.
test('a corrected review can be saved as ground truth', async ({ page, pageErrors }) => {
  await openPhotoBoard(page, { boundaryModel: false });
  await page.evaluate(() => localStorage.setItem('livediagram:truth', '1'));
  await importToReview(page, [
    { fill: ORANGE, x: 200, y: 120, w: 180, h: 180 },
    { fill: BLUE, x: 500, y: 120, w: 180, h: 180 },
  ]);
  const overlay = page.locator('[data-testid="photo-review-overlay"]');
  await expect(overlay.locator('[data-testid^="note-words-"]')).toHaveCount(2);

  // Untick one: a label must claim only what the author says is a note.
  await overlay.getByRole('checkbox').first().click();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /save as truth/i }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('wall.json');
  const body = await file.createReadStream();
  const text = await new Promise<string>((resolve) => {
    let out = '';
    body.on('data', (chunk) => (out += String(chunk)));
    body.on('end', () => resolve(out));
  });
  const truth = JSON.parse(text) as {
    photo: string;
    labelledOn: { width: number; height: number };
    notes: { x: number; y: number; w: number; h: number; kind: string }[];
  };
  expect(truth.photo).toBe('wall');
  expect(truth.labelledOn.width).toBeGreaterThan(0);
  // One note, and in FRACTIONS of the photograph, so the labels outlive any
  // working size the detector is run at.
  expect(truth.notes).toHaveLength(1);
  for (const note of truth.notes) {
    expect(note.x).toBeGreaterThanOrEqual(0);
    expect(note.x + note.w).toBeLessThanOrEqual(1);
    expect(note.y + note.h).toBeLessThanOrEqual(1);
  }

  expectNoPageErrors(pageErrors);
});

// `/new/`, trailing slash and all, is a URL people type. Production's asset
// layer redirects it to `/new` and keeps the query; a server that answers 404
// instead loses the page the arming happens on, and the export stays hidden
// however many times it is reloaded.
test('?truth=1 arms the export from /new/, trailing slash and all', async ({
  page,
  pageErrors,
}) => {
  const res = await page.goto('/new/?truth=1');
  expect(res?.status()).toBe(200);
  await page.getByText('New Canvas', { exact: false }).first().waitFor();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('livediagram:truth'))).toBe('1');
  expect(new URL(page.url()).search).toBe('?truth=1');

  expectNoPageErrors(pageErrors);
});

// Every tick can be clicked. A box's tick sits at its top-left corner, and a
// box the author DRAWS is added last, so it paints over the detector's boxes
// — including their ticks. A wrong detected box with a hand-drawn box over its
// corner could not be cleared, which is how one ended up in a hand-made label.
test('a tick under a box the author drew can still be cleared', async ({ page, pageErrors }) => {
  await openPhotoBoard(page, { boundaryModel: false });
  await importToReview(page, [{ fill: ORANGE, x: 300, y: 120, w: 180, h: 180 }]);
  const overlay = page.locator('[data-testid="photo-review-overlay"]');
  await expect(overlay.locator('[data-shown="no"]')).toHaveCount(0);
  const detectedTick = overlay.getByRole('checkbox').first();
  const t = (await detectedTick.boundingBox())!;

  // Draw a box whose body covers the detected box's tick.
  await page.mouse.move(t.x - 40, t.y - 40);
  await page.mouse.down();
  await page.mouse.move(t.x + 60, t.y + 60, { steps: 6 });
  await page.mouse.up();
  await expect(overlay.locator('[data-testid^="note-box-"]')).toHaveCount(2);

  await detectedTick.click({ timeout: 3000 });
  await expect(detectedTick).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('button', { name: /^Add 1 note$/ })).toBeVisible();

  expectNoPageErrors(pageErrors);
});

// Correcting boxes, then saving and reopening the label (docs/specs/021-event-storming/event-storming.md Phase 9).
// Real pointer drags, at a zoom, so the pixels-to-photo conversion is proven
// where it can go wrong.
test('boxes can be moved, resized, re-kinded, deleted, saved and reopened', async ({
  page,
  pageErrors,
}) => {
  await openPhotoBoard(page, { boundaryModel: false });
  await page.setViewportSize({ width: 1280, height: 800 });
  await importToReview(page, [
    { fill: ORANGE, x: 150, y: 120, w: 120, h: 120 },
    { fill: ORANGE, x: 500, y: 120, w: 120, h: 120 },
  ]);
  const overlay = page.locator('[data-testid="photo-review-overlay"]');
  await expect(overlay.locator('[data-shown="no"]')).toHaveCount(0);
  const boxes = overlay.locator('[data-testid^="note-box-"]');
  await expect(boxes).toHaveCount(2);
  await overlay.getByRole('button', { name: 'Zoom in' }).click();
  const first = boxes.first();
  const before = (await first.boundingBox())!;

  // Move: drag the body 60px right, 30px down.
  const body = overlay.getByTestId(/^note-body-/).first();
  const b = (await body.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 60, b.y + b.height / 2 + 30, { steps: 8 });
  await page.mouse.up();
  const moved = (await first.boundingBox())!;
  expect(moved.x - before.x).toBeCloseTo(60, -1);
  expect(moved.y - before.y).toBeCloseTo(30, -1);
  await expect(first).toHaveAttribute('data-selected', 'yes');
  // A move is not a draw.
  await expect(boxes).toHaveCount(2);

  // Resize: drag the bottom-right handle 40px out.
  const handle = (await overlay.getByTestId('box-handle-se').boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 40, handle.y + handle.height / 2 + 40, {
    steps: 8,
  });
  await page.mouse.up();
  const grown = (await first.boundingBox())!;
  expect(grown.width - moved.width).toBeCloseTo(40, -1);
  expect(grown.x).toBeCloseTo(moved.x, 0);

  // Re-kind it, and delete the other box.
  await overlay.getByRole('button', { name: 'Make this a command' }).click();
  await overlay
    .getByTestId(/^note-body-/)
    .nth(1)
    .click();
  await page.keyboard.press('Delete');
  await expect(boxes).toHaveCount(1);

  // Save, and read what was saved.
  const download = page.waitForEvent('download');
  await overlay.getByRole('button', { name: /save as truth/i }).click();
  const file = await download;
  const path = await file.path();
  const { readFileSync } = await import('node:fs');
  const saved = JSON.parse(readFileSync(path, 'utf8')) as {
    notes: { x: number; y: number; w: number; h: number; kind: string }[];
  };
  expect(saved.notes).toHaveLength(1);
  expect(saved.notes[0]!.kind).toBe('command');
  // Moved right of where it was drawn (150/900 = 0.167) and grown past 120/900.
  expect(saved.notes[0]!.x).toBeGreaterThan(0.18);
  expect(saved.notes[0]!.w).toBeGreaterThan(0.14);

  // Reopen it over a fresh import of the same photo: the correction is back.
  await overlay.getByRole('button', { name: /^cancel$/i }).click();
  await importToReview(page, [
    { fill: ORANGE, x: 150, y: 120, w: 120, h: 120 },
    { fill: ORANGE, x: 500, y: 120, w: 120, h: 120 },
  ]);
  await overlay.getByLabel('Open a saved label').setInputFiles(path);
  await expect(boxes).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Add 1 note$/ })).toBeVisible();

  expectNoPageErrors(pageErrors);
});

// When the reader could not read the notes (here: the stub reads every one
// blank), the review suggests a better photo or typing — and "Try another
// photo" really does open the picker again (docs/specs/021-event-storming/event-storming.md Phase 9).
test('an unread wall offers another photo, and the picker opens', async ({ page, pageErrors }) => {
  await openPhotoBoard(page, { boundaryModel: false });
  await importToReview(page, [
    { fill: ORANGE, x: 200, y: 120, w: 180, h: 180 },
    { fill: BLUE, x: 500, y: 120, w: 180, h: 180 },
  ]);
  const tip = page.getByTestId('photo-unread-tip');
  await expect(tip).toBeVisible({ timeout: 20_000 });
  await expect(tip).toContainText(/2 of 2 notes couldn.t be read/i);

  const chooser = page.waitForEvent('filechooser');
  await tip.getByRole('button', { name: /try another photo/i }).click();
  await chooser;
  // The old review is gone: the new photo gets a review of its own.
  await expect(page.locator('[data-testid="photo-review-overlay"]')).toHaveCount(0);

  expectNoPageErrors(pageErrors);
});

// The hosted reader's free budget is spent (docs/specs/021-event-storming/event-storming.md Phase 9): the notes go to
// the in-browser reader instead, and the review says so without saying whose
// budget it was. The model download is blocked here, so the device reader then
// says it could not start: both notes are on screen, in that order of events.
test('a spent budget reads on this device instead, and says so', async ({ page, pageErrors }) => {
  await openPhotoBoard(page, { boundaryModel: false });
  // Registered after the fixture's own stub, so it wins.
  await page.route('**/api/ai/read-notes', (route) =>
    route.fulfill({ status: 429, json: { error: 'ai_quota' } }),
  );
  await importToReview(page, [{ fill: ORANGE, x: 300, y: 120, w: 180, h: 180 }]);
  await expect(page.getByTestId('photo-reader-fallback')).toHaveText(
    /ai is resting for today\. reading on this device instead/i,
    { timeout: 20_000 },
  );
  await expect(page.getByTestId('photo-reader-unavailable')).toBeVisible({ timeout: 90_000 });
  // The quota toast is not shown: the author was carried through, not stopped.
  await expect(page.getByText(/out of quota/i)).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});

// A box that is moved is read again (docs/specs/021-event-storming/event-storming.md Phase 9): 8 seconds after the
// last change, its crop is cut afresh and sent to the same reader, and the new
// words replace the old.
test('a moved box is read again, 8 seconds after the move', async ({ page, pageErrors }) => {
  await openPhotoBoard(page, { boundaryModel: false });
  const asked: number[][] = [];
  await page.route('**/api/ai/read-notes', async (route) => {
    const { crops = [] } = JSON.parse(route.request().postData() ?? '{}') as {
      crops?: { id: number }[];
    };
    asked.push(crops.map((c) => c.id));
    const again = asked.length > 1;
    await route.fulfill({
      json: {
        texts: crops.map((c) => ({ id: c.id, text: again ? 'Read again' : '', legible: again })),
      },
    });
  });
  await importToReview(page, [
    { fill: ORANGE, x: 200, y: 120, w: 180, h: 180 },
    { fill: BLUE, x: 500, y: 120, w: 180, h: 180 },
  ]);
  const overlay = page.locator('[data-testid="photo-review-overlay"]');
  await expect(overlay.getByTestId('photo-reading')).toHaveCount(0, { timeout: 20_000 });
  expect(asked).toHaveLength(1);

  const body = overlay.locator('[data-testid^="note-body-"]').first();
  const box = (await body.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 10, { steps: 5 });
  await page.mouse.up();

  // Nothing yet: it waits for the last change.
  await page.waitForTimeout(5000);
  expect(asked).toHaveLength(1);
  await expect(overlay.getByText('Read again')).toBeVisible({ timeout: 10_000 });
  expect(asked).toHaveLength(2);
  expect(asked[1]).toHaveLength(1);
  expectNoPageErrors(pageErrors);
});
