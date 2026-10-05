// What the Drive mirror needs from livediagram itself
// (docs/specs/022-drive-mirror/blueprints/drive-mirror.md, "LivediagramPort"):
// My documents reads, the ordinary writes an inbound change goes through
// (so authorisation, the change log and realtime rooms behave exactly as if
// the user had done it here), and the mirror's own rows. The engine only ever
// sees this interface; tests give it an in-memory livediagram.

import { storeAsCreates } from '@livediagram/items';
import { fetchItems } from '../api/items';
import {
  creationIntentOf,
  type DriveConnection,
  type DriveItem,
  type DriveItemKind,
  type DriveLease,
} from '@livediagram/api-schema';
import {
  remapTabLinks,
  type StoredPresentation,
  type Tab,
  documentToEnvelopeText,
  type DocumentEnvelope,
  type EnvelopeTab,
} from '@livediagram/document';
import {
  ApiError,
  API_BASE,
  apiAcquireDriveLease,
  apiCreateDocument,
  apiCreateFolder,
  apiDeleteDocument,
  apiDeleteDriveItem,
  apiDeleteFolder,
  apiGetDriveConnection,
  apiListDriveItems,
  apiListFolders,
  apiListTrash,
  apiLoadDocument,
  apiLoadTab,
  apiPurgeDocument,
  apiPutDriveConnection,
  apiPutDriveItems,
  apiReleaseDriveLease,
  apiRestoreDocument,
  apiSaveDocumentMeta,
  apiSetDocumentFolder,
  apiUpdateFolder,
} from '../api-client';
import { apiFetch, apiHeaders, expectOk } from '../api/core';
import type { DocumentListResponse } from '@livediagram/api-schema';

export type MirrorDocument = {
  id: string;
  name: string;
  folderId: string | null;
  savedAt: number;
  createdAt: number;
};

export type CopyTarget = { id: string; name: string; folderId: string | null };

export type MirrorFolder = { id: string; name: string; parentId: string | null; updatedAt: number };

export type MirrorTrashed = { id: string; name: string; trashedAt: number };

export interface LivediagramPort {
  // My documents: live cloud documents (never team, shared or offline ones).
  listPersonalDocuments(): Promise<MirrorDocument[]>;
  listPersonalFolders(): Promise<MirrorFolder[]>;
  listPersonalTrash(): Promise<MirrorTrashed[]>;
  // The `.livediagram` contents, `exportedAt` pinned to the document's
  // savedAt so unchanged content is byte-identical. Null when it is gone.
  loadEnvelope(id: string): Promise<{ text: string; savedAt: number } | null>;
  // The document's cached SVG snapshot, or null (empty document, no R2).
  loadSnapshotSvg(id: string): Promise<string | null>;
  canOpenDocument(id: string): Promise<boolean>;

  renameDocument(id: string, name: string): Promise<void>;
  moveDocument(id: string, folderId: string | null): Promise<void>;
  trashDocument(id: string): Promise<void>;
  restoreDocument(id: string): Promise<void>;
  purgeDocument(id: string): Promise<void>;
  createFolder(id: string, name: string, parentId: string | null): Promise<void>;
  renameFolder(id: string, name: string): Promise<void>;
  moveFolder(id: string, parentId: string | null): Promise<void>;
  deleteFolder(id: string): Promise<void>;
  // A new document in My documents from an envelope; returns its id. `target`
  // pins the id, name and folder (a copy opened with livediagram).
  importDocumentCopy(envelope: DocumentEnvelope, target?: CopyTarget): Promise<string>;

  getConnection(): Promise<DriveConnection | null>;
  putConnection(patch: {
    rootFolderId?: string | null;
    pageToken?: string;
  }): Promise<DriveConnection>;
  listItems(): Promise<DriveItem[]>;
  putItems(items: DriveItem[]): Promise<void>;
  deleteItem(kind: DriveItemKind, ldId: string): Promise<void>;
  acquireLease(holder: string): Promise<DriveLease>;
  releaseLease(holder: string): Promise<void>;
}

// A copied document gets fresh tab ids; tab links and the deck's slides
// follow them, so the copy navigates and presents like the original.
export function copyEnvelope(envelope: DocumentEnvelope): {
  tabs: EnvelopeTab[];
  presentation: string | null;
} {
  const idMap = new Map(envelope.document.tabs.map((t) => [t.id, crypto.randomUUID()] as const));
  const tabs = envelope.document.tabs.map((t) => ({
    ...t,
    id: idMap.get(t.id)!,
    elements: remapTabLinks(t.elements, idMap),
  }));
  let presentation = envelope.document.presentation;
  if (presentation) {
    try {
      const deck = JSON.parse(presentation) as StoredPresentation;
      for (const d of deck.decks ?? []) {
        for (const slide of d.slides ?? []) slide.tabId = idMap.get(slide.tabId) ?? slide.tabId;
      }
      presentation = JSON.stringify(deck);
    } catch {
      // An unreadable deck is dropped rather than carried broken.
      presentation = null;
    }
  }
  return { tabs, presentation };
}

