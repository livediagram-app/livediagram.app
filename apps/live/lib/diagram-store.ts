// Thin re-export layer kept for backwards compatibility with existing
// import sites. Everything lives in `api-client.ts` now — the live app
// no longer uses localStorage for diagram persistence. The post-Clerk
// auth phase will replace `X-Owner-Id` with a real auth token but the
// surface stays the same.

export {
  apiAppendChangeLogEntry,
  apiCreateDiagram,
  apiCreateFolder,
  apiCreateShareLink as createShareLink,
  apiDeleteChangeLogEntry,
  apiDeleteChangeLogForTab,
  apiDeleteDiagram as deleteDiagram,
  apiDeleteFolder,
  apiDeleteShareLink as deleteShareLink,
  apiDeleteTab,
  apiListChangeLog,
  apiListDiagrams as listDiagrams,
  apiListFolders,
  apiListShareLinks as listShareLinks,
  apiLoadDiagram as loadDiagram,
  apiLoadSelf as loadSelfParticipant,
  apiLoadShared as loadSharedDiagram,
  apiLoadTab,
  apiSaveDiagramMeta,
  apiSaveSelf as saveSelfParticipant,
  apiSaveTab,
  apiSetDiagramFolder,
  apiShareDiagram as shareDiagram,
  apiUnshareDiagram as unshareDiagram,
  apiUpdateFolder,
  connectRoom,
} from './api-client';
export type {
  ChangeLogEntry,
  ChangeLogKind,
  DiagramSummary,
  Folder,
  RoomHandlers,
  RoomIncoming,
  RoomOutgoing,
  ShareLink,
  ShareRole,
  SharedDiagramResolution,
  StoredDiagram,
  TabSummary,
} from './api-client';
