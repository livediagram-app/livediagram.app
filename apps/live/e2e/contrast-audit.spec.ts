import type { Browser, Page } from '@playwright/test';
import { auditContrast, type ContrastReport } from './contrast';
import { dismissQuickTour, expect, expectNoPageErrors, test } from './fixtures';

// Contrast audit, dark mode (docs/specs/003-system-architecture/e2e-smoke.md; the palette it guards is
// docs/specs/004-interface-design/color-scheme.md, Dark palette (Steel)). Every visible text node on each
// screen must meet WCAG AA against the background painted under it. There is no allow-list: a failure
// is fixed at its colour. Light mode is deliberately out of scope: its colours belong to the light half
// of #74, owned by Thomas.

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const CANVAS = '[data-canvas-a11y-root]';

test.use({ colorScheme: 'dark', reducedMotion: 'reduce', viewport: { width: 1440, height: 860 } });

async function darkVisitor(page: Page, owner?: string): Promise<void> {
  await page.addInitScript((id) => {
    localStorage.setItem('livediagram:v2:ui-mode', 'dark');
    localStorage.setItem('livediagram:v2:name-confirmed', '1');
    if (id) localStorage.setItem('livediagram:v2:self-id', id);
  }, owner ?? null);
}

// A diagram shaped like a real one: an actor, boxes, and solid and dashed labelled arrows, on the
// Default scheme, so the canvas ink is the palette's own.
async function seedDiagram(page: Page, owner: string, origin: string): Promise<string> {
  const id = crypto.randomUUID();
  const box = (bid: string, label: string, x: number, y: number) => ({
    id: bid,
    type: 'shape',
    shape: 'square',
    x,
    y,
    width: 200,
    height: 100,
    label,
  });
  const arrow = (aid: string, from: string, to: string, label: string, dashed = false) => ({
    id: aid,
    type: 'arrow',
    from: { kind: 'pinned', elementId: from, anchor: 's' },
    to: { kind: 'pinned', elementId: to, anchor: 'n' },
    label,
    ...(dashed ? { strokeStyle: 'dashed' } : {}),
  });
  const elements = [
    {
      id: 'actor',
      type: 'shape',
      shape: 'actor',
      x: 470,
      y: 20,
      width: 60,
      height: 100,
      label: 'Webber',
    },
    box('a', 'Assistant', 180, 240),
    box('s', 'Spinner', 440, 240),
    box('r', 'Runa (Backend)', 280, 480),
    arrow('x1', 'actor', 'a', 'UI'),
    arrow('x2', 'actor', 's', 'UI'),
    arrow('x3', 'a', 'r', 'Use personal assistant', true),
  ];
  const res = await page.request.post(`${apiBase}/diagrams`, {
    headers: { 'X-Owner-Id': owner, Origin: origin },
    data: { id, name: 'Contrast', tabs: [{ id: crypto.randomUUID(), name: 'Runa', elements }] },
  });
  expect(res.ok(), `seeding failed: ${res.status()}`).toBe(true);
  return id;
}

async function shareLink(page: Page, owner: string, origin: string, id: string): Promise<string> {
  const res = await page.request.post(`${apiBase}/diagrams/${id}/share`, {
    headers: { 'X-Owner-Id': owner, Origin: origin, 'Content-Type': 'application/json' },
    data: {},
  });
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { link: { code: string } }).link.code;
}

function expectAA(report: ContrastReport, screen: string): void {
  test.info().annotations.push({
    type: `contrast: ${screen}`,
    description: `${report.measured} text nodes measured; skipped ${JSON.stringify(report.skipped)}`,
  });
  expect(report.measured, `${screen}: nothing was measured`).toBeGreaterThan(0);
  const lines = report.failures.map(
    (f) => `"${f.text}" ${f.fg} on ${f.bg} = ${f.ratio}:1 (needs ${f.required}) at ${f.where}`,
  );
  expect(lines, `${screen}: text below WCAG AA in dark mode`).toEqual([]);
}

test.describe('Contrast audit, dark mode', () => {
  test('the New Diagram wizard', async ({ page, pageErrors }) => {
    await darkVisitor(page);
    await page.goto('/new');
    await page.getByText('New Diagram', { exact: false }).first().waitFor();
    await expect(page.locator('html')).toHaveClass(/dark/);
    expectAA(await auditContrast(page), 'wizard, template step');

    await page.getByRole('button', { name: /^next$/i }).click();
    await page
      .getByText('All themes', { exact: false })
      .or(page.getByText('Default').first())
      .first()
      .waitFor();
    expectAA(await auditContrast(page), 'wizard, theme step');
    expectNoPageErrors(pageErrors);
  });

  test('the editor, its panels and dialogs', async ({ page, pageErrors, baseURL }) => {
    const owner = crypto.randomUUID();
    const origin = new URL(baseURL!).origin;
    const id = await seedDiagram(page, owner, origin);
    await darkVisitor(page, owner);
    await page.goto(`/diagram/${id}`);
    await page.locator(CANVAS).waitFor();
    await dismissQuickTour(page);
    await expect(page.getByRole('img', { name: /Spinner/ }).first()).toBeVisible();
    expectAA(await auditContrast(page), 'editor with its default panels');

    await page
      .getByRole('img', { name: /Spinner/ })
      .first()
      .click();
    expectAA(await auditContrast(page), 'editor, a shape selected');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Application settings' }).click();
    await page.getByRole('dialog').first().waitFor();
    expectAA(await auditContrast(page), 'Settings dialog');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /^Share$/ }).click();
    await page.getByRole('dialog', { name: 'Share this diagram' }).waitFor();
    expectAA(await auditContrast(page), 'Share dialog');
    await page.keyboard.press('Escape');
    expectNoPageErrors(pageErrors);
  });

  test('the Join dialog a share link opens', async ({ page, browser, baseURL }) => {
    const owner = crypto.randomUUID();
    const origin = new URL(baseURL!).origin;
    const id = await seedDiagram(page, owner, origin);
    const code = await shareLink(page, owner, origin, id);
    const visitor = await freshDarkPage(browser);
    await visitor.goto(`/diagram/shared?s=${code}`);
    await visitor.getByRole('button', { name: /^join$/i }).waitFor();
    expectAA(await auditContrast(visitor), 'Join dialog');
    await visitor.context().close();
  });

  test('the Explorer', async ({ page, pageErrors, baseURL }) => {
    const owner = crypto.randomUUID();
    await seedDiagram(page, owner, new URL(baseURL!).origin);
    await darkVisitor(page, owner);
    await page.goto('/explorer');
    await page.getByText('Contrast').first().waitFor();
    expectAA(await auditContrast(page), 'Explorer');
    expectNoPageErrors(pageErrors);
  });
});

// A visitor with no identity yet, so the share link greets them with the Join dialog.
async function freshDarkPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    viewport: { width: 1440, height: 860 },
    baseURL: test.info().project.use.baseURL,
  });
  await context.addInitScript(() => localStorage.setItem('livediagram:v2:ui-mode', 'dark'));
  return context.newPage();
}
