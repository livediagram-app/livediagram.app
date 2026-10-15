// Which forms send their responses to a tab (docs/specs/030-forms/forms.md "Publishing and the form link"), so
// deleting that board or sheet can say first that it unpublishes them. Pure, and cheap: the tab bar asks for every tab
// on every render, so a form's destination is read where it is stored, never by parsing the form.
import type { Tab } from '@livediagram/document';

const DELETE_TAB =
  "Delete this tab? Unless another document also holds it, its content can't be recovered.";

/** The names of the Form tabs whose responses go to `tabId` (a board or a sheet). */
export function formsFeeding(tabs: readonly Tab[], tabId: string): string[] {
  return tabs.flatMap((t) => {
    if (t.kind !== 'form' || t.id === tabId || !t.form) return [];
    const to = t.form.sheet?.tabId ?? t.form.destination?.tabId;
    return to === tabId ? [t.name] : [];
  });
}

/** Delete's confirmation for a tab: plain, or warning that the forms it takes responses for are unpublished. */
export function deleteTabMessage(tabs: readonly Tab[], tabId: string): string {
  const names = formsFeeding(tabs, tabId);
  if (names.length === 0) return DELETE_TAB;
  const which =
    names.length === 1
      ? `The form “${names[0]}” sends its responses`
      : `${names.length} forms send their responses`;
  return `Delete this tab? ${which} here: deleting it unpublishes ${
    names.length === 1 ? 'that form' : 'them'
  }, and people with the link can no longer fill it in. Unless another document also holds the tab, its content can't be recovered.`;
}
