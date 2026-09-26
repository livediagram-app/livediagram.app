import type { Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  startTemplateDiagram,
  test,
} from './fixtures';
import { openPhotoBoard } from './fixtures/photo-board';
import { wallPhotoPng, type WallNote } from './fixtures/wall-photo';

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

const ORANGE = '#fdba74'; // domain-event
const BLUE = '#93c5fd'; // command

// A wall, drawn: solid notes in a row, in reading order.
function wall(notes: WallNote[]) {
  return { name: 'wall.png', mimeType: 'image/png', buffer: wallPhotoPng(900, 400, notes) };
}

async function importToReview(page: Page, notes: WallNote[]) {
  await page.getByRole('button', { name: /add from photo/i }).click();
  await page.setInputFiles('input[type="file"]', wall(notes));
  // The review wizard (docs/specs/021-event-storming/event-storming.md Phase 9) appears after detection, unless the
  // photo had no paper in it — then a toast comes instead.
  const overlay = page.locator('[data-testid="photo-review-overlay"]');
  const emptyToast = page.getByText(/no stickies found in this photo/i);
  await Promise.race([
    overlay.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => false),
    emptyToast.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => false),
  ]);
  if (!(await overlay.isVisible().catch(() => false))) return;
  // The photo goes up BEFORE the detector has found anything (docs/specs/021-event-storming/event-storming.md Phase
  // 9), so wait for the finding phase to END before judging what is in it. By
  // its testid, not its words: the overlay says "finding the stickies" in two
  // places, and a text locator matching both throws strict-mode rather than
  // waiting — which silently let this helper read the note count too early.
  await overlay
    .locator('[data-testid="photo-finding"]')
    .waitFor({ state: 'hidden', timeout: 30_000 });
  // The photo itself must be visible AND sized: a collapsed container renders
  // the surface with its controls but no image and no boxes (a regression
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
  // Nothing found: the overlay stays open with the retake advice, and there is
  // nothing to add (docs/specs/021-event-storming/event-storming.md).
  if (
    await page
      .locator('[data-testid="photo-found-nothing"]')
      .isVisible()
      .catch(() => false)
  ) {
    return;
  }
  const add = page.getByRole('button', { name: /^Add \d+ notes?$/ });
  // The words stream in behind the photo; wait for them before adding.
  await page
    .getByText('Reading the words…')
    .waitFor({ state: 'hidden', timeout: 20_000 })
    .catch(() => {});
  await add.click();
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
  await openPhotoBoard(page, { boundaryModel: false });
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
  await page.keyboard.press('Control+z');
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
  await startTemplateDiagram(page, /Browse Technical templates/, /^Event storming/i);
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);
  await expect(page.getByRole('button', { name: /add from photo/i })).toBeVisible();
  expectNoPageErrors(pageErrors);
});

// Labelling a wall from the review (docs/vision/sticky-detection.md). The
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
  await page.getByText('New Diagram', { exact: false }).first().waitFor();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('livediagram:truth'))).toBe('1');
  expect(new URL(page.url()).search).toBe('?truth=1');

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
    /free monthly budget reached\. reading on this device instead/i,
    { timeout: 20_000 },
  );
  await expect(page.getByTestId('photo-reader-unavailable')).toBeVisible({ timeout: 90_000 });
  // The quota toast is not shown: the author was carried through, not stopped.
  await expect(page.getByText(/used up its quota/i)).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});

// A box that is moved is read again (docs/specs/021-event-storming/event-storming.md Phase 9): 8 seconds after the
// last change, its crop is cut afresh and sent to the same reader, and the new
// words replace the old.
test('a moved box is read again, 8 seconds after the move', async ({ page, pageErrors }) => {
  await openPhotoBoard(page, { boundaryModel: false });
  const asked: number[][] = [];
  await page.route('**/api/ai/read-notes', async (route) => {
    const crops = (JSON.parse(route.request().postData() ?? '{}').crops ?? []) as { id: number }[];
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
