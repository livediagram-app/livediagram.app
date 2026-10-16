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

// A Form tab's own: deleting it deletes its form link (docs/specs/030-forms/forms.md "Publishing and the form link"),
// which an undo does not bring back. The tab cannot tell whether it has one, so the line says "if".
export const FORM_TAB_DELETE_WARNING =
  'If this form has a link, the link is deleted with it: undo brings the form back, not its link.';

/** What deleting a tab does that an undo cannot take back, the one case Delete still asks first
 *  (docs/specs/007-editor/live-app.md "Confirmations"): a Form tab's link goes, and the forms sending their responses here stop taking
 *  them. Undefined for any other tab, which is deleted at once. */
export function deleteTabWarning(tabs: readonly Tab[], tabId: string): string | undefined {
  if (tabs.some((t) => t.id === tabId && t.kind === 'form')) return FORM_TAB_DELETE_WARNING;
  const forms = formsFeeding(tabs, tabId);
  if (forms.length === 0) return undefined;
  return forms.length === 1
    ? `“${forms[0]!.heading}” sends its responses here: it stops taking them, keeping its link, until it has somewhere to send them.`
    : `${forms.length} forms send their responses here: they stop taking them, keeping their links, until they have somewhere to send them.`;
}
