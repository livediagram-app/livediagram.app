import { test, expect, expectNoPageErrors, startBlankDiagram } from './fixtures';

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
