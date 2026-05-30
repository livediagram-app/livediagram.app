// Thin re-export layer kept for backwards compatibility with existing
// import sites. Everything lives in `api-client.ts` now — the live app
// no longer uses localStorage for diagram persistence. The post-Clerk
// auth phase will replace `X-Owner-Id` with a real auth token but the
// surface stays the same.

export {
  apiAppendChangeLogEntry,
  apiCreateShareLink as createShareLink,
  apiDeleteChangeLogForTab,
  apiDeleteDiagram as deleteDiagram,
  apiDeleteShareLink as deleteShareLink,
  apiListChangeLog,
  apiListDiagrams as listDiagrams,
  apiListShareLinks as listShareLinks,
  apiLoadDiagram as loadDiagram,
  apiLoadSelf as loadSelfParticipant,
  apiLoadShared as loadSharedDiagram,
  apiSaveDiagram as saveDiagram,
  apiSaveSelf as saveSelfParticipant,
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
} from './api-client';
