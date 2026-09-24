import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from './fixtures';
import { BOUNDARY_WEIGHTS, openPhotoBoard } from './fixtures/photo-board';
import { wallPhotoPng, type WallNote } from './fixtures/wall-photo';

// The boundary model in the photo import (spec/139 Phase 9). The detector
// takes a small learned model's corrections when the model can run here, in a
// worker, on weights the app serves itself; when it cannot, the classical
// detector runs alone and the import carries on. Only a browser can show
// either: the worker, the lazy runtime, WASM and the fetch of the weights.
//
// The model learnt photographs, so a wall drawn flat to the bit (a screenshot)
// is never asked of it; the walls meant to reach the model carry a few levels
// of grain, as any photograph does.
test.use({ colorScheme: 'dark' });

const ORANGE = '#fdba74'; // domain-event
const BLUE = '#93c5fd'; // command

// Levels of sensor-like noise either way: enough that no two neighbouring
// pixels are reliably equal, as in a photograph.
const GRAIN = 3;

const NOTES: WallNote[] = [
  { fill: ORANGE, x: 120, y: 120, w: 160, h: 160 },
  { fill: BLUE, x: 380, y: 120, w: 160, h: 160 },
  { fill: ORANGE, x: 640, y: 120, w: 160, h: 160 },
];

const FLAT_PAIR: WallNote[] = [
  { fill: ORANGE, x: 200, y: 120, w: 180, h: 180 },
  { fill: BLUE, x: 500, y: 120, w: 180, h: 180 },
];

// Import a wall and wait for the detector to answer, collecting what the photo
// import logs on the way.
async function importWall(
  page: Page,
  notes: WallNote[] = NOTES,
  grain = GRAIN,
): Promise<{ detector: string; log: string[] }> {
  const log: string[] = [];
  page.on('console', (m) => {
    if (m.text().startsWith('[photo-')) log.push(m.text());
  });
  await page.getByRole('button', { name: /add from photo/i }).click();
  await page.setInputFiles('input[type="file"]', {
    name: 'wall.png',
    mimeType: 'image/png',
    buffer: wallPhotoPng(900, 400, notes, { grain }),
  });
  const overlay = page.locator('[data-testid="photo-review-overlay"][data-detector]');
  await overlay.waitFor({ timeout: 20_000 });
  await expect(overlay.locator('[data-testid^="note-box-"]')).toHaveCount(notes.length);
  return { detector: (await overlay.getAttribute('data-detector')) ?? '', log };
}

test('the photo import runs the boundary model in the browser', async ({ page, pageErrors }) => {
  await openPhotoBoard(page);
  const weights = page.waitForRequest(BOUNDARY_WEIGHTS);
  const { detector, log } = await importWall(page);
  await weights;

  expect(detector).toBe('hybrid');
  // The model read the wall, not just "ran": a core for every note at least
  // (specks of core too, which the hybrid rules then ignore).
  const seen = log
    .map((l) => /^\[photo-model\] (\d+) notes on (wasm|webgpu)/.exec(l))
    .find(Boolean);
  expect(Number(seen?.[1])).toBeGreaterThanOrEqual(NOTES.length);
  expect(log).toContainEqual(expect.stringMatching(/^\[photo-detect\] hybrid \((wasm|webgpu),/));
  expectNoPageErrors(pageErrors);
});

test('the classical detector finds the notes alone when the model cannot load', async ({
  page,
  pageErrors,
}) => {
  await openPhotoBoard(page, { boundaryModel: false });
  const { detector, log } = await importWall(page);

  expect(detector).toBe('classical');
  expect(log).toContainEqual('[photo-detect] classical (load-failed)');
  expectNoPageErrors(pageErrors);
});

// The model reads a flat, textureless note as background (0.99 over this blue
// one's middle), which would let the hybrid drop a note the colour found. A
// flat drawing is therefore read by the classical detector alone, and says so.
test('a flat drawn note survives the photo import', async ({ page, pageErrors }) => {
  await openPhotoBoard(page);
  const { detector, log } = await importWall(page, FLAT_PAIR, 0);

  expect(detector).toBe('classical');
  expect(log).toContainEqual('[photo-detect] classical (flat-image)');
  expectNoPageErrors(pageErrors);
});

// The same two notes photographed reach the model, and the hybrid keeps both.
test('the same notes photographed survive the hybrid', async ({ page, pageErrors }) => {
  await openPhotoBoard(page);
  const { detector } = await importWall(page, FLAT_PAIR);

  expect(detector).toBe('hybrid');
  expectNoPageErrors(pageErrors);
});
