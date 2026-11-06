import {
  adoptGuest,
  documentHeaders,
  expect,
  mintGuest,
  ownerHeaders,
  seedDocumentItem,
  test,
} from './fixtures';

// Work Tracker #575 (docs/specs/012-collaboration/speaker-note-cards.md "Saving"): a deck too large to go whole as the
// page goes (past the browser's 64 KB keepalive allowance) sends only the slide it changed, kept alive, so the card
// typed just before the tab closed, inside the save's wait, is stored.

const CANVAS = '[data-canvas-a11y-root]';
const SLIDES = 6;
const CARDS = 12;
// Six slides of twelve 800-character cards: about 58 KB of deck, sent with the deck it was built on, about 115 KB.
const cardText = (slide: number, card: number) => `${slide}.${card} `.padEnd(800, 'n');
const MARK = ' and the close';

test('a large deck’s last typed card survives the tab closing', async ({ page, baseURL }) => {
  const owner = await mintGuest(page.request);
  const id = crypto.randomUUID();
  const tabId = crypto.randomUUID();
  const pages = Array.from({ length: SLIDES }, (_, i) => ({
    id: `p${i}`,
    orientation: 'landscape',
    kind: 'slide',
  }));
  const deck = {
    decks: [
      {
        slides: pages.map((p, i) => ({
          id: `slide-${i}`,
          tabId,
          elementIds: [],
          pageId: p.id,
          noteCards: Array.from({ length: CARDS }, (_, c) => ({
            id: `c${i}-${c}`,
            text: cardText(i, c),
          })),
        })),
      },
    ],
  };
  const presentation = JSON.stringify(deck);
  expect(presentation.length).toBeGreaterThan(50 * 1024);
  const seeded = await seedDocumentItem(
    page.request,
    ownerHeaders(owner, { Origin: new URL(baseURL!).origin }),
    { id, name: 'Talk', tabs: [{ id: tabId, name: 'Slides', elements: [], pages }], presentation },
  );
  expect(seeded.ok()).toBe(true);
  await adoptGuest(page, owner);
  await page.addInitScript(() => {
    localStorage.setItem('livedocuments:v2:name-confirmed', '1');
  });
  await page.goto(`/document/${id}`);
  await page.locator(CANVAS).waitFor();

  const request = page.request;
  const headers = await documentHeaders(request, owner, id);

  // The first slide's Notes, its first card open, a few words typed on the end.
  await page.getByRole('button', { name: 'Notes' }).first().click();
  const first = page.getByRole('group', { name: `Card 1 of ${CARDS}` });
  await expect(first).toContainText('0.0 ');
  await first.click();
  const box = page.getByRole('textbox', { name: 'Card 1' });
  await box.press('ControlOrMeta+End');
  await box.pressSequentially(MARK);

  // The tab closes inside the save's wait (DECK_SAVE_DEBOUNCE_MS, 900 ms), as a person closes it: its pagehide
  // sends the deck, and nothing the page started may finish after it goes unless it was kept alive.
  const closed = page.waitForEvent('close');
  page.on('dialog', (dialog) => void dialog.accept());
  await page.close({ runBeforeUnload: true });
  await closed;

  // The typed card is stored, and every other card with it.
  const storedSlides = async () => {
    const res = await request.get(`/api/documents/${id}`, { headers });
    const body = (await res.json()) as { document: { presentation: string | null } };
    return (JSON.parse(body.document.presentation ?? '{"decks":[]}') as typeof deck).decks[0]
      ?.slides;
  };
  await expect
    .poll(async () => (await storedSlides())?.[0]?.noteCards[0]?.text)
    .toBe(cardText(0, 0) + MARK);
  const slides = (await storedSlides())!;
  expect(slides.map((s) => s.noteCards.length)).toEqual(Array(SLIDES).fill(CARDS));
  expect(slides[1]!.noteCards[0]!.text).toBe(cardText(1, 0));
});
