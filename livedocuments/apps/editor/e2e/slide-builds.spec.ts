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

// Builds within a slide (docs/specs/012-collaboration/presentation-mode.md "Builds"): a slide with three builds
// presents in four steps forward and back, the editor always shows the finished slide, and the next slide comes
// only after the last build.

const CANVAS = '[data-canvas-a11y-root]';

test('a slide with three builds presents in four steps, forward and back', async ({
  page,
  pageErrors,
  baseURL,
}) => {
  const owner = await mintGuest(page.request);
  const id = crypto.randomUUID();
  const tabId = crypto.randomUUID();
  const box = (bid: string, y: number, build?: { order: number; effect: string }) => ({
    id: bid,
    type: 'shape',
    shape: 'square',
    x: 0,
    y,
    width: 160,
    height: 60,
    label: bid,
    ...(build ? { build } : {}),
  });
  const deck = {
    decks: [
      {
        slides: [
          { id: 's1', tabId, elementIds: ['title', 'one', 'two', 'three'] },
          { id: 's2', tabId, elementIds: ['next'] },
        ],
      },
    ],
  };
  const seeded = await seedDocumentItem(
    page.request,
    ownerHeaders(owner, { Origin: new URL(baseURL!).origin }),
    {
      id,
      name: 'Builds',
      tabs: [
        {
          id: tabId,
          name: 'Slides',
          elements: [
            box('title', 0),
            box('one', 100, { order: 1, effect: 'fade' }),
            box('two', 200, { order: 2, effect: 'rise' }),
            box('three', 300, { order: 3, effect: 'appear' }),
            box('next', 400),
          ],
        },
      ],
      presentation: JSON.stringify(deck),
    },
  );
  expect(seeded.ok()).toBe(true);
  await adoptGuest(page, owner);
  await page.addInitScript(() => {
    localStorage.setItem('livedocuments:v2:name-confirmed', '1');
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/document/${id}`);
  await page.locator(CANVAS).waitFor();
  await dismissQuickTour(page);

  // What the canvas draws, by element id.
  const shown = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-canvas-a11y-root] [data-element-id]')]
        .map((el) => el.getAttribute('data-element-id'))
        .sort()
        .join(','),
    );
  // The editor shows the finished slide.
  await expect.poll(shown).toBe('next,one,three,title,two');

  await page.getByRole('button', { name: 'Present', exact: true }).click();
  const forward = ['title', 'one,title', 'one,title,two', 'one,three,title,two', 'next'];
  await expect.poll(shown).toBe(forward[0]);
  for (const step of forward.slice(1)) {
    await page.keyboard.press('ArrowRight');
    await expect.poll(shown).toBe(step);
  }
  // Back onto the slide finished, then each build off in turn.
  for (const step of [...forward].reverse().slice(1)) {
    await page.keyboard.press('ArrowLeft');
    await expect.poll(shown).toBe(step);
  }

  await page.keyboard.press('Escape');
  await expect.poll(shown).toBe('next,one,three,title,two');
  expectNoPageErrors(pageErrors);
});
