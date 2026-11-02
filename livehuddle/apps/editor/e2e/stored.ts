// The api's answers the e2e specs read back from inside the page, typed where their JSON is parsed.
// Type-only: a page.evaluate callback runs in the browser, so these types are all a spec can bring.

/** GET /documents/:id, as far as the specs read it. */
export type StoredDocument = { document?: { tabs?: { id: string; name: string }[] } };

/** GET /documents/:id/tabs/:tabId, its elements typed by the spec reading them. */
export type StoredTab<E = unknown> = { tab?: { elements?: E[] } & Record<string, unknown> };
