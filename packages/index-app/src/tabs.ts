// An item's tabs alone (liveworkspace/docs/one-explorer-contracts.md "An item's tabs"): `GET /api/<items>/:id/tabs`
// answers `{ tabs: [{ id, name, kind }] }`, in the item's order, for whoever may read the item. The Share dialog's
// tab picker on liveworkspace.app reads it once per open (`share.tabsPath` in @liveworkspace/sites), rather than the
// whole item with every tab's content. An app on the index serves it from its item's Durable Object, from the tab
// rows alone (never their content), and lets the kit shape the answer:
//
//   const itemId = itemTabsRequest(request.method, segments, 'documents');
//   if (itemId) {
//     const grant = await gate(itemId);                       // the item's read gate: no grant is a 404
//     if (!grant) return notFound();
//     return itemTabsResponse(itemTabsOf(await tabRows(itemId), grant.tabScope), CORS_HEADERS);
//   }

/** One tab as the picker names it. `kind` is the app's own word for what the tab holds, or null. */
export type ItemTab = { id: string; name: string; kind: string | null };

export type ItemTabsAnswer = { tabs: ItemTab[] };

export const ITEM_TABS_SEGMENT = 'tabs';

/** The item a `GET /api/<itemsSegment>/:id/tabs` is about, or null for any other request. */
export function itemTabsRequest(
  method: string,
  segments: readonly string[],
  itemsSegment: string,
): string | null {
  if (method !== 'GET' || segments.length !== 4) return null;
  if (segments[0] !== 'api' || segments[1] !== itemsSegment || segments[3] !== ITEM_TABS_SEGMENT)
    return null;
  return segments[2] || null;
}

/**
 * The tabs a reader may see, in the order given: every one, or for a reader whose grant names one tab (a tab's
 * share link) that tab alone, so the others' names never leave. A tab with no name reads as ''; a kind that isn't a
 * string reads as null.
 */
export function itemTabsOf(
  rows: readonly { id: string; name?: string | null; kind?: unknown }[],
  tabScope: string | null = null,
): ItemTab[] {
  const out: ItemTab[] = [];
  for (const row of rows) {
    if (tabScope !== null && row.id !== tabScope) continue;
    out.push({
      id: row.id,
      name: typeof row.name === 'string' ? row.name : '',
      kind: typeof row.kind === 'string' && row.kind !== '' ? row.kind : null,
    });
  }
  return out;
}

/** The answer: private to the reader, and never kept, since a tab can be renamed, added or removed at any moment. */
export function itemTabsResponse(tabs: ItemTab[], headers?: HeadersInit): Response {
  const out = new Headers(headers);
  out.set('Content-Type', 'application/json');
  out.set('Cache-Control', 'private, no-store');
  return new Response(JSON.stringify({ tabs } satisfies ItemTabsAnswer), { headers: out });
}
