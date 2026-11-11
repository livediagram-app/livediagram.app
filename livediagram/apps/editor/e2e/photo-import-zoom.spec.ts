import { expect, expectNoPageErrors, test } from './fixtures';
import { openPhotoBoard } from './fixtures/photo-board';
import { ORANGE, BLUE } from './fixtures/photo-import';
import { wallPhotoPng } from './fixtures/wall-photo';

// Importing a photographed wall: the boxes stay on their stickies (docs/specs/021-event-storming/
// event-storming.md Phase 9) at any window shape, for a tall photo, and while the photo is zoomed,
// panned and pinched. The reader is stubbed and the boundary model blocked, as in
// photo-import.spec.ts.
test.use({ colorScheme: 'dark' });

// THE BOXES MUST SIT ON THE STICKIES. They are placed as percentages, so
// whatever element those percentages are measured against has to be the
// IMAGE — not a frame that can be bigger than it. A wide, short photo in a
// tall window is where the two come apart: the frame has a minimum height, the
// photo does not fill it, and every box drifts down the picture.
test('the boxes land on the stickies at any window shape', async ({ page, pageErrors }) => {
  await openPhotoBoard(page, { boundaryModel: false });
  // A panorama: 6:1, like a photo of a long paper wall.
  const notes = [
    { fill: ORANGE, x: 60, y: 60, w: 120, h: 120 },
    { fill: BLUE, x: 600, y: 60, w: 120, h: 120 },
    { fill: ORANGE, x: 1140, y: 60, w: 120, h: 120 },
  ];
  await page.getByRole('button', { name: /add from photo/i }).click();
  await page.setInputFiles('input[type="file"]', {
    name: 'panorama.png',
    mimeType: 'image/png',
    buffer: wallPhotoPng(1320, 240, notes),
  });
  const overlay = page.locator('[data-testid="photo-review-overlay"]');
  await overlay.waitFor({ state: 'visible', timeout: 15_000 });
  await overlay
    .locator('[data-testid="photo-finding"]')
    .waitFor({ state: 'hidden', timeout: 30_000 });
  await expect(overlay.locator('[data-testid^="note-box-"]')).toHaveCount(3);

  // Four window shapes, resized one after another on the SAME open review,
  // because that is how it was reported: the boxes go wrong when the window
  // changes shape under them. Two of these make the frame's minimum size win
  // over the picture, in each direction.
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 900, height: 1100 },
    { width: 1600, height: 500 },
    { width: 700, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(250);
    const img = (await overlay.locator('img').boundingBox())!;
    for (const [at, note] of notes.entries()) {
      const box = (await overlay.locator(`[data-testid^="note-box-"]`).nth(at).boundingBox())!;
      // Where the sticky IS, in the rendered image.
      const wantX = img.x + ((note.x + note.w / 2) / 1320) * img.width;
      const wantY = img.y + ((note.y + note.h / 2) / 240) * img.height;
      const gotX = box.x + box.width / 2;
      const gotY = box.y + box.height / 2;
      // Within a tenth of a note: the box outlines the paper, it does not
      // hover near it.
      const tolerance = (120 / 1320) * img.width * 0.5;
      expect(
        Math.abs(gotX - wantX),
        `note ${at} x at ${viewport.width}x${viewport.height}`,
      ).toBeLessThan(tolerance);
      expect(
        Math.abs(gotY - wantY),
        `note ${at} y at ${viewport.width}x${viewport.height}`,
      ).toBeLessThan(tolerance);
    }
  }

  // And the gesture reads the same geometry: a box DRAWN in a window shape
  // where the frame is bigger than the picture has to land under the pointer,
  // not offset by the gap between the two.
  const img = (await overlay.locator('img').boundingBox())!;
  const from = { x: img.x + img.width * 0.4, y: img.y + img.height * 0.55 };
  const to = { x: img.x + img.width * 0.5, y: img.y + img.height * 0.9 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await expect(overlay.locator('[data-testid^="note-box-"]')).toHaveCount(4);
  const drawn = (await overlay.locator('[data-testid^="note-box-"]').last().boundingBox())!;
  expect(Math.abs(drawn.x - from.x)).toBeLessThan(6);
  expect(Math.abs(drawn.y - from.y)).toBeLessThan(6);
  expect(Math.abs(drawn.width - (to.x - from.x))).toBeLessThan(6);
  expect(Math.abs(drawn.height - (to.y - from.y))).toBeLessThan(6);

  expectNoPageErrors(pageErrors);
});

