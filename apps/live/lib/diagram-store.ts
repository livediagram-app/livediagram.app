// Thin re-export layer kept for backwards compatibility with existing
// import sites. Everything lives in `api-client.ts` now — the live app
// no longer uses localStorage for diagram persistence. The post-Clerk
// auth phase will replace `X-Owner-Id` with a real auth token but the
// surface stays the same.

export {
  apiAppendChangeLogEntry,
  apiCreateDiagram,
  apiCreateShareLink as createShareLink,
  apiDeleteChangeLogEntry,
  apiDeleteChangeLogForTab,
  apiDeleteDiagram as deleteDiagram,
  apiDeleteShareLink as deleteShareLink,
  apiDeleteTab,
  apiListChangeLog,
  apiListDiagrams as listDiagrams,
  apiListShareLinks as listShareLinks,
  apiLoadDiagram as loadDiagram,
  apiLoadSelf as loadSelfParticipant,
  apiLoadShared as loadSharedDiagram,
  apiLoadTab,
  apiSaveDiagramMeta,
  apiSaveSelf as saveSelfParticipant,
  apiSaveTab,
  apiShareDiagram as shareDiagram,
  apiUnshareDiagram as unshareDiagram,
  connectRoom,
} from './api-client';
export type {
  ChangeLogEntry,
  ChangeLogKind,
  DiagramSummary,
  RoomHandlers,
  RoomIncoming,
  RoomOutgoing,
  ShareLink,
  ShareRole,
  SharedDiagramResolution,
  StoredDiagram,
  TabSummary,
} from './api-client';
