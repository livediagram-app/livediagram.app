import type { Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  startEventStormingRow,
  test,
} from './fixtures';

// Workshop notes always land on a lane (docs/specs/021-event-storming/event-storming.md "Always on a lane"), in a
// real browser: drag, Cmd/Ctrl, the arrow keys, duplicate, paste at the
// pointer and staggered, and the one-time settle of an older board. Every
// position is read back from the api: the notes are tilted, so screen boxes
// are rotation-bloated, and "on a lane" is an exact claim about canvas
// coordinates.
test.use({ colorScheme: 'dark' });

const LANE_PITCH = 240;
const LANE_CENTRE_0 = 100;
const API = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

type Note = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  esKind?: string;
  label?: string;
};
type BoardTab = { id: string; elements: Note[]; esLanesSettled?: boolean };

const laneOffset = (n: Note) => {
  const t = (n.y + n.height / 2 - LANE_CENTRE_0) / LANE_PITCH;
  return Math.abs(t - Math.round(t)) * LANE_PITCH;
};
const onLane = (n: Note) => laneOffset(n) < 0.5;
const stickies = (tab: BoardTab) => tab.elements.filter((el) => el.type === 'sticky');

async function boardTab(page: Page, settle = 1500): Promise<BoardTab> {
  await page.waitForTimeout(settle);
  return page.evaluate(async (base: string) => {
    const owner = localStorage.getItem('livediagram:v2:self-id') ?? '';
    const id = location.pathname.split('/').filter(Boolean).pop()!;
    const headers = { 'X-Owner-Id': owner };
    const diagram = await (await fetch(`${base}/diagrams/${id}`, { headers })).json();
    const tabId = diagram.diagram.tabs[0].id;
    return (await (await fetch(`${base}/diagrams/${id}/tabs/${tabId}`, { headers })).json()).tab;
  }, API);
}

// Canvas to screen, measured from two notes of the row whose canvas centres
// are known: exact, where a tilted note's box height is not.
async function viewportOf(page: Page) {
  const tab = await boardTab(page, 0);
  const row = stickies(tab).sort((a, b) => a.x - b.x);
  const notes = page.locator('[data-canvas-a11y-root]').getByRole('img', { name: /^Sticky note/ });
  const boxes = await Promise.all([0, 2].map((i) => notes.nth(i).boundingBox()));
  const centre = (b: { x: number; y: number; width: number; height: number }) => ({
    x: b.x + b.width / 2,
    y: b.y + b.height / 2,
  });
  const s0 = centre(boxes[0]!);
  const s2 = centre(boxes[1]!);
  const c0 = { x: row[0]!.x + row[0]!.width / 2, y: row[0]!.y + row[0]!.height / 2 };
  const c2x = row[2]!.x + row[2]!.width / 2;
  const zoom = (s2.x - s0.x) / (c2x - c0.x);
  return {
    zoom,
    row,
    toScreen: (x: number, y: number) => ({
      x: s0.x + (x - c0.x) * zoom,
      y: s0.y + (y - c0.y) * zoom,
    }),
  };
}

async function openRow(page: Page) {
  await startEventStormingRow(page);
  await dismissQuickTour(page);
  const notes = page.locator('[data-canvas-a11y-root]').getByRole('img', { name: /^Sticky note/ });
  await expect(notes).toHaveCount(3);
  await page.waitForTimeout(500);
  return notes;
}

