// The landing page's preview of a document in This Browser (docs/specs/019-marketing/returning-visitor.md): the
// server has no snapshot of a document kept in this browser, so its first tab is drawn here, from the offline
// store, by the same headless renderer the server's snapshots use (docs/specs/006-document/
// document-snapshots.md), with the editor's icon and sticker art. Loaded on demand by the recent-diagrams
// sync (lib/api/documents.ts), off the critical path, and only for a save the cache does not already hold.
//
// Like the server's snapshot, an empty first tab has no picture (null). Unlike it, images keep their
// placeholders and Plan cards and Sheet cells are left out: a glance at the document, not an export.
import { renderElementsToSvg } from '@livediagram/document';
import {
  ensureIconCatalogs,
  resolveIconArtLoaded,
  resolveStickerArtLoaded,
} from '@/lib/icon-registry';
import { offlineLoadDocument, offlineLoadTab } from '@/lib/offline/offline-store';

export async function localSnapshotSvg(documentId: string): Promise<string | null> {
  const doc = await offlineLoadDocument(documentId);
  const first = doc?.tabs[0];
  if (!first) return null;
  const tab = await offlineLoadTab(documentId, first.id);
  if (!tab || tab.elements.length === 0) return null;
  // Icons and stickers draw from their catalogues; without them (offline, a failed load) they draw as
  // nothing, which still leaves a useful picture.
  await ensureIconCatalogs().catch(() => undefined);
  return renderElementsToSvg(tab, {
    resolveIconArt: resolveIconArtLoaded,
    resolveStickerArt: resolveStickerArtLoaded,
  });
}
