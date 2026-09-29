// What the Drive mirror needs from livediagram itself
// (docs/specs/022-drive-mirror/blueprints/drive-mirror.md, "LivediagramPort"):
// Personal Space reads, the ordinary writes an inbound change goes through
// (so authorisation, the change log and realtime rooms behave exactly as if
// the user had done it here), and the mirror's own rows. The engine only ever
// sees this interface; tests give it an in-memory livediagram.

import type {
  DriveConnection,
  DriveItem,
  DriveItemKind,
  DriveLease,
} from '@livediagram/api-schema';
import { remapTabLinks, type StoredPresentation, type Tab } from '@livediagram/diagram';
import {
  ApiError,
  API_BASE,
  apiAcquireDriveLease,
  apiCreateDiagram,
  apiCreateFolder,
  apiDeleteDiagram,
  apiDeleteDriveItem,
  apiDeleteFolder,
  apiGetDriveConnection,
  apiListDriveItems,
  apiListFolders,
  apiListTrash,
  apiLoadDiagram,
  apiLoadTab,
  apiPurgeDiagram,
  apiPutDriveConnection,
  apiPutDriveItems,
  apiReleaseDriveLease,
  apiRestoreDiagram,
  apiSaveDiagramMeta,
  apiSetDiagramFolder,
  apiUpdateFolder,
} from '../api-client';
import { apiFetch, apiHeaders, expectOk } from '../api/core';
import type { DiagramListResponse } from '@livediagram/api-schema';
import {
  diagramToEnvelopeText,
  type DiagramEnvelope,
  type EnvelopeTab,
} from '../export-diagram-text';

export type MirrorDiagram = {
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
  // Personal Space: live cloud diagrams (never team, shared or offline ones).
  listPersonalDiagrams(): Promise<MirrorDiagram[]>;
  listPersonalFolders(): Promise<MirrorFolder[]>;
  listPersonalTrash(): Promise<MirrorTrashed[]>;
  // The `.livediagram` contents, `exportedAt` pinned to the diagram's
  // savedAt so unchanged content is byte-identical. Null when it is gone.
  loadEnvelope(id: string): Promise<{ text: string; savedAt: number } | null>;
  // The diagram's cached SVG snapshot, or null (empty diagram, no R2).
  loadSnapshotSvg(id: string): Promise<string | null>;
  canOpenDiagram(id: string): Promise<boolean>;

  renameDiagram(id: string, name: string): Promise<void>;
  moveDiagram(id: string, folderId: string | null): Promise<void>;
  trashDiagram(id: string): Promise<void>;
  restoreDiagram(id: string): Promise<void>;
  purgeDiagram(id: string): Promise<void>;
  createFolder(id: string, name: string, parentId: string | null): Promise<void>;
  renameFolder(id: string, name: string): Promise<void>;
  moveFolder(id: string, parentId: string | null): Promise<void>;
  deleteFolder(id: string): Promise<void>;
  // A new Personal Space diagram from an envelope; returns its id. `target`
  // pins the id, name and folder (a copy opened with livediagram).
  importDiagramCopy(envelope: DiagramEnvelope, target?: CopyTarget): Promise<string>;

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

// A copied diagram gets fresh tab ids; tab links and the deck's slides
// follow them, so the copy navigates and presents like the original.
export function copyEnvelope(envelope: DiagramEnvelope): {
  tabs: EnvelopeTab[];
  presentation: string | null;
} {
  const idMap = new Map(envelope.diagram.tabs.map((t) => [t.id, crypto.randomUUID()] as const));
  const tabs = envelope.diagram.tabs.map((t) => ({
    ...t,
    id: idMap.get(t.id)!,
    elements: remapTabLinks(t.elements, idMap),
  }));
  let presentation = envelope.diagram.presentation;
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
    async listPersonalDiagrams() {
      // The raw cloud list: apiListDiagrams merges this browser's offline
      // diagrams in, and those are never mirrored.
      const res = await apiFetch(`${API_BASE}/diagrams`, { headers: await apiHeaders(ownerId) });
      const { diagrams } = await expectOk<DiagramListResponse>(res, 'list');
      return diagrams
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
      const diagram = await apiLoadDiagram(ownerId, id);
      if (!diagram) return null;
      const tabs: EnvelopeTab[] = [];
      for (const summary of diagram.tabs) {
        const tab = await apiLoadTab(ownerId, id, summary.id, null);
        if (!tab) continue;
        const { folder: _bodyFolder, ...body } = tab as Tab & { folder?: string };
        void _bodyFolder;
        tabs.push(summary.folder ? { ...body, folder: summary.folder } : body);
      }
      return {
        text: diagramToEnvelopeText(
          { id: diagram.id, name: diagram.name, presentation: diagram.presentation },
          tabs,
          diagram.savedAt,
        ),
        savedAt: diagram.savedAt,
      };
    },
    async loadSnapshotSvg(id) {
      const res = await apiFetch(`${API_BASE}/diagrams/${encodeURIComponent(id)}/thumbnail`, {
        headers: await apiHeaders(ownerId),
      });
      return res.ok ? res.text() : null;
    },
    async canOpenDiagram(id) {
      try {
        return (await apiLoadDiagram(ownerId, id)) !== null;
      } catch (err) {
        if (err instanceof ApiError && [403, 404, 410].includes(err.status)) return false;
        throw err;
      }
    },
    renameDiagram: (id, name) => apiSaveDiagramMeta(ownerId, { id, name }),
    moveDiagram: (id, folderId) => apiSetDiagramFolder(ownerId, id, folderId, null),
    trashDiagram: (id) => apiDeleteDiagram(ownerId, id),
    restoreDiagram: async (id) => {
      await apiRestoreDiagram(ownerId, id);
    },
    purgeDiagram: (id) => apiPurgeDiagram(ownerId, id),
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
    async importDiagramCopy(envelope, target) {
      const id = target?.id ?? crypto.randomUUID();
      const { tabs, presentation } = copyEnvelope(envelope);
      await apiCreateDiagram(ownerId, {
        id,
        name: target?.name ?? envelope.diagram.name,
        tabs,
        presentation,
        folderId: target?.folderId ?? null,
      });
      // Per-diagram tab folders ride the meta write, not the tab bodies.
      if (tabs.some((t) => t.folder)) {
        await apiSaveDiagramMeta(ownerId, {
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
