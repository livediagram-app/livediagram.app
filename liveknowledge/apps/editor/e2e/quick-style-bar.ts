import type { Locator, Page } from '@playwright/test';
import { expect } from './fixtures';

// The Quick Style bar's helpers (docs/specs/008-canvas/quick-style-panel.md): one button per row, each opening a
// popover dialog (named as the button) that holds the row. Shared by the quick-style specs.

export const quickBar = (page: Page): Locator => page.getByRole('toolbar', { name: 'Quick Style' });

// A row's title (the row's aria-label) -> the bar button that opens its popover.
export const QUICK_BUTTON = {
  Stroke: 'Stroke',
  Fill: 'Fill',
  'Text colour': 'Text',
  'Stroke width': 'Width',
  'Stroke style': 'Line',
  'Text alignment': 'Align',
  'Icon alignment': 'Icon',
} as const;

export type QuickRowTitle = keyof typeof QUICK_BUTTON;

// A row's popover dialog, open or not.
export const quickPopover = (page: Page, title: QuickRowTitle): Locator =>
  page.getByRole('dialog', { name: QUICK_BUTTON[title], exact: true });

// Opens the row's popover unless it is open, and returns the row inside it. A row of glyph buttons is a radio
// group; a colour row is a group of toggle buttons (docs/specs/004-interface-design/colour-picker.md).
export async function quickRow(page: Page, title: QuickRowTitle): Promise<Locator> {
  const button = quickBar(page).getByRole('button', { name: QUICK_BUTTON[title], exact: true });
  await expect(button).toBeVisible();
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
  const dialog = quickPopover(page, title);
  await expect(dialog).toBeVisible();
  return dialog.locator(
    `[role="radiogroup"][aria-label="${title}"], [role="group"][aria-label="${title}"]`,
  );
}

export async function quickChoose(page: Page, title: QuickRowTitle, option: string) {
  await (await quickRow(page, title)).getByLabel(option, { exact: true }).click();
}
