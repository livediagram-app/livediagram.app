import {
  dismissQuickTour,
  expect,
  guestSigFor,
  mintSignedGuest,
  ownerHeaders,
  test,
} from './fixtures';

// A Sheet on a Plan tab (docs/specs/029-sheets/sheet.md): typed into in Plan mode, its formula worked out on
// the grid and kept in the sheet store, and maximised and restored like a board.

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const CANVAS = '[data-canvas-a11y-root]';
// The grid's header strips (apps/live/components/sheets/sheet-geometry.ts): a click past them lands on A1.
const ROW_HEADER_PX = 46;
const COL_HEADER_PX = 22;

const ids = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(4, '0')}`);

// A Sheet tab (docs/specs/026-plan/plan-tabs.md "Board tab and Sheet tab"): its one Sheet fills the tab, takes a
// formula, works it out and keeps it as typed; filling the tab already, it offers no Maximise.
test('a Sheet tab takes a formula, works it out, keeps it, and fills the tab', async ({
  page,
  baseURL,
}) => {
  const owner = await mintSignedGuest(page.request);
  const id = crypto.randomUUID();
  const tabId = crypto.randomUUID();
  const sheetId = 'e2esheet01';
  const headers = ownerHeaders(owner, { Origin: new URL(baseURL!).origin });
  const now = Date.now();
  const seeded = await page.request.post(`${apiBase}/projects`, {
    headers,
    data: {
      id,
      name: 'Budget room',
      tabs: [
        {
          id: tabId,
          name: 'Budget',
          kind: 'sheet',
          elements: [
            {
              id: 'sheet',
              type: 'shape',
              shape: 'plan-sheet',
              // Clear of the toolbar along the top.
              x: 120,
              y: 260,
              width: 960,
              height: 560,
              planSheet: { sheetId },
            },
          ],
        },
      ],
      sheets: [
        {
          id: sheetId,
          tabId,
          title: 'Budget',
          layout: { rows: ids('r', 20), cols: ids('c', 6) },
          cells: [],
          rev: 0,
          createdAt: now,
          updatedAt: now,
          updatedBy: { id: owner, name: 'Owner', color: '#0ea5e9' },
        },
      ],
    },
  });
  expect(seeded.ok()).toBe(true);

  await page.addInitScript(
    ({ o, sig }) => {
      localStorage.setItem('liveplanner:v2:self-id', o);
      if (sig) localStorage.setItem('liveplanner:v2:self-sig', sig);
      localStorage.setItem('liveplanner:v2:name-confirmed', '1');
      localStorage.setItem(
        'liveplanner:user-preferences:v1',
        JSON.stringify({ planTourSeen: true, planTourTracks: ['boards', 'sheets'] }),
      );
    },
    { o: owner, sig: guestSigFor(owner) },
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/project/${id}`);
  await page.locator(CANVAS).waitFor();
  await dismissQuickTour(page);

  const grid = page.getByRole('grid', { name: 'Budget grid' });
  await expect(grid).toBeVisible();
  const box = (await grid.boundingBox())!;
  await page.mouse.click(box.x + ROW_HEADER_PX + 20, box.y + COL_HEADER_PX + 8);
  await page.keyboard.type('=6*7');
  await page.keyboard.press('Enter');
  await expect(grid).toContainText('42');

  // The sheet store keeps the formula as typed.
  await expect
    .poll(async () => {
      const res = await page.request.get(`${apiBase}/projects/${id}/sheets`, { headers });
      const body = (await res.json()) as { sheets: { id: string; cells: { i?: unknown }[] }[] };
      return JSON.stringify(body.sheets.find((s) => s.id === sheetId)?.cells ?? []);
    })
    .toContain('6*7');

  // The Sheet fills the tab for everyone: no Maximise or Restore to offer.
  await expect(page.getByRole('button', { name: 'Maximise Sheet' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restore Sheet' })).toHaveCount(0);
});
