// The New Document wizard's note to the editor (docs/specs/013-workspace/default-folders.md "A template picked
// after creation"): /new now makes the chosen mode's blank, and the template is picked afterwards on the start
// screen, so the template's default folder can only be applied then. The wizard notes the document it made, its
// first tab and whether the person chose the folder themselves; the editor reads it at the first template pick and
// clears it. Kept for this browser tab only (sessionStorage), and only for a cloud document made from a mode's blank.
const KEY = 'livepages:v2:template-pick-handoff';

export type TemplatePickHandoff = {
  documentId: string;
  tabId: string;
  // The folder was the person's own choice (picked on the Location step, or a /new?folder= / ?team= context, or
  // their saved "skip this step" place): it is kept whatever template is picked.
  placementChosen: boolean;
};

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function handTemplatePick(handoff: TemplatePickHandoff | null): void {
  const store = storage();
  if (!store) return;
  try {
    if (handoff) store.setItem(KEY, JSON.stringify(handoff));
    else store.removeItem(KEY);
  } catch {
    // Full or blocked storage: the template's default is simply not applied.
  }
}

export function readTemplatePick(): TemplatePickHandoff | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw: unknown = JSON.parse(store.getItem(KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return null;
    const h = raw as Record<string, unknown>;
    if (typeof h.documentId !== 'string' || typeof h.tabId !== 'string') return null;
    return {
      documentId: h.documentId,
      tabId: h.tabId,
      placementChosen: h.placementChosen === true,
    };
  } catch {
    return null;
  }
}

/** The handoff for this document's first tab, taken (read and cleared) so it applies once. */
export function takeTemplatePick(documentId: string, tabId: string): TemplatePickHandoff | null {
  const handoff = readTemplatePick();
  if (!handoff || handoff.documentId !== documentId) return null;
  handTemplatePick(null);
  return handoff.tabId === tabId ? handoff : null;
}
