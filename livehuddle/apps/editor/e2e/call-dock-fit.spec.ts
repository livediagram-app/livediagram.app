import { expect, markModeToursSeen, serverNewUrl, test } from './fixtures';

// The Call dock fits its buttons at every width (docs/specs/008-canvas/avatar-mode.md "The Call dock", "Where"; Work
// Tracker 1041): it sits in the bottom-right cluster's row, so its last button (Pop Out where the browser has one)
// stays inside the card's border and the card never reaches the zoom buttons. At 760 px a dock floating at half the
// canvas's width once squeezed Pop Out past its card and over the zoom pill.

// A Spaces template: opens walking as it lands, so the dock shows (packages/templates template-builders-spaces.ts).
const SPACE = 'team-pod';

test('the Call dock keeps every button inside its card and clear of the zoom buttons', async ({
  page,
}) => {
  test.setTimeout(60_000);
  // The Receptionist's welcome stays away.
  await markModeToursSeen(page.context());
  await page.setViewportSize({ width: 768, height: 863 });
  await page.goto(await serverNewUrl(page, `/new?template=${SPACE}`));
  const card = page.locator('[data-call-dock] > [data-floating-panel]');
  await expect(card.locator('button').first()).toBeVisible({ timeout: 30_000 });

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
            return {
              // Every button inside the card's border: the last one ends before the card does.
              inside: last.left >= box.left && last.right <= box.right + 0.5,
              unsqueezed: el.scrollWidth <= el.clientWidth,
              // The card ends before the zoom buttons start.
              clear: box.right <= clusterLeft,
            };
          }),
        { message: `at ${width}px` },
      )
      .toEqual({ inside: true, unsqueezed: true, clear: true });
  }
});