test('a dragged workshop note lands on a lane from anywhere, and Cmd/Ctrl leaves it free', async ({
  page,
  pageErrors,
}) => {
  test.slow();
  const notes = await openRow(page);
  const { toScreen, row } = await viewportOf(page);
  const traveller = row[2]!;
  const drag = async (dy: number, mod?: string) => {
    const current = stickies(await boardTab(page, 0)).find((n) => n.id === traveller.id)!;
    const start = toScreen(current.x + 100, current.y + 100);
    if (mod) await page.keyboard.down(mod);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y + dy, { steps: 12 });
    await page.mouse.up();
    if (mod) await page.keyboard.up(mod);
  };
  // 140 canvas px down: between lane 0 and lane 1, nearer lane 1. The old
  // aid left a note there; now it lands on lane 1.
  const zoom = (await viewportOf(page)).zoom;
  await drag(140 * zoom);
  let moved = stickies(await boardTab(page)).find((n) => n.id === traveller.id)!;
  expect(onLane(moved), `offset ${laneOffset(moved)}`).toBe(true);
  expect(moved.y).toBe(traveller.y + LANE_PITCH);
  await expect(notes).toHaveCount(3);

  // Cmd/Ctrl: exactly where the hand put it, between two lanes.
  await drag(-110 * zoom, 'Control');
  moved = stickies(await boardTab(page)).find((n) => n.id === traveller.id)!;
  expect(laneOffset(moved)).toBeGreaterThan(60);

  // And it stays free: a reload settles nothing on a board already settled.
  await page.reload();
  await notes.nth(2).waitFor();
  const reloaded = stickies(await boardTab(page)).find((n) => n.id === traveller.id)!;
  expect(reloaded.y).toBe(moved.y);
  expectNoPageErrors(pageErrors);
});

test('the arrow keys move a workshop note a whole lane', async ({ page, pageErrors }) => {
  const notes = await openRow(page);
  const before = stickies(await boardTab(page, 0)).sort((a, b) => a.x - b.x)[1]!;
  await notes.nth(1).click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('ArrowUp');
  const after = stickies(await boardTab(page)).find((n) => n.id === before.id)!;
  expect(after).toMatchObject({ x: before.x, y: before.y + LANE_PITCH });
  await page.keyboard.press('ArrowRight');
  const nudged = stickies(await boardTab(page)).find((n) => n.id === before.id)!;
  expect(nudged).toMatchObject({ x: before.x + 1, y: before.y + LANE_PITCH });
  expectNoPageErrors(pageErrors);
});

test('duplicate staggers along the lane', async ({ page, pageErrors }) => {
  const notes = await openRow(page);
  const source = stickies(await boardTab(page, 0)).sort((a, b) => a.x - b.x)[0]!;
  await notes.nth(0).click();
  await page.keyboard.press('ControlOrMeta+d');
  await expect(notes).toHaveCount(4);
  const copy = stickies(await boardTab(page)).find(
    (n) => n.id !== source.id && n.label === source.label,
  )!;
  expect(copy).toMatchObject({ x: source.x + 24, y: source.y });
  expectNoPageErrors(pageErrors);
});

