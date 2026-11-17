import { expect, markModeToursSeen, serverNewUrl, test } from './fixtures';

// The Call dock fits its buttons at every width (docs/specs/008-canvas/avatar-mode.md "The Call dock", "Where"; Work
// Tracker 1041): it sits in the bottom-right cluster's row, so its last button (Pop Out where the browser has one)
// stays inside the card's border and the card never reaches the zoom buttons. At 760 px a dock floating at half the
// canvas's width once squeezed Pop Out past its card and over the zoom pill. It also stands clear of the Map, open
// bottom-left: at 640 to 700 px the centred dock once covered the Map's right half.

// A Spaces template: opens walking as it lands, so the dock shows (packages/templates template-builders-spaces.ts).
const SPACE = 'team-pod';

test('the Call dock keeps every button inside its card, clear of the zoom buttons and the open Map', async ({
  page,
}) => {
  test.setTimeout(60_000);
  // The Receptionist's welcome stays away.
  await markModeToursSeen(page.context());
  await page.setViewportSize({ width: 768, height: 863 });
  await page.goto(await serverNewUrl(page, `/new?template=${SPACE}`));
  const card = page.locator('[data-call-dock] > [data-floating-panel]');
  await expect(card.locator('button').first()).toBeVisible({ timeout: 30_000 });
  // The Map opens on a desktop-width window (MovablePanel starts collapsed only on a phone).
  const map = page.locator('[data-tour-id="minimap"]');
  await expect(map).toBeVisible();
  // Open: its toggle offers to collapse it, and its body (the panel's direct child that takes aria-hidden while
  // collapsed) is not hidden. The header's icons are aria-hidden too, so only the body is checked.
  await expect(map.getByRole('button', { name: 'Collapse map' })).toBeVisible();
  await expect(map.locator(':scope > [aria-hidden="true"]')).toHaveCount(0);

  for (const width of [768, 760, 700, 640, 1024, 1440]) {
    await page.setViewportSize({ width, height: 863 });
    await expect
      .poll(
        () =>
          card.evaluate((el) => {
            const box = el.getBoundingClientRect();
            const buttons = [...el.querySelectorAll('button')].map((b) =>
              b.getBoundingClientRect(),
            );
            const last = buttons.at(-1)!;
            const cluster = [...document.querySelectorAll('[data-cluster-buttons] > *')]
              .map((b) => b.getBoundingClientRect())
              .filter((r) => r.width > 0);
            const clusterLeft = Math.min(...cluster.map((r) => r.left));
            const map = document.querySelector('[data-tour-id="minimap"]')!.getBoundingClientRect();
            return {
              // Every button inside the card's border: the last one ends before the card does.
              inside: last.left >= box.left && last.right <= box.right + 0.5,
              unsqueezed: el.scrollWidth <= el.clientWidth,
              // The card ends before the zoom buttons start.
              // The card ends before the zoom buttons start, or stands on its own line above them.
              clear:
                box.right <= clusterLeft || box.bottom <= Math.min(...cluster.map((r) => r.top)),
              // The card and the open Map share no pixel.
              offMap:
                box.left >= map.right ||
                box.right <= map.left ||
                box.bottom <= map.top ||
                box.top >= map.bottom,
            };
          }),
        { message: `at ${width}px` },
      )
      .toEqual({ inside: true, unsqueezed: true, clear: true, offMap: true });
  }
});
