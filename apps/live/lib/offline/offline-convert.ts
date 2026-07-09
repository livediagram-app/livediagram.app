// Offline Mode conversions (spec/76): move a diagram between the browser-only
// IndexedDB store and the cloud API, in both directions.
//
// Ordering is chosen so a failure never loses the diagram: the destination is
// written before the source is removed. Taking a cloud diagram offline is
// destructive on the server (the whole point — it must leave the account and
// every other device), so the UI gates it behind a confirmation.

import { apiCreateDiagram, apiLoadDiagram, apiLoadTab } from '@/lib/api-client';
import { API_BASE, apiDelete } from '@/lib/api/core';
import {
  offlineCreateDiagram,
  offlineDeleteDiagram,
  offlineGetRecord,
  offlinePutRecord,
  type OfflineDiagramRecord,
} from './offline-store';

// Offline → Cloud ("Save to your account"). Creates the cloud copy first, then
// removes the local one, so a network failure leaves the offline diagram
// intact. Returns the (unchanged) diagram id. `apiCreateDiagram` does not
// dispatch on the offline index, so it always writes to the server even while
// the id is still registered offline.
export async function saveOfflineToCloud(offlineId: string, ownerId: string): Promise<string> {
  const rec = await offlineGetRecord(offlineId);
  if (!rec) throw new Error('offline diagram not found');
  // Embedded data-URI images travel with the tab JSON, so the cloud copy
  // renders them as-is (they aren't re-homed to R2 — spec/76 follow-up).
  await apiCreateDiagram(ownerId, { id: rec.id, name: rec.name, tabs: rec.tabs });
  await offlineDeleteDiagram(rec.id);
  return rec.id;
}

// Cloud → Offline ("Take offline"). Downloads the whole diagram, writes it to
// IndexedDB, then DELETES the server record (and thus any share links). The
// local write happens first so a failed delete leaves a (harmless) duplicate
// rather than nothing. The server delete goes through the raw `apiDelete` so it
// isn't re-routed to the local store once the id is registered offline.
export async function takeCloudOffline(
  diagramId: string,
  ownerId: string,
  shareCode: string | null = null,
): Promise<void> {
  const diagram = await apiLoadDiagram(ownerId, diagramId);
  if (!diagram) throw new Error('diagram not found');
  const tabs = (
    await Promise.all(
      diagram.tabs.map((s) => apiLoadTab(ownerId, diagramId, s.id, shareCode).catch(() => null)),
    )
  ).filter((t): t is NonNullable<typeof t> => t !== null);

  const now = Date.now();
  const rec: OfflineDiagramRecord = {
    id: diagram.id,
    name: diagram.name,
    folderId: null,
    createdAt: diagram.createdAt ?? now,
    savedAt: now,
    tabs,
  };
  await offlinePutRecord(rec);
  // Raw server delete — the id is now in the offline index, so the dispatching
  // apiDeleteDiagram would target the local store instead of the server.
  await apiDelete(`${API_BASE}/diagrams/${diagramId}`, ownerId, { action: 'take offline' });
}

// Re-exported for callers that only need to create an offline diagram from
// scratch (kept here so conversion + creation share one import site).
export { offlineCreateDiagram };
