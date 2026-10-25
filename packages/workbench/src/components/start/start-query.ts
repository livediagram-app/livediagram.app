// A search handed to the next start panel (docs/specs/007-editor/new-document-route.md "Choosing a mode"): a `/new?q=`
// link (the marketing site's Build yours, a gallery search) chooses a mode, and its words become the search in that
// mode's start on the new document, so the templates it meant are the ones shown. Kept for this tab only, and read
// once, under the product's key (the `startQueryKey` binding).
import { workbench } from '../../bindings';


export function handStartQuery(query: string | null): void {
  try {
    if (query) sessionStorage.setItem(workbench.startQueryKey, query);
    else sessionStorage.removeItem(workbench.startQueryKey);
  } catch {
    // No session storage: the start opens unsearched.
  }
}

export function takeStartQuery(): string {
  try {
    const q = sessionStorage.getItem(workbench.startQueryKey) ?? '';
    sessionStorage.removeItem(workbench.startQueryKey);
    return q;
  } catch {
    return '';
  }
}
