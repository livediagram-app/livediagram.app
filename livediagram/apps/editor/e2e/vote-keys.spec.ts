import type { Browser, Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  test,
  adoptGuest,
  mintGuest,
  documentHeaders,
  seedDocumentItem,
} from './fixtures';

// Dot voting from the keyboard (docs/specs/012-collaboration/session-tools.md "Casting from the keyboard"): an
// Editor and a Participant, by keyboard alone, Tab to a sticky and cast and take back dots with + and -; each hears
// the outcome and both screens converge on the same counts. A Viewer's + casts nothing.

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const CANVAS = '[data-canvas-a11y-root]';

async function openAs(
  browser: Browser,
  baseURL: string,
  url: string,
  owner: string | null,
): Promise<Page> {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 860 } });
  if (owner) await adoptGuest(ctx, owner);
  await ctx.addInitScript(() => {
    localStorage.setItem('livediagram:v2:name-confirmed', '1');
    localStorage.setItem(
      'livediagram:user-preferences:v1',
      JSON.stringify({ workshopTourSeen: true }),
    );
  });
  const page = await ctx.newPage();
  await page.goto(url);
  return page;
}

async function joinIfAsked(page: Page): Promise<void> {
  const join = page.getByRole('button', { name: /^join$/i });
  await Promise.race([join.waitFor().catch(() => {}), page.locator(CANVAS).waitFor()]);
  if (await join.isVisible()) await join.click();
  await page.locator(CANVAS).waitFor();
  await dismissQuickTour(page);
}

// F6 until the canvas holds focus: the keyboard's way to it (docs/specs/004-interface-design/canvas-accessibility.md).
async function focusCanvas(page: Page): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const on = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.dataset.canvasA11yRoot !== undefined,
    );
    if (on) return;
    await page.keyboard.press('F6');
  }
  throw new Error('F6 never reached the canvas');
}

// The walk skips an element another person holds, and a release reaches this screen at presence speed.
const released = (page: Page) =>
  expect(page.getByLabel(/^Locked to /)).toHaveCount(0, { timeout: 10_000 });

// Tab until the walk lands on the sticky with this label: each step is heard as `Selected …`.
async function walkTo(page: Page, label: string): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const before = await said(page).textContent();
    await page.keyboard.press('Tab');
    await expect.poll(() => said(page).textContent()).not.toBe(before);
    const now = (await said(page).textContent())?.trim();
    if (now === `Selected '${label}'`) return;
  }
  throw new Error(`Tab never reached ${label}`);
}

const said = (page: Page) => page.locator('[role="status"][aria-live="polite"]').last();
// The tally on a sticky's stepper (`1 vote`, `2 votes`) as one screen shows it.
const tally = (page: Page, id: string) =>
  page.locator(`[data-element-id="${id}"] .lvd-vote-stepper [role="img"]`);

const sticky = (id: string, x: number, label: string) => ({
  id,
  type: 'sticky',
  x,
  y: 160,
  width: 160,
  height: 160,
  label,
});

test('an Editor and a Participant vote by keyboard and converge; a Viewer cannot', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(90_000);
  const owner = await mintGuest(page.request);
  const id = crypto.randomUUID();
  const seeded = await seedDocumentItem(page.request, owner, {
    id,
    name: 'Retro',
    tabs: [
      {
        id: crypto.randomUUID(),
        name: 'Board',
        opensIn: 'workshop',
        elements: [sticky('idea', 200, 'Idea'), sticky('other', 420, 'Other')],
        vote: { active: true, revealed: false, votesPerPerson: 2, votes: {}, round: 'r1' },
      },
    ],
  });
  expect(seeded.ok(), `seed: ${seeded.status()}`).toBe(true);
  const headers = await documentHeaders(page.request, owner, id, {
    Origin: new URL(baseURL!).origin,
  });
  const linkFor = async (role: 'participate' | 'view') => {
    const share = await page.request.post(`${apiBase}/documents/${id}/share`, {
      headers,
      data: { role },
    });
    return ((await share.json()) as { link: { code: string } }).link.code;
  };

  const editor = await openAs(browser, baseURL!, `/document/${id}`, owner);
  await editor.locator(CANVAS).waitFor();
  const participant = await openAs(
    browser,
    baseURL!,
    `/document/shared?s=${await linkFor('participate')}`,
    null,
  );
  await joinIfAsked(participant);

  // The Participant: Tab to the first sticky, + casts a dot, and says so.
  await focusCanvas(participant);
  // Pressed straight after Tab: the dot's words are what is heard, not the selection's.
  await participant.keyboard.press('Tab');
  await participant.keyboard.press('+');
  await expect(said(participant)).toHaveText("Dot added to 'Idea'. 1 of 2 dots left.");
  await expect(tally(editor, 'idea')).toHaveAttribute('aria-label', '1 vote');
  // The walk keeps the concurrent-selection lock: the Participant moves off before the Editor walks there.
  await participant.keyboard.press('Escape');

  // The Editor, by keyboard too, on the same sticky: both screens read two.
  await released(editor);
  await focusCanvas(editor);
  await walkTo(editor, 'Idea');
  await editor.keyboard.press('=');
  await expect(said(editor)).toHaveText("Dot added to 'Idea'. 1 of 2 dots left.");
  for (const p of [editor, participant])
    await expect(tally(p, 'idea')).toHaveAttribute('aria-label', '2 votes');

  // The Participant spends its budget, is told when it runs out, and takes one back.
  await editor.keyboard.press('Escape');
  await released(participant);
  await focusCanvas(participant);
  await walkTo(participant, 'Idea');
  await participant.keyboard.press('+');
  await expect(said(participant)).toHaveText("Dot added to 'Idea'. 0 of 2 dots left.");
  await participant.keyboard.press('+');
  await expect(said(participant)).toHaveText('No dots left.');
  await participant.keyboard.press('-');
  await expect(said(participant)).toHaveText("Dot removed from 'Idea'. 1 of 2 dots left.");
  for (const p of [editor, participant])
    await expect(tally(p, 'idea')).toHaveAttribute('aria-label', '2 votes');

  // A Viewer walks to the same sticky; its + casts nothing.
  const viewer = await openAs(
    browser,
    baseURL!,
    `/document/shared?s=${await linkFor('view')}`,
    null,
  );
  await joinIfAsked(viewer);
  await focusCanvas(viewer);
  await viewer.keyboard.press('Tab');
  await viewer.keyboard.press('+');
  await expect(said(viewer)).not.toHaveText(/^Dot /);
  await editor.waitForTimeout(500);
  await expect(tally(editor, 'idea')).toHaveAttribute('aria-label', '2 votes');
  await expect(tally(editor, 'other')).toHaveAttribute('aria-label', '0 votes');
});
