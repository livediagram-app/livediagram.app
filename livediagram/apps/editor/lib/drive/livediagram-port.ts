// What the Drive mirror needs from livediagram itself
// (docs/specs/022-drive-mirror/blueprints/drive-mirror.md, "LivediagramPort"):
// My Work reads, the ordinary writes an inbound change goes through
// (so authorisation, the Timeline and realtime rooms behave exactly as if
// the user had done it here), and the mirror's own rows. My Work's canvases,
// folders and Trash are the liveworkspace index's, read and written as the
// person (lib/index-client.ts); a canvas's content is the api's, and the
// mirror's rows stay at /api/drive. The engine only ever sees this interface;
// tests give it an in-memory livediagram.

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
import { LIST_LIMIT_MAX, type Page } from '@liveworkspace/index-client';
import {
  ApiError,
  API_BASE,
  apiAcquireDriveLease,
  apiCreateDocument,
  apiDeleteDriveItem,
  apiGetDriveConnection,
  apiListDriveItems,
  apiLoadDocument,
  apiLoadTab,
  apiPutDriveConnection,
  apiPutDriveItems,
  apiReleaseDriveLease,
  apiSaveDocumentMeta,
} from '../api-client';
import { apiFetch, apiHeaders } from '../api/core';
import { indexClient } from '../index-client';

// The most index pages a My Work list reads (LIST_LIMIT_MAX each). The mirror takes a canvas or folder missing from
// a list as gone and removes its Drive file, so a list that would be cut short throws instead: the pass stops and
// the next one tries again.
export const MIRROR_LIST_PAGES_MAX = 100;

// Every page of an index list, or a throw when there are more than the mirror may read.
export async function everyPage<T, K extends string>(
  read: (cursor: string | undefined) => Promise<Page<T, K>>,
  key: K,
): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MIRROR_LIST_PAGES_MAX; page++) {
    const answer = await read(cursor);
    out.push(...(answer[key] as T[]));
    if (!answer.nextCursor) return out;
    cursor = answer.nextCursor;
  }
  throw new Error('My Work is too large to mirror in one pass');
}

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
  // My Work: live cloud documents (never team, shared or offline ones).
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
  // A new document in My Work from an envelope; returns its id. `target`
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
    // My Work: the person's own live canvases, never a team's, a link's or this browser's offline ones (the index
    // never sees those). `savedAt` is the item's last content or title change.
    async listPersonalDocuments() {
      const items = await everyPage(
        (cursor) =>
          indexClient.listItems({
            app: 'livediagram',
            team: 'personal',
            limit: LIST_LIMIT_MAX,
            ...(cursor ? { cursor } : {}),
          }),
        'items',
      );
      return items
        .filter((i) => i.teamId === null && i.trashedAt === null && i.sharedVia === null)
        .map((i) => ({
          id: i.id,
          name: i.title,
          folderId: i.folderId,
          savedAt: i.updatedAt,
          createdAt: i.createdAt,
        }));
    },
    async listPersonalFolders() {
      const folders = await everyPage(
        (cursor) =>
          indexClient.listFolders({
            team: 'personal',
            limit: LIST_LIMIT_MAX,
            ...(cursor ? { cursor } : {}),
          }),
        'folders',
      );
      return folders
        .filter((f) => f.teamId === null)
        .map((f) => ({ id: f.id, name: f.name, parentId: f.parentId, updatedAt: f.updatedAt }));
    },
    async listPersonalTrash() {
      const items = await everyPage(
        (cursor) =>
          indexClient.listTrash({
            app: 'livediagram',
            team: 'personal',
            limit: LIST_LIMIT_MAX,
            ...(cursor ? { cursor } : {}),
          }),
        'items',
      );
      return items
        .filter((i) => i.teamId === null && i.trashedAt !== null)
        .map((i) => ({ id: i.id, name: i.title, trashedAt: i.trashedAt! }));
    },
    async loadEnvelope(id) {
      const liveDoc = await apiLoadDocument(ownerId, id);
      if (!liveDoc) return null;
      // The list's `savedAt` is the index item's last change, which a rename at the index moves without a save
      // here. The upload is stamped with the later of the two, so the next pass sees it mirrored rather than
      // uploading it again and again (plan-outbound.ts compares the two).
      // Unread (the index not answering), the canvas's own save stands.
      const item = await indexClient.getItem(id).then(
        (r) => r.item,
        () => null,
      );
      const savedAt = Math.max(liveDoc.savedAt, item?.updatedAt ?? 0);
      const tabs: EnvelopeTab[] = [];
      for (const summary of liveDoc.tabs) {
        const tab = await apiLoadTab(ownerId, id, summary.id, null);
        if (!tab) continue;
        const { folder: _bodyFolder, ...body } = tab as Tab & { folder?: string };
        void _bodyFolder;
        tabs.push(summary.folder ? { ...body, folder: summary.folder } : body);
      }
      return {
        text: documentToEnvelopeText(
          { id: liveDoc.id, name: liveDoc.name, presentation: liveDoc.presentation },
          tabs,
          savedAt,
        ),
        savedAt,
      };
    },
    async loadSnapshotSvg(id) {
      // liveworkspace's preview of it (liveworkspace/docs/previews.md), through this app's router.
      const res = await apiFetch(`${API_BASE}/previews/items/${encodeURIComponent(id)}`, {
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
    moveDocument: async (id, folderId) => {
      await indexClient.updateItem(id, { folderId });
    },
    trashDocument: (id) => indexClient.deleteItem(id),
    restoreDocument: async (id) => {
      await indexClient.restoreItem(id);
    },
    purgeDocument: (id) => indexClient.deleteItem(id, { permanent: true }),
    createFolder: async (id, name, parentId) => {
      await indexClient.createFolder({ id, name, parentId, teamId: null });
    },
    renameFolder: async (id, name) => {
      await indexClient.updateFolder(id, { name });
    },
    moveFolder: async (id, parentId) => {
      await indexClient.updateFolder(id, { parentId });
    },
    deleteFolder: (id) => indexClient.deleteFolder(id),
    async importDocumentCopy(envelope, target) {
      const id = target?.id ?? crypto.randomUUID();
      const { tabs, presentation } = copyEnvelope(envelope);
      await apiCreateDocument(ownerId, {
        id,
        name: target?.name ?? envelope.document.name,
        tabs,
        presentation,
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
