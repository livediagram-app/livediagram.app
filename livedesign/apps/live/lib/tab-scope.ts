// Tab-scoped share links on the client (docs/specs/013-workspace/tab-scoped-share-links.md). A session opened
// through a link scoped to one tab can only make that tab active; the others
// are drawn as "Not shared" pills and their content is never requested.

// What the visitor is told when something tries to take them to another tab.
export const OUT_OF_SCOPE_MESSAGE = "That tab isn't shared with you";

// Whether `tabId` is closed to a session scoped to `scope` (null = every tab
// is open: the owner, a team member, an All-tabs link).
export function isTabOutOfScope(tabId: string, scope: string | null): boolean {
  return scope !== null && tabId !== scope;
}

// The tab whose content a freshly opened document fetches first and shows:
// the scoped tab when there is one, otherwise the first.
export function firstTabToLoad(
  tabs: readonly { id: string }[],
  scope: string | null,
): string | null {
  return scope ?? tabs[0]?.id ?? null;
}