test('paste lands at the pointer over the canvas, and staggers when it is elsewhere', async ({
  page,
  context,
  pageErrors,
}) => {
  test.slow();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const notes = await openRow(page);
  const { row } = await viewportOf(page);
  await notes.nth(0).click();
  await page.keyboard.press('ControlOrMeta+c');

  // Over the canvas, two lanes below the row's LAST note and 30px into its
  // footprint: the copy takes that lane, and the free slot beside the note
  // already there rather than landing on top of it.
  const last = row[2]!;
  const below = { ...last, id: 'below', y: last.y + 2 * LANE_PITCH };
  await page.evaluate(
    async ({ base, note }) => {
      const owner = localStorage.getItem('livediagram:v2:self-id') ?? '';
      const id = location.pathname.split('/').filter(Boolean).pop()!;
      const headers = { 'X-Owner-Id': owner, 'Content-Type': 'application/json' };
      const diagram = await (await fetch(`${base}/diagrams/${id}`, { headers })).json();
      const tabId = diagram.diagram.tabs[0].id;
      const tab = (await (await fetch(`${base}/diagrams/${id}/tabs/${tabId}`, { headers })).json())
        .tab;
      await fetch(`${base}/diagrams/${id}/tabs/${tabId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          ...tab,
          elements: [...tab.elements, { ...note, id: crypto.randomUUID() }],
        }),
      });
    },
    { base: API, note: below },
  );
  await page.reload();
  await expect(notes).toHaveCount(4);
  await page.waitForTimeout(800);
  const view = await viewportOf(page);
  const at = view.toScreen(below.x + 130, below.y + 100 + 30);
  await page.mouse.move(at.x, at.y);
  await page.keyboard.press('ControlOrMeta+v');
  await expect(notes).toHaveCount(5);
  let tab = await boardTab(page);
  const pasted = stickies(tab).filter((n) => n.label === row[0]!.label && n.id !== row[0]!.id);
  expect(pasted).toHaveLength(1);
  expect(pasted[0]!.y).toBe(below.y);
  expect(pasted[0]!.x).toBe(below.x + 200 + 16);

  // Off the canvas: staggered on the ORIGINAL, same lane, 24px right.
  await page.mouse.move(2, 2);
  await page.keyboard.press('ControlOrMeta+v');
  await expect(notes).toHaveCount(6);
  tab = await boardTab(page);
  const copies = stickies(tab).filter((n) => n.label === row[0]!.label && n.id !== row[0]!.id);
  const staggered = copies.find((n) => n.id !== pasted[0]!.id)!;
  expect(staggered).toMatchObject({ x: row[0]!.x + 24, y: row[0]!.y });
  expectNoPageErrors(pageErrors);
});

test('an older board is lined up on the lanes once, and undo keeps the choice', async ({
  page,
  pageErrors,
}) => {
  test.slow();
  const notes = await openRow(page);
  // Make it an OLDER board: two notes parked between lanes, and no mark.
  await page.evaluate(async (base: string) => {
    const owner = localStorage.getItem('livediagram:v2:self-id') ?? '';
    const id = location.pathname.split('/').filter(Boolean).pop()!;
    const headers = { 'X-Owner-Id': owner, 'Content-Type': 'application/json' };
    const diagram = await (await fetch(`${base}/diagrams/${id}`, { headers })).json();
    const tabId = diagram.diagram.tabs[0].id;
    const tab = (await (await fetch(`${base}/diagrams/${id}/tabs/${tabId}`, { headers })).json())
      .tab;
    const { esLanesSettled: _gone, ...older } = tab;
    void _gone;
    const elements = tab.elements.map((el: { y: number }, i: number) =>
      i === 0 ? { ...el, y: el.y + 130 } : i === 1 ? { ...el, y: el.y - 70 } : el,
    );
    await fetch(`${base}/diagrams/${id}/tabs/${tabId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ ...older, elements }),
    });
  }, API);
  await page.reload();
  await notes.nth(2).waitFor();
  await expect(page.getByText('Lined up 2 notes on the lanes.')).toBeVisible();
  let tab = await boardTab(page);
  expect(tab.esLanesSettled).toBe(true);
  expect(stickies(tab).every(onLane)).toBe(true);

  // Undo puts them back where they were, and the board does not ask again.
  await page.locator('[data-canvas-a11y-root]').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ControlOrMeta+z');
  tab = await boardTab(page);
  expect(stickies(tab).filter((n) => !onLane(n))).toHaveLength(2);
  expect(tab.esLanesSettled).toBe(true);
  await page.reload();
  await notes.nth(2).waitFor();
  await page.waitForTimeout(1000);
  await expect(page.getByText(/Lined up \d+ notes? on the lanes/)).toHaveCount(0);
  tab = await boardTab(page);
  expect(stickies(tab).filter((n) => !onLane(n))).toHaveLength(2);
  expectNoPageErrors(pageErrors);
});

test('a new board starts on a lane, settled', async ({ page, pageErrors }) => {
  await openRow(page);
  const tab = await boardTab(page, 0);
  expect(tab.esLanesSettled).toBe(true);
  expect(stickies(tab).every(onLane)).toBe(true);
  expectNoPageErrors(pageErrors);
});
