// Which forms send their responses to a tab (docs/specs/030-forms/forms.md "Publishing and the form link"), so
// deleting that board or sheet can say first that it pauses them. Pure, and cheap: the tab bar asks for every tab
// on every render, so a form's destination is read where it is stored, never by parsing the form.
import type { Tab } from '@livediagram/document';

/** The Form tabs whose responses go to `tabId` (a board, or a sheet: a form sending to a sheet feeds no board, as its
 *  sheet wins over a board it kept), each with its heading. The board's Form strip and Delete's warning both read it. */
export function formsFeeding(
  tabs: readonly Tab[],
  tabId: string,
): { tabId: string; heading: string }[] {
  return tabs.flatMap((t) => {
    if (t.kind !== 'form' || t.id === tabId || !t.form) return [];
    const to = t.form.sheet?.tabId ?? t.form.destination?.tabId;
    return to === tabId ? [{ tabId: t.id, heading: t.form.heading }] : [];
  });
}

/** Delete's warning for a tab the forms send their responses to: they stop taking responses. Undefined for any other tab. */
export function deleteTabWarning(tabs: readonly Tab[], tabId: string): string | undefined {
  const forms = formsFeeding(tabs, tabId);
  if (forms.length === 0) return undefined;
  return forms.length === 1
    ? `“${forms[0]!.heading}” sends its responses here: it stops taking them, keeping its link, until it has somewhere to send them.`
    : `${forms.length} forms send their responses here: they stop taking them, keeping their links, until they have somewhere to send them.`;
}
