// A knowledgebase's sources in other apps on the wire (docs/specs/030-knowledgebase/search-and-ask.md "Sources",
// liveworkspace/docs/specs/004-index/knowledge-sources.md): what AI Settings shows and changes, what a source's
// citation carries, and an Unanswered question's likely item. Ids, names and places only: never another app's key.

/** The apps a knowledgebase reads (`KNOWLEDGE_SOURCE_APPS`, @liveworkspace/index-client), as the wire names them. */
export type KnowledgeSourceAppName =
  'livediagram' | 'liveplanner' | 'livedocuments' | 'livedesign' | 'livehuddle';

/** Where in the item a citation opens (`KnowledgePlace`). */
export type KnowledgeSourcePlace = { tabId?: string; elementIds?: string[]; cardId?: string };

/** How far a source has been read: `read` (its chunks are searched), `waiting` (owed a read), `capped` (past the
 *  knowledgebase's source cap, not read) or `failed` (its app did not answer; tried again later). */
export type KnowledgeSourceState = 'read' | 'waiting' | 'capped' | 'failed';

export type KnowledgeSourceRow = {
  itemId: string;
  app: KnowledgeSourceAppName;
  title: string;
  origin: 'connected' | 'folder';
  state: KnowledgeSourceState;
  chunks: number;
  /** When its text was last read (epoch ms); absent until it is. */
  readAt?: number;
};

/** `GET .../ai/sources`: the choices and the sources they make. `folderName` is the folder's name as the Editor chose
 *  it (null with no folder); `teamId` the knowledgebase's team (only a team's is offered a folder, of that team). */
export type KnowledgeSources = {
  connected: boolean;
  folderId: string | null;
  folderName: string | null;
  teamId: string | null;
  items: KnowledgeSourceRow[];
};

/** `PUT .../ai/sources`, an Editor's: either or both. `folderId` null turns the folder off. */
export type KnowledgeSourcesChange = {
  connected?: boolean;
  folderId?: string | null;
  folderName?: string | null;
};

/** What a cited source chunk carries beside the passage: the item, its app, the place and when it was read. The
 *  editor makes the link from them (the app's address, the place's deep link and the question). */
export type AskSourceItem = {
  app: KnowledgeSourceAppName;
  itemId: string;
  itemName: string;
  place: KnowledgeSourcePlace;
  readAt: number;
};

/** An Unanswered question's likely item (insights.md "Likely answered elsewhere"), shown only to a reader who can
 *  open it. */
export type KnowledgeLikelySource = { app: KnowledgeSourceAppName; itemId: string; title: string };

/** A source chunk as `search_pages` answers it, after the pages' passages. */
export type KnowledgeSourceHit = {
  app: KnowledgeSourceAppName;
  itemId: string;
  itemName: string;
  title: string;
  place: KnowledgeSourcePlace;
  snippet: string;
  readAt: number;
};
