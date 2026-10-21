// A shape library item's thumbnail (docs/specs/013-workspace/shape-libraries.md "Using a library"):
// its elements drawn by the editor's own SVG export, handed back as a data URL for an <img>, so
// nothing in it runs. The exporter loads with the first thumbnail, never with the editor; each item
// is drawn once per session.

import type { Tab } from '@livediagram/document';
import type { ShapeLibraryItem } from '@livediagram/api-schema';

const drawn = new Map<string, Promise<string>>();

export function libraryItemThumbnail(item: ShapeLibraryItem): Promise<string> {
  const cached = drawn.get(item.id);
  if (cached) return cached;
  const pending = (async () => {
    const { renderTabToSvg } = await import('./export-tab');
    const tab = { id: `library-item-${item.id}`, name: item.title, elements: item.elements } as Tab;
    const svg = renderTabToSvg(tab, { pattern: false });
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  })();
  // A failure is not cached: the next open tries again.
  pending.catch(() => drawn.delete(item.id));
  drawn.set(item.id, pending);
  return pending;
}
