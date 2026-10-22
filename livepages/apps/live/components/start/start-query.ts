// A search handed to the next start panel (docs/specs/007-editor/new-document-route.md "Choosing a mode"): a `/new?q=`
// link (the marketing site's Build yours, a gallery search) chooses a mode, and its words become the search in that
// mode's start on the new document, so the templates it meant are the ones shown. Kept for this tab only, and read
// once.
const KEY = 'livepages:v2:start-query';

export function handStartQuery(query: string | null): void {
  try {
    if (query) sessionStorage.setItem(KEY, query);
    else sessionStorage.removeItem(KEY);
  } catch {
    // No session storage: the start opens unsearched.
  }
}

export function takeStartQuery(): string {
  try {
    const q = sessionStorage.getItem(KEY) ?? '';
    sessionStorage.removeItem(KEY);
    return q;
  } catch {
    return '';
  }
}
