import type { Locator, Page } from '@playwright/test';
import { expect, test, expectNoPageErrors } from './fixtures';
import { draftLines, newServerKnowledgebase, openRowMenu, writeLines } from './knowledgebase';

// The runtime motion guard (docs/specs/004-interface-design/motion.md "Enforcement").
//
// The static guard reads source; this one watches what the browser actually runs.
// Every animation and transition that starts while chrome surfaces open is
// recorded with its computed timing, and each one that isn't canvas motion or an
// ambient loop must settle, delay included, within 250ms. That is the only place
// a cascade's delay (set on `.stagger-enter`) meets its item's duration (set by an
// `animate-*` utility), so it is the only place their sum can be checked.

const CEILING_MS = 250;

type Motion = {
  name: string;
  target: string;
  delay: number;
  active: number;
  iterations: number;
};

// Installed before any app code: records every animation / transition as it
// starts, from the element it runs on. Canvas elements (anything inside an
// element wrapper) are canvas motion with their own specs, so they are skipped.
function recordMotion(): void {
  const w = window as unknown as { __motion: Motion[] };
  w.__motion = [];
  const record = (event: Event) => {
    const el = event.target;
    // The Edit, Save and Cancel ripple is page motion with its own budget (app/mode-ripple.css), not chrome.
    if (
      !(el instanceof Element) ||
      el.closest('[data-element-id], .lk-mode-ripple, .lk-click-ring')
    )
      return;
    for (const anim of el.getAnimations()) {
      const timing = anim.effect?.getComputedTiming();
      if (!timing) continue;
      const css = anim as Animation & { animationName?: string; transitionProperty?: string };
      w.__motion.push({
        name: css.animationName ?? css.transitionProperty ?? anim.constructor.name,
        target: `${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '').slice(0, 60)}`,
        delay: Number(timing.delay ?? 0),
        active: Number(timing.activeDuration ?? 0),
        iterations: Number(timing.iterations ?? 1),
      });
    }
  };
  document.addEventListener('animationstart', record, true);
  document.addEventListener('transitionrun', record, true);
}

type MotionRecord = Motion;

async function recorded(page: Page): Promise<MotionRecord[]> {
  return page.evaluate(() => (window as unknown as { __motion: Motion[] }).__motion);
}

// Chrome motion only: loops and repeating pulses are ambient indicators.
const transitions = (all: MotionRecord[]) =>
  all.filter((m) => Number.isFinite(m.active) && m.iterations < 2);

async function startBlank(page: Page): Promise<void> {
  // A new knowledgebase on liveknowledge (serverNewUrl). A guest's own /new keeps it Offline, where the Explorer shows
  // no card for the open knowledgebase and so no menu on one.
  await newServerKnowledgebase(page);
}

/** Open a chrome surface, let its motion play out, and close it again. `shown` is the surface
 *  itself, for one whose code loads on demand (Settings, Search): its motion starts only once it
 *  arrives, which on a cold CI runner can be most of the 400ms, so the wait starts from there. */
async function openAndClose(
  page: Page,
  open: () => Promise<void>,
  close: () => Promise<void> = () => page.keyboard.press('Escape'),
  shown?: Locator,
): Promise<void> {
  await open();
  if (shown) await shown.waitFor();
  await page.waitForTimeout(400);
  await close();
  await page.waitForTimeout(300);
}

/** A trigger that opens and closes its own surface. */
async function toggle(page: Page, name: string): Promise<void> {
  const trigger = page.getByRole('button', { name, exact: true });
  await openAndClose(
    page,
    () => trigger.click(),
    () => trigger.click(),
  );
}

async function tourTheChrome(page: Page): Promise<void> {
  await writeLines(page, 'A line, so the page holds writing.');
  await page.waitForTimeout(400);

  // The knowledgebase's menu, and Knowledgebase Style from the footer's Style (liveknowledge has no Selection mode
  // and no zoom cluster: docs/specs/030-knowledgebase/page-surface.md).
  const name = page.locator('[data-knowledgebase-menu]');
  await openAndClose(page, () => name.click());
  await openAndClose(
    page,
    () => page.getByRole('button', { name: 'Style', exact: true }).click(),
    undefined,
    page.getByRole('dialog', { name: 'Knowledgebase Style' }),
  );
  // The Explorer popover.
  const explorer = page.getByRole('button', { name: 'Explorer', exact: true });
  await openAndClose(page, () => explorer.click());
  // A page's row menu, the search panel from Cmd or Ctrl K (this knowledgebase first: search-and-ask.md "Search"),
  // and the writing's Insert menu.
  await openAndClose(page, async () => {
    await openRowMenu(page, 'Start Here');
  });
  await openAndClose(
    page,
    () => page.keyboard.press('ControlOrMeta+k'),
    undefined,
    page.getByRole('dialog', { name: 'Search', exact: true }),
  );
  await toggle(page, 'More Formatting');
  // The slash menu (page-surface.md "The slash menu", "Motion"): it unfolds from the `/` typed in the writing, and
  // Escape closes it; the `/` typed goes again so the writing is as it was.
  await openAndClose(
    page,
    async () => {
      // Into the draft: a Save would close the menu (docs/specs/030-knowledgebase/editing.md).
      await draftLines(page, '/');
      await page.getByRole('listbox', { name: 'Insert a block' }).waitFor();
    },
    async () => {
      await page.keyboard.press('Escape');
      await page.keyboard.press('Backspace');
    },
  );
  await openAndClose(
    page,
    () => page.getByRole('button', { name: 'Application settings' }).click(),
    undefined,
    page.getByRole('dialog', { name: 'Settings' }),
  );
  // The Search panel is the tour's one fly-up-in, which the budget test asserts it saw.
  await openAndClose(
    page,
    async () => {
      // Search, first in the footer's Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md).
      await page.locator('[data-tools-button]').click();
      await page.locator('[data-tools-item="search"]').click();
    },
    undefined,
    page.locator('.animate-fly-up-in').first(),
  );
}

test.describe('Motion budget', () => {
  test('every chrome animation settles within 250ms', async ({ page, pageErrors }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
    await page.addInitScript(recordMotion);
    await startBlank(page);
    await tourTheChrome(page);

    const seen = transitions(await recorded(page));
    // Guard against the probe going blind: menus, dialogs and hovers all ran, the slash menu's `dropdown-open`
    // among them (the palette's dropdowns, which share it, show only while a drawing is edited).
    expect(seen.length).toBeGreaterThan(20);
    expect(seen.some((m) => m.name === 'dialog-in')).toBe(true);
    expect(seen.some((m) => m.name === 'fly-up-in')).toBe(true);
    expect(seen.some((m) => m.name === 'dropdown-open' && m.target.includes('fixed'))).toBe(true);

    const slow = seen
      .filter((m) => m.delay + m.active > CEILING_MS)
      .map((m) => `${m.name} ${m.delay}+${m.active}ms on ${m.target}`);
    expect(slow, `chrome motion past ${CEILING_MS}ms:\n${slow.join('\n')}`).toEqual([]);
    expectNoPageErrors(pageErrors);
  });

  test('reduced motion collapses every animation to instant', async ({ page, pageErrors }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.addInitScript(recordMotion);
    await startBlank(page);
    await tourTheChrome(page);

    const all = await recorded(page);
    const moving = all
      .filter((m) => m.delay + m.active > 1)
      .map((m) => `${m.name} ${m.delay}+${m.active}ms on ${m.target}`);
    expect(moving, `motion under reduced motion:\n${moving.join('\n')}`).toEqual([]);
    expectNoPageErrors(pageErrors);
  });
});
