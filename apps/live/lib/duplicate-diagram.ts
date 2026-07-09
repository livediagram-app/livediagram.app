// Single-source duplicate-diagram helper.
//
// "Clone an existing diagram into a fresh one under the same owner"
// is a multi-step operation that lived as three near-identical
// inlines (editor-page, /new, /explorer). Per CLAUDE.md it's
// supposed to live in one place — extracting it here removes the
// drift risk (one copy could silently forget to remap link
// references and break cross-tab navigation in the copy).
//
// Steps:
//
//   1. Load the source diagram's meta + every tab.
//   2. Mint a fresh tab id for each source tab.
//   3. Walk every element; any element.link.tabId that points at a
//      source tab gets rewritten to the matching new id so the copy
//      keeps its internal navigation.
//   4. Create the new diagram with a fresh id under `ownerId`, with
//      the remapped tabs seeded inline.
//
// Returns the new diagram id on success, undefined on failure
// (network glitch, source not found, etc.). Callers handle
// post-duplication side effects (list refresh, navigate, etc.) —
// the helper deliberately doesn't touch state outside the api
// round-trip so it can stand alone.

import type { Tab } from '@livediagram/diagram';
import { apiCreateDiagram, apiLoadDiagram, apiLoadTab, apiSaveDiagramMeta } from './api-client';
import { isOfflineId, offlineCreateDiagram } from './offline/offline-store';

export async function duplicateDiagram(
  ownerId: string,
  sourceId: string,
): Promise<string | undefined> {
  const src = await apiLoadDiagram(ownerId, sourceId).catch(() => null);
  if (!src) return undefined;
  const fullTabs = await Promise.all(
    src.tabs.map((t) => apiLoadTab(ownerId, src.id, t.id, null).catch(() => null)),
  );
  // Build the old → new tab-id map from the source's declared tab
  // list, not from the loaded payloads — a missing tab fetch
  // shouldn't break the link remap for tabs that DID load.
  const tabIdMap = new Map<string, string>();
  for (const t of src.tabs) tabIdMap.set(t.id, crypto.randomUUID());
  const remappedTabs: Tab[] = [];
  for (const tab of fullTabs) {
    if (!tab) continue;
    const newTabId = tabIdMap.get(tab.id) ?? crypto.randomUUID();
    const elements = tab.elements.map((el) => {
      if ('link' in el && el.link) {
        // Tab / element-kind links carry a tabId that needs
        // remapping into the duplicated tab tree. Diagram-kind
        // links target another diagram entirely; they survive
        // the duplication unchanged so the new diagram still
        // navigates to the same external destination.
        if (el.link.kind === 'tab' || el.link.kind === 'element') {
          const next = tabIdMap.get(el.link.tabId);
          if (next) return { ...el, link: { ...el.link, tabId: next } };
        }
      }
      return el;
    });
    remappedTabs.push({ ...tab, id: newTabId, elements });
  }
  const newId = crypto.randomUUID();
  // Offline Mode (spec/76): a copy of an offline diagram is another OFFLINE
  // diagram. Creating it on the server instead would silently upload content
  // the user explicitly chose to keep in this browser. Tabs are stored whole
  // (per-tab `folder` included), so no follow-up meta write is needed.
  if (await isOfflineId(sourceId)) {
    try {
      await offlineCreateDiagram(
        { id: newId, name: `${src.name} copy`, tabs: remappedTabs },
        Date.now(),
      );
      return newId;
    } catch {
      return undefined;
    }
  }
  // A failed create must return undefined per the contract above —
  // returning the id anyway made callers toast "Diagram duplicated"
  // and navigate to a diagram that doesn't exist.
  try {
    await apiCreateDiagram(ownerId, {
      id: newId,
      name: `${src.name} copy`,
      tabs: remappedTabs,
    });
  } catch {
    return undefined;
  }
  // Tab-folder structure (spec/30) doesn't ride the create — the seed
  // path strips per-tab `folder` — so it's re-applied via the same meta
  // PUT the autosave uses. Best-effort: a copy with loose tabs beats no
  // copy.
  if (remappedTabs.some((t) => t.folder)) {
    await apiSaveDiagramMeta(ownerId, {
      id: newId,
      tabs: remappedTabs.map((t) => ({ id: t.id, ...(t.folder ? { folder: t.folder } : {}) })),
    }).catch(() => {});
  }
  return newId;
}
