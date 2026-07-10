// Offline Mode conversions (spec/76): move a diagram between the browser-only
// IndexedDB store and the cloud API, in both directions.
//
// Ordering is chosen so a failure never loses the diagram: the destination is
// written before the source is removed. Taking a cloud diagram offline is
// destructive on the server (the whole point — it must leave the account and
// every other device), so the UI gates it behind a confirmation.

import { apiCreateDiagram, apiLoadDiagram, apiLoadTab } from '@/lib/api-client';
import { API_BASE, ApiError, apiDelete } from '@/lib/api/core';
import { embedTabImages, isDataImageId, uploadEmbeddedImages } from './offline-images';
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
  // Re-home embedded data-URI images to R2 first (spec/19 + /76): the cloud
  // copy gets real gallery images instead of bloated tab JSON. Best-effort
  // per image; a kept data URI still renders.
  const tabs = await uploadEmbeddedImages(ownerId, rec.tabs);
  await apiCreateDiagram(ownerId, { id: rec.id, name: rec.name, tabs });
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
  const fetchedTabs = (
    await Promise.all(
      diagram.tabs.map((s) => apiLoadTab(ownerId, diagramId, s.id, shareCode).catch(() => null)),
    )
  ).filter((t): t is NonNullable<typeof t> => t !== null);
  // Embed referenced R2 images as data URIs BEFORE the server delete below:
  // once the diagram row is gone, its images count as unused and the api's
  // 30-day retention reaper would delete the bytes the offline diagram still
  // points at (spec/19 + /76).
  const tabs = await embedTabImages(fetchedTabs, { ownerId, diagramId, shareCode });
  // Embedding is best-effort per image, but the DELETE below is not: if any
  // image failed to embed, aborting here keeps the server copy (and its
  // images) alive instead of quietly signing the stragglers up for the
  // 30-day reaper. The caller surfaces the failure; the user can retry.
  const unembedded = tabs.some((t) =>
    t.elements.some((el) => el.type === 'image' && el.imageId && !isDataImageId(el.imageId)),
  );
  if (unembedded) throw new Error('image embed incomplete');

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
  try {
    await apiDelete(`${API_BASE}/diagrams/${diagramId}`, ownerId, { action: 'take offline' });
  } catch (e) {
    // The server copy survived, so ROLL BACK the local copy: leaving both
    // registered under one id would shadow the live cloud diagram behind a
    // stale offline fork (and duplicate the Explorer row). Data-safe: the
    // server still holds everything.
    await offlineDeleteDiagram(rec.id).catch(() => {});
    throw e;
  }
}

// Toast copy for a failed Sync Diagram, shared by the Explorer menus (via
// useOfflineConversion) and the Share dialog's offline gate. A 413 is the
// hard per-tab size cap (usually a large embedded image whose gallery
// upload failed, leaving the data URI in the tab JSON): retrying won't
// help, so it must not read as a connection problem.
export function syncFailureMessage(e: unknown): string {
  return e instanceof ApiError && e.status === 413
    ? 'This diagram is too large to sync: a tab exceeds the server size limit, usually a big embedded image. Remove or shrink it and try again.'
    : 'Could not sync this diagram. Check your connection and try again.';
}

// Re-exported for callers that only need to create an offline diagram from
// scratch (kept here so conversion + creation share one import site).
export { offlineCreateDiagram };
