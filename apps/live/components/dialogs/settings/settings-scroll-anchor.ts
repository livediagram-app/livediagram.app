import type { SettingsScrollAnchor } from './settings-view-memory';

// Marks each settings row inside the pane with its catalogue key, so a scroll
// position can be named by the row it shows rather than by pixels.
export const SETTINGS_ROW_ATTRIBUTE = 'data-settings-row';

function rows(pane: HTMLElement): HTMLElement[] {
  return [...pane.querySelectorAll<HTMLElement>(`[${SETTINGS_ROW_ATTRIBUTE}]`)];
}

// The topmost row still (even partly) in view, and where its top sits
// relative to the pane's top edge. At the very top there is nothing to keep.
export function captureScrollAnchor(pane: HTMLElement): SettingsScrollAnchor | null {
  if (pane.scrollTop <= 0) return null;
  const paneTop = pane.getBoundingClientRect().top;
  for (const row of rows(pane)) {
    const rect = row.getBoundingClientRect();
    if (rect.bottom > paneTop) {
      return { rowKey: row.getAttribute(SETTINGS_ROW_ATTRIBUTE)!, offset: rect.top - paneTop };
    }
  }
  return null;
}

// Scrolls so the anchored row sits at its remembered offset again, wherever
// a reflow has moved it. False when the row no longer exists.
export function applyScrollAnchor(pane: HTMLElement, anchor: SettingsScrollAnchor): boolean {
  const row = rows(pane).find((r) => r.getAttribute(SETTINGS_ROW_ATTRIBUTE) === anchor.rowKey);
  if (!row) return false;
  const current = row.getBoundingClientRect().top - pane.getBoundingClientRect().top;
  pane.scrollTop += current - anchor.offset;
  return true;
}
