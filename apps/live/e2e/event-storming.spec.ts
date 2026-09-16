import type { Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  startTemplateDiagram,
  test,
} from './fixtures';

// The event-storming board's own gestures (spec/139), in a real browser. The
// geometry is unit-tested to death; what only a browser can answer is whether
// a real drag lands where the preview promised, and whether the board is still
// the same board after a round trip through the api.
//
// Dark scheme throughout (the testing rule): the board's chrome is tuned per
// scheme, so a suite that only ever sees light misses half of it.
test.use({ colorScheme: 'dark' });

const LANE_PITCH = 240;
const LANE_HEIGHT = 200;
const GRID_CELL = 100;

type BoardNote = { id: string; type: string; x: number; y: number; height: number };
type BoardTab = {
  elements: BoardNote[];
  esTimeline?: { originX: number; originY: number; enabled: boolean };
};

// The board as the API holds it. Screen geometry cannot answer the questions
// this feature raises — the notes are TILTED, so their bounding boxes are
// rotation-bloated by a few pixels, and "on the grid" is an exact claim about
// canvas coordinates. Reading the saved tab back proves the placement AND the
// persistence in one go, through the page's own identity.
async function boardTab(page: Page): Promise<BoardTab> {
  // Let the debounced autosave flush before asking the server what it has.
  await page.waitForTimeout(1500);
  // Same base the app itself was built with: the e2e stack serves the api
  // same-origin, a local dev stack may put it on its own port.
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
  return page.evaluate(async (base: string) => {
    const apiBase = base;
    const owner = localStorage.getItem('livediagram:v2:self-id') ?? '';
    const id = location.pathname.split('/').filter(Boolean).pop()!;
    const headers = { 'X-Owner-Id': owner };
    const diagram = await (await fetch(`${apiBase}/diagrams/${id}`, { headers })).json();
    const tabId = diagram.diagram.tabs[0].id;
    const tab = await (await fetch(`${apiBase}/diagrams/${id}/tabs/${tabId}`, { headers })).json();
    return tab.tab;
  }, apiBase);
}

const stickies = (tab: BoardTab) => tab.elements.filter((el) => el.type === 'sticky');

// Timeline lanes (spec/139 Phase 6). Three claims, each of which has failed in
// a prototype at some point: the switch turns lanes on for the BOARD (so it
// survives a reload), turning them on moves NOTHING, and a note dragged
// afterwards lands centred on a lane and on a half-note column.
test('timeline lanes snap a dragged note without moving anything else', async ({
  page,
  pageErrors,
}) => {
  await startTemplateDiagram(page, /Browse Technical templates/, /^Event storming/i);
  const canvas = page.locator('[data-canvas-a11y-root]');
  await dismissQuickTour(page);

  const notes = canvas.getByRole('img', { name: /^Sticky note/ });
  await expect(notes).toHaveCount(3);
  // The opening zoom-to-fit settles a few pixels after the notes render.
  await page.waitForTimeout(500);

  // The switch sits at the TOP of the notation category, above the notes.
  const lanes = page.getByRole('switch', { name: /timeline lanes/i });
  await expect(lanes).toBeVisible();
  await expect(lanes).toHaveAttribute('aria-checked', 'false');
  await lanes.click();
  await expect(lanes).toHaveAttribute('aria-checked', 'true');

  const before = await boardTab(page);
  expect(before.esTimeline?.enabled).toBe(true);
  // The stack anchored itself on the top-most, then left-most note.
  const topLeft = [...stickies(before)].sort((a, b) => a.y - b.y || a.x - b.x)[0]!;
  expect(before.esTimeline).toMatchObject({ originX: topLeft.x, originY: topLeft.y });

  // Not one note moved: lanes are an aid the next drag can use, not a cage the
  // board is poured into.
  const third = (await notes.nth(2).boundingBox())!;
  const firstBox = (await notes.nth(0).boundingBox())!;
  const zoom = firstBox.height / (stickies(before)[0]!.height ?? 200);

  // Drag the third note down a lane and across a column, landing it a few px
  // off both — near enough for the snap, far enough to prove it happened.
  await page.mouse.move(third.x + third.width / 2, third.y + third.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    third.x + third.width / 2 + (GRID_CELL + 9) * zoom,
    third.y + third.height / 2 + (LANE_PITCH + 11) * zoom,
    { steps: 12 },
  );
  // The lit lane is the promise the drop has to keep.
  await expect(page.locator('[data-testid="timeline-lanes-overlay"]')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('[data-testid="timeline-lanes-overlay"]')).toHaveCount(0);

  const after = await boardTab(page);
  const origin = after.esTimeline!;
  const movedId = stickies(before).sort((a, b) => b.x - a.x)[0]!.id;
  const moved = stickies(after).find((el) => el.id === movedId)!;
  // Its left edge is ON a column and its centre is ON a lane. Exactly on —
  // this is the whole claim, and it is not a claim screen pixels can make.
  expect((moved.x - origin.originX) % GRID_CELL).toBeCloseTo(0, 6);
  const centreOffset = moved.y + moved.height / 2 - (origin.originY + LANE_HEIGHT / 2);
  expect(centreOffset % LANE_PITCH).toBeCloseTo(0, 6);

  // …and every OTHER note is byte-identical to before the drag.
  for (const el of stickies(before)) {
    if (el.id === movedId) continue;
    expect(
      stickies(after).find((a) => a.id === el.id),
      `note ${el.id}`,
    ).toEqual(el);
  }

  // Undo puts the note back AND leaves the lanes on: two separate steps, with
  // the note's move on top.
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await notes.nth(2).boundingBox())!.x).toBeCloseTo(third.x, 0);
  await expect(lanes).toHaveAttribute('aria-checked', 'true');
  // One more undo and the switch itself comes back off; redo re-applies it.
  await page.keyboard.press('Control+z');
  await expect(lanes).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Control+Shift+z');
  await expect(lanes).toHaveAttribute('aria-checked', 'true');

  // Lanes are BOARD state: they survive the round trip through the api.
  await page.waitForTimeout(1500);
  await page.reload();
  await canvas.waitFor();
  await expect(page.getByRole('switch', { name: /timeline lanes/i })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  expectNoPageErrors(pageErrors);
});

// The negative half: no other board grows a lane switch. Cheap, and it is the
// claim every gate in this feature rests on.
test('an ordinary diagram has no timeline lanes', async ({ page, pageErrors }) => {
  await startTemplateDiagram(page, /Browse Technical templates/, /^Sequence/i);
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);
  await expect(page.getByRole('switch', { name: /timeline lanes/i })).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});