// The other direction: a TALL photo in a wide window, where the frame's
// minimum WIDTH is what the picture fails to fill. Same bug, sideways.
test('the boxes land on the stickies for a tall photo too', async ({ page, pageErrors }) => {
  await openPhotoBoard(page, { boundaryModel: false });
  const notes = [
    { fill: ORANGE, x: 60, y: 60, w: 120, h: 120 },
    { fill: BLUE, x: 60, y: 600, w: 120, h: 120 },
    { fill: ORANGE, x: 60, y: 1140, w: 120, h: 120 },
  ];
  await page.getByRole('button', { name: /add from photo/i }).click();
  await page.setInputFiles('input[type="file"]', {
    name: 'tall.png',
    mimeType: 'image/png',
    buffer: wallPhotoPng(240, 1320, notes),
  });
  const overlay = page.locator('[data-testid="photo-review-overlay"]');
  await overlay.waitFor({ state: 'visible', timeout: 15_000 });
  await overlay
    .locator('[data-testid="photo-finding"]')
    .waitFor({ state: 'hidden', timeout: 30_000 });
  await expect(overlay.locator('[data-testid^="note-box-"]')).toHaveCount(3);

  for (const viewport of [
    { width: 1600, height: 800 },
    { width: 1400, height: 600 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(250);
    const img = (await overlay.locator('img').boundingBox())!;
    for (const [at, note] of notes.entries()) {
      const box = (await overlay.locator('[data-testid^="note-box-"]').nth(at).boundingBox())!;
      const wantX = img.x + ((note.x + note.w / 2) / 240) * img.width;
      const wantY = img.y + ((note.y + note.h / 2) / 1320) * img.height;
      const tolerance = (120 / 1320) * img.height * 0.5;
      expect(
        Math.abs(box.x + box.width / 2 - wantX),
        `note ${at} x at ${viewport.width}x${viewport.height}`,
      ).toBeLessThan(tolerance);
      expect(
        Math.abs(box.y + box.height / 2 - wantY),
        `note ${at} y at ${viewport.width}x${viewport.height}`,
      ).toBeLessThan(tolerance);
    }
  }

  expectNoPageErrors(pageErrors);
});

// Zooming into a dense wall (docs/specs/021-event-storming/event-storming.md Phase 9). At fit, a whiteboard of three
// hundred notes has stickies fifteen pixels across: too small to judge, tick
// or draw round. The review zooms and pans with the canvas's own gestures.
test('the photo zooms and pans, and the boxes stay on their stickies', async ({
  page,
  pageErrors,
}) => {
  await openPhotoBoard(page, { boundaryModel: false });
  await page.setViewportSize({ width: 1280, height: 800 });
  const notes = [
    { fill: ORANGE, x: 100, y: 100, w: 60, h: 60 },
    { fill: BLUE, x: 700, y: 250, w: 60, h: 60 },
  ];
  await page.getByRole('button', { name: /add from photo/i }).click();
  await page.setInputFiles('input[type="file"]', {
    name: 'dense.png',
    mimeType: 'image/png',
    buffer: wallPhotoPng(900, 400, notes),
  });
  const overlay = page.locator('[data-testid="photo-review-overlay"]');
  await overlay.waitFor({ state: 'visible', timeout: 15_000 });
  await overlay
    .locator('[data-testid="photo-finding"]')
    .waitFor({ state: 'hidden', timeout: 30_000 });
  const boxes = overlay.locator('[data-testid^="note-box-"]');
  await expect(boxes).toHaveCount(2);
  const level = overlay.getByTestId('photo-zoom-level');
  const pillAtFit = (await overlay
    .getByTestId(/^note-words-/)
    .first()
    .boundingBox())!;

  // The plain scroll wheel over the blue note: it zooms ABOUT the pointer.
  const img = overlay.locator('img');
  const blue = (await boxes.nth(1).boundingBox())!;
  const cursor = { x: blue.x + blue.width / 2, y: blue.y + blue.height / 2 };
  await page.mouse.move(cursor.x, cursor.y);
  for (let i = 0; i < 2; i += 1) await page.mouse.wheel(0, -120);
  await expect(level).not.toHaveText('100%');
  const zoomedBlue = (await boxes.nth(1).boundingBox())!;
  expect(zoomedBlue.width).toBeGreaterThan(blue.width * 2);
  // Still under the pointer.
  expect(Math.abs(zoomedBlue.x + zoomedBlue.width / 2 - cursor.x)).toBeLessThan(6);
  expect(Math.abs(zoomedBlue.y + zoomedBlue.height / 2 - cursor.y)).toBeLessThan(6);
  // And ON its sticky: the same fraction of the (transformed) image.
  const zImg = (await img.boundingBox())!;
  const wantX = zImg.x + ((700 + 30) / 900) * zImg.width;
  expect(Math.abs(zoomedBlue.x + zoomedBlue.width / 2 - wantX)).toBeLessThan(6);

  // The word pill does NOT grow with the photo: at most two lines of text at
  // its largest size (it may shrink, as a wider box fits the words on one).
  const pillZoomed = (await overlay.getByTestId('note-words-1').boundingBox())!;
  expect(pillZoomed.height).toBeLessThanOrEqual(pillAtFit.height + 2);
  expect(pillZoomed.height).toBeLessThan(2 * 11 * 1.25 + 6);

  // A MIDDLE-button drag moves the photo, and draws nothing.
  await page.mouse.move(cursor.x, cursor.y);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(cursor.x + 150, cursor.y + 60, { steps: 6 });
  await page.mouse.up({ button: 'middle' });
  const panned = (await boxes.nth(1).boundingBox())!;
  expect(panned.x - zoomedBlue.x).toBeGreaterThan(100);
  await expect(boxes).toHaveCount(2);

  // A note that is small IN THE PHOTO but big on screen can be drawn round:
  // a bare patch just left of the blue note, 40px on screen — under 2% of the
  // photo's width at this zoom, which the old click rule threw away.
  const viewport = (await overlay.getByTestId('photo-viewport').boundingBox())!;
  const from = { x: panned.x - 60, y: panned.y + 10 };
  const to = { x: from.x + 40, y: from.y + 40 };
  expect(from.x).toBeGreaterThan(viewport.x);
  expect(to.x).toBeLessThan(panned.x);
  expect(to.y).toBeLessThan(viewport.y + viewport.height);
  const shownWidth = (await img.boundingBox())!.width;
  expect((40 / shownWidth) * 900).toBeLessThan(0.02 * 900);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  await expect(boxes).toHaveCount(3);
  const drawn = (await boxes.last().boundingBox())!;
  expect(Math.abs(drawn.x - from.x)).toBeLessThan(6);
  expect(Math.abs(drawn.width - (to.x - from.x))).toBeLessThan(6);

  // Back to the whole photo.
  await overlay.getByRole('button', { name: 'Show the whole photo' }).click();
  await expect(level).toHaveText('100%');

  expectNoPageErrors(pageErrors);
});

// A phone: two fingers pinch the photo bigger, and draw no box doing it.
test('a two-finger pinch zooms the photo on a touch screen', async ({ page, pageErrors }) => {
  await openPhotoBoard(page, { boundaryModel: false });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: /add from photo/i }).click();
  await page.setInputFiles('input[type="file"]', {
    name: 'phone.png',
    mimeType: 'image/png',
    buffer: wallPhotoPng(900, 400, [{ fill: ORANGE, x: 400, y: 150, w: 80, h: 80 }]),
  });
  const overlay = page.locator('[data-testid="photo-review-overlay"]');
  await overlay.waitFor({ state: 'visible', timeout: 15_000 });
  await overlay
    .locator('[data-testid="photo-finding"]')
    .waitFor({ state: 'hidden', timeout: 30_000 });
  const boxes = overlay.locator('[data-testid^="note-box-"]');
  await expect(boxes).toHaveCount(1);
  const vp = (await overlay.getByTestId('photo-viewport').boundingBox())!;
  const mid = { x: vp.x + vp.width / 2, y: vp.y + vp.height * 0.8 };

  // Real touch points, through the browser's own input pipeline.
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', spread: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints:
        type === 'touchEnd'
          ? []
          : [
              { x: mid.x - spread, y: mid.y, id: 1 },
              { x: mid.x + spread, y: mid.y, id: 2 },
            ],
    });
  await touch('touchStart', 40);
  for (const spread of [60, 90, 120, 160]) await touch('touchMove', spread);
  await touch('touchEnd', 0);

  const level = await overlay.getByTestId('photo-zoom-level').textContent();
  expect(parseInt(level ?? '100', 10)).toBeGreaterThan(250);
  // The pinch drew nothing.
  await expect(boxes).toHaveCount(1);

  expectNoPageErrors(pageErrors);
});