// The production port, over lib/api.
export function createApiLivediagramPort(ownerId: string): LivediagramPort {
  return {
    async listPersonalDocuments() {
      // The raw cloud list: apiListDocuments merges this browser's offline
      // documents in, and those are never mirrored.
      const res = await apiFetch(`${API_BASE}/documents`, { headers: await apiHeaders(ownerId) });
      const { documents: liveDocs } = await expectOk<DocumentListResponse>(res, 'list');
      return liveDocs
        .filter((d) => d.teamId === null)
        .map((d) => ({
          id: d.id,
          name: d.name,
          folderId: d.folderId,
          savedAt: d.savedAt,
          createdAt: d.createdAt,
        }));
    },
    async listPersonalFolders() {
      return (await apiListFolders(ownerId))
        .filter((f) => f.teamId === null)
        .map((f) => ({ id: f.id, name: f.name, parentId: f.parentId, updatedAt: f.updatedAt }));
    },
    async listPersonalTrash() {
      const { cloud } = await apiListTrash(ownerId);
      if (!cloud) throw new Error('trash unavailable');
      return cloud
        .filter((t) => t.teamId === null)
        .map((t) => ({ id: t.id, name: t.name, trashedAt: t.trashedAt }));
    },
    async loadEnvelope(id) {
      const liveDoc = await apiLoadDocument(ownerId, id);
      if (!liveDoc) return null;
      const tabs: EnvelopeTab[] = [];
      for (const summary of liveDoc.tabs) {
        const tab = await apiLoadTab(ownerId, id, summary.id, null);
        if (!tab) continue;
        const { folder: _bodyFolder, ...body } = tab as Tab & { folder?: string };
        void _bodyFolder;
        tabs.push(summary.folder ? { ...body, folder: summary.folder } : body);
      }
      const itemStore = await fetchItems({ ownerId, documentId: id, shareCode: null, tabId: null });
      return {
        text: documentToEnvelopeText(
          { id: liveDoc.id, name: liveDoc.name, presentation: liveDoc.presentation },
          tabs,
          liveDoc.savedAt,
          itemStore.items,
        ),
        savedAt: liveDoc.savedAt,
      };
    },
    async loadSnapshotSvg(id) {
      const res = await apiFetch(`${API_BASE}/documents/${encodeURIComponent(id)}/thumbnail`, {
        headers: await apiHeaders(ownerId),
      });
      return res.ok ? res.text() : null;
    },
    async canOpenDocument(id) {
      try {
        return (await apiLoadDocument(ownerId, id)) !== null;
      } catch (err) {
        if (err instanceof ApiError && [403, 404, 410].includes(err.status)) return false;
        throw err;
      }
    },
    renameDocument: (id, name) => apiSaveDocumentMeta(ownerId, { id, name }),
    moveDocument: (id, folderId) => apiSetDocumentFolder(ownerId, id, folderId, null),
    trashDocument: (id) => apiDeleteDocument(ownerId, id),
    restoreDocument: async (id) => {
      await apiRestoreDocument(ownerId, id);
    },
    purgeDocument: (id) => apiPurgeDocument(ownerId, id),
    createFolder: async (id, name, parentId) => {
      await apiCreateFolder(ownerId, { id, name, parentId, teamId: null });
    },
    renameFolder: async (id, name) => {
      await apiUpdateFolder(ownerId, id, { name });
    },
    moveFolder: async (id, parentId) => {
      await apiUpdateFolder(ownerId, id, { parentId });
    },
    deleteFolder: (id) => apiDeleteFolder(ownerId, id),
    async importDocumentCopy(envelope, target) {
      const id = target?.id ?? crypto.randomUUID();
      const { tabs, presentation } = copyEnvelope(envelope);
      await apiCreateDocument(ownerId, {
        id,
        name: target?.name ?? envelope.document.name,
        tabs,
        presentation,
        items: storeAsCreates(envelope.document.items ?? []),
        // Import a copy is an import (docs/specs/013-workspace/default-folders.md): no place chosen
        // and its intent, so it lands in the person's default folder. A copy the mirror placed keeps
        // the mirror's place, chosen explicitly (its root included), and is never routed.
        ...(target ? { folderId: target.folderId ?? null } : { intent: creationIntentOf(tabs[0]) }),
      });
      // Per-document tab folders ride the meta write, not the tab bodies.
      if (tabs.some((t) => t.folder)) {
        await apiSaveDocumentMeta(ownerId, {
          id,
          tabs: tabs.map((t) => (t.folder ? { id: t.id, folder: t.folder } : { id: t.id })),
        });
      }
      return id;
    },
    getConnection: () => apiGetDriveConnection(ownerId),
    putConnection: (patch) => apiPutDriveConnection(ownerId, patch),
    listItems: () => apiListDriveItems(ownerId),
    putItems: (items) => apiPutDriveItems(ownerId, items),
    deleteItem: (kind, ldId) => apiDeleteDriveItem(ownerId, kind, ldId),
    acquireLease: (holder) => apiAcquireDriveLease(ownerId, holder),
    releaseLease: (holder) => apiReleaseDriveLease(ownerId, holder),
  };
}
