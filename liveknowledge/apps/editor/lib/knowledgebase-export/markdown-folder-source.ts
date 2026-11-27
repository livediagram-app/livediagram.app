// The editor's pages, writing and pictures for a Markdown Folder export (docs/specs/020-import-export/
// knowledgebase-export.md "Who sees what", "How it is built"). A synced knowledgebase's tree is the api's `GET pages`
// (only the pages the caller may read, each owner named); an Offline one's is this editor's own list. A page this
// editor already holds is written from what it holds; any other is read as saved, with the caller's credentials.
import { isKnowledgePageRow, type KnowledgePagesResponse } from '@liveknowledge/api-schema';
import { isConnectedRow, type Tab } from '@liveknowledge/document';
import { apiKnowledgePages } from '@/lib/api/knowledge';
import { apiReadSavedTab } from '@/lib/api/tabs';
import { apiFetchImageBlob } from '@/lib/api/images';
import type { FolderPage, FolderPicture, MarkdownFolderSource } from './markdown-folder';

export type MarkdownFolderContext = {
  documentId: string;
  ownerId: string;
  shareCode: string | null;
  /** Kept only in this browser: no api to ask. */
  offline: boolean;
  /** The editor's pages, in tree order. */
  tabs: readonly Tab[];
  /** The pages whose writing this editor holds. */
  loaded: ReadonlySet<string>;
};

/** Whether a session is offered the Markdown Folder ("Where it is offered"): every role that reads the whole
 *  knowledgebase (an Editor, a Participant, a Viewer); never a link confined to one page (`tabScope` set), nor an
 *  early open that has no reader yet (`'self'`). */
export function offersMarkdownFolder(session: {
  documentId: string | null;
  ownerId: string;
  tabScope: string | null;
}): boolean {
  return !!session.documentId && session.ownerId !== 'self' && session.tabScope === null;
}

// An Offline picture's id is its own bytes: only a base64 raster is taken.
const DATA_PICTURE = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=]+)$/;

/** A `data:` picture's bytes, or null when it is no base64 raster. */
export function dataPicture(imageId: string): FolderPicture | null {
  const match = DATA_PICTURE.exec(imageId);
  if (!match) return null;
  const binary = atob(match[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, type: match[1]! };
}

/** The api's tree as the export's pages: connected files left out, each owner by name. */
export function folderPagesOf(listed: KnowledgePagesResponse): FolderPage[] {
  const names = listed.names ?? {};
  return listed.pages.filter(isKnowledgePageRow).map((row) => {
    const owner = row.owner ? names[row.owner] : undefined;
    return {
      id: row.tab,
      title: row.title,
      ...(row.parent ? { parent: row.parent } : {}),
      facts: {
        ...(owner ? { owner } : {}),
        ...(row.updatedAt !== undefined ? { updated: row.updatedAt } : {}),
        ...(row.trust.verifiedAt !== undefined ? { verified: row.trust.verifiedAt } : {}),
        ...(row.labels?.length ? { labels: row.labels } : {}),
      },
    };
  });
}

/** This editor's list as the export's pages, for an Offline knowledgebase (no names or saved times to say). */
export function offlinePagesOf(tabs: readonly Tab[]): FolderPage[] {
  return tabs
    .filter((t) => !isConnectedRow(t))
    .map((t) => ({
      id: t.id,
      title: t.name,
      ...(t.parent ? { parent: t.parent } : {}),
      ...(t.knowledge?.verifiedAt !== undefined
        ? { facts: { verified: t.knowledge.verifiedAt } }
        : {}),
    }));
}

/** The source the export reads: the tree read once now, each page and picture when the export asks. */
export async function markdownFolderSource(
  context: MarkdownFolderContext,
  signal?: AbortSignal,
): Promise<MarkdownFolderSource> {
  const { documentId, ownerId, shareCode } = context;
  const pages = context.offline
    ? offlinePagesOf(context.tabs)
    : folderPagesOf(await apiKnowledgePages({ ownerId, shareCode }, documentId, signal));
  const held = new Map(context.tabs.filter((t) => context.loaded.has(t.id)).map((t) => [t.id, t]));
  return {
    documentId,
    pages,
    readPage: async (id) =>
      held.get(id) ?? (await apiReadSavedTab(ownerId, documentId, id, shareCode, signal)),
    readPicture: async (imageId) => {
      if (imageId.startsWith('data:')) return dataPicture(imageId);
      const blob = await apiFetchImageBlob(ownerId, imageId, { documentId, shareCode });
      return blob ? { bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type } : null;
    },
  };
}
