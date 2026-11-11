import type { Page } from '@playwright/test';
import { expect } from '../fixtures';
import { wallPhotoPng, type WallNote } from './wall-photo';

// Shared helpers for the photo-import specs (photo-import*.spec.ts): a drawn wall, and
// the steps from the Add from photo button to the review and on to the board.

export const ORANGE = '#fdba74'; // domain-event
export const BLUE = '#93c5fd'; // command

// A wall, drawn: solid notes in a row, in reading order.
export function wall(notes: WallNote[]) {
  return { name: 'wall.png', mimeType: 'image/png', buffer: wallPhotoPng(900, 400, notes) };
}

export async function importToReview(page: Page, notes: WallNote[]) {
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

export async function importPhoto(page: Page, notes: WallNote[]) {
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
export async function panBy(page: Page, dx: number, dy: number) {
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

export const notes = (page: Page) =>
  page.locator('[data-canvas-a11y-root]').getByRole('img', { name: /^Sticky note/ });
export const drafts = (page: Page) => page.locator('[data-photo-draft]');
export const bar = (page: Page) => page.locator('[data-testid="photo-draft-bar"]');
