import type { SettingsScrollAnchor } from './settings-view-memory';

// Marks each settings row inside the pane with its catalogue key, so a scroll
// position can be named by the row it shows rather than by pixels.
export const SETTINGS_ROW_ATTRIBUTE = 'data-settings-row';

function rows(pane: HTMLElement): HTMLElement[] {
  return [...pane.querySelectorAll<HTMLElement>(`[${SETTINGS_ROW_ATTRIBUTE}]`)];
}

// Rendered pixels per layout pixel. Rects carry any ancestor transform (the
// dialog scales in from 0.96 as it opens) while scrollTop does not, so a rect
// distance is divided by this before it meets scrollTop. 1 when unmeasurable.
function renderScale(pane: HTMLElement, paneRect: DOMRect): number {
  return pane.offsetHeight > 0 && paneRect.height > 0 ? paneRect.height / pane.offsetHeight : 1;
}

// Where a row's top sits below the pane's top edge, in layout pixels.
function rowOffset(pane: HTMLElement, paneRect: DOMRect, rowRect: DOMRect): number {
  return (rowRect.top - paneRect.top) / renderScale(pane, paneRect);
}

// The topmost row still (even partly) in view, and where its top sits
// relative to the pane's top edge. At the very top there is nothing to keep.
export function captureScrollAnchor(pane: HTMLElement): SettingsScrollAnchor | null {
  if (pane.scrollTop <= 0) return null;
  const paneRect = pane.getBoundingClientRect();
  for (const row of rows(pane)) {
    const rect = row.getBoundingClientRect();
    if (rect.bottom > paneRect.top) {
      return {
        rowKey: row.getAttribute(SETTINGS_ROW_ATTRIBUTE)!,
        offset: rowOffset(pane, paneRect, rect),
      };
    }
  }
  return null;
}

// Scrolls so the anchored row sits at its remembered offset again, wherever
// a reflow has moved it. False when the row no longer exists.
export function applyScrollAnchor(pane: HTMLElement, anchor: SettingsScrollAnchor): boolean {
  const row = rows(pane).find((r) => r.getAttribute(SETTINGS_ROW_ATTRIBUTE) === anchor.rowKey);
  if (!row) return false;
  const current = rowOffset(pane, pane.getBoundingClientRect(), row.getBoundingClientRect());
  pane.scrollTop += current - anchor.offset;
  return true;
}
