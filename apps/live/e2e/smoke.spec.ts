import {
  test,
  expect,
  dismissQuickTour,
  expectNoPageErrors,
  startBlankDiagram,
  startEventStormingRow,
  startTemplateDiagram,
} from './fixtures';

// End-to-end smoke suite (spec/72). Small by design: it answers "does
// the app boot and take input without crashing", the layer the unit
// tests can't reach. Every test also fails on any uncaught page error
// (the `pageErrors` fixture).

test('the new-diagram wizard renders', async ({ page, pageErrors }) => {
  await page.goto('/new');
  await expect(page.getByText('New Diagram', { exact: false })).toBeVisible();
  // The Quick Start template grid is the client-rendered heart of the
  // wizard; its presence proves the picker mounted, not just the shell.
  await expect(page.getByText('Quick Start', { exact: false })).toBeVisible();
  await expect(page.getByText('Blank diagram', { exact: false })).toBeVisible();
  expectNoPageErrors(pageErrors);
});

test('the explorer renders for a guest', async ({ page, pageErrors }) => {
  await page.goto('/explorer');
  // The sidebar's quick-find sections are always present for a guest.
  await expect(page.getByText('Recent', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Shared with you', { exact: false })).toBeVisible();
  expectNoPageErrors(pageErrors);
});

test('create a blank diagram, add a shape, and it survives a reload', async ({
  page,
  pageErrors,
}) => {
  await startBlankDiagram(page);
  // The wizard created a real diagram and routed to it.
  await expect(page).toHaveURL(/\/diagram\/[0-9a-f-]{36}/);

  // The palette is open by default on desktop; its shape tiles are
  // aria-labelled ("Add square"). Arm the Square, then drop it on the
  // canvas with a single click. Element views carry a role=img label
  // (spec/71), so the placed square is addressable without reaching
  // into canvas internals.
  const canvas = page.locator('[data-canvas-a11y-root]');
  const square = page.getByRole('img', { name: 'Square', exact: true });
  await page.getByRole('button', { name: 'Add square', exact: true }).click();
  await canvas.click({ position: { x: 420, y: 300 } });
  await expect(square).toHaveCount(1);

  // The autosave round-trip through the api + D1 is the part no unit
  // test covers: reload and the shape must still be on the tab.
  await page.waitForTimeout(1500); // let the debounced autosave flush
  await page.reload();
  await canvas.waitFor();
  await expect(square).toHaveCount(1);

  expectNoPageErrors(pageErrors);
});

// A board KIND is the one thing a unit test can't prove end to end: the
// template has to build, the tab has to persist its kind, and the editor has
// to read it back and present differently because of it (spec/139). This
// walks that whole path in a browser, then reloads to prove the board is
// still a board after a round trip through the api.
test('an event-storming board stays a board across a reload', async ({ page, pageErrors }) => {
  await startTemplateDiagram(page, /Browse Technical templates/, /^Event storming/i);
  await expect(page).toHaveURL(/\/diagram\/[0-9a-f-]{36}/);

  // The notation palette is the board presenting itself: on any other tab
  // these tiles are behind a category dropdown.
  const notation = page.getByRole('option', { name: /domain event/i });
  await expect(notation.first()).toBeVisible();
  // The seeded timeline of orange events (spec/139).
  const canvas = page.locator('[data-canvas-a11y-root]');
  const note = canvas.getByRole('img', { name: /sticky/i }).first();
  await expect(note).toBeVisible();
  // The starter is one domain event and nothing else: no text element
  // (spec/139 Phase 1).
  await expect(canvas.getByRole('img')).toHaveCount(1);
  await expect(canvas.getByRole('img', { name: /Board Created/i })).toHaveCount(1);
  // Workshop notes are written in capitals (spec/139). Only a browser can
  // answer this one: the stored label keeps its typed casing, so the caps
  // exist purely as the rendered treatment.
  const painted = await note.evaluate((node) => {
    const line = Array.from(node.querySelectorAll('div')).find(
      (d) => d.children.length === 0 && !!d.textContent?.trim(),
    );
    return line ? getComputedStyle(line).textTransform : null;
  });
  expect(painted).toBe('uppercase');

  await page.waitForTimeout(1500); // let the debounced autosave flush
  await page.reload();
  await canvas.waitFor();
  // Board-ness survived persistence: had the kind failed to save, the
  // palette would come back on its ordinary category.
  await expect(notation.first()).toBeVisible();

  expectNoPageErrors(pageErrors);
});

// Inserting a note BETWEEN two notes (spec/139). The unit tests own the
// geometry; what only a browser can answer is whether a real HTML5 palette
// drag over a real gap, WITH ALT HELD, opens a slot, and whether the note the
// drop lands there is still in the middle of the timeline after a round trip
// through the api. That order IS the board's information content, so losing it
// in persistence would be the whole feature failing quietly.
//
// The no-modifier half is asserted first and matters just as much: without
// Alt the board must not stir, which is the regression the Alt gesture exists
// to prevent.
test('a note dropped between two notes stays between them', async ({ page, pageErrors }) => {
  await startEventStormingRow(page);
  const canvas = page.locator('[data-canvas-a11y-root]');
  await dismissQuickTour(page);

  // The seeded timeline: three orange domain events, left to right.
  const notes = canvas.getByRole('img', { name: /^Sticky note/ });
  await expect(notes).toHaveCount(3);
  // The template's opening zoom-to-fit settles a few pixels AFTER the notes
  // first render. Measure before that and the baseline is a moving target,
  // which reads as a board that shifted when nothing did.
  await page.waitForTimeout(500);
  const first = (await notes.nth(0).boundingBox())!;
  const second = (await notes.nth(1).boundingBox())!;

  // Drag a Domain event tile from the notation palette into the gap between
  // the first two notes. Manual mouse steps: the browser only starts a native
  // drag once the pointer actually travels.
  const gapX = (first.x + first.width + second.x) / 2;
  const gapY = first.y + first.height / 2;
  const tile = page.getByRole('option', { name: /domain event/i }).first();
  const tileBox = (await tile.boundingBox())!;
  await page.mouse.move(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(gapX - 250, gapY - 120, { steps: 8 });
  await page.mouse.move(gapX, gapY, { steps: 8 });
  // Chromium delivers the `dragover` for a synthetic move one move behind, so
  // without a nudge the board can still be reading the previous position when
  // the drop lands. A real pointer streams them; the harness needs telling.
  await page.mouse.move(gapX + 1, gapY);
  await page.mouse.move(gapX, gapY);

  // NO MODIFIER, hovering the gap: nothing moves. This is the regression
  // guard — before the Alt gesture, this same drag rearranged the board under
  // an author who only wanted to drop a note nearby.
  await page.waitForTimeout(150);
  expect((await notes.nth(1).boundingBox())!.x).toBeCloseTo(second.x, 0);

  // Now press Alt, mid-drag. (Mid-drag, not before it: a window manager that
  // claims Alt+press never lets the page see a drag that started with Alt
  // down — Cinnamon's default. Pressing it during the drag works everywhere.)
  await page.keyboard.down('Alt');
  await page.mouse.move(gapX + 1, gapY);
  await page.mouse.move(gapX, gapY);
  // The slot is open: everything from the second note on has slid right to
  // make room, without a single change to the document.
  await expect
    .poll(async () => (await notes.nth(1).boundingBox())!.x)
    .toBeGreaterThan(second.x + 100);
  await page.mouse.up();
  await page.keyboard.up('Alt');

  // The new note lands in the slot, unlabelled and ready to type into.
  const fresh = canvas.getByRole('img', { name: 'Sticky note', exact: true });
  await expect(fresh).toHaveCount(1);

  await page.waitForTimeout(1500); // let the debounced autosave flush
  await page.reload();
  await canvas.waitFor();
  await expect(notes).toHaveCount(4);

  // Second in the row, still — the order is the board's whole point.
  const order = await notes.evaluateAll((els) =>
    els
      .map((el) => ({ x: el.getBoundingClientRect().x, name: el.getAttribute('aria-label') ?? '' }))
      .sort((a, b) => a.x - b.x)
      .map((n) => n.name),
  );
  expect(order).toEqual([
    'Sticky note "Order placed"',
    'Sticky note',
    'Sticky note "Payment received"',
    'Sticky note "Order shipped"',
  ]);

  expectNoPageErrors(pageErrors);
});

// The same gesture for a note ALREADY on the board (spec/139) — the drag
// people do most. What only a browser can answer here: a POINTER drag (not a
// native HTML5 one) carries the live Alt state, the dragged note and the other
// notes' render-only ripple are visible at once, and the whole gesture is a
// single undo step including the note's original position.
test('a note already on the board inserts between two others', async ({ page, pageErrors }) => {
  await startEventStormingRow(page);
  const canvas = page.locator('[data-canvas-a11y-root]');
  await dismissQuickTour(page);

  const notes = canvas.getByRole('img', { name: /^Sticky note/ });
  await expect(notes).toHaveCount(3);
  await page.waitForTimeout(500); // the opening zoom-to-fit settles
  const order = async () =>
    notes.evaluateAll((els) =>
      els
        .map((el) => ({
          x: el.getBoundingClientRect().x,
          name: el.getAttribute('aria-label') ?? '',
        }))
        .sort((a, b) => a.x - b.x)
        .map((n) => n.name),
    );
  expect(await order()).toEqual([
    'Sticky note "Order placed"',
    'Sticky note "Payment received"',
    'Sticky note "Order shipped"',
  ]);

  // Drag the LAST note back into the gap between the first two.
  const first = (await notes.nth(0).boundingBox())!;
  const second = (await notes.nth(1).boundingBox())!;
  const last = (await notes.nth(2).boundingBox())!;
  const gapX = (first.x + first.width + second.x) / 2;
  const gapY = first.y + first.height / 2;
  await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2);
  await page.mouse.down();
  await page.mouse.move(gapX + 60, gapY, { steps: 10 });
  await page.mouse.move(gapX, gapY, { steps: 4 });

  // No modifier: the note follows the hand and NOTHING else moves. This is
  // the regression guard — an ordinary move must stay an ordinary move.
  await expect(page.getByText(/press to insert it between two notes/i)).toBeVisible();
  expect((await notes.nth(1).boundingBox())!.x).toBeCloseTo(second.x, 0);

  // Alt alone, with the hand held still: a pointer drag DOES receive key
  // events, so the slot opens without waiting for the next twitch.
  await page.keyboard.down('Alt');
  await expect.poll(async () => (await notes.nth(1).boundingBox())!.x).toBeGreaterThan(second.x);
  // Releasing it unwinds the ripple again, mid-drag.
  await page.keyboard.up('Alt');
  await expect.poll(async () => (await notes.nth(1).boundingBox())!.x).toBeCloseTo(second.x, 0);

  await page.keyboard.down('Alt');
  await expect.poll(async () => (await notes.nth(1).boundingBox())!.x).toBeGreaterThan(second.x);
  await page.mouse.up();
  await page.keyboard.up('Alt');

  const inserted = [
    'Sticky note "Order placed"',
    'Sticky note "Order shipped"',
    'Sticky note "Payment received"',
  ];
  await expect.poll(order).toEqual(inserted);

  // ONE undo restores the whole board, the dragged note's original position
  // included — the live ticks during the drag collapse into a single step.
  await page.keyboard.press('ControlOrMeta+z');
  await expect
    .poll(order)
    .toEqual([
      'Sticky note "Order placed"',
      'Sticky note "Payment received"',
      'Sticky note "Order shipped"',
    ]);

  await page.keyboard.press('ControlOrMeta+y');
  await expect.poll(order).toEqual(inserted);

  await page.waitForTimeout(1500); // let the debounced autosave flush
  await page.reload();
  await canvas.waitFor();
  await expect.poll(order).toEqual(inserted);

  expectNoPageErrors(pageErrors);
});

// The one mobile test (spec/72). Not a general phone suite: it guards a
// specific class of bug that a desktop-only run is structurally blind to —
// a popover that only OVERLAPS its host when the viewport is too narrow to
// put it alongside, and so only then has to win the stacking contest.
//
// The bug it is a tombstone for: the Collaborate flyout was z-overlay while
// the tab menu it opens from is z-modal. On desktop the flyout sits beside
// the menu and the z-order never matters; on a phone it clamps on top of the
// menu and rendered behind it, so tapping Collaborate did nothing at all.
test.describe('mobile', () => {
  // Only the properties that create the condition — a narrow viewport and a
  // real touch pointer. Spreading a whole `devices[...]` entry would also set
  // defaultBrowserType, which Playwright forbids inside a describe.
  test.use({
    viewport: { width: 390, height: 664 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  });

  test('the tab menu opens the Collaborate flyout in front of the menu', async ({
    page,
    pageErrors,
  }) => {
    await startBlankDiagram(page);
    // A fresh guest gets the tour offer over a scrim that eats taps.
    const declineTour = page.getByRole('button', { name: /^no thanks$/i });
    if (await declineTour.count()) await declineTour.tap();

    await page.getByRole('button', { name: 'Tab menu' }).tap();
    const collaborate = page.getByRole('button', { name: /collaborate/i });
    await expect(collaborate).toBeVisible();
    await collaborate.tap();

    // Present in the DOM is not the assertion that matters — it was present
    // and painted behind the menu before the fix. Ask the browser what is
    // actually on top at the flyout's own centre.
    const flyout = page.locator('[data-menu-flyout]');
    await expect(flyout).toBeVisible();
    const onTop = await page.evaluate(() => {
      const panel = document.querySelector('[data-menu-flyout]');
      if (!panel) return false;
      const r = panel.getBoundingClientRect();
      const hit = document.elementFromPoint(
        Math.round(r.x + r.width / 2),
        Math.round(r.y + r.height / 2),
      );
      return !!hit && panel.contains(hit);
    });
    expect(onTop).toBe(true);

    // And the session tools are genuinely reachable, not just painted. Since
    // the Session Studio (spec/39) they are TABS in its switcher, not a strip
    // of buttons, and a running tool's status dot joins the tab's name
    // ("Timer Running"), so match the start of the name, not all of it.
    // Tapping one proves the tap lands in the flyout rather than behind it.
    const timerTab = page.getByRole('tab', { name: /^timer\b/i });
    const pollTab = page.getByRole('tab', { name: /^poll\b/i });
    await expect(timerTab).toBeVisible();
    await expect(pollTab).toBeVisible();
    await pollTab.tap();
    await expect(pollTab).toHaveAttribute('aria-selected', 'true');

    // Covering the parent hides which row is open and the way back, so the
    // mobile panel carries its own header: the category name, and a Close
    // that returns to the menu underneath.
    await expect(flyout.getByText('COLLABORATE')).toBeVisible();
    const close = flyout.getByRole('button', { name: /close collaborate/i });
    await expect(close).toBeVisible();

    // It sits ON the parent rather than beside it — the whole reason the
    // header is needed.
    const covers = await page.evaluate(() => {
      const panel = document.querySelector('[data-menu-flyout]');
      const host = document.querySelector('[data-tour-id="tab-menu"]');
      if (!panel || !host) return null;
      const p = panel.getBoundingClientRect();
      const h = host.getBoundingClientRect();
      return {
        sameLeft: Math.abs(p.left - h.left) <= 1,
        sameWidth: Math.abs(p.width - h.width) <= 1,
      };
    });
    expect(covers).toEqual({ sameLeft: true, sameWidth: true });

    // Close returns to the parent menu.
    await close.tap();
    await expect(flyout).toHaveCount(0);
    await expect(page.getByRole('button', { name: /collaborate/i })).toBeVisible();

    expectNoPageErrors(pageErrors);
  });
});
