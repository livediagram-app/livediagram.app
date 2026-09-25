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
// The template lays its starter row out at the board's gutter, and the lanes
// take their x rhythm from the notes rather than from a lattice.
const NOTE_GAP = 16;

type BoardNote = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  esKind?: string;
};
type BoardTab = {
  elements: BoardNote[];
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

// Timeline lanes (spec/139 Phase 6). An event-storming board is ALWAYS on
// lanes — there is no switch to find — and a note dragged on one lands centred
// on a lane, in a slot the board suggested, with nothing else stirring.
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

  // No switch anywhere: lanes are what this board IS.
  await expect(page.getByRole('switch', { name: /timeline lanes/i })).toHaveCount(0);

  const before = await boardTab(page);
  // The lanes are fixed to the canvas, lane 0 spanning y 0..200.
  const originY = 0;

  // Not one note moved: lanes are an aid the next drag can use, not a cage the
  // board is poured into.
  const third = (await notes.nth(2).boundingBox())!;
  const firstBox = (await notes.nth(0).boundingBox())!;
  const zoom = firstBox.height / (stickies(before)[0]!.height ?? 200);

  // Drag the third note down one lane, aiming a few px off the LEFT EDGE of
  // the note it should line up under — near enough for the neighbour snap,
  // far enough past the ordinary alignment threshold (6px) that landing there
  // can only be the lanes.
  await page.mouse.move(third.x + third.width / 2, third.y + third.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    third.x + third.width / 2 - (200 + NOTE_GAP - 9) * zoom,
    third.y + third.height / 2 + (LANE_PITCH + 11) * zoom,
    { steps: 12 },
  );
  // The lit lane is the promise the drop has to keep.
  await expect(page.locator('[data-testid="timeline-lanes-overlay"]')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('[data-testid="timeline-lanes-overlay"]')).toHaveCount(0);

  const after = await boardTab(page);
  const movedId = stickies(before).sort((a, b) => b.x - a.x)[0]!.id;
  const moved = stickies(after).find((el) => el.id === movedId)!;
  // Its centre is ON a lane and its left edge is EXACTLY where the note it
  // was aimed under sits — the operator's own case, which the old half-note
  // lattice could not express because the row's gutter is not a multiple of it.
  const byX = stickies(before).sort((a, b) => a.x - b.x);
  const column = byX[byX.length - 2]!;
  expect(moved.x).toBeCloseTo(column.x, 6);
  const centreOffset = moved.y + moved.height / 2 - (originY + LANE_HEIGHT / 2);
  expect(centreOffset % LANE_PITCH).toBeCloseTo(0, 6);

  // …and every OTHER note is byte-identical to before the drag.
  for (const el of stickies(before)) {
    if (el.id === movedId) continue;
    expect(
      stickies(after).find((a) => a.id === el.id),
      `note ${el.id}`,
    ).toEqual(el);
  }

  // Undo puts the note back, in ONE step: there is no switch flip underneath
  // it any more.
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await notes.nth(2).boundingBox())!.x).toBeCloseTo(third.x, 0);

  // …and the board still snaps after a reload, with nothing stored to restore.
  await page.waitForTimeout(1500);
  await page.reload();
  await canvas.waitFor();
  await expect(page.getByRole('switch', { name: /timeline lanes/i })).toHaveCount(0);

  expectNoPageErrors(pageErrors);
});

