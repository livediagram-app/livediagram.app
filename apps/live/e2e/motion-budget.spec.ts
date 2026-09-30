import type { Page } from '@playwright/test';
import { expect, test, dismissQuickTour, expectNoPageErrors } from './fixtures';

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
    if (!(el instanceof Element) || el.closest('[data-element-id]')) return;
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
  await page.goto('/new');
  await page.getByRole('button', { name: /^start blank$/i }).click();
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);
}

/** Open a chrome surface, let its motion play out, and close it again. */
async function openAndClose(
  page: Page,
  open: () => Promise<void>,
  close: () => Promise<void> = () => page.keyboard.press('Escape'),
): Promise<void> {
  await open();
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
  await page.getByRole('button', { name: 'Add square', exact: true }).click();
  await page.locator('[data-canvas-a11y-root]').click({ position: { x: 520, y: 360 } });
  const square = page.getByRole('img', { name: 'Square', exact: true });
  await expect(square).toHaveCount(1);
  await page.waitForTimeout(400);

  await toggle(page, 'Canvas tool');
  await toggle(page, 'Palette category');
  await toggle(page, 'Fit to screen');
  await openAndClose(page, () => page.getByRole('button', { name: 'Document menu' }).click());
  await openAndClose(page, () => page.getByRole('button', { name: 'Tab menu' }).click());
  await openAndClose(page, () => square.click({ button: 'right' }));
  await openAndClose(page, () =>
    page.getByRole('button', { name: 'Application settings' }).click(),
  );
  await openAndClose(page, () => page.getByRole('button', { name: 'Search', exact: true }).click());
}

test.describe('Motion budget', () => {
  test('every chrome animation settles within 250ms', async ({ page, pageErrors }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
    await page.addInitScript(recordMotion);
    await startBlank(page);
    await tourTheChrome(page);

    const seen = transitions(await recorded(page));
    // Guard against the probe going blind: menus, dialogs and hovers all ran.
    expect(seen.length).toBeGreaterThan(20);
    expect(seen.some((m) => m.name === 'menu-drop')).toBe(true);
    expect(seen.some((m) => m.name === 'fly-up-in')).toBe(true);

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
