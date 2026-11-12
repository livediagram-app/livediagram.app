'use client';

// Opening a card's picture whole in a new browser tab (docs/specs/026-plan/items.md "Attachments", item-types.md
// "Image fields": a Several Images thumbnail). The new tab opens at once, inside the press, so the browser lets it;
// the picture fills it once read.
import { apiImageOriginal, type ImagesScope } from '@/lib/api/images';

export async function openImageWhole(scope: ImagesScope, imageId: string): Promise<void> {
  const tab = window.open('', '_blank');
  const blob = await apiImageOriginal(scope, imageId);
  if (!blob) {
    tab?.close();
    return;
  }
  const url = URL.createObjectURL(blob);
  if (tab) tab.location.href = url;
  else window.open(url, '_blank');
  // Long enough for the tab to read it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
