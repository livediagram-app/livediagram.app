import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  adoptGuest,
  mintGuest,
  ownerHeaders,
  seedDocumentItem,
  test,
} from './fixtures';

// Presentation mode (docs/specs/012-collaboration/presentation-mode.md): Present frames the first slide,
// the arrow keys move the camera between slides, and leaving puts the editor's view back exactly where it
// was (docs/specs/003-system-architecture/react-state-and-effects.md: captured and restored on the
// transition, in the same commit).

const CANVAS = '[data-canvas-a11y-root]';

test('a deck presents slide by slide and leaves the view as it was', async ({
  page,
  pageErrors,
  baseURL,
}) => {
  const owner = await mintGuest(page.request);
  const id = crypto.randomUUID();
  const tabId = crypto.randomUUID();
  const box = (bid: string, x: number, y: number) => ({
    id: bid,
    type: 'shape',
    shape: 'square',
    x,
    y,
    width: 120,
    height: 80,
    label: bid,
  });
  const deck = {
    decks: [
      {
        slides: [
          { id: 's1', tabId, elementIds: ['a'] },
          { id: 's2', tabId, elementIds: ['b'] },
        ],
      },
    ],
  };
  const seeded = await seedDocumentItem(
    page.request,
    ownerHeaders(owner, { Origin: new URL(baseURL!).origin }),
    {
      id,
      name: 'Deck',
      tabs: [{ id: tabId, name: 'Slides', elements: [box('a', 0, 0), box('b', 2000, 1500)] }],
      presentation: JSON.stringify(deck),
    },
  );
  expect(seeded.ok()).toBe(true);
  await adoptGuest(page, owner);
  await page.addInitScript(() => {
    localStorage.setItem('livedocuments:v2:name-confirmed', '1');
  });
  await page.goto(`/document/${id}`);
  await page.locator(CANVAS).waitFor();
  await dismissQuickTour(page);

  // The canvas camera, as its transform.
  const camera = () =>
    page.evaluate(
      () =>
        document
          .querySelector('[data-canvas-a11y-root] [style*="transform"]')
          ?.getAttribute('style')
          ?.match(/transform:[^;]+/)?.[0] ?? null,
    );
  // Opening the tab frames its page beside the Contents sidebar, then glides onto it once the view rests
  // (docs/specs/007-editor/pages-mode.md "Framing beside it", "Getting around the pages"): the view the deck
  // must leave as it was is the one at rest. The canvas says so itself (`data-view-at-rest`: landed, no glide
  // under way and no rest's snap waiting), so a read between the landing and the glide is never taken for rest.
  // Read two frames later, once the view's last move has been drawn.
  await expect(page.locator('[data-view-at-rest]')).toHaveCount(1);
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  await expect(page.locator('[data-view-at-rest]')).toHaveCount(1);
  const before = await camera();
  expect(before).not.toBeNull();

  // The header's Present starts the open tab's show at its slide 1; a stored deck's selection slides keep
  // presenting (presentation-mode.md "The header's Present button"; the Slide Deck panel is retired).
  await page.getByRole('button', { name: 'Present', exact: true }).click();
  await expect.poll(camera).not.toBe(before);
  const slideOne = await camera();

  await page.keyboard.press('ArrowRight');
  await expect.poll(camera).not.toBe(slideOne);

  await page.keyboard.press('Escape');
  await expect.poll(camera).toBe(before);
  expectNoPageErrors(pageErrors);
});
