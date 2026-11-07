import type { Locator, Page } from '@playwright/test';
import { expect, test, expectNoPageErrors, openStartBlank, paletteTile } from './fixtures';

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

// Straight to a blank canvas (the /new?blank=1 bypass), made on livehuddle: a guest's own /new keeps it in This
// Browser, which the index never holds, so the Explorer panel would show no Current space card and no Space menu
// (docs/specs/013-workspace/explorer-structure.md "The editor's Explorer panel").
const startBlank = openStartBlank;

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
  await (await paletteTile(page, 'Add Sticky Note')).click();
  await page.locator('[data-canvas-a11y-root]').click({ position: { x: 520, y: 360 } });
  const square = page.getByRole('img', { name: 'Sticky note', exact: true });
  await expect(square).toHaveCount(1);
  await page.waitForTimeout(400);

  // A category's flyout on the category bar (docs/specs/007-editor/toolbar-layout.md "The category bar").
  await openAndClose(page, () =>
    page.locator('[data-category-bar-button][aria-label="Rooms"]').click(),
  );
  await toggle(page, 'Fit to screen');
  // The Explorer popover, and the Space menu on its Current space card.
  const explorer = page.getByRole('button', { name: 'Explorer', exact: true });
  await explorer.click();
  await page.waitForTimeout(400);
  await openAndClose(page, () => page.getByRole('button', { name: 'Space menu' }).click());
  // The scrim sits over the Explorer button while the panel is open; Escape closes it.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await openAndClose(page, () => page.getByRole('button', { name: 'Tab menu' }).click());
  await openAndClose(page, () => square.click({ button: 'right' }));
  await openAndClose(
    page,
    () => page.getByRole('button', { name: 'Application settings' }).click(),
    undefined,
    page.getByRole('dialog', { name: 'Settings' }),
  );
  // The Search panel is the tour's one fly-up-in, which the budget test asserts it saw.
  await openAndClose(
    page,
    () => page.getByRole('button', { name: 'Search', exact: true }).click(),
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

  // docs/specs/007-editor/toolbar-layout.md "Switching morphs the strip": the Edit | Walk morph is script-driven
  // (Web Animations), which the animationstart recorder above never hears, so it is read off the strip itself: every
  // piece settles within the ceiling, and on every frame the toggle sits at the bar's start edge, the bar resizing
  // without a jump.
  test('the Edit | Walk morph settles within 250ms, the toggle riding the bar', async ({
    page,
    pageErrors,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
    await startBlank(page);
    const start = page.getByRole('region', { name: /^Start a Space$/ });
    if (await start.isVisible()) {
      await start.getByRole('button', { name: 'Close' }).click();
      await start.waitFor({ state: 'detached' });
    }
    const toggle = page.getByRole('group', { name: 'Edit or Walk' });
    for (const side of ['Walk', 'Edit'] as const) {
      const frames = await page.evaluate(async (name) => {
        const shown = () =>
          [...document.querySelectorAll<HTMLElement>('[data-toolbar-palette]')].find(
            (r) => r.getClientRects().length > 0,
          )!;
        const button = [...shown().querySelectorAll<HTMLElement>('[data-edit-walk]')].find(
          (b) => b.getAttribute('aria-label') === name,
        )!;
        button.click();
        const out: { budget: number[]; edge: number; width: number; surface: boolean }[] = [];
        const t0 = performance.now();
        await new Promise<void>((done) => {
          const step = () =>
            setTimeout(() => {
              const root = shown();
              const card = root.querySelector<HTMLElement>('[data-tour-id="palette"]')!;
              const bar = root.querySelector<HTMLElement>('[data-strip-morph-surface]');
              const tog = card.querySelector<HTMLElement>(':scope > [data-edit-walk-toggle]')!;
              const box = (bar ?? card).getBoundingClientRect();
              out.push({
                // Ambient loops (a talking bar) are not chrome motion: finite ones only.
                budget: root
                  .getAnimations({ subtree: true })
                  .map((a) => {
                    const t = a.effect!.getComputedTiming();
                    return Number(t.delay ?? 0) + Number(t.activeDuration ?? 0);
                  })
                  .filter(Number.isFinite),
                edge: tog.getBoundingClientRect().left - box.left,
                width: box.width,
                surface: bar !== null,
              });
              // Sample until the bar has come and gone. The morph starts only once the incoming strip has
              // rendered, which a loaded CI runner can hold back 200 ms, so a fixed window from the click caught
              // its end too early (#1392). The 2 s cap still fails a morph that never ends.
              const seen = out.some((f) => f.surface);
              if (performance.now() - t0 < 2000 && (!seen || bar !== null))
                requestAnimationFrame(step);
              else done();
            }, 0);
          requestAnimationFrame(step);
        });
        return out;
      }, side);
      await expect(toggle.getByRole('button', { name: side, exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      // The morph ran, and ended.
      expect(frames.some((f) => f.surface)).toBe(true);
      expect(frames.at(-1)!.surface).toBe(false);
      const slow = frames.flatMap((f) => f.budget).filter((ms) => ms > CEILING_MS);
      expect(slow, `strip motion past ${CEILING_MS}ms`).toEqual([]);
      // The toggle never leaves the bar's start edge (a pixel for rounding).
      const edges = frames.map((f) => f.edge);
      expect(Math.max(...edges) - Math.min(...edges)).toBeLessThanOrEqual(1);
      // No jump: the bar's width moves monotonically from one strip's to the other's.
      const widths = frames.map((f) => f.width);
      const rising = widths.at(-1)! >= widths[0]!;
      for (let i = 1; i < widths.length; i++)
        expect(
          rising ? widths[i]! - widths[i - 1]! : widths[i - 1]! - widths[i]!,
        ).toBeGreaterThanOrEqual(-1);
      await page.waitForTimeout(300);
    }
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
