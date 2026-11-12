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
  // The Kanban preset starts with a few widgets of its own; the field widget is counted on top of them.
  const before = await zone.locator('[data-widget]').count();
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

  // It stands in the board's header once the gallery is closed.
  await gallery.getByRole('button', { name: 'Close' }).click();
  await expect(gallery).toHaveCount(0);
  const widget = zone.locator(`[data-widget="${widgetId}"]`);
  await expect(widget).toBeVisible();
  await expect(zone.locator('[data-widget]')).toHaveCount(before + 1);

  // Edit Widgets shows a Remove on each widget; pressing it takes the widget off the header.
  await board.getByRole('button', { name: 'Edit Widgets' }).click();
  await widget.getByRole('button', { name: /^Remove / }).click();
  await expect(widget).toHaveCount(0);
  await expect(zone.locator('[data-widget]')).toHaveCount(before);
});