// The slots two events suggest, taken one at a time: the ALIGNED column under
// an event, and the STAGGERED brick under the gutter between two. Both are
// dropped from far enough away that only a real capture radius could land
// them, and both are read back from the document rather than the screen.
test('a dragged note takes the slot two events suggest', async ({ page, pageErrors }) => {
  await startTemplateDiagram(page, /Browse Technical templates/, /^Event storming/i);
  const canvas = page.locator('[data-canvas-a11y-root]');
  await dismissQuickTour(page);
  const notes = canvas.getByRole('img', { name: /^Sticky note/ });
  await expect(notes).toHaveCount(3);
  await page.waitForTimeout(500);
  const before = await boardTab(page);
  const row = stickies(before).sort((a, b) => a.x - b.x);
  const zoom = (await notes.nth(0).boundingBox())!.height / (row[0]!.height ?? 200);
  const gutter = row[1]!.x - (row[0]!.x + row[0]!.width);
  // The template lays its row on a lane, so every target below is measured
  // from the row's own lane.
  const laneTopY = (index: number) => row[0]!.y + index * LANE_PITCH;

  // The note that will do the travelling is the right-most of the row.
  const travellerId = row[row.length - 1]!.id;
  const dragBy = async (dxCanvas: number, dyCanvas: number, opts = { expectGhost: true }) => {
    const box = (await notes.nth(2).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + dxCanvas * zoom,
      box.y + box.height / 2 + dyCanvas * zoom,
      { steps: 14 },
    );
    // The offer is on screen BEFORE the drop — that is the whole point of a
    // capture radius this wide. When nothing is offered, nothing is drawn.
    const ghost = page.locator('[data-testid="timeline-lane-ghost"]');
    if (opts.expectGhost) await expect(ghost).toBeVisible();
    else await expect(ghost).toHaveCount(0);
    await page.mouse.up();
  };

  // 1. ALIGNED: into the lane below, aimed 60px right of the first event's
  //    column — way past any alignment threshold, well inside the radius.
  const traveller = stickies(before).find((el) => el.id === travellerId)!;
  await dragBy(row[0]!.x + 60 - traveller.x, laneTopY(1) + 6 - traveller.y);
  let after = await boardTab(page);
  let moved = stickies(after).find((el) => el.id === travellerId)!;
  expect(moved.x).toBeCloseTo(row[0]!.x, 6);
  expect(moved.y + moved.height / 2).toBeCloseTo(laneTopY(1) + LANE_HEIGHT / 2, 6);

  // 2. STAGGERED: aimed 40px off the brick position under the gutter between
  //    the two events still in the row above.
  const brick = row[0]!.x + (row[0]!.width + gutter) / 2;
  await dragBy(brick + 40 - moved.x, 0);
  after = await boardTab(page);
  moved = stickies(after).find((el) => el.id === travellerId)!;
  expect(moved.x).toBeCloseTo(brick, 6);

  // 3. PUSHED RIGHT UP AGAINST the first event, which is how an author says
  //    "right behind this": the note takes the next place in the row instead
  //    of coming to rest half on top of its neighbour.
  const touching = row[0]!.x + row[0]!.width + 10;
  await dragBy(touching - moved.x, laneTopY(0) + 4 - moved.y);
  after = await boardTab(page);
  moved = stickies(after).find((el) => el.id === travellerId)!;
  expect(moved.x).not.toBeCloseTo(touching, 1);
  for (const el of [row[0]!, row[1]!]) {
    const overlaps = moved.x < el.x + el.width && moved.x + moved.width > el.x;
    expect(overlaps, `landed on top of ${el.id}`).toBe(false);
  }

  // Neither event above moved to make room for either drop.
  for (const el of [row[0]!, row[1]!]) {
    expect(
      stickies(after).find((a) => a.id === el.id),
      `note ${el.id}`,
    ).toEqual(el);
  }
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

// The next-note buttons (spec/139 Phase 7). What only a browser can answer is
// whether the button a note shows really adds the note beside it, and whether
// the two stay two ordinary notes: dragging one leaves the other where it is.
test('a next-note button adds a command before an event, and nothing ties them', async ({
  page,
  pageErrors,
}) => {
  await startTemplateDiagram(page, /Browse Technical templates/, /^Event storming/i);
  const canvas = page.locator('[data-canvas-a11y-root]');
  await dismissQuickTour(page);
  const notes = canvas.getByRole('img', { name: /^Sticky note/ });
  await expect(notes).toHaveCount(3);
  await page.waitForTimeout(500);

  // Select an event: both of its sides offer a next note. The MIDDLE one,
  // because the first sits under the Explorer panel at this viewport and a
  // floating panel would swallow the click.
  await notes.nth(1).click();
  const before = page.getByRole('button', { name: /add a command before/i });
  await expect(before).toBeVisible();
  await expect(page.getByRole('button', { name: /add a policy after/i })).toBeVisible();

  const start = await boardTab(page);
  await before.click();
  await expect(notes).toHaveCount(4);
  await page.keyboard.type('Place order');
  await page.keyboard.press('Escape');

  const added = await boardTab(page);
  const command = stickies(added).find((el) => el.esKind === 'command')!;
  // One gutter to the left of the event it was added from, the same height.
  const event = stickies(added).find(
    (el) => el.esKind === 'domain-event' && el.x === command.x + command.width + 16,
  );
  expect(event).toBeDefined();
  expect(stickies(added)).toHaveLength(stickies(start).length + 1);
  expect(command).not.toHaveProperty('esDock');

  // Drag the event away: the command stays exactly where it was.
  await page.waitForTimeout(500);
  const box = (await notes.nth(1).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 260, { steps: 10 });
  await page.mouse.up();
  const moved = await boardTab(page);
  const movedCommand = stickies(moved).find((el) => el.id === command.id)!;
  const movedEvent = stickies(moved).find((el) => el.id === event!.id)!;
  expect(movedEvent.y).not.toBe(event!.y);
  expect({ x: movedCommand.x, y: movedCommand.y }).toEqual({ x: command.x, y: command.y });

  expectNoPageErrors(pageErrors);
});

// Copied notes pasted while a note is open for typing (spec/09 clipboard).
// The clipboard holds them as JSON text, and the note used to take that JSON
// as its words. They belong on the board.
test('pasting copied notes into a note open for typing puts them on the board', async ({
  page,
  context,
  pageErrors,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await startTemplateDiagram(page, /Browse Technical templates/, /^Event storming/i);
  const canvas = page.locator('[data-canvas-a11y-root]');
  await dismissQuickTour(page);
  const notes = canvas.getByRole('img', { name: /^Sticky note/ });
  await expect(notes).toHaveCount(3);
  await page.waitForTimeout(500);

  // Copy one event.
  await notes.nth(1).click();
  await page.keyboard.press('ControlOrMeta+c');
  // Add the next note: it arrives open for typing.
  await page.getByRole('button', { name: /add a command before/i }).click();
  await expect(notes).toHaveCount(4);
  await page.keyboard.press('ControlOrMeta+v');
  await expect(notes).toHaveCount(5);

  const tab = await boardTab(page);
  const labels = stickies(tab).map((el) => (el as BoardNote & { label?: string }).label ?? '');
  expect(labels.some((l) => l.includes('schemaVersion'))).toBe(false);
  expectNoPageErrors(pageErrors);
});

// An armed workshop-note tile is a STAMP (spec/139 Phase 4): a ghost of the
// note follows the pointer, a drag carries it rather than sizing a box, and it
// lands centred where the ghost was, on a lane.
test('an armed note tile shows the note it will add and places it there', async ({
  page,
  pageErrors,
}) => {
  await startTemplateDiagram(page, /Browse Technical templates/, /^Event storming/i);
  await dismissQuickTour(page);
  const notes = page.locator('[data-canvas-a11y-root]').getByRole('img', { name: /^Sticky note/ });
  await expect(notes).toHaveCount(3);
  await page.waitForTimeout(500);

  // Aim one lane below the template row, a few px off the lane's centre.
  const before = await boardTab(page);
  const rowNote = stickies(before)[0]!;
  const rowBox = (await notes.nth(0).boundingBox())!;
  const zoom = rowBox.height / rowNote.height;
  const aimY = rowBox.y + rowBox.height / 2 + (LANE_PITCH + 7) * zoom;

  await page.getByRole('option', { name: 'Add Command note' }).first().click();
  await expect(page.getByText('Click to place a command note')).toBeVisible();
  const ghost = page.getByTestId('stamp-ghost');
  await page.mouse.move(700, aimY);
  await expect(ghost).toBeVisible();
  await expect(ghost).toContainText('Command');
  const resting = (await ghost.boundingBox())!;

  // Press and drag: the ghost is carried at the note's own size, never drawn.
  await page.mouse.down();
  await page.mouse.move(900, aimY + 5, { steps: 8 });
  // A 200 x 50 drag: a draw-to-size box would be wide and flat. The ghost
  // keeps the note's own square, the same size it had at rest.
  const carried = (await ghost.boundingBox())!;
  expect(carried.width).toBeCloseTo(resting.width, 0);
  expect(carried.height).toBeCloseTo(carried.width, 0);
  await page.mouse.up();
  await expect(notes).toHaveCount(4);
  await expect(ghost).toHaveCount(0);

  const tab = await boardTab(page);
  const command = stickies(tab).find((el) => el.esKind === 'command')!;
  expect({ width: command.width, height: command.height }).toEqual({ width: 200, height: 200 });
  // On the lane below the row, centred on it.
  expect(command.y + command.height / 2).toBeCloseTo(
    rowNote.y + rowNote.height / 2 + LANE_PITCH,
    6,
  );
  expectNoPageErrors(pageErrors);
});
