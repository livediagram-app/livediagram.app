import { expect, expectNoPageErrors, test } from './fixtures';

// Presentation mode (docs/specs/012-collaboration/presentation-mode.md): Present frames the first slide,
// the arrow keys move the camera between slides, and leaving puts the editor's view back exactly where it
// was (docs/specs/003-system-architecture/react-state-and-effects.md: captured and restored on the
// transition, in the same commit).

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const CANVAS = '[data-canvas-a11y-root]';

test('a deck presents slide by slide and leaves the view as it was', async ({
  page,
  pageErrors,
  baseURL,
}) => {
  const owner = crypto.randomUUID();
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
  const seeded = await page.request.post(`${apiBase}/documents`, {
    headers: { 'X-Owner-Id': owner, Origin: new URL(baseURL!).origin },
    data: {
      id,
      name: 'Deck',
      tabs: [{ id: tabId, name: 'Slides', elements: [box('a', 0, 0), box('b', 2000, 1500)] }],
      presentation: JSON.stringify(deck),
    },
  });
  expect(seeded.ok()).toBe(true);
  await page.addInitScript((o) => {
    localStorage.setItem('livediagram:v2:self-id', o);
    localStorage.setItem('livediagram:v2:name-confirmed', '1');
    localStorage.setItem(
      'livediagram:user-preferences:v1',
      JSON.stringify({ panelLayout: 'toolbar' }),
    );
  }, owner);
  await page.goto(`/document/${id}`);
  await page.locator(CANVAS).waitFor();
  const decline = page.getByRole('button', { name: /^no thanks$/i }).first();
  if (await decline.isVisible().catch(() => false)) await decline.click();

  // The canvas camera, as its transform.
  const camera = () =>
    page.evaluate(
      () =>
        document
          .querySelector('[data-canvas-a11y-root] [style*="transform"]')
          ?.getAttribute('style')
          ?.match(/transform:[^;]+/)?.[0] ?? null,
    );
  await expect.poll(camera).not.toBeNull();
  const before = await camera();

  await page.getByRole('button', { name: 'Selection mode' }).click();
  await page.getByText('Slide Deck', { exact: true }).first().click();
  await page.getByRole('button', { name: /^Present(\s*\d+)?$/ }).click();
  await expect.poll(camera).not.toBe(before);
  const slideOne = await camera();

  await page.keyboard.press('ArrowRight');
  await expect.poll(camera).not.toBe(slideOne);

  await page.keyboard.press('Escape');
  await expect.poll(camera).toBe(before);
  expectNoPageErrors(pageErrors);
});
