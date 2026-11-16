import { defaultCatalogue, presetSetup } from '@liveplanner/items';
import { adoptGuest, dismissQuickTour, expect, mintGuest, seedPlan, test } from './fixtures';

// The Add a Widget gallery end to end (docs/specs/026-plan/board-widgets.md "The widget gallery"): the + at the end
// of a board's header opens it, a field widget's tile adds that widget to the header, and Edit Widgets takes it off.
// The unit tests draw the gallery in isolation; this drives the real board, popover and header together.

const CANVAS = '[data-canvas-a11y-root]';

// The default card types carry no custom field, and a field widget reads one: add a Deal type with a Value (currency).
const catalogue = () => {
  const base = defaultCatalogue();
  return {
    ...base,
    types: [
      ...base.types,
      {
        id: 'deal',
        label: 'Deal',
        newTitle: 'New deal',
        glyph: 'coin',
        color: '#16a34a',
        fields: ['title', 'description', 'status', 'f-value', 'comments'],
        custom: [{ id: 'f-value', label: 'Value', kind: 'currency', currency: 'GBP' }],
      },
    ],
  };
};

test('Add a Widget adds a field widget to the board header and Edit Widgets removes it', async ({
  page,
}) => {
  const owner = await mintGuest(page.request);
  const id = crypto.randomUUID();
  const seeded = await seedPlan(page.request, owner, {
    id,
    name: 'Widget room',
    itemTypes: catalogue(),
    tabs: [
      {
        id: crypto.randomUUID(),
        name: 'Board',
        kind: 'board',
        elements: [
          {
            id: 'board',
            type: 'shape',
            shape: 'plan-board',
            x: 100,
            y: 100,
            width: 1100,
            height: 560,
            // A board offers the fields of the card types it takes.
            planBoard: { ...presetSetup('kanban'), addTypes: ['deal'] },
          },
        ],
      },
    ],
  });
  expect(seeded.ok()).toBe(true);

  await adoptGuest(page, owner);
  await page.addInitScript(() => {
    localStorage.setItem('liveplanner:v2:name-confirmed', '1');
    localStorage.setItem(
      'liveplanner:user-preferences:v1',
      JSON.stringify({ planTourSeen: true, planTourTracks: ['boards', 'sheets'] }),
    );
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/project/${id}`);
  await page.locator(CANVAS).waitFor();
  await dismissQuickTour(page);

  // The board's header offers the + to someone who may edit.
  const board = page.locator('[data-plan-board]').first();
  await board.waitFor();
  const zone = board.locator('[data-widget-zone]');
  // The Kanban preset starts with a few widgets of its own; the field widget is counted on top of them. Each widget is
  // in the zone once, in the row or (when the row is full) as the measuring layer's copy of one in More.
  const kinds = () =>
    zone
      .first()
      .evaluate(
        (z) =>
          new Set(
            [...z.querySelectorAll('[data-widget]')].map((e) => e.getAttribute('data-widget')),
          ).size,
      );
  const before = await kinds();
  await board.getByRole('button', { name: 'Add a widget' }).click();

  const gallery = page.getByRole('dialog', { name: 'Add a Widget' });
  await expect(gallery).toBeVisible();

  // A field widget: a tile under one of the card types' fields.
  const tile = gallery.locator('[data-gallery-field] [data-gallery-tile]').first();
  await tile.scrollIntoViewIfNeeded();
  const widgetId = await tile.getAttribute('data-gallery-tile');
  expect(widgetId, 'the Deal type carries a field a widget can read').toBeTruthy();
  const button = tile.locator('button[data-widget-card]');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');

  // It stands in the board's header once the gallery is closed: in the row, or in More when the row is full (a header
  // band's zone is at most 46rem, which the preset's widgets and this one can outgrow; board-widgets.md "The header").
  await gallery.getByRole('button', { name: 'Close' }).click();
  await expect(gallery).toHaveCount(0);
  await expect.poll(kinds).toBe(before + 1);
  const inRow = zone.locator(`[data-widget="${widgetId}"]:not([data-widget-ghost])`);
  const more = board.getByRole('button', { name: /^More widgets/ });
  const shown = async () => {
    if ((await inRow.count()) === 0) await more.click();
    const widget = page.locator(`[data-widget="${widgetId}"]:not([data-widget-ghost])`);
    await expect(widget).toBeVisible();
    return widget;
  };
  await shown();

  // Edit Widgets shows a Remove on each widget, in the row and in More; pressing it takes the widget off the header.
  await board.getByRole('button', { name: 'Edit Widgets' }).click();
  const widget = await shown();
  await widget.getByRole('button', { name: /^Remove / }).click();
  await expect(page.locator(`[data-widget="${widgetId}"]`)).toHaveCount(0);
  await expect.poll(kinds).toBe(before);
});
