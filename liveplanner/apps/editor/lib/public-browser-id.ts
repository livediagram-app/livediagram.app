// A visitor's browser key on liveplanner's public pages: a random id kept in local storage, never an account, a cookie
// or an address. A form's Report names it (docs/specs/030-forms/forms.md "Abuse and limits"), and a public roadmap's
// upvote is one per browser key (docs/specs/026-plan/public-roadmap.md "Upvotes"). With no storage (a private
// window that refuses it), each call is a fresh id: the visitor simply is not remembered.
const BROWSER_KEY = 'liveplanner:form-browser';

export function publicBrowserId(): string {
  try {
    const known = localStorage.getItem(BROWSER_KEY);
    if (known) return known;
    const id = crypto.randomUUID();
    localStorage.setItem(BROWSER_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
