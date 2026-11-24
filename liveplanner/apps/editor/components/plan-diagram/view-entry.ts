// View As Diagram's entry (docs/specs/026-plan/view-as-diagram.md "Where"): a Board tab's menu asks, and the editor's
// one ViewAsDiagramHost opens the dialog. A module-level relay: the menu and the host sit far apart in the tree.

const listeners = new Set<(tabId: string) => void>();
let enabled = false;

export function openViewAsDiagram(tabId: string): void {
  for (const l of [...listeners]) l(tabId);
}

/** The host's subscription, while this session may draw; answers the unsubscribe. */
export function onViewAsDiagram(listener: (tabId: string) => void): () => void {
  listeners.add(listener);
  enabled = true;
  return () => {
    listeners.delete(listener);
    enabled = listeners.size > 0;
  };
}

/** Whether a menu should offer View As Diagram now. */
export function canViewAsDiagram(): boolean {
  return enabled;
}
